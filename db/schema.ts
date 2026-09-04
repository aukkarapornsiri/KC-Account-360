import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow();

// Compatibility tables used by the existing v25 application. They remain available
// while normalized subledgers are introduced phase by phase.
export const financialRecords = pgTable("financial_records", {
  id: text("id").primaryKey(),
  module: text("module").notNull(),
  recordType: text("record_type").notNull(),
  documentNo: text("document_no").notNull().unique(),
  sourceSystem: text("source_system").notNull().default("KC Account"),
  counterparty: text("counterparty").notNull().default(""),
  description: text("description").notNull(),
  amount: bigint("amount", { mode: "number" }).notNull().default(0),
  taxAmount: bigint("tax_amount", { mode: "number" }).notNull().default(0),
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
  check("financial_records_amount_nonnegative", sql`${table.amount} >= 0`),
  check("financial_records_tax_nonnegative", sql`${table.taxAmount} >= 0`),
]);

export const auditLogs = pgTable("audit_logs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  recordId: text("record_id"),
  action: text("action").notNull(),
  actorEmail: text("actor_email").notNull(),
  details: text("details").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_audit_logs_record_created").on(table.recordId, table.createdAt)]);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedBy: text("updated_by").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const documents = pgTable("documents", {
  id: text("id").primaryKey(),
  recordId: text("record_id").notNull().references(() => financialRecords.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  objectKey: text("object_key").notNull().unique(),
  contentType: text("content_type").notNull(),
  size: bigint("size", { mode: "number" }).notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_documents_record_id").on(table.recordId)]);

export const masterData = pgTable("master_data", {
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

export const integrationConnectors = pgTable("integration_connectors", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull().default(""),
  apiKeyHash: text("api_key_hash"),
  status: text("status").notNull().default("Setup Required"),
  cursor: text("cursor").notNull().default(""),
  recordsSynced: bigint("records_synced", { mode: "number" }).notNull().default(0),
  lastSyncAt: text("last_sync_at"),
  lastSuccessAt: text("last_success_at"),
  lastError: text("last_error"),
  updatedBy: text("updated_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("idx_integration_connectors_status").on(table.status)]);

export const integrationEvents = pgTable("integration_events", {
  id: text("id").primaryKey(),
  sourceSystem: text("source_system").notNull(),
  externalEventId: text("external_event_id").notNull(),
  direction: text("direction").notNull().default("Inbound"),
  eventType: text("event_type").notNull(),
  payload: text("payload").notNull(),
  payloadHash: text("payload_hash").notNull(),
  status: text("status").notNull().default("Received"),
  financialRecordId: text("financial_record_id").references(() => financialRecords.id, { onDelete: "set null" }),
  error: text("error"),
  retryCount: integer("retry_count").notNull().default(0),
  receivedAt: text("received_at").notNull(),
  processedAt: text("processed_at"),
}, (table) => [
  uniqueIndex("uq_integration_events_source_external").on(table.sourceSystem, table.externalEventId),
  index("idx_integration_events_source_status").on(table.sourceSystem, table.status),
  index("idx_integration_events_status_received").on(table.status, table.receivedAt),
  index("idx_integration_events_financial_record").on(table.financialRecordId),
]);

// Phase A: tenant, company and accounting foundation.
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  version: integer("version").notNull().default(1),
}, (table) => [check("tenants_status_check", sql`${table.status} in ('ACTIVE','SUSPENDED','INACTIVE')`)]);

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  legalName: text("legal_name").notNull(),
  taxId: text("tax_id"),
  baseCurrency: text("base_currency").notNull().default("THB"),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  version: integer("version").notNull().default(1),
}, (table) => [
  uniqueIndex("uq_companies_tenant_code").on(table.tenantId, table.code),
  index("idx_companies_tenant").on(table.tenantId),
]);

export const integrationConnectorScopes = pgTable("integration_connector_scopes", {
  connectorKey: text("connector_key").notNull().references(() => integrationConnectors.key, { onDelete: "restrict" }),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  primaryKey({ columns: [table.connectorKey, table.tenantId, table.companyId] }),
  index("idx_integration_connector_scopes_company").on(table.companyId, table.isActive),
  index("idx_integration_connector_scopes_tenant").on(table.tenantId),
]);

export const branches = pgTable("branches", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  taxBranchCode: text("tax_branch_code"),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  version: integer("version").notNull().default(1),
}, (table) => [
  uniqueIndex("uq_branches_company_code").on(table.companyId, table.code),
  index("idx_branches_tenant").on(table.tenantId),
  index("idx_branches_company").on(table.companyId),
]);

export const fiscalYears = pgTable("fiscal_years", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  startsOn: date("starts_on", { mode: "string" }).notNull(),
  endsOn: date("ends_on", { mode: "string" }).notNull(),
  status: text("status").notNull().default("OPEN"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("uq_fiscal_years_company_name").on(table.companyId, table.name),
  index("idx_fiscal_years_tenant").on(table.tenantId),
  check("fiscal_year_date_order", sql`${table.endsOn} >= ${table.startsOn}`),
]);

export const accountingPeriods = pgTable("accounting_periods", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  fiscalYearId: uuid("fiscal_year_id").notNull().references(() => fiscalYears.id, { onDelete: "restrict" }),
  periodNo: integer("period_no").notNull(),
  startsOn: date("starts_on", { mode: "string" }).notNull(),
  endsOn: date("ends_on", { mode: "string" }).notNull(),
  status: text("status").notNull().default("OPEN"),
  subledgerStatus: jsonb("subledger_status").notNull().default(sql`'{}'::jsonb`),
  lockedAt: timestamp("locked_at", { withTimezone: true, mode: "string" }),
  lockedBy: text("locked_by"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  version: integer("version").notNull().default(1),
}, (table) => [
  uniqueIndex("uq_accounting_periods_year_number").on(table.fiscalYearId, table.periodNo),
  index("idx_accounting_periods_company_status").on(table.companyId, table.status),
  index("idx_accounting_periods_tenant").on(table.tenantId),
  check("accounting_period_number", sql`${table.periodNo} between 1 and 13`),
  check("accounting_period_date_order", sql`${table.endsOn} >= ${table.startsOn}`),
  check("accounting_period_status", sql`${table.status} in ('OPEN','SOFT_CLOSE','REVIEW','CLOSED','LOCKED')`),
]);

export const dimensions = pgTable("dimensions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  type: text("type").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("ACTIVE"),
  externalReferences: jsonb("external_references").notNull().default(sql`'{}'::jsonb`),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  version: integer("version").notNull().default(1),
}, (table) => [
  uniqueIndex("uq_dimensions_company_type_code").on(table.companyId, table.type, table.code),
  index("idx_dimensions_tenant").on(table.tenantId),
  check("dimensions_type", sql`${table.type} in ('DEPARTMENT','COST_CENTER','PROFIT_CENTER','PROJECT')`),
]);

export const currencies = pgTable("currencies", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  decimalPlaces: integer("decimal_places").notNull().default(2),
  status: text("status").notNull().default("ACTIVE"),
}, (table) => [check("currencies_decimal_places", sql`${table.decimalPlaces} between 0 and 6`)]);

export const exchangeRates = pgTable("exchange_rates", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  fromCurrency: text("from_currency").notNull().references(() => currencies.code, { onDelete: "restrict" }),
  toCurrency: text("to_currency").notNull().references(() => currencies.code, { onDelete: "restrict" }),
  rateDate: date("rate_date", { mode: "string" }).notNull(),
  rate: numeric("rate", { precision: 24, scale: 10 }).notNull(),
  source: text("source").notNull(),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("uq_exchange_rates_company_pair_date").on(table.companyId, table.fromCurrency, table.toCurrency, table.rateDate),
  index("idx_exchange_rates_tenant").on(table.tenantId),
  check("exchange_rates_positive", sql`${table.rate} > 0`),
]);

export const accountGroups = pgTable("account_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  normalBalance: text("normal_balance").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("uq_account_groups_company_code").on(table.companyId, table.code),
  index("idx_account_groups_tenant").on(table.tenantId),
  check("account_groups_category", sql`${table.category} in ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE')`),
  check("account_groups_normal_balance", sql`${table.normalBalance} in ('DEBIT','CREDIT')`),
]);

export const chartOfAccounts = pgTable("chart_of_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  accountGroupId: uuid("account_group_id").notNull().references(() => accountGroups.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  nameTh: text("name_th").notNull(),
  nameEn: text("name_en"),
  normalBalance: text("normal_balance").notNull(),
  isControlAccount: boolean("is_control_account").notNull().default(false),
  allowManualPosting: boolean("allow_manual_posting").notNull().default(true),
  status: text("status").notNull().default("ACTIVE"),
  statementMapping: jsonb("statement_mapping").notNull().default(sql`'{}'::jsonb`),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  version: integer("version").notNull().default(1),
}, (table) => [
  uniqueIndex("uq_chart_of_accounts_company_code").on(table.companyId, table.code),
  index("idx_chart_of_accounts_tenant").on(table.tenantId),
  index("idx_chart_of_accounts_group").on(table.accountGroupId),
  check("chart_of_accounts_normal_balance", sql`${table.normalBalance} in ('DEBIT','CREDIT')`),
]);

export const taxCodes = pgTable("tax_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  taxType: text("tax_type").notNull(),
  rate: numeric("rate", { precision: 9, scale: 6 }).notNull().default("0"),
  effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
  effectiveTo: date("effective_to", { mode: "string" }),
  payableAccountId: uuid("payable_account_id").references(() => chartOfAccounts.id, { onDelete: "restrict" }),
  receivableAccountId: uuid("receivable_account_id").references(() => chartOfAccounts.id, { onDelete: "restrict" }),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("uq_tax_codes_company_code_effective").on(table.companyId, table.code, table.effectiveFrom),
  index("idx_tax_codes_tenant").on(table.tenantId),
  index("idx_tax_codes_payable_account").on(table.payableAccountId),
  index("idx_tax_codes_receivable_account").on(table.receivableAccountId),
  check("tax_codes_rate_nonnegative", sql`${table.rate} >= 0`),
]);

export const documentSequences = pgTable("document_sequences", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "restrict" }),
  documentType: text("document_type").notNull(),
  prefix: text("prefix").notNull(),
  nextNumber: bigint("next_number", { mode: "number" }).notNull().default(1),
  padding: integer("padding").notNull().default(6),
  resetPolicy: text("reset_policy").notNull().default("FISCAL_YEAR"),
  updatedAt: updatedAt(),
  version: integer("version").notNull().default(1),
}, (table) => [
  uniqueIndex("uq_document_sequences_scope_type").on(table.companyId, table.branchId, table.documentType),
  index("idx_document_sequences_tenant").on(table.tenantId),
  index("idx_document_sequences_branch").on(table.branchId),
  check("document_sequences_next_positive", sql`${table.nextNumber} > 0`),
]);

export const postingRules = pgTable("posting_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  eventType: text("event_type").notNull(),
  name: text("name").notNull(),
  versionNo: integer("version_no").notNull().default(1),
  effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
  effectiveTo: date("effective_to", { mode: "string" }),
  conditions: jsonb("conditions").notNull().default(sql`'{}'::jsonb`),
  lineRules: jsonb("line_rules").notNull(),
  status: text("status").notNull().default("DRAFT"),
  createdBy: text("created_by").notNull(),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true, mode: "string" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("uq_posting_rules_company_event_version").on(table.companyId, table.eventType, table.versionNo),
  index("idx_posting_rules_tenant").on(table.tenantId),
  index("idx_posting_rules_active_lookup").on(table.companyId, table.eventType, table.status, table.effectiveFrom),
]);

export const accountingEvents = pgTable("accounting_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "restrict" }),
  eventId: text("event_id").notNull(),
  eventType: text("event_type").notNull(),
  sourceSystem: text("source_system").notNull(),
  sourceDocumentType: text("source_document_type").notNull(),
  sourceDocumentId: text("source_document_id").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  correlationId: text("correlation_id"),
  transactionDate: date("transaction_date", { mode: "string" }).notNull(),
  accountingDate: date("accounting_date", { mode: "string" }).notNull(),
  currency: text("currency").notNull().references(() => currencies.code, { onDelete: "restrict" }),
  amount: numeric("amount", { precision: 20, scale: 4 }).notNull(),
  tax: numeric("tax", { precision: 20, scale: 4 }).notNull().default("0"),
  dimensions: jsonb("dimensions").notNull().default(sql`'{}'::jsonb`),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  payloadHash: text("payload_hash").notNull(),
  status: text("status").notNull().default("RECEIVED"),
  failureCode: text("failure_code"),
  failureDetail: text("failure_detail"),
  retryCount: integer("retry_count").notNull().default(0),
  receivedAt: createdAt(),
  processedAt: timestamp("processed_at", { withTimezone: true, mode: "string" }),
}, (table) => [
  uniqueIndex("uq_accounting_events_tenant_source_idempotency").on(table.tenantId, table.sourceSystem, table.idempotencyKey),
  uniqueIndex("uq_accounting_events_tenant_source_event").on(table.tenantId, table.sourceSystem, table.eventId),
  index("idx_accounting_events_company_status").on(table.companyId, table.status, table.receivedAt),
  index("idx_accounting_events_branch").on(table.branchId),
  check("accounting_events_amount_nonnegative", sql`${table.amount} >= 0 and ${table.tax} >= 0`),
]);

export const journalEntries = pgTable("journal_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "restrict" }),
  periodId: uuid("period_id").notNull().references(() => accountingPeriods.id, { onDelete: "restrict" }),
  accountingEventId: uuid("accounting_event_id").references(() => accountingEvents.id, { onDelete: "restrict" }),
  journalNo: text("journal_no").notNull(),
  journalType: text("journal_type").notNull(),
  accountingDate: date("accounting_date", { mode: "string" }).notNull(),
  description: text("description").notNull(),
  currency: text("currency").notNull().references(() => currencies.code, { onDelete: "restrict" }),
  exchangeRate: numeric("exchange_rate", { precision: 24, scale: 10 }).notNull().default("1"),
  status: text("status").notNull().default("DRAFT"),
  reversalOfId: uuid("reversal_of_id"),
  version: integer("version").notNull().default(1),
  createdBy: text("created_by").notNull(),
  approvedBy: text("approved_by"),
  postedBy: text("posted_by"),
  postedAt: timestamp("posted_at", { withTimezone: true, mode: "string" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("uq_journal_entries_company_number").on(table.companyId, table.journalNo),
  uniqueIndex("uq_journal_entries_event").on(table.accountingEventId),
  index("idx_journal_entries_tenant").on(table.tenantId),
  index("idx_journal_entries_period_status").on(table.periodId, table.status),
  index("idx_journal_entries_branch").on(table.branchId),
  index("idx_journal_entries_reversal").on(table.reversalOfId),
  check("journal_entries_status", sql`${table.status} in ('DRAFT','PENDING_APPROVAL','APPROVED','POSTED','REVERSED','REJECTED','VOID')`),
]);

export const journalLines = pgTable("journal_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  journalEntryId: uuid("journal_entry_id").notNull().references(() => journalEntries.id, { onDelete: "restrict" }),
  lineNo: integer("line_no").notNull(),
  accountId: uuid("account_id").notNull().references(() => chartOfAccounts.id, { onDelete: "restrict" }),
  description: text("description").notNull().default(""),
  debit: numeric("debit", { precision: 20, scale: 4 }).notNull().default("0"),
  credit: numeric("credit", { precision: 20, scale: 4 }).notNull().default("0"),
  baseDebit: numeric("base_debit", { precision: 20, scale: 4 }).notNull().default("0"),
  baseCredit: numeric("base_credit", { precision: 20, scale: 4 }).notNull().default("0"),
  dimensions: jsonb("dimensions").notNull().default(sql`'{}'::jsonb`),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("uq_journal_lines_entry_line").on(table.journalEntryId, table.lineNo),
  index("idx_journal_lines_account").on(table.accountId),
  check("journal_lines_nonnegative", sql`${table.debit} >= 0 and ${table.credit} >= 0 and ${table.baseDebit} >= 0 and ${table.baseCredit} >= 0`),
  check("journal_lines_one_side", sql`(${table.debit} > 0 and ${table.credit} = 0) or (${table.credit} > 0 and ${table.debit} = 0)`),
]);

export const approvalRules = pgTable("approval_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  documentType: text("document_type").notNull(),
  conditions: jsonb("conditions").notNull().default(sql`'{}'::jsonb`),
  steps: jsonb("steps").notNull(),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  version: integer("version").notNull().default(1),
}, (table) => [index("idx_approval_rules_company_document").on(table.companyId, table.documentType, table.status)]);

export const approvalInstances = pgTable("approval_instances", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  ruleId: uuid("rule_id").notNull().references(() => approvalRules.id, { onDelete: "restrict" }),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  makerUserId: text("maker_user_id").notNull(),
  status: text("status").notNull().default("PENDING"),
  currentStep: integer("current_step").notNull().default(1),
  createdAt: createdAt(),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "string" }),
}, (table) => [
  uniqueIndex("uq_approval_instances_entity").on(table.tenantId, table.entityType, table.entityId),
  index("idx_approval_instances_company_status").on(table.companyId, table.status),
]);

export const approvalSteps = pgTable("approval_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  approvalInstanceId: uuid("approval_instance_id").notNull().references(() => approvalInstances.id, { onDelete: "restrict" }),
  stepNo: integer("step_no").notNull(),
  approverRole: text("approver_role").notNull(),
  approverUserId: text("approver_user_id"),
  status: text("status").notNull().default("PENDING"),
  actionBy: text("action_by"),
  actionAt: timestamp("action_at", { withTimezone: true, mode: "string" }),
  reason: text("reason"),
}, (table) => [
  uniqueIndex("uq_approval_steps_instance_step").on(table.approvalInstanceId, table.stepNo),
  index("idx_approval_steps_approver_status").on(table.approverUserId, table.status),
]);

export const auditEvents = pgTable("audit_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "restrict" }),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "restrict" }),
  module: text("module").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  actorUserId: text("actor_user_id").notNull(),
  reason: text("reason"),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  approvalReference: text("approval_reference"),
  sourceSystem: text("source_system").notNull().default("KC Account 360"),
  requestId: text("request_id"),
  correlationId: text("correlation_id"),
  ipAddress: text("ip_address"),
  sessionId: text("session_id"),
  createdAt: createdAt(),
}, (table) => [
  index("idx_audit_events_tenant_created").on(table.tenantId, table.createdAt),
  index("idx_audit_events_entity").on(table.entityType, table.entityId, table.createdAt),
  index("idx_audit_events_company").on(table.companyId, table.createdAt),
  index("idx_audit_events_branch").on(table.branchId),
]);

export const userCompanyRoles = pgTable("user_company_roles", {
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  userId: text("user_id").notNull(),
  role: text("role").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  primaryKey({ columns: [table.tenantId, table.companyId, table.userId, table.role] }),
  index("idx_user_company_roles_user").on(table.userId, table.isActive),
  index("idx_user_company_roles_company").on(table.companyId),
]);
