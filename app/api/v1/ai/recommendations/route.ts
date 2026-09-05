import { NextResponse } from "next/server";
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getCompanyAccess, hasPermission } from "@/app/api/access";
import { generateAccountingRecommendations, getAccountingRecommendations } from "@/lib/ai/accounting-copilot";

export const dynamic = "force-dynamic";
const scopeSchema = z.object({ tenantId: z.string().uuid(), companyId: z.string().uuid() });

async function authorize(userEmail: string, tenantId: string, companyId: string) {
  const access = await getCompanyAccess(userEmail, tenantId, companyId);
  return access && hasPermission(access, "read") ? access : null;
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const parsed = scopeSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "AI scope ไม่ถูกต้อง", issues: parsed.error.issues }, { status: 422 });
  if (!await authorize(user.email, parsed.data.tenantId, parsed.data.companyId)) return NextResponse.json({ error: "COMPANY_ACCESS_REQUIRED" }, { status: 403 });
  return NextResponse.json({ recommendations: await getAccountingRecommendations(parsed.data) }, { headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const parsed = scopeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "AI scope ไม่ถูกต้อง", issues: parsed.error.issues }, { status: 422 });
  const access = await authorize(user.email, parsed.data.tenantId, parsed.data.companyId);
  if (!access || !hasPermission(access, "review_ai")) return NextResponse.json({ error: "AI_REVIEW_PERMISSION_REQUIRED" }, { status: 403 });
  return NextResponse.json({ recommendations: await generateAccountingRecommendations(parsed.data) });
}
