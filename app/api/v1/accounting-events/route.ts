import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { authenticateConnector, authorizeAccountingConnector } from "@/lib/integration-service";
import { isConnectorKey } from "@/lib/integration-contract";
import { processAccountingEvent } from "@/lib/accounting/posting-engine";

export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 256 * 1024;

export async function POST(request: Request) {
  const source = request.headers.get("x-kc-source-system")?.trim().toLowerCase() || "";
  if (!isConnectorKey(source)) return NextResponse.json({ error: "Unknown source system" }, { status: 404 });
  if (!await authenticateConnector(source, request)) return NextResponse.json({ error: "Invalid integration API key" }, { status: 401 });
  if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) return NextResponse.json({ error: "Payload must not exceed 256 KB" }, { status: 413 });
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return NextResponse.json({ error: "Payload must not exceed 256 KB" }, { status: 413 });

  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 }); }
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  const bodyKey = body && typeof body === "object" && "idempotencyKey" in body ? String(body.idempotencyKey) : "";
  if (!idempotencyKey || idempotencyKey !== bodyKey) return NextResponse.json({ error: "Idempotency-Key header must match payload" }, { status: 400 });
  if (body && typeof body === "object" && "sourceSystem" in body && String(body.sourceSystem).toLowerCase() !== source) return NextResponse.json({ error: "Source system header does not match payload" }, { status: 400 });
  const tenantId = body && typeof body === "object" && "tenantId" in body ? String(body.tenantId) : "";
  const companyId = body && typeof body === "object" && "companyId" in body ? String(body.companyId) : "";
  if (!await authorizeAccountingConnector(source, request, tenantId, companyId)) return NextResponse.json({ error: "Connector is not authorized for this tenant and company" }, { status: 403 });

  try {
    const result = await processAccountingEvent(body, `integration:${source}`);
    return NextResponse.json({ ok: true, ...result }, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: "Payload validation failed", issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) }, { status: 422 });
    const code = error instanceof Error ? error.message : "ACCOUNTING_EVENT_FAILED";
    const status = code.includes("IDEMPOTENCY") ? 409 : code.includes("SCOPE") ? 403 : 422;
    return NextResponse.json({ error: code }, { status });
  }
}
