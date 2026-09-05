import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("defines editable company policies and governed company users", async () => {
  const [schema, policies, users] = await Promise.all([read("db/schema.ts"), read("app/api/v1/access-policies/route.ts"), read("app/api/v1/users/route.ts")]);
  assert.match(schema, /accessPolicies = pgTable\(\s*"access_policies"/);
  assert.match(schema, /companyUsers = pgTable\(\s*"company_users"/);
  assert.match(policies, /SYSTEM_ADMIN_MUST_REMAIN_ACTIVE_WITH_ADMIN_PERMISSIONS/);
  assert.match(policies, /SYSTEM_POLICY_KEY_IMMUTABLE/);
  assert.match(users, /LAST_USER_ADMIN_REQUIRED/);
  assert.match(users, /CANNOT_REMOVE_OWN_USER_ADMIN_PERMISSION/);
});

test("bootstrap preserves later policy and user-status edits", async () => {
  const source = await read("scripts/bootstrap-accounting.mjs");
  assert.doesNotMatch(source, /permissions=excluded\.permissions/);
  assert.doesNotMatch(source, /status='ACTIVE'/);
  assert.match(source, /where not exists .*is_active=true.*on conflict\(tenant_id,company_id,user_id,role\) do nothing/);
});

test("QA fixtures cover all 18 AP and AR document types and reject ambiguous databases", async () => {
  const source = await read("scripts/seed-qa-fixtures.mjs");
  for (const code of ["PR", "PO", "PD", "GR", "PI", "PBR", "PP", "PCN", "PDN", "SQ", "SO", "SD", "DN", "SI", "BL", "RC", "SCN", "SDN"]) assert.match(source, new RegExp(`\\[\\"(?:AP|AR)\\", \\"${code}\\"`));
  assert.match(source, /KC_QA_CONFIRM !== "QA_ONLY"/);
  assert.match(source, /!\/\(qa\|test\|staging\)\/i\.test\(target\.pathname\)/);
  assert.match(source, /documentsCreated: documents\.length/);
});

test("public preview supports safe local mutations and exports without production writes", async () => {
  const [client, preview, exporter] = await Promise.all([read("app/kc-account-app.tsx"), read("lib/preview-data.ts"), read("app/api/export/route.ts")]);
  assert.match(preview, /preview_mode: "true"/);
  assert.match(preview, /qa\.admin@example\.invalid/);
  assert.match(client, /applyPreviewMutation/);
  assert.match(client, /PREVIEW_FILE_ATTACHED/);
  assert.match(client, /EDITABLE ACCESS POLICY/);
  assert.match(exporter, /buildPreviewData/);
});
