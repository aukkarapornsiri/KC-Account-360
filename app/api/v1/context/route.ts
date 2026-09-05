import { and, asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { accountingPeriods, branches, companies, tenants, userCompanyRoles, userPreferences } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const userId = user.email.trim().toLowerCase();
  const db = getDb();
  const [preference] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  const assignments = await db.select({
    tenantId: tenants.id,
    tenantCode: tenants.code,
    tenantName: tenants.name,
    companyId: companies.id,
    companyCode: companies.code,
    companyName: companies.legalName,
    baseCurrency: companies.baseCurrency,
    role: userCompanyRoles.role,
  }).from(userCompanyRoles)
    .innerJoin(tenants, eq(tenants.id, userCompanyRoles.tenantId))
    .innerJoin(companies, eq(companies.id, userCompanyRoles.companyId))
    .where(and(sql`lower(${userCompanyRoles.userId}) = ${userId}`, eq(userCompanyRoles.isActive, true), eq(tenants.status, "ACTIVE"), eq(companies.status, "ACTIVE")))
    .orderBy(asc(companies.code));
  const companyIds = [...new Set(assignments.map((assignment) => assignment.companyId))];
  const companyContexts = await Promise.all(companyIds.map(async (companyId) => {
    const assignment = assignments.find((item) => item.companyId === companyId)!;
    const [companyBranches, periods] = await Promise.all([
      db.select({ id: branches.id, code: branches.code, name: branches.name }).from(branches).where(and(eq(branches.companyId, companyId), eq(branches.status, "ACTIVE"))).orderBy(asc(branches.code)),
      db.select({ id: accountingPeriods.id, periodNo: accountingPeriods.periodNo, startsOn: accountingPeriods.startsOn, endsOn: accountingPeriods.endsOn, status: accountingPeriods.status }).from(accountingPeriods).where(and(eq(accountingPeriods.companyId, companyId), sql`${accountingPeriods.status} <> 'LOCKED'`)).orderBy(asc(accountingPeriods.startsOn)),
    ]);
    return { ...assignment, roles: assignments.filter((item) => item.companyId === companyId).map((item) => item.role), branches: companyBranches, periods };
  }));
  return NextResponse.json({
    user,
    defaultCompanyId: preference?.defaultCompanyId || companyContexts[0]?.companyId || null,
    defaultBranchId: preference?.defaultBranchId || null,
    companies: companyContexts,
  }, { headers: { "cache-control": "private, no-store" } });
}
