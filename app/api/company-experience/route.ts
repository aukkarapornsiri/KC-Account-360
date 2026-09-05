import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getCompanyAccess, hasPermission } from "@/app/api/access";
import { getDb } from "@/db";
import { auditEvents, companyExperienceSettings } from "@/db/schema";

export const dynamic = "force-dynamic";
const scopeSchema = z.object({ tenantId: z.string().uuid(), companyId: z.string().uuid() });
const updateSchema = scopeSchema.extend({
  applicationName: z.string().trim().min(1).max(100),
  themeTokens: z.record(z.string(), z.string().max(100)).default({}),
  branding: z.record(z.string(), z.unknown()).default({}),
  navigation: z.object({ hiddenItems: z.array(z.string().max(40)).max(30).default([]), pinnedItems: z.array(z.string().max(40)).max(12).default([]) }).strict(),
  documentBranding: z.object({ showLogo: z.boolean(), footerText: z.string().max(300), color: z.string().regex(/^#[0-9a-f]{6}$/i) }).strict(),
}).strict();

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const parsed = scopeSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Company scope ไม่ถูกต้อง" }, { status: 422 });
  const access = await getCompanyAccess(user.email, parsed.data.tenantId, parsed.data.companyId);
  if (!access || !hasPermission(access, "read")) return NextResponse.json({ error: "COMPANY_ACCESS_REQUIRED" }, { status: 403 });
  const [stored] = await getDb().select().from(companyExperienceSettings).where(eq(companyExperienceSettings.companyId, parsed.data.companyId)).limit(1);
  return NextResponse.json({ experience: stored || null }, { headers: { "cache-control": "private, no-store" } });
}

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Company Experience ไม่ถูกต้อง", issues: parsed.error.issues }, { status: 422 });
  const access = await getCompanyAccess(user.email, parsed.data.tenantId, parsed.data.companyId);
  if (!access || !hasPermission(access, "manage_settings")) return NextResponse.json({ error: "MANAGE_SETTINGS_REQUIRED" }, { status: 403 });
  const { tenantId, companyId, ...values } = parsed.data;
  const now = new Date().toISOString();
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.insert(companyExperienceSettings).values({ companyId, ...values, updatedBy: user.email, updatedAt: now }).onConflictDoUpdate({ target: companyExperienceSettings.companyId, set: { ...values, updatedBy: user.email, updatedAt: now, version: sql`${companyExperienceSettings.version} + 1` } });
    await tx.insert(auditEvents).values({ tenantId, companyId, module: "SETTINGS", entityType: "COMPANY_EXPERIENCE", entityId: companyId, action: "UPDATE", actorUserId: user.email, newValue: { applicationName: values.applicationName, navigation: values.navigation, documentBranding: values.documentBranding } });
  });
  return NextResponse.json({ ok: true });
}
