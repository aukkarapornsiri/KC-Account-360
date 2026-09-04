// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
export {};
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const financialRecords = sqliteTable("financial_records", {
  id: text("id").primaryKey(),
  module: text("module").notNull(),
  recordType: text("record_type").notNull(),
  documentNo: text("document_no").notNull().unique(),
  sourceSystem: text("source_system").notNull().default("KC Account"),
  counterparty: text("counterparty").notNull().default(""),
  description: text("description").notNull(),
  amount: integer("amount").notNull().default(0),
  taxAmount: integer("tax_amount").notNull().default(0),
  currency: text("currency").notNull().default("THB"),
  status: text("status").notNull().default("Draft"),
  dueDate: text("due_date"),
  period: text("period").notNull(),
  metadata: text("metadata").notNull().default("{}"),
  createdBy: text("created_by").notNull(),
  approver: text("approver"),
  postedAt: text("posted_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_financial_records_module_status").on(table.module, table.status),
  index("idx_financial_records_period").on(table.period),
]);

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  recordId: text("record_id"),
  action: text("action").notNull(),
  actorEmail: text("actor_email").notNull(),
  details: text("details").notNull(),
  createdAt: text("created_at").notNull(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedBy: text("updated_by").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  recordId: text("record_id").notNull(),
  name: text("name").notNull(),
  objectKey: text("object_key").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: text("created_at").notNull(),
});

export const masterData = sqliteTable("master_data", {
  id: text("id").primaryKey(),
  category: text("category").notNull(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("Active"),
  metadata: text("metadata").notNull().default("{}"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("idx_master_data_category_name").on(table.category, table.name)]);

export const integrationConnectors = sqliteTable("integration_connectors", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull().default(""),
  apiKeyHash: text("api_key_hash"),
  status: text("status").notNull().default("Setup Required"),
  cursor: text("cursor").notNull().default(""),
  recordsSynced: integer("records_synced").notNull().default(0),
  lastSyncAt: text("last_sync_at"),
  lastSuccessAt: text("last_success_at"),
  lastError: text("last_error"),
  updatedBy: text("updated_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("idx_integration_connectors_status").on(table.status)]);

export const integrationEvents = sqliteTable("integration_events", {
  id: text("id").primaryKey(),
  sourceSystem: text("source_system").notNull(),
  externalEventId: text("external_event_id").notNull(),
  direction: text("direction").notNull().default("Inbound"),
  eventType: text("event_type").notNull(),
  payload: text("payload").notNull(),
  payloadHash: text("payload_hash").notNull(),
  status: text("status").notNull().default("Received"),
  financialRecordId: text("financial_record_id"),
  error: text("error"),
  retryCount: integer("retry_count").notNull().default(0),
  receivedAt: text("received_at").notNull(),
  processedAt: text("processed_at"),
}, (table) => [
  uniqueIndex("uq_integration_events_source_external").on(table.sourceSystem, table.externalEventId),
  index("idx_integration_events_source_status").on(table.sourceSystem, table.status),
  index("idx_integration_events_status_received").on(table.status, table.receivedAt),
]);
