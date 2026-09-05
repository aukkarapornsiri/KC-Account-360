import { and, asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getCompanyAccess, hasPermission } from "@/app/api/access";
import { getDb } from "@/db";
import { accessPolicies, auditEvents, companyUsers, userCompanyRoles } from "@/db/schema";

export const dynamic = "force-dynamic";
const scopeSchema = z.object({ tenantId: z.string().uuid(), companyId: z.string().uuid() });
const upsertSchema = scopeSchema.extend({ action: z.literal("upsert"), email: z.string().trim().email().max(254), fullName: z.string().trim().min(2).max(150), department: z.string().trim().min(2).max(100), employeeCode: z.string().trim().max(50).nullable().default(null), policyId: z.string().uuid(), branchScope: z.array(z.string().trim().min(1).max(50)).min(1).default(["ALL"]) }).strict();
const statusSchema = scopeSchema.extend({ action: z.literal("status"), email: z.string().trim().email().max(254), status: z.enum(["ACTIVE", "SUSPENDED", "INACTIVE"]) }).strict();
const userActionSchema = z.discriminatedUnion("action", [upsertSchema, statusSchema]);

async function requireUserAdmin(email: string, tenantId: string, companyId: string) {
  const access = await getCompanyAccess(email, tenantId, companyId);
  return access && hasPermission(access, "manage_users") ? access : null;
}

export async function GET(request: Request) {
  const actor = await getChatGPTUser();
  if (!actor) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const parsed = scopeSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Company scope ไม่ถูกต้อง" }, { status: 422 });
  if (!await requireUserAdmin(actor.email, parsed.data.tenantId, parsed.data.companyId)) return NextResponse.json({ error: "MANAGE_USERS_REQUIRED" }, { status: 403 });
  const users = await getDb().select({ id: companyUsers.id, email: companyUsers.email, fullName: companyUsers.fullName, department: companyUsers.department, employeeCode: companyUsers.employeeCode, status: companyUsers.status, policyId: accessPolicies.id, policyKey: accessPolicies.key, policyName: accessPolicies.name, permissions: accessPolicies.permissions, modules: accessPolicies.moduleAccess, branchScope: userCompanyRoles.branchScope }).from(companyUsers)
    .leftJoin(userCompanyRoles, and(eq(userCompanyRoles.tenantId, companyUsers.tenantId), eq(userCompanyRoles.companyId, companyUsers.companyId), sql`lower(${userCompanyRoles.userId}) = lower(${companyUsers.email})`, eq(userCompanyRoles.isActive, true)))
    .leftJoin(accessPolicies, eq(accessPolicies.id, userCompanyRoles.accessPolicyId))
    .where(and(eq(companyUsers.tenantId, parsed.data.tenantId), eq(companyUsers.companyId, parsed.data.companyId))).orderBy(asc(companyUsers.department), asc(companyUsers.fullName));
  return NextResponse.json({ users }, { headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request) {
  const actor = await getChatGPTUser();
  if (!actor) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const payload = await request.json().catch(() => null);
  const parsed = userActionSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "ข้อมูลผู้ใช้ไม่ถูกต้อง", issues: parsed.error.issues }, { status: 422 });
  const { tenantId, companyId } = parsed.data;
  if (!await requireUserAdmin(actor.email, tenantId, companyId)) return NextResponse.json({ error: "MANAGE_USERS_REQUIRED" }, { status: 403 });
  const db = getDb();
  const email = parsed.data.email.toLowerCase();
  if (parsed.data.action === "status") {
    const statusData = parsed.data;
    if (email === actor.email.trim().toLowerCase() && statusData.status !== "ACTIVE") return NextResponse.json({ error: "CANNOT_DISABLE_CURRENT_USER" }, { status: 409 });
    try {
      await db.transaction(async (tx) => {
      const [target] = await tx.select().from(companyUsers).where(and(eq(companyUsers.tenantId, tenantId), eq(companyUsers.companyId, companyId), sql`lower(${companyUsers.email}) = ${email}`)).limit(1);
      if (!target) throw new Error("USER_NOT_FOUND");
      if (statusData.status !== "ACTIVE") {
        const administratorCount = await tx.execute(sql`select count(distinct lower(ucr.user_id))::int as count from user_company_roles ucr join access_policies ap on ap.id = ucr.access_policy_id join company_users cu on cu.company_id = ucr.company_id and lower(cu.email) = lower(ucr.user_id) where ucr.company_id = ${companyId}::uuid and ucr.is_active = true and cu.status = 'ACTIVE' and ap.status = 'ACTIVE' and ap.permissions ? 'manage_users' and lower(ucr.user_id) <> ${email}`);
        const [targetPolicy] = await tx.select({ permissions: accessPolicies.permissions }).from(userCompanyRoles).innerJoin(accessPolicies, eq(accessPolicies.id, userCompanyRoles.accessPolicyId)).where(and(eq(userCompanyRoles.tenantId, tenantId), eq(userCompanyRoles.companyId, companyId), sql`lower(${userCompanyRoles.userId}) = ${email}`, eq(userCompanyRoles.isActive, true))).limit(1);
        if (Array.isArray(targetPolicy?.permissions) && targetPolicy.permissions.includes("manage_users") && Number(administratorCount.rows[0]?.count || 0) < 1) throw new Error("LAST_USER_ADMIN_REQUIRED");
      }
      await tx.update(companyUsers).set({ status: statusData.status, updatedAt: new Date().toISOString(), version: target.version + 1 }).where(eq(companyUsers.id, target.id));
      await tx.update(userCompanyRoles).set({ isActive: statusData.status === "ACTIVE", updatedAt: new Date().toISOString() }).where(and(eq(userCompanyRoles.tenantId, tenantId), eq(userCompanyRoles.companyId, companyId), sql`lower(${userCompanyRoles.userId}) = ${email}`));
      await tx.insert(auditEvents).values({ tenantId, companyId, module: "ACCESS", entityType: "USER", entityId: target.id, action: statusData.status, actorUserId: actor.email, newValue: { email, status: statusData.status } });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "USER_STATUS_UPDATE_FAILED";
      if (message === "USER_NOT_FOUND") return NextResponse.json({ error: message }, { status: 404 });
      if (message === "LAST_USER_ADMIN_REQUIRED") return NextResponse.json({ error: message }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ ok: true });
  }
  const upsertData = parsed.data;
  const [policy] = await db.select().from(accessPolicies).where(and(eq(accessPolicies.id, upsertData.policyId), eq(accessPolicies.tenantId, tenantId), eq(accessPolicies.companyId, companyId), eq(accessPolicies.status, "ACTIVE"))).limit(1);
  if (!policy) return NextResponse.json({ error: "ACTIVE_POLICY_REQUIRED" }, { status: 422 });
  if (email === actor.email.trim().toLowerCase() && (!Array.isArray(policy.permissions) || !policy.permissions.includes("manage_users"))) return NextResponse.json({ error: "CANNOT_REMOVE_OWN_USER_ADMIN_PERMISSION" }, { status: 409 });
  await db.transaction(async (tx) => {
    const [profile] = await tx.insert(companyUsers).values({ tenantId, companyId, email, fullName: upsertData.fullName, department: upsertData.department, employeeCode: upsertData.employeeCode }).onConflictDoUpdate({ target: [companyUsers.companyId, companyUsers.email], set: { fullName: upsertData.fullName, department: upsertData.department, employeeCode: upsertData.employeeCode, status: "ACTIVE", updatedAt: new Date().toISOString(), version: sql`${companyUsers.version} + 1` } }).returning({ id: companyUsers.id });
    await tx.delete(userCompanyRoles).where(and(eq(userCompanyRoles.tenantId, tenantId), eq(userCompanyRoles.companyId, companyId), sql`lower(${userCompanyRoles.userId}) = ${email}`));
    await tx.insert(userCompanyRoles).values({ tenantId, companyId, userId: email, role: policy.key, accessPolicyId: policy.id, branchScope: upsertData.branchScope, isActive: true });
    await tx.insert(auditEvents).values({ tenantId, companyId, module: "ACCESS", entityType: "USER", entityId: profile.id, action: "UPSERT", actorUserId: actor.email, newValue: { email, department: upsertData.department, policy: policy.key, branchScope: upsertData.branchScope } });
  });
  return NextResponse.json({ ok: true });
}
