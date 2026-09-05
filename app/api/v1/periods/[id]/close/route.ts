import { NextResponse } from "next/server";
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getCompanyAccess, hasPermission } from "@/app/api/access";
import { completeCloseReview, getPeriodClose, lockClosedPeriod, refreshPeriodClose, startPeriodClose } from "@/lib/accounting/closing-engine";

export const dynamic = "force-dynamic";
const bodySchema = z.object({
  tenantId: z.string().uuid(),
  companyId: z.string().uuid(),
  action: z.enum(["start", "refresh", "approve", "lock"]),
  runId: z.string().uuid().optional(),
  reason: z.string().trim().max(500).optional(),
}).strict();

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const { id: periodId } = await context.params;
  const search = new URL(request.url).searchParams;
  const tenantId = search.get("tenantId") || "";
  const companyId = search.get("companyId") || "";
  const access = await getCompanyAccess(user.email, tenantId, companyId);
  if (!access || !hasPermission(access, "read")) return NextResponse.json({ error: "COMPANY_ACCESS_REQUIRED" }, { status: 403 });
  try { return NextResponse.json(await getPeriodClose({ tenantId, companyId, periodId }), { headers: { "cache-control": "private, no-store" } }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "PERIOD_CLOSE_FAILED" }, { status: 404 }); }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "คำขอปิดงวดไม่ถูกต้อง", issues: parsed.error.issues }, { status: 422 });
  const { id: periodId } = await context.params;
  const scope = { tenantId: parsed.data.tenantId, companyId: parsed.data.companyId, periodId };
  const access = await getCompanyAccess(user.email, scope.tenantId, scope.companyId);
  if (!access || !hasPermission(access, "close_period")) return NextResponse.json({ error: "CLOSE_PERIOD_PERMISSION_REQUIRED" }, { status: 403 });
  try {
    const result = parsed.data.action === "start" ? await startPeriodClose(scope, user.email)
      : parsed.data.action === "refresh" && parsed.data.runId ? await refreshPeriodClose(scope, parsed.data.runId, user.email)
      : parsed.data.action === "approve" && parsed.data.runId && hasPermission(access, "approve") ? await completeCloseReview(scope, parsed.data.runId, user.email, parsed.data.reason || "")
      : parsed.data.action === "lock" && parsed.data.runId && hasPermission(access, "approve") ? await lockClosedPeriod(scope, parsed.data.runId, user.email)
      : null;
    if (!result) return NextResponse.json({ error: "PERIOD_CLOSE_ACTION_INVALID" }, { status: 403 });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const code = error instanceof Error ? error.message : "PERIOD_CLOSE_FAILED";
    const status = code.includes("PERMISSION") || code.includes("MAKER_CHECKER") ? 403 : code.endsWith("NOT_FOUND") ? 404 : 409;
    return NextResponse.json({ error: code }, { status });
  }
}
