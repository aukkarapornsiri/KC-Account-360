import { NextResponse } from "next/server";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { auditLogs, documents, financialRecords } from "@/db/schema";
import { getUserAccess, hasPermission } from "@/app/api/access";
import { eq } from "drizzle-orm";
import { putObject } from "@/lib/local-storage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const access = await getUserAccess(user.email);
  if (!hasPermission(access, "create")) return NextResponse.json({ error: "คุณไม่มีสิทธิ์แนบเอกสาร" }, { status: 403 });
  const form = await request.formData();
  const file = form.get("file");
  const recordId = String(form.get("recordId") || "");
  if (!(file instanceof File) || !recordId) return NextResponse.json({ error: "กรุณาเลือกไฟล์และรายการ" }, { status: 400 });
  const db = getDb();
  const [record] = await db.select({ id: financialRecords.id }).from(financialRecords).where(eq(financialRecords.id, recordId)).limit(1);
  if (!record) return NextResponse.json({ error: "ไม่พบรายการที่ต้องการแนบเอกสาร" }, { status: 404 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "ไฟล์ต้องไม่เกิน 10 MB" }, { status: 413 });
  const allowed = ["application/pdf", "image/png", "image/jpeg", "text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
  if (!allowed.includes(file.type)) return NextResponse.json({ error: "รองรับ PDF, PNG, JPG, CSV, Excel และ Word เท่านั้น" }, { status: 415 });
  const id = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const objectKey = `kc-account/${recordId}/${id}-${safeName}`;
  await putObject(objectKey, file);
  const now = new Date().toISOString();
  await db.insert(documents).values({ id, recordId, name: file.name, objectKey, contentType: file.type, size: file.size, uploadedBy: user.email, createdAt: now });
  await db.insert(auditLogs).values({ recordId, action: "UPLOAD_DOCUMENT", actorEmail: user.email, details: `Uploaded ${file.name}`, createdAt: now });
  return NextResponse.json({ ok: true, id });
}
