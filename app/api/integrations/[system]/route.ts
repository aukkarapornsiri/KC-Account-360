import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { CONNECTORS, isConnectorKey } from "@/lib/integration-contract";
import { authenticateConnector, processIntegrationEvent } from "@/lib/integration-service";

export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 256 * 1024;

export async function POST(request: Request, context: { params: Promise<{ system: string }> }) {
  const { system } = await context.params;
  if (!isConnectorKey(system)) return NextResponse.json({ error: "Unknown integration system" }, { status: 404 });
  if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) return NextResponse.json({ error: "Payload must not exceed 256 KB" }, { status: 413 });
  if (!await authenticateConnector(system, request)) {
    return NextResponse.json({ error: "Invalid integration API key" }, { status: 401 });
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload must not exceed 256 KB" }, { status: 413 });
  }
  let body: unknown;
  try { body = JSON.parse(raw); }
  catch { return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 }); }

  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  const bodyEventId = typeof body === "object" && body !== null && "event_id" in body ? String(body.event_id) : "";
  if (!idempotencyKey || idempotencyKey !== bodyEventId) {
    return NextResponse.json({ error: "Idempotency-Key header must match event_id" }, { status: 400 });
  }

  try {
    const result = await processIntegrationEvent(system, body, `api:${CONNECTORS[system].name}`);
    return NextResponse.json({ ok: true, ...result }, { status: result.status === "Duplicate" ? 200 : 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Payload validation failed", issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) }, { status: 422 });
    }
    const message = error instanceof Error ? error.message : "Integration processing failed";
    const status = message.includes("เคยถูกใช้") ? 409 : 422;
    return NextResponse.json({ error: message }, { status });
  }
}

