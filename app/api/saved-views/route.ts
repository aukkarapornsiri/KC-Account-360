import { and, eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { auditLogs, userSavedViews } from "@/db/schema";
import { getCompanyAccess, getUserAccess, hasPermission } from "@/app/api/access";

export const dynamic = "force-dynamic";

const moduleSchema = z.string().trim().min(1).max(40).regex(/^[a-z0-9_-]+$/i);
const saveSchema = z.object({
  action: z.literal("save"),
  module: moduleSchema,
  name: z.string().trim().min(1).max(60),
  configuration: z.object({
    statusFilter: z.string().max(80).default("ALL"),
    typeFilter: z.string().max(80).default("ALL"),
    search: z.string().max(200).default(""),
    sortBy: z.enum(["documentNo", "updatedAt", "amount", "status", "dueDate"]).default("updatedAt"),
    sortDirection: z.enum(["asc", "desc"]).default("desc"),
    pageSize: z.number().int().min(10).max(200).default(25),
    columns: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  }).strict(),
  visibility: z.enum(["PRIVATE", "SHARED", "ROLE_DEFAULT"]).default("PRIVATE"),
  companyId: z.string().uuid().nullable().default(null),
  tenantId: z.string().uuid().nullable().default(null),
  roleDefaultFor: z.enum(["Admin", "Accountant", "Approver", "Viewer"]).nullable().default(null),
}).strict();
const deleteSchema = z.object({ action: z.literal("delete"), id: z.string().uuid() }).strict();
const scopeSchema = z.object({ tenantId: z.string().uuid(), companyId: z.string().uuid() });

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const searchParams = new URL(request.url).searchParams;
  const moduleResult = moduleSchema.safeParse(searchParams.get("module"));
  if (!moduleResult.success) return NextResponse.json({ error: "Module ไม่ถูกต้อง" }, { status: 422 });
  const userId = user.email.trim().toLowerCase();
  const tenantId = searchParams.get("tenantId");
  const companyId = searchParams.get("companyId");
  let visibility = eq(userSavedViews.userId, userId);
  if (tenantId && companyId) {
    const scope = scopeSchema.safeParse({ tenantId, companyId });
    if (!scope.success) return NextResponse.json({ error: "Company scope ไม่ถูกต้อง" }, { status: 422 });
    const access = await getCompanyAccess(user.email, scope.data.tenantId, scope.data.companyId);
    if (!access || !hasPermission(access, "read")) return NextResponse.json({ error: "COMPANY_ACCESS_REQUIRED" }, { status: 403 });
    visibility = or(
      eq(userSavedViews.userId, userId),
      and(eq(userSavedViews.companyId, scope.data.companyId), eq(userSavedViews.visibility, "SHARED")),
      and(eq(userSavedViews.companyId, scope.data.companyId), eq(userSavedViews.visibility, "ROLE_DEFAULT"), eq(userSavedViews.roleDefaultFor, access.role)),
    )!;
  }
  const views = await getDb().select().from(userSavedViews).where(and(eq(userSavedViews.module, moduleResult.data), visibility));
  return NextResponse.json({ views }, { headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const payload = await request.json().catch(() => null);
  const parsed = payload?.action === "delete" ? deleteSchema.safeParse(payload) : saveSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Saved View ไม่ถูกต้อง", issues: parsed.error.issues }, { status: 422 });
  const userId = user.email.trim().toLowerCase();
  const now = new Date().toISOString();
  const db = getDb();
  if (parsed.data.action === "delete") {
    const viewId = parsed.data.id;
    await db.transaction(async (tx) => {
      await tx.delete(userSavedViews).where(and(eq(userSavedViews.id, viewId), eq(userSavedViews.userId, userId)));
      await tx.insert(auditLogs).values({ recordId: viewId, action: "DELETE_SAVED_VIEW", actorEmail: user.email, details: "Deleted personal saved view", createdAt: now });
    });
    return NextResponse.json({ ok: true });
  }
  const { module, name, configuration, visibility, companyId, tenantId, roleDefaultFor } = parsed.data;
  if (visibility !== "PRIVATE") {
    const access = companyId && tenantId ? await getCompanyAccess(user.email, tenantId, companyId) : await getUserAccess(user.email);
    if (!access || !hasPermission(access, "manage_settings")) return NextResponse.json({ error: "คุณไม่มีสิทธิ์แชร์หรือกำหนด Default View" }, { status: 403 });
  }
  await db.transaction(async (tx) => {
    await tx.insert(userSavedViews).values({ userId, companyId, module, name, configuration, visibility, roleDefaultFor, updatedAt: now })
      .onConflictDoUpdate({ target: [userSavedViews.userId, userSavedViews.module, userSavedViews.name], set: { companyId, configuration, visibility, roleDefaultFor, updatedAt: now } });
    await tx.insert(auditLogs).values({ recordId: `${userId}:${module}:${name}`, action: "SAVE_PERSONAL_VIEW", actorEmail: user.email, details: `Saved private view for ${module}`, createdAt: now });
  });
  const views = await db.select().from(userSavedViews).where(and(eq(userSavedViews.userId, userId), eq(userSavedViews.module, module)));
  return NextResponse.json({ ok: true, views });
}
