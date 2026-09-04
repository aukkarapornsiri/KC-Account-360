import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs, financialRecords, integrationConnectors, integrationEvents } from "@/db/schema";
import {
  CONNECTORS,
  CONNECTOR_KEYS,
  inboundEventSchema,
  mapInboundEvent,
  type ConnectorKey,
  type InboundEvent,
} from "@/lib/integration-contract";

const SYSTEM_ACTOR = "integration-api@kc-account";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : "ไม่สามารถประมวลผล Integration Event ได้";
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function ensureConnectorRows(actor = SYSTEM_ACTOR) {
  const db = getDb();
  const now = new Date().toISOString();
  for (const key of CONNECTOR_KEYS) {
    const connector = CONNECTORS[key];
    await db.insert(integrationConnectors).values({
      key,
      name: connector.name,
      baseUrl: "",
      apiKeyHash: null,
      status: "Setup Required",
      cursor: "",
      recordsSynced: 0,
      lastSyncAt: null,
      lastSuccessAt: null,
      lastError: null,
      updatedBy: actor,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: integrationConnectors.key,
      set: { name: connector.name },
    });
  }
}

export async function createConnectorApiKey(system: ConnectorKey, actor: string) {
  await ensureConnectorRows(actor);
  const random = crypto.getRandomValues(new Uint8Array(32));
  const secret = Array.from(random, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const apiKey = `kcacc_${system}_${secret}`;
  const apiKeyHash = await sha256(apiKey);
  const now = new Date().toISOString();
  const db = getDb();
  await db.update(integrationConnectors).set({ apiKeyHash, updatedBy: actor, updatedAt: now }).where(eq(integrationConnectors.key, system));
  await db.insert(auditLogs).values({ recordId: system, action: "ROTATE_INTEGRATION_KEY", actorEmail: actor, details: `Rotated inbound API key for ${CONNECTORS[system].name}`, createdAt: now });
  return apiKey;
}

export async function authenticateConnector(system: ConnectorKey, request: Request) {
  await ensureConnectorRows();
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token || token.length > 160) return false;
  const tokenHash = await sha256(token);
  const db = getDb();
  const [connector] = await db.select().from(integrationConnectors).where(eq(integrationConnectors.key, system)).limit(1);
  return Boolean(connector?.apiKeyHash && connector.apiKeyHash === tokenHash && connector.status !== "Disabled");
}

export type ProcessEventResult = {
  eventId: string;
  financialRecordId: string | null;
  status: "Processed" | "Duplicate";
};

async function processParsedEvent(system: ConnectorKey, event: InboundEvent, actor: string, existingEventId?: string): Promise<ProcessEventResult> {
  const db = getDb();
  const payload = canonicalJson(event);
  const payloadHash = await sha256(payload);
  const now = new Date().toISOString();
  let eventId = existingEventId;

  if (!eventId) {
    const [existing] = await db.select().from(integrationEvents).where(and(
      eq(integrationEvents.sourceSystem, system),
      eq(integrationEvents.externalEventId, event.event_id),
    )).limit(1);
    if (existing) {
      if (existing.payloadHash !== payloadHash) throw new Error("event_id นี้เคยถูกใช้กับ Payload อื่น");
      return { eventId: existing.id, financialRecordId: existing.financialRecordId, status: "Duplicate" };
    }
    eventId = crypto.randomUUID();
    await db.insert(integrationEvents).values({
      id: eventId,
      sourceSystem: system,
      externalEventId: event.event_id,
      direction: "Inbound",
      eventType: event.event_type,
      payload,
      payloadHash,
      status: "Received",
      financialRecordId: null,
      error: null,
      retryCount: 0,
      receivedAt: now,
      processedAt: null,
    });
  }

  try {
    const mapped = mapInboundEvent(system, event);
    const financialRecordId = crypto.randomUUID();
    await db.insert(financialRecords).values({
      id: financialRecordId,
      ...mapped,
      createdBy: actor,
      approver: null,
      postedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    await db.update(integrationEvents).set({ status: "Processed", financialRecordId, error: null, processedAt: now }).where(eq(integrationEvents.id, eventId));
    await db.update(integrationConnectors).set({
      status: "Active",
      recordsSynced: sql`${integrationConnectors.recordsSynced} + 1`,
      lastSuccessAt: now,
      lastError: null,
      updatedAt: now,
    }).where(eq(integrationConnectors.key, system));
    await db.insert(auditLogs).values({ recordId: financialRecordId, action: "INTEGRATION_RECEIVED", actorEmail: actor, details: `${CONNECTORS[system].name}: ${event.event_type} ${event.document_no}`, createdAt: now });
    return { eventId, financialRecordId, status: "Processed" };
  } catch (error) {
    const message = errorMessage(error);
    await db.update(integrationEvents).set({ status: "Failed", error: message, processedAt: now }).where(eq(integrationEvents.id, eventId));
    await db.update(integrationConnectors).set({ status: "Error", lastError: message, updatedAt: now }).where(eq(integrationConnectors.key, system));
    await db.insert(auditLogs).values({ recordId: eventId, action: "INTEGRATION_FAILED", actorEmail: actor, details: `${CONNECTORS[system].name}: ${message}`, createdAt: now });
    throw error;
  }
}

export async function processIntegrationEvent(system: ConnectorKey, input: unknown, actor = SYSTEM_ACTOR) {
  await ensureConnectorRows(actor);
  const parsed = inboundEventSchema.parse(input);
  return processParsedEvent(system, parsed, actor);
}

export async function retryIntegrationEvent(eventId: string, actor: string) {
  const db = getDb();
  const [stored] = await db.select().from(integrationEvents).where(eq(integrationEvents.id, eventId)).limit(1);
  if (!stored) throw new Error("ไม่พบ Integration Event");
  if (stored.status === "Processed") return { eventId: stored.id, financialRecordId: stored.financialRecordId, status: "Duplicate" as const };
  const system = stored.sourceSystem as ConnectorKey;
  if (!CONNECTOR_KEYS.includes(system)) throw new Error("ระบบต้นทางไม่ถูกต้อง");
  const parsed = inboundEventSchema.parse(JSON.parse(stored.payload));
  await db.update(integrationEvents).set({ retryCount: stored.retryCount + 1, status: "Received", error: null }).where(eq(integrationEvents.id, eventId));
  return processParsedEvent(system, parsed, actor, eventId);
}

export async function recordSyncFailure(system: ConnectorKey, actor: string, error: unknown) {
  const db = getDb();
  const now = new Date().toISOString();
  const message = errorMessage(error);
  await db.update(integrationConnectors).set({ status: "Error", lastSyncAt: now, lastError: message, updatedBy: actor, updatedAt: now }).where(eq(integrationConnectors.key, system));
  await db.insert(auditLogs).values({ recordId: system, action: "INTEGRATION_SYNC_FAILED", actorEmail: actor, details: `${CONNECTORS[system].name}: ${message}`, createdAt: now });
  return message;
}

export async function getIntegrationSnapshot(actor = SYSTEM_ACTOR) {
  await ensureConnectorRows(actor);
  const db = getDb();
  const [connectors, events] = await Promise.all([
    db.select().from(integrationConnectors).orderBy(integrationConnectors.name),
    db.select().from(integrationEvents).orderBy(desc(integrationEvents.receivedAt)).limit(100),
  ]);
  return {
    connectors: connectors.map(({ apiKeyHash, ...connector }) => ({ ...connector, inboundKeyConfigured: Boolean(apiKeyHash) })),
    events,
  };
}
