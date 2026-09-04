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
    paths: {
      ...paths,
      "/api/v1/accounting-events": {
        post: {
          summary: "Validate an enterprise accounting event and create a balanced journal",
          operationId: "create_accounting_event_journal",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "X-KC-Source-System", in: "header", required: true, schema: { type: "string", enum: CONNECTOR_KEYS } },
            { name: "Idempotency-Key", in: "header", required: true, schema: { type: "string" } },
          ],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/EnterpriseAccountingEvent" } } } },
          responses: {
            "201": { description: "Balanced journal draft or approval request created" },
            "200": { description: "Idempotent duplicate returned without a second journal" },
            "401": { description: "Invalid connector API key" },
            "403": { description: "Connector is outside the requested tenant/company scope" },
            "409": { description: "Idempotency conflict" },
            "422": { description: "Closed period, mapping, exchange-rate, balance, or validation error" },
          },
        },
      },
    },
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
        EnterpriseAccountingEvent: {
          type: "object",
          required: ["tenantId", "companyId", "eventId", "eventType", "sourceSystem", "sourceDocumentType", "sourceDocumentId", "idempotencyKey", "transactionDate", "accountingDate", "currency", "amount"],
          properties: {
            tenantId: { type: "string", format: "uuid" },
            companyId: { type: "string", format: "uuid" },
            branchId: { type: ["string", "null"], format: "uuid" },
            eventId: { type: "string", minLength: 3, maxLength: 100 },
            eventType: { type: "string", minLength: 3, maxLength: 80 },
            sourceSystem: { type: "string", enum: CONNECTOR_KEYS },
            sourceDocumentType: { type: "string" },
            sourceDocumentId: { type: "string" },
            idempotencyKey: { type: "string" },
            correlationId: { type: ["string", "null"] },
            transactionDate: { type: "string", format: "date" },
            accountingDate: { type: "string", format: "date" },
            currency: { type: "string", minLength: 3, maxLength: 3 },
            amount: { type: "string", pattern: "^\\d{1,16}(\\.\\d{1,4})?$" },
            tax: { type: "string", pattern: "^\\d{1,16}(\\.\\d{1,4})?$", default: "0" },
            dimensions: { type: "object", additionalProperties: { type: "string" } },
            metadata: { type: "object", additionalProperties: true },
          },
        },
      },
    },
  }, { headers: { "cache-control": "private, no-store" } });
}
