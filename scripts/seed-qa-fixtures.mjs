import pg from "pg";

const connectionString = process.env.KC_QA_DATABASE_URL?.trim();
if (!connectionString) throw new Error("KC_QA_DATABASE_URL is required");
if (process.env.KC_QA_CONFIRM !== "QA_ONLY") throw new Error("KC_QA_CONFIRM=QA_ONLY is required");
const target = new URL(connectionString);
if (!/(qa|test|staging)/i.test(target.pathname)) throw new Error("Refusing to seed a database whose name is not clearly QA, test, or staging");

const tenantCode = process.env.KC_QA_TENANT_CODE?.trim() || "KC";
const companyCode = process.env.KC_QA_COMPANY_CODE?.trim() || "COMPANY-001";
const actor = process.env.KC_QA_ACTOR_EMAIL?.trim().toLowerCase() || "qa.accounting@example.invalid";
const documents = [
  ["AP", "PR", "Purchase Requisition", "DRAFT"], ["AP", "PO", "Purchase Order", "PENDING_APPROVAL"], ["AP", "PD", "Purchase Deposit", "PENDING_APPROVAL"],
  ["AP", "GR", "Goods Receipt", "DRAFT"], ["AP", "PI", "Purchase Invoice", "PENDING_APPROVAL"], ["AP", "PBR", "Purchase Billing Receipt", "DRAFT"],
  ["AP", "PP", "Purchase Payment", "PENDING_APPROVAL"], ["AP", "PCN", "Purchase Credit Note", "PENDING_APPROVAL"], ["AP", "PDN", "Purchase Debit Note", "PENDING_APPROVAL"],
  ["AR", "SQ", "Quotation", "DRAFT"], ["AR", "SO", "Sales Order", "PENDING_APPROVAL"], ["AR", "SD", "Deposit Receipt", "PENDING_APPROVAL"],
  ["AR", "DN", "Delivery Note", "DRAFT"], ["AR", "SI", "Invoice", "PENDING_APPROVAL"], ["AR", "BL", "Billing Note", "DRAFT"],
  ["AR", "RC", "Receipt", "PENDING_APPROVAL"], ["AR", "SCN", "Credit Note", "PENDING_APPROVAL"], ["AR", "SDN", "Debit Note", "PENDING_APPROVAL"],
];

const pool = new pg.Pool({ connectionString, max: 1, application_name: "kc-account-qa-fixtures" });
const client = await pool.connect();
try {
  await client.query("begin");
  await client.query("select pg_advisory_xact_lock(hashtext('kc-account-qa-fixtures'))");
  const scope = await client.query("select t.id tenant_id, c.id company_id from tenants t join companies c on c.tenant_id=t.id where t.code=$1 and c.code=$2", [tenantCode, companyCode]);
  if (!scope.rowCount) throw new Error("QA tenant/company not found; run db:bootstrap first");
  const { tenant_id: tenantId, company_id: companyId } = scope.rows[0];
  const controls = await client.query("select id, code from chart_of_accounts where company_id=$1 and code in ('120100','210100','410100','510100')", [companyId]);
  const accountId = Object.fromEntries(controls.rows.map((row) => [row.code, row.id]));
  if (Object.keys(accountId).length !== 4) throw new Error("QA chart of accounts is incomplete");
  const customer = await client.query("insert into business_partners(tenant_id,company_id,code,partner_type,legal_name,currency,payment_terms_days,control_account_id,status) values($1,$2,'QA-CUSTOMER','CUSTOMER','QA Customer Co., Ltd.','THB',30,$3,'ACTIVE') on conflict(company_id,code) do update set legal_name=excluded.legal_name, updated_at=now() returning id", [tenantId, companyId, accountId["120100"]]);
  const vendor = await client.query("insert into business_partners(tenant_id,company_id,code,partner_type,legal_name,currency,payment_terms_days,control_account_id,status) values($1,$2,'QA-VENDOR','VENDOR','QA Vendor Co., Ltd.','THB',30,$3,'ACTIVE') on conflict(company_id,code) do update set legal_name=excluded.legal_name, updated_at=now() returning id", [tenantId, companyId, accountId["210100"]]);
  const today = new Date().toISOString().slice(0, 10);
  const due = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  for (const [module, code, type, status] of documents) {
    const documentNo = `${code}-QA-001`;
    const partnerId = module === "AR" ? customer.rows[0].id : vendor.rows[0].id;
    const account = module === "AR" ? accountId["410100"] : accountId["510100"];
    const created = await client.query("insert into accounting_documents(tenant_id,company_id,partner_id,module,document_type,document_no,external_document_no,document_date,due_date,currency,subtotal,tax_amount,total_amount,status,source_system,source_document_id,metadata,created_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9,'THB',1000,70,1070,$10,'KC QA Suite',$6,jsonb_build_object('qaFixture',true,'documentCode',$11),$12) on conflict(company_id,document_no) do update set status=excluded.status, metadata=excluded.metadata, updated_at=now(), version=accounting_documents.version+1 returning id", [tenantId, companyId, partnerId, module, type, documentNo, `EXT-${documentNo}`, today, due, status, code, actor]);
    await client.query("insert into accounting_document_lines(document_id,line_no,description,quantity,unit_price,discount_amount,account_id,metadata) values($1,1,$2,1,1000,0,$3,jsonb_build_object('qaFixture',true)) on conflict(document_id,line_no) do update set description=excluded.description, account_id=excluded.account_id", [created.rows[0].id, `${type} QA line`, account]);
  }
  await client.query("insert into audit_events(tenant_id,company_id,module,entity_type,entity_id,action,actor_user_id,new_value,source_system) values($1,$2,'QA','FIXTURE_SET',$3,'SEED',$4,jsonb_build_object('documents',18,'isolated',true),'KC QA Suite')", [tenantId, companyId, `qa:${today}`, actor]);
  await client.query("commit");
  console.log(JSON.stringify({ ok: true, tenantId, companyId, documentsCreated: documents.length, actor }));
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
