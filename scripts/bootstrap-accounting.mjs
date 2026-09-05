import pg from "pg";

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const databaseUrl = required("DATABASE_URL");
const adminEmail = required("KC_BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
const tenantCode = process.env.KC_BOOTSTRAP_TENANT_CODE?.trim() || "KC";
const tenantName = process.env.KC_BOOTSTRAP_TENANT_NAME?.trim() || "KC Group";
const companyCode = process.env.KC_BOOTSTRAP_COMPANY_CODE?.trim() || "COMPANY-001";
const companyName = process.env.KC_BOOTSTRAP_COMPANY_NAME?.trim() || "Configure company legal name";
const taxId = process.env.KC_BOOTSTRAP_TAX_ID?.trim() || null;
const fiscalYear = Number(process.env.KC_BOOTSTRAP_FISCAL_YEAR || new Date().getUTCFullYear());
if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2200) throw new Error("KC_BOOTSTRAP_FISCAL_YEAR is invalid");

const pad = (value) => String(value).padStart(2, "0");
const isoDate = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`;
const lastDay = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const accountGroups = [
  ["ASSET", "สินทรัพย์", "ASSET", "DEBIT"],
  ["LIABILITY", "หนี้สิน", "LIABILITY", "CREDIT"],
  ["EQUITY", "ส่วนของผู้ถือหุ้น", "EQUITY", "CREDIT"],
  ["REVENUE", "รายได้", "REVENUE", "CREDIT"],
  ["EXPENSE", "ค่าใช้จ่าย", "EXPENSE", "DEBIT"],
];
const accounts = [
  ["110100", "เงินสดและรายการเทียบเท่าเงินสด", "Cash and cash equivalents", "ASSET", "DEBIT", false, true],
  ["120100", "ลูกหนี้การค้า", "Trade receivables", "ASSET", "DEBIT", true, false],
  ["210100", "เจ้าหนี้การค้า", "Trade payables", "LIABILITY", "CREDIT", true, false],
  ["220100", "ภาษีขาย", "Output VAT", "LIABILITY", "CREDIT", true, false],
  ["130100", "ภาษีซื้อ", "Input VAT", "ASSET", "DEBIT", true, false],
  ["310100", "ทุน", "Capital", "EQUITY", "CREDIT", false, true],
  ["410100", "รายได้จากการขายและบริการ", "Sales and service revenue", "REVENUE", "CREDIT", false, true],
  ["510100", "ต้นทุนขายและบริการ", "Cost of sales and services", "EXPENSE", "DEBIT", false, true],
];
const policies = [
  ["SYSTEM_ADMIN", "System Administrator", "IT", ["read", "create", "post", "approve", "reconcile", "close_period", "review_ai", "export", "manage_master", "manage_users", "manage_settings", "manage_integrations"], ["ALL"]],
  ["ACCOUNTING_MANAGER", "Accounting Manager", "Accounting", ["read", "create", "post", "approve", "reconcile", "close_period", "review_ai", "export", "manage_master"], ["GL", "AP", "AR", "CASH", "TAX", "CLOSING", "REPORTS"]],
  ["ACCOUNTANT", "Accountant", "Accounting", ["read", "create", "post", "reconcile", "review_ai", "export", "manage_master"], ["GL", "AP", "AR", "CASH", "TAX", "REPORTS"]],
  ["AP_OFFICER", "Accounts Payable Officer", "Procurement / AP", ["read", "create", "export"], ["AP", "CASH", "REPORTS"]],
  ["AR_OFFICER", "Accounts Receivable Officer", "Sales / AR", ["read", "create", "export"], ["AR", "CASH", "REPORTS"]],
  ["TREASURY", "Treasury Officer", "Finance", ["read", "create", "reconcile", "export"], ["CASH", "AP", "AR", "REPORTS"]],
  ["TAX_OFFICER", "Tax Officer", "Tax", ["read", "create", "post", "export"], ["TAX", "AP", "AR", "REPORTS"]],
  ["EXECUTIVE_APPROVER", "Executive / CFO Approver", "Management", ["read", "approve", "review_ai", "export"], ["GL", "AP", "AR", "CASH", "CLOSING", "REPORTS", "AI"]],
  ["INTERNAL_AUDITOR", "Internal Auditor", "Audit", ["read", "export"], ["ALL"]],
  ["INTEGRATION_ADMIN", "Integration Administrator", "IT / Integration", ["read", "reconcile", "manage_integrations"], ["INTEGRATION", "RECONCILIATION"]],
];
const requestedUsers = JSON.parse(process.env.KC_BOOTSTRAP_USERS_JSON || "[]");
if (!Array.isArray(requestedUsers)) throw new Error("KC_BOOTSTRAP_USERS_JSON must be a JSON array");

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1, application_name: "kc-account-bootstrap" });
const client = await pool.connect();
try {
  await client.query("begin");
  await client.query("select pg_advisory_xact_lock(hashtext('kc-account-normalized-bootstrap'))");
  await client.query("insert into currencies(code,name,decimal_places,status) values('THB','Thai Baht',2,'ACTIVE') on conflict(code) do nothing");
  const tenant = await client.query("insert into tenants(code,name) values($1,$2) on conflict(code) do update set name=excluded.name, updated_at=now(), version=tenants.version+1 returning id", [tenantCode, tenantName]);
  const tenantId = tenant.rows[0].id;
  const company = await client.query("insert into companies(tenant_id,code,legal_name,tax_id,base_currency) values($1,$2,$3,$4,'THB') on conflict(tenant_id,code) do update set legal_name=excluded.legal_name, tax_id=excluded.tax_id, updated_at=now(), version=companies.version+1 returning id", [tenantId, companyCode, companyName, taxId]);
  const companyId = company.rows[0].id;
  const policyIds = new Map();
  for (const [key, name, department, permissions, modules] of policies) {
    const result = await client.query("insert into access_policies(tenant_id,company_id,key,name,department,permissions,module_access,description,is_system) values($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,true) on conflict(company_id,key) do update set name=excluded.name, department=excluded.department, description=excluded.description, is_system=true, updated_at=now(), version=access_policies.version+1 returning id", [tenantId, companyId, key, name, department, JSON.stringify(permissions), JSON.stringify(modules), `${name} default policy`]);
    policyIds.set(key, result.rows[0].id);
  }
  await client.query("insert into branches(tenant_id,company_id,code,name,tax_branch_code) values($1,$2,'BR-00000','สำนักงานใหญ่','00000') on conflict(company_id,code) do update set name=excluded.name, updated_at=now(), version=branches.version+1", [tenantId, companyId]);
  const fiscal = await client.query("insert into fiscal_years(tenant_id,company_id,name,starts_on,ends_on) values($1,$2,$3,$4,$5) on conflict(company_id,name) do update set starts_on=excluded.starts_on, ends_on=excluded.ends_on, updated_at=now() returning id", [tenantId, companyId, String(fiscalYear), isoDate(fiscalYear, 1, 1), isoDate(fiscalYear, 12, 31)]);
  const fiscalYearId = fiscal.rows[0].id;
  for (let month = 1; month <= 12; month += 1) {
    await client.query("insert into accounting_periods(tenant_id,company_id,fiscal_year_id,period_no,starts_on,ends_on) values($1,$2,$3,$4,$5,$6) on conflict(fiscal_year_id,period_no) do nothing", [tenantId, companyId, fiscalYearId, month, isoDate(fiscalYear, month, 1), isoDate(fiscalYear, month, lastDay(fiscalYear, month))]);
  }
  const groupIds = new Map();
  for (const [code, name, category, normalBalance] of accountGroups) {
    const result = await client.query("insert into account_groups(tenant_id,company_id,code,name,category,normal_balance) values($1,$2,$3,$4,$5,$6) on conflict(company_id,code) do update set name=excluded.name, updated_at=now() returning id", [tenantId, companyId, code, name, category, normalBalance]);
    groupIds.set(code, result.rows[0].id);
  }
  for (const [code, nameTh, nameEn, groupCode, normalBalance, isControl, manual] of accounts) {
    await client.query("insert into chart_of_accounts(tenant_id,company_id,account_group_id,code,name_th,name_en,normal_balance,is_control_account,allow_manual_posting) values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(company_id,code) do update set name_th=excluded.name_th, name_en=excluded.name_en, account_group_id=excluded.account_group_id, updated_at=now(), version=chart_of_accounts.version+1", [tenantId, companyId, groupIds.get(groupCode), code, nameTh, nameEn, normalBalance, isControl, manual]);
  }
  const users = [{ email: adminEmail, fullName: "System Administrator", department: "IT", policyKey: "SYSTEM_ADMIN", employeeCode: null, branchScope: ["ALL"] }, ...requestedUsers];
  for (const user of users) {
    const email = String(user.email || "").trim().toLowerCase();
    const fullName = String(user.fullName || "").trim();
    const department = String(user.department || "").trim();
    const policyKey = String(user.policyKey || "").trim();
    const policyId = policyIds.get(policyKey);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !fullName || !department || !policyId) throw new Error(`Invalid bootstrap user or policy: ${email || "missing email"}`);
    await client.query("insert into company_users(tenant_id,company_id,email,full_name,department,employee_code) values($1,$2,$3,$4,$5,$6) on conflict(company_id,email) do update set full_name=excluded.full_name, department=excluded.department, employee_code=excluded.employee_code, updated_at=now(), version=company_users.version+1", [tenantId, companyId, email, fullName, department, user.employeeCode || null]);
    await client.query("insert into user_company_roles(tenant_id,company_id,user_id,role,access_policy_id,branch_scope) select $1,$2,$3,$4,$5,$6::jsonb where not exists (select 1 from user_company_roles where tenant_id=$1 and company_id=$2 and lower(user_id)=lower($3) and is_active=true) on conflict(tenant_id,company_id,user_id,role) do nothing", [tenantId, companyId, email, policyKey, policyId, JSON.stringify(Array.isArray(user.branchScope) && user.branchScope.length ? user.branchScope : ["ALL"])]);
  }
  await client.query("insert into audit_events(tenant_id,company_id,module,entity_type,entity_id,action,actor_user_id,new_value) values($1,$2,'SYSTEM','COMPANY',$2::text,'BOOTSTRAP',$3,jsonb_build_object('fiscalYear',$4::int,'baseCurrency','THB'))", [tenantId, companyId, adminEmail, fiscalYear]);
  await client.query("commit");
  console.log(JSON.stringify({ ok: true, tenantId, companyId, fiscalYear, adminEmail, usersProvisioned: users.length, policiesProvisioned: policies.length }));
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
