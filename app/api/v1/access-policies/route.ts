import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ALL_PERMISSIONS, getCompanyAccess, hasPermission } from "@/app/api/access";
import { getDb } from "@/db";
import { accessPolicies, auditEvents } from "@/db/schema";

export const dynamic = "force-dynamic";
const permissionSchema = z.enum(ALL_PERMISSIONS as [typeof ALL_PERMISSIONS[number], ...typeof ALL_PERMISSIONS]);
const scopeSchema = z.object({ tenantId: z.string().uuid(), companyId: z.string().uuid() });
const saveSchema = scopeSchema.extend({
  id: z.string().uuid().optional(),
  key: z.string().trim().min(2).max(50).regex(/^[A-Z][A-Z0-9_]*$/),
  name: z.string().trim().min(2).max(100),
  department: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).default(""),
  permissions: z.array(permissionSchema).min(1),
  modules: z.array(z.string().trim().min(2).max(30).regex(/^[A-Z_]+$/)).min(1),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
}).strict();

async function requirePolicyAdmin(email: string, tenantId: string, companyId: string) {
  const access = await getCompanyAccess(email, tenantId, companyId);
  return access && hasPermission(access, "manage_users") ? access : null;
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const parsed = scopeSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Company scope ไม่ถูกต้อง" }, { status: 422 });
  if (!await requirePolicyAdmin(user.email, parsed.data.tenantId, parsed.data.companyId)) return NextResponse.json({ error: "MANAGE_USERS_REQUIRED" }, { status: 403 });
  const policies = await getDb().select().from(accessPolicies).where(and(eq(accessPolicies.tenantId, parsed.data.tenantId), eq(accessPolicies.companyId, parsed.data.companyId))).orderBy(asc(accessPolicies.department), asc(accessPolicies.name));
  return NextResponse.json({ policies }, { headers: { "cache-control": "private, no-store" } });
}

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const parsed = saveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Policy ไม่ถูกต้อง", issues: parsed.error.issues }, { status: 422 });
  const { tenantId, companyId, id, modules, ...input } = parsed.data;
  if (!await requirePolicyAdmin(user.email, tenantId, companyId)) return NextResponse.json({ error: "MANAGE_USERS_REQUIRED" }, { status: 403 });
  if (input.key === "SYSTEM_ADMIN" && (input.status !== "ACTIVE" || !input.permissions.includes("manage_users") || !input.permissions.includes("manage_settings"))) return NextResponse.json({ error: "SYSTEM_ADMIN_MUST_REMAIN_ACTIVE_WITH_ADMIN_PERMISSIONS" }, { status: 409 });
  const db = getDb();
  const now = new Date().toISOString();
  let saved: string;
  try {
    saved = await db.transaction(async (tx) => {
    if (id) {
      const [existing] = await tx.select().from(accessPolicies).where(and(eq(accessPolicies.id, id), eq(accessPolicies.tenantId, tenantId), eq(accessPolicies.companyId, companyId))).limit(1);
      if (!existing) throw new Error("POLICY_NOT_FOUND");
      if (existing.isSystem && input.key !== existing.key) throw new Error("SYSTEM_POLICY_KEY_IMMUTABLE");
      await tx.update(accessPolicies).set({ ...input, moduleAccess: modules, updatedAt: now, version: existing.version + 1 }).where(eq(accessPolicies.id, id));
      await tx.insert(auditEvents).values({ tenantId, companyId, module: "ACCESS", entityType: "POLICY", entityId: id, action: "UPDATE", actorUserId: user.email, oldValue: { key: existing.key, permissions: existing.permissions, modules: existing.moduleAccess }, newValue: { key: input.key, permissions: input.permissions, modules } });
      return id;
    }
    const [created] = await tx.insert(accessPolicies).values({ tenantId, companyId, ...input, moduleAccess: modules, isSystem: false }).returning({ id: accessPolicies.id });
    await tx.insert(auditEvents).values({ tenantId, companyId, module: "ACCESS", entityType: "POLICY", entityId: created.id, action: "CREATE", actorUserId: user.email, newValue: { key: input.key, permissions: input.permissions, modules } });
    return created.id;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "POLICY_SAVE_FAILED";
    if (message === "POLICY_NOT_FOUND") return NextResponse.json({ error: message }, { status: 404 });
    if (message === "SYSTEM_POLICY_KEY_IMMUTABLE") return NextResponse.json({ error: message }, { status: 409 });
    if (message.includes("access_policies_company_key_uq") || message.includes("duplicate key")) return NextResponse.json({ error: "POLICY_KEY_ALREADY_EXISTS" }, { status: 409 });
    throw error;
  }
  const [policy] = await db.select().from(accessPolicies).where(eq(accessPolicies.id, saved)).limit(1);
  return NextResponse.json({ ok: true, policy });
}
