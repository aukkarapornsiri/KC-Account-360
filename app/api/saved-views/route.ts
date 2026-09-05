import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { auditLogs, userSavedViews } from "@/db/schema";

export const dynamic = "force-dynamic";

const moduleSchema = z.string().trim().min(1).max(40).regex(/^[a-z0-9_-]+$/i);
const saveSchema = z.object({
  action: z.literal("save"),
  module: moduleSchema,
  name: z.string().trim().min(1).max(60),
  configuration: z.object({
    statusFilter: z.string().max(80).default("ALL"),
    typeFilter: z.string().max(80).default("ALL"),
  }).strict(),
}).strict();
const deleteSchema = z.object({ action: z.literal("delete"), id: z.string().uuid() }).strict();

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const moduleResult = moduleSchema.safeParse(new URL(request.url).searchParams.get("module"));
  if (!moduleResult.success) return NextResponse.json({ error: "Module ไม่ถูกต้อง" }, { status: 422 });
  const userId = user.email.trim().toLowerCase();
  const views = await getDb().select().from(userSavedViews).where(and(eq(userSavedViews.userId, userId), eq(userSavedViews.module, moduleResult.data)));
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
  const { module, name, configuration } = parsed.data;
  await db.transaction(async (tx) => {
    await tx.insert(userSavedViews).values({ userId, module, name, configuration, visibility: "PRIVATE", updatedAt: now })
      .onConflictDoUpdate({ target: [userSavedViews.userId, userSavedViews.module, userSavedViews.name], set: { configuration, updatedAt: now } });
    await tx.insert(auditLogs).values({ recordId: `${userId}:${module}:${name}`, action: "SAVE_PERSONAL_VIEW", actorEmail: user.email, details: `Saved private view for ${module}`, createdAt: now });
  });
  const views = await db.select().from(userSavedViews).where(and(eq(userSavedViews.userId, userId), eq(userSavedViews.module, module)));
  return NextResponse.json({ ok: true, views });
}
