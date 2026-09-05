import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { auditLogs, userPreferences } from "@/db/schema";

export const dynamic = "force-dynamic";

export const defaultPreferences = {
  language: "th",
  theme: "light",
  tableDensity: "comfortable",
  sidebarMode: "expanded",
  pageWidth: "full",
  dateFormat: "DD/MM/YYYY",
  negativeNumberFormat: "parentheses",
} as const;

const updateSchema = z.object({
  language: z.enum(["th", "en", "ja", "zh"]).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  tableDensity: z.enum(["comfortable", "compact"]).optional(),
  sidebarMode: z.enum(["expanded", "collapsed", "auto"]).optional(),
  pageWidth: z.enum(["full", "contained"]).optional(),
  dateFormat: z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional(),
  negativeNumberFormat: z.enum(["parentheses", "minus"]).optional(),
  defaultCompanyId: z.string().uuid().nullable().optional(),
  defaultBranchId: z.string().uuid().nullable().optional(),
}).strict();

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const userId = user.email.trim().toLowerCase();
  const [stored] = await getDb().select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  return NextResponse.json({ preferences: stored || { userId, ...defaultPreferences } }, { headers: { "cache-control": "private, no-store" } });
}

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data).length === 0) return NextResponse.json({ error: "Preference ไม่ถูกต้อง", issues: parsed.success ? [] : parsed.error.issues }, { status: 422 });
  const userId = user.email.trim().toLowerCase();
  const now = new Date().toISOString();
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.insert(userPreferences).values({ userId, ...defaultPreferences, ...parsed.data, updatedAt: now }).onConflictDoUpdate({ target: userPreferences.userId, set: { ...parsed.data, updatedAt: now, version: sql`${userPreferences.version} + 1` } });
    await tx.insert(auditLogs).values({ recordId: userId, action: "UPDATE_USER_PREFERENCES", actorEmail: user.email, details: `Updated: ${Object.keys(parsed.data).sort().join(", ")}`, createdAt: now });
  });
  const [stored] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  return NextResponse.json({ ok: true, preferences: stored }, { headers: { "cache-control": "private, no-store" } });
}
