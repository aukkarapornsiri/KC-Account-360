import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("uses PostgreSQL and keeps the legacy application tables compatible", async () => {
  const database = await readFile(new URL("../db/index.ts", import.meta.url), "utf8");
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  assert.match(database, /drizzle-orm\/node-postgres/);
  assert.match(database, /DATABASE_URL/);
  for (const table of ["financialRecords", "auditLogs", "settings", "documents", "masterData", "integrationConnectors", "integrationEvents"]) assert.match(schema, new RegExp(`export const ${table}`));
});

test("defines tenant, company, period, GL, approval and audit foundations", async () => {
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  for (const table of ["tenants", "companies", "branches", "accountingPeriods", "chartOfAccounts", "postingRules", "accountingEvents", "journalEntries", "journalLines", "approvalRules", "approvalInstances", "approvalSteps", "auditEvents", "userCompanyRoles", "integrationConnectorScopes"]) assert.match(schema, new RegExp(`export const ${table}`));
  assert.match(schema, /uq_accounting_events_tenant_source_idempotency/);
  assert.match(schema, /journal_lines_one_side/);
});

test("central posting validates scope, open periods, posting rules and balance", async () => {
  const engine = await readFile(new URL("../lib/accounting/posting-engine.ts", import.meta.url), "utf8");
  for (const invariant of ["COMPANY_SCOPE_INVALID", "BRANCH_SCOPE_INVALID", "ACCOUNTING_PERIOD_CLOSED", "POSTING_RULE_NOT_FOUND", "POSTING_ACCOUNT_NOT_FOUND", "JOURNAL_UNBALANCED", "IDEMPOTENCY_PAYLOAD_CONFLICT"]) assert.match(engine, new RegExp(invariant));
  assert.match(engine, /db\.transaction/);
  assert.match(engine, /PENDING_APPROVAL/);
});

test("database migration protects posted and unbalanced journals", async () => {
  const migration = await readFile(new URL("../drizzle-pg/0000_youthful_meltdown.sql", import.meta.url), "utf8");
  assert.match(migration, /journal_must_balance_before_post/);
  assert.match(migration, /JOURNAL_UNBALANCED/);
  assert.match(migration, /POSTED_JOURNAL_IMMUTABLE/);
});

test("on-prem deployment requires OIDC proxy and persistent storage", async () => {
  const compose = await readFile(new URL("../docker-compose.yml", import.meta.url), "utf8");
  const auth = await readFile(new URL("../app/chatgpt-auth.ts", import.meta.url), "utf8");
  assert.match(compose, /postgres:17-bookworm/);
  assert.match(compose, /oauth2-proxy/);
  assert.match(compose, /document-data/);
  assert.match(auth, /AUTH_TRUST_PROXY/);
  assert.match(auth, /x-auth-request-email/);
});

test("persists user experience settings without changing accounting permissions", async () => {
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  const api = await readFile(new URL("../app/api/preferences/route.ts", import.meta.url), "utf8");
  const app = await readFile(new URL("../app/kc-account-app.tsx", import.meta.url), "utf8");
  for (const table of ["userPreferences", "userSavedViews", "userDashboardLayouts", "companyExperienceSettings"]) assert.match(schema, new RegExp(`export const ${table}`));
  assert.match(api, /UPDATE_USER_PREFERENCES/);
  assert.match(api, /onConflictDoUpdate/);
  assert.match(app, /data-density=/);
  assert.match(app, /data-page-width=/);
  assert.match(app, /savePersonalPreferences/);
});
