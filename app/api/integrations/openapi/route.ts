import { NextResponse } from "next/server";
import { CONNECTORS, CONNECTOR_KEYS } from "@/lib/integration-contract";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const paths = Object.fromEntries(CONNECTOR_KEYS.map((key) => [
    `/api/integrations/${key}`,
    {
      post: {
        summary: `Receive accounting events from ${CONNECTORS[key].name}`,
        operationId: `receive_${key}_accounting_event`,
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "Idempotency-Key", in: "header", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/AccountingEvent" } } },
        },
        responses: {
          "201": { description: "Event processed and accounting record created" },
          "200": { description: "Duplicate event accepted without creating a second record" },
          "401": { description: "Invalid API key" },
          "409": { description: "Idempotency key reused with a different payload" },
          "422": { description: "Validation or mapping error" },
        },
      },
    },
  ]));

  return NextResponse.json({
    openapi: "3.1.0",
    info: { title: "KC Account Integration API", version: "1.0.0", description: "Secure accounting event ingestion for KC CuTo CRM, KC Inventory, KC EAM and KC HR." },
    servers: [{ url: origin }],
    paths,
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "KC Account API Key" } },
      schemas: {
        AccountingEvent: {
          type: "object",
          required: ["event_id", "event_type", "occurred_at", "document_no", "period", "description", "amount"],
          properties: {
            event_id: { type: "string", minLength: 3, maxLength: 100 },
            event_type: { type: "string", description: "One of the supported event types for the selected connector" },
            occurred_at: { type: "string", format: "date-time" },
            document_no: { type: "string", minLength: 3, maxLength: 40 },
            period: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$", example: "2026-09" },
            description: { type: "string", maxLength: 500 },
            counterparty: { type: "string", maxLength: 200 },
            amount: { type: "number", minimum: 0 },
            tax_amount: { type: "number", minimum: 0, default: 0 },
            currency: { type: "string", minLength: 3, maxLength: 3, default: "THB" },
            due_date: { type: ["string", "null"], format: "date" },
            metadata: { type: "object", additionalProperties: true },
          },
        },
      },
    },
  }, { headers: { "cache-control": "private, no-store" } });
}
