import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getUserAccess, hasPermission } from "@/app/api/access";
import { getDb } from "@/db";
import { auditLogs, integrationConnectors } from "@/db/schema";
import {
  CONNECTORS,
  connectorSecretEnvKey,
  isConnectorKey,
  validateExternalBaseUrl,
  type ConnectorKey,
} from "@/lib/integration-contract";
import {
  createConnectorApiKey,
  ensureConnectorRows,
  getIntegrationSnapshot,
  processIntegrationEvent,
  recordSyncFailure,
  retryIntegrationEvent,
} from "@/lib/integration-service";

export const dynamic = "force-dynamic";
const jsonError = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

function outboundToken(system: ConnectorKey) {
  const value = process.env[connectorSecretEnvKey(system)];
  return typeof value === "string" ? value.trim() : "";
}

async function currentConnector(system: ConnectorKey) {
  const db = getDb();
  const [connector] = await db.select().from(integrationConnectors).where(eq(integrationConnectors.key, system)).limit(1);
  if (!connector) throw new Error("ไม่พบ Connector");
  return connector;
}

function externalHeaders(system: ConnectorKey): Record<string, string> {
  const token = outboundToken(system);
  return token ? { accept: "application/json", authorization: `Bearer ${token}` } : { accept: "application/json" };
}

async function fetchWithLimit(url: string, system: ConnectorKey) {
  const response = await fetch(url, { headers: externalHeaders(system), redirect: "error", signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`ระบบต้นทางตอบกลับ HTTP ${response.status}`);
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > 1024 * 1024) throw new Error("ข้อมูลจากระบบต้นทางเกิน 1 MB");
  const raw = await response.text();
  if (new TextEncoder().encode(raw).byteLength > 1024 * 1024) throw new Error("ข้อมูลจากระบบต้นทางเกิน 1 MB");
  return raw;
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return jsonError("กรุณาเข้าสู่ระบบ", 401);
  const snapshot = await getIntegrationSnapshot(user.email);
  return NextResponse.json({
    ...snapshot,
    connectors: snapshot.connectors.map((connector) => ({
      ...connector,
      outboundTokenConfigured: outboundToken(connector.key as ConnectorKey).length > 0,
      inboundEndpoint: `/api/integrations/${connector.key}`,
      exportPath: CONNECTORS[connector.key as ConnectorKey].exportPath,
    })),
  });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return jsonError("กรุณาเข้าสู่ระบบ", 401);
  const access = await getUserAccess(user.email);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") return jsonError("คำขอไม่ถูกต้อง");
  const systemValue = String(body.system || "");
  const system = isConnectorKey(systemValue) ? systemValue : null;
  const db = getDb();
  const now = new Date().toISOString();
  await ensureConnectorRows(user.email);

  if (body.action === "retry") {
    if (!hasPermission(access, "reconcile")) return jsonError("คุณไม่มีสิทธิ์ Retry Integration", 403);
    try {
      const result = await retryIntegrationEvent(String(body.eventId || ""), user.email);
      return NextResponse.json({ ok: true, result });
    } catch (error) { return jsonError(error instanceof Error ? error.message : "Retry ไม่สำเร็จ", 422); }
  }

  if (!system) return jsonError("ระบบต้นทางไม่ถูกต้อง", 422);

  if (body.action === "rotate_key") {
    if (!hasPermission(access, "manage_integrations")) return jsonError("คุณไม่มีสิทธิ์จัดการ API Key", 403);
    const apiKey = await createConnectorApiKey(system, user.email);
    return NextResponse.json({ ok: true, apiKey, shownOnce: true });
  }

  if (body.action === "update_connector") {
    if (!hasPermission(access, "manage_integrations")) return jsonError("คุณไม่มีสิทธิ์ตั้งค่า Connector", 403);
    let baseUrl = "";
    try { baseUrl = body.baseUrl ? validateExternalBaseUrl(String(body.baseUrl).trim()) : ""; }
    catch (error) { return jsonError(error instanceof Error ? error.message : "Endpoint ไม่ถูกต้อง", 422); }
    const status = body.enabled === false ? "Disabled" : baseUrl ? "Ready" : "Setup Required";
    await db.update(integrationConnectors).set({ baseUrl, status, lastError: null, updatedBy: user.email, updatedAt: now }).where(eq(integrationConnectors.key, system));
    await db.insert(auditLogs).values({ recordId: system, action: "UPDATE_CONNECTOR", actorEmail: user.email, details: `${CONNECTORS[system].name}: ${status}`, createdAt: now });
    return NextResponse.json({ ok: true });
  }

  if (!["test", "sync"].includes(body.action)) return jsonError("การดำเนินการไม่รองรับ");
  if (!hasPermission(access, "reconcile")) return jsonError("คุณไม่มีสิทธิ์เรียกใช้งาน Connector", 403);
  const connector = await currentConnector(system);
  if (connector.status === "Disabled") return jsonError("Connector ถูกระงับ", 409);
  if (!connector.baseUrl) return jsonError("กรุณากำหนด Endpoint ของระบบต้นทางก่อน", 409);
  if (!outboundToken(system)) return jsonError(`ยังไม่ได้ตั้งค่า ${connectorSecretEnvKey(system)} ใน Production`, 409);

  try {
    if (body.action === "test") {
      await fetchWithLimit(`${connector.baseUrl}/api/v1/health`, system);
      await db.update(integrationConnectors).set({ status: "Ready", lastSuccessAt: now, lastError: null, updatedBy: user.email, updatedAt: now }).where(eq(integrationConnectors.key, system));
      await db.insert(auditLogs).values({ recordId: system, action: "TEST_CONNECTOR", actorEmail: user.email, details: `${CONNECTORS[system].name}: connection successful`, createdAt: now });
      return NextResponse.json({ ok: true });
    }

    const url = new URL(`${connector.baseUrl}${CONNECTORS[system].exportPath}`);
    if (connector.cursor) url.searchParams.set("cursor", connector.cursor);
    const raw = await fetchWithLimit(url.toString(), system);
    const result = JSON.parse(raw) as { events?: unknown[]; next_cursor?: string };
    if (!Array.isArray(result.events)) throw new Error("ระบบต้นทางต้องส่งข้อมูลในรูปแบบ { events: [] }");
    if (result.events.length > 500) throw new Error("หนึ่งรอบ Sync รองรับสูงสุด 500 Events");
    let processed = 0; let duplicates = 0; const failures: string[] = [];
    for (const event of result.events) {
      try {
        const outcome = await processIntegrationEvent(system, event, `sync:${user.email}`);
        if (outcome.status === "Duplicate") duplicates += 1; else processed += 1;
      } catch (error) { failures.push(error instanceof Error ? error.message : "Unknown event error"); }
    }
    const summary = failures.length ? `${failures.length} event(s) failed: ${failures[0]}` : null;
    await db.update(integrationConnectors).set({
      status: failures.length ? "Error" : "Active",
      cursor: typeof result.next_cursor === "string" ? result.next_cursor.slice(0, 500) : connector.cursor,
      lastSyncAt: now,
      lastSuccessAt: failures.length ? connector.lastSuccessAt : now,
      lastError: summary,
      updatedBy: user.email,
      updatedAt: now,
    }).where(eq(integrationConnectors.key, system));
    await db.insert(auditLogs).values({ recordId: system, action: "SYNC_CONNECTOR", actorEmail: user.email, details: `${CONNECTORS[system].name}: processed=${processed}, duplicate=${duplicates}, failed=${failures.length}`, createdAt: now });
    return NextResponse.json({ ok: failures.length === 0, processed, duplicates, failed: failures.length, errors: failures.slice(0, 10) }, { status: failures.length ? 207 : 200 });
  } catch (error) {
    const message = await recordSyncFailure(system, user.email, error);
    return jsonError(message, 502);
  }
}
