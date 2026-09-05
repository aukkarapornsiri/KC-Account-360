import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { auditLogs, userDashboardLayouts } from "@/db/schema";

export const dynamic = "force-dynamic";
const dashboardKeySchema = z.string().trim().min(1).max(80).regex(/^[a-z0-9:_-]+$/i);
const layoutItemSchema = z.object({ id: z.string().trim().min(1).max(50), visible: z.boolean(), order: z.number().int().min(0).max(100), size: z.enum(["small", "medium", "large", "full"]) }).strict();
const updateSchema = z.object({ dashboardKey: dashboardKeySchema, layout: z.array(layoutItemSchema).min(1).max(30) }).strict();

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const key = dashboardKeySchema.safeParse(new URL(request.url).searchParams.get("dashboardKey"));
  if (!key.success) return NextResponse.json({ error: "Dashboard ไม่ถูกต้อง" }, { status: 422 });
  const userId = user.email.trim().toLowerCase();
  const [stored] = await getDb().select().from(userDashboardLayouts).where(and(eq(userDashboardLayouts.userId, userId), eq(userDashboardLayouts.dashboardKey, key.data))).limit(1);
  return NextResponse.json({ layout: stored || null }, { headers: { "cache-control": "private, no-store" } });
}

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dashboard Layout ไม่ถูกต้อง", issues: parsed.error.issues }, { status: 422 });
  const userId = user.email.trim().toLowerCase();
  const now = new Date().toISOString();
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.insert(userDashboardLayouts).values({ userId, ...parsed.data, updatedAt: now }).onConflictDoUpdate({ target: [userDashboardLayouts.userId, userDashboardLayouts.dashboardKey], set: { layout: parsed.data.layout, updatedAt: now, version: sql`${userDashboardLayouts.version} + 1` } });
    await tx.insert(auditLogs).values({ recordId: `${userId}:${parsed.data.dashboardKey}`, action: "UPDATE_DASHBOARD_LAYOUT", actorEmail: user.email, details: `Updated ${parsed.data.layout.length} dashboard widgets`, createdAt: now });
  });
  return NextResponse.json({ ok: true, layout: parsed.data.layout });
}
