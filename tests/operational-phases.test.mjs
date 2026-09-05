import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("normalizes AP AR bank reconciliation closing and AI review data", async () => {
  const schema = await read("db/schema.ts");
  for (const table of [
    "businessPartners", "accountingDocuments", "accountingDocumentLines", "openItems", "openItemAllocations",
    "bankAccounts", "bankStatementLines", "bankMatches", "externalSubledgerBalances",
    "periodCloseRuns", "periodCloseTasks", "aiRecommendations", "aiRecommendationActions",
  ]) assert.match(schema, new RegExp(`export const ${table}`));
  assert.match(schema, /uq_period_close_runs_active[\s\S]*where/);
  assert.match(schema, /ai_recommendations_confidence/);
});

test("produces ledger-derived trial balance and financial statements", async () => {
  const reporting = await read("lib/accounting/reporting.ts");
  assert.match(reporting, /journalEntries\.status, "POSTED"/);
  assert.match(reporting, /TRIAL_BALANCE_UNBALANCED/);
  assert.match(reporting, /balanceSheet/);
  assert.match(reporting, /profitAndLoss/);
});

test("closes periods only after reconciliation and maker-checker approval", async () => {
  const closing = await read("lib/accounting/closing-engine.ts");
  for (const guard of ["PERIOD_CLOSE_BLOCKED", "MAKER_CHECKER_REQUIRED", "PERIOD_CLOSE_NOT_APPROVED", "TRIAL_BALANCE_FAILED"]) assert.match(closing, new RegExp(guard));
  assert.match(closing, /pg_advisory_xact_lock/);
  assert.match(closing, /status: "LOCKED"/);
});

test("reverses posted journals through a new balanced journal", async () => {
  const actions = await read("app/api/v1/journals/[id]/actions/route.ts");
  assert.match(actions, /action === "reverse"/);
  assert.match(actions, /JOURNAL_ALREADY_REVERSED/);
  assert.match(actions, /debit: line\.credit, credit: line\.debit/);
  assert.doesNotMatch(actions, /set\(\{ status: "REVERSED"/);
});

test("keeps AI recommendations evidence-based and human-controlled", async () => {
  const copilot = await read("lib/ai/accounting-copilot.ts");
  const review = await read("app/api/v1/ai/recommendations/[id]/actions/route.ts");
  for (const feature of ["INTEGRATION_EXCEPTION", "BANK_MATCH", "CASH_FLOW_FORECAST", "CLOSING_COPILOT"]) assert.match(copilot, new RegExp(feature));
  assert.match(copilot, /requiresHumanApproval/);
  assert.match(copilot, /ledgerMutation: false/);
  assert.match(review, /review_ai/);
});

test("persists advanced views dashboard layouts and company experience", async () => {
  const views = await read("app/api/saved-views/route.ts");
  const dashboard = await read("app/api/dashboard-layouts/route.ts");
  const experience = await read("app/api/company-experience/route.ts");
  for (const field of ["sortBy", "sortDirection", "pageSize", "columns", "visibility"]) assert.match(views, new RegExp(field));
  assert.match(views, /ROLE_DEFAULT/);
  assert.match(views, /COMPANY_ACCESS_REQUIRED/);
  assert.match(dashboard, /UPDATE_DASHBOARD_LAYOUT/);
  assert.match(experience, /documentBranding/);
  assert.match(experience, /MANAGE_SETTINGS_REQUIRED/);
});

test("provides idempotent bootstrap and verifiable on-prem backups", async () => {
  const bootstrap = await read("scripts/bootstrap-accounting.mjs");
  const backup = await read("scripts/backup-on-prem.sh");
  const restore = await read("scripts/verify-restore.sh");
  assert.match(bootstrap, /pg_advisory_xact_lock/);
  assert.match(bootstrap, /on conflict\(tenant_id,company_id,user_id,role\)/);
  assert.match(bootstrap, /accounting_periods/);
  assert.match(backup, /pg_dump/);
  assert.match(backup, /sha256sum/);
  assert.match(restore, /pg_restore/);
  assert.match(restore, /period_close_runs/);
});

test("exposes the authorized tenant company branch and period context", async () => {
  const context = await read("app/api/v1/context/route.ts");
  assert.match(context, /userCompanyRoles/);
  assert.match(context, /defaultCompanyId/);
  assert.match(context, /branches: companyBranches/);
  assert.match(context, /cache-control.*private, no-store/s);
});
