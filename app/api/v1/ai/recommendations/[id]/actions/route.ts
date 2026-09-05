import { NextResponse } from "next/server";
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getCompanyAccess, hasPermission } from "@/app/api/access";
import { reviewAccountingRecommendation } from "@/lib/ai/accounting-copilot";

export const dynamic = "force-dynamic";
const bodySchema = z.object({ tenantId: z.string().uuid(), companyId: z.string().uuid(), action: z.enum(["ACCEPT", "REJECT", "EDIT", "APPLY"]), reason: z.string().trim().max(500).optional(), editedAction: z.record(z.string(), z.unknown()).optional() }).strict();

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "คำสั่ง AI Review ไม่ถูกต้อง", issues: parsed.error.issues }, { status: 422 });
  const access = await getCompanyAccess(user.email, parsed.data.tenantId, parsed.data.companyId);
  if (!access || !hasPermission(access, "review_ai")) return NextResponse.json({ error: "AI_REVIEW_PERMISSION_REQUIRED" }, { status: 403 });
  const { id } = await context.params;
  try { return NextResponse.json({ ok: true, result: await reviewAccountingRecommendation(parsed.data, id, user.email, parsed.data.action, parsed.data.reason, parsed.data.editedAction) }); }
  catch (error) {
    const code = error instanceof Error ? error.message : "AI_REVIEW_FAILED";
    return NextResponse.json({ error: code }, { status: code.endsWith("NOT_FOUND") ? 404 : code.includes("REQUIRED") ? 422 : 409 });
  }
}
