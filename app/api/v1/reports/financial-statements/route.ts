import { NextResponse } from "next/server";
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getCompanyAccess, hasPermission } from "@/app/api/access";
import { getFinancialStatements } from "@/lib/accounting/reporting";

export const dynamic = "force-dynamic";
const querySchema = z.object({ tenantId: z.string().uuid(), companyId: z.string().uuid(), periodId: z.string().uuid() });

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "ขอบเขตรายงานไม่ถูกต้อง", issues: parsed.error.issues }, { status: 422 });
  const access = await getCompanyAccess(user.email, parsed.data.tenantId, parsed.data.companyId);
  if (!access || !hasPermission(access, "read")) return NextResponse.json({ error: "COMPANY_ACCESS_REQUIRED" }, { status: 403 });
  try {
    return NextResponse.json(await getFinancialStatements(parsed.data.tenantId, parsed.data.companyId, parsed.data.periodId), { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "FINANCIAL_STATEMENT_FAILED";
    return NextResponse.json({ error: code }, { status: code.endsWith("NOT_FOUND") ? 404 : 409 });
  }
}
