import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { auditLogs, settings } from "@/db/schema";
import { getUserAccess, hasPermission } from "@/app/api/access";
import { deleteObject, getObject, putObject } from "@/lib/local-storage";

export const dynamic = "force-dynamic";
const LOGO_SETTING = "brand_logo_key";

async function currentLogoKey() {
  const [setting] = await getDb().select().from(settings).where(eq(settings.key, LOGO_SETTING)).limit(1);
  return setting?.value || "";
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const access = await getUserAccess(user.email);
  if (!hasPermission(access, "read")) return new Response("Forbidden", { status: 403 });
  const objectKey = await currentLogoKey();
  if (!objectKey) return new Response("Not found", { status: 404 });
  if (objectKey.includes("-365_")) return NextResponse.redirect(new URL("/account360-logo.png", request.url));
  const object = await getObject(objectKey);
  if (!object) return new Response("Not found", { status: 404 });
  const contentType = objectKey.toLowerCase().endsWith(".jpg") || objectKey.toLowerCase().endsWith(".jpeg") ? "image/jpeg" : "image/png";
  return new Response(object, { headers: { "content-type": contentType, "content-length": String(object.byteLength), "content-disposition": "inline", "cache-control": "private, no-store" } });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const access = await getUserAccess(user.email);
  if (!hasPermission(access, "manage_settings")) return NextResponse.json({ error: "คุณไม่มีสิทธิ์จัดการ Brand Logo" }, { status: 403 });
  const form = await request.formData(); const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "กรุณาเลือกไฟล์ Logo" }, { status: 400 });
  if (!["image/png", "image/jpeg"].includes(file.type)) return NextResponse.json({ error: "รองรับ PNG หรือ JPG เท่านั้น" }, { status: 415 });
  if (file.size > 1024 * 1024) return NextResponse.json({ error: "ไฟล์ Logo ต้องไม่เกิน 1 MB" }, { status: 413 });
  const previousKey = await currentLogoKey(); const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-"); const objectKey = `kc-account/branding/${crypto.randomUUID()}-${safeName}`;
  await putObject(objectKey, file);
  const db = getDb(); const now = new Date().toISOString();
  try {
    await db.insert(settings).values({ key: LOGO_SETTING, value: objectKey, updatedBy: user.email, updatedAt: now }).onConflictDoUpdate({ target: settings.key, set: { value: objectKey, updatedBy: user.email, updatedAt: now } });
    await db.insert(auditLogs).values({ recordId: null, action: "UPDATE_BRAND_LOGO", actorEmail: user.email, details: `Uploaded ${file.name}`, createdAt: now });
  } catch (error) { await deleteObject(objectKey); throw error; }
  if (previousKey) await deleteObject(previousKey);
  return NextResponse.json({ ok: true, key: objectKey });
}

export async function DELETE() {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const access = await getUserAccess(user.email);
  if (!hasPermission(access, "manage_settings")) return NextResponse.json({ error: "คุณไม่มีสิทธิ์จัดการ Brand Logo" }, { status: 403 });
  const previousKey = await currentLogoKey(); const db = getDb(); const now = new Date().toISOString();
  await db.insert(settings).values({ key: LOGO_SETTING, value: "", updatedBy: user.email, updatedAt: now }).onConflictDoUpdate({ target: settings.key, set: { value: "", updatedBy: user.email, updatedAt: now } });
  await db.insert(auditLogs).values({ recordId: null, action: "RESET_BRAND_LOGO", actorEmail: user.email, details: "Restored the standard Account 360 logo", createdAt: now });
  if (previousKey) await deleteObject(previousKey);
  return NextResponse.json({ ok: true });
}
