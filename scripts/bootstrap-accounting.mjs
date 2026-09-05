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
  await client.query("insert into user_company_roles(tenant_id,company_id,user_id,role) values($1,$2,$3,'Admin') on conflict(tenant_id,company_id,user_id,role) do update set is_active=true, updated_at=now()", [tenantId, companyId, adminEmail]);
  await client.query("insert into audit_events(tenant_id,company_id,module,entity_type,entity_id,action,actor_user_id,new_value) values($1,$2,'SYSTEM','COMPANY',$2::text,'BOOTSTRAP',$3,jsonb_build_object('fiscalYear',$4::int,'baseCurrency','THB'))", [tenantId, companyId, adminEmail, fiscalYear]);
  await client.query("commit");
  console.log(JSON.stringify({ ok: true, tenantId, companyId, fiscalYear, adminEmail }));
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
