import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

async function readCssTree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return readCssTree(entryPath);
      }
      return entry.name.endsWith(".css") ? readFile(entryPath, "utf8") : "";
    }),
  );
  return contents.join("\n");
}

test("emits the catalog's animation and scrolling utilities", async () => {
  const css = await readCssTree(path.join(root, ".next", "static"));

  assert.match(css, /--tw-enter-opacity/);
  assert.match(css, /scrollbar-width:\s*thin/);
  assert.match(css, /scrollbar-width:\s*none/);
  assert.match(css, /scrollbar-gutter:\s*stable/);
  assert.match(css, /scroll-fade-reveal-b/);
  assert.match(css, /mask-image:/);
  assert.match(css, /tw-shimmer/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("applies the KC AI CI token baseline consistently", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /--kc-teal:\s*#0aada9/i);
  assert.match(css, /--sidebar-bg:\s*#172033/i);
  assert.match(css, /--background:\s*#f7fafa/i);
  assert.match(css, /--text-primary:\s*#172033/i);
  assert.match(css, /--radius-lg:\s*14px/i);
  assert.match(css, /--status-review:\s*#8b5cf6/i);
  assert.match(css, /IBM Plex Sans Thai/);
  assert.doesNotMatch(css, /--background:\s*#0a0a0a/i);
});

test("renders the KC EAM-inspired navigation sidebar", async () => {
  const source = await readFile(new URL("../app/kc-account-app.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(source, /<Sidebar className="kc-sidebar"/);
  assert.match(source, /className="kc-current-company"/);
  assert.match(source, /System Control/);
  assert.match(source, /className="kc-ai-card"/);
  assert.match(css, /\.kc-sidebar-shell\s*\{[^}]*height:\s*100%/s);
  assert.match(css, /\.kc-sidebar-logo\s*\{[^}]*background:\s*var\(--kc-sidebar-surface\)/s);
  assert.match(css, /\.kc-system-submenu button\[data-active="true"\]/);
});

test("uses the supplied KAI-COM robot for every rendered AI logo", async () => {
  const source = await readFile(new URL("../app/kc-account-app.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const uses = source.match(/<AIRobotIcon/g) ?? [];
  assert.equal(uses.length, 4);
  assert.match(source, /src="\/kai-com-ai-robot\.webp"/);
  assert.doesNotMatch(source, /<BrainCircuit \/>/);
  assert.match(css, /\.ai-robot-icon\.sidebar/);
  assert.match(css, /\.recommendation \.recommendation-icon/);
});

test("provides the KC EAM-inspired System Control settings workspace", async () => {
  const source = await readFile(new URL("../app/kc-account-app.tsx", import.meta.url), "utf8");
  const api = await readFile(new URL("../app/api/records/route.ts", import.meta.url), "utf8");
  const logoApi = await readFile(new URL("../app/api/branding/logo/route.ts", import.meta.url), "utf8");

  assert.match(source, /className="system-control-tabs"/);
  assert.match(source, /การตั้งค่าระบบ/);
  assert.match(source, /Live Preview/);
  assert.match(source, /การตรวจสอบการเข้าถึง/);
  assert.match(source, /action:\s*"update_settings"/);
  assert.match(api, /body\.action === "update_settings"/);
  assert.match(logoApi, /brand_logo_key/);
  assert.match(logoApi, /file\.size > 1024 \* 1024/);
});

test("exposes the complete accounting, integration, and control navigation", async () => {
  const source = await readFile(new URL("../app/kc-account-app.tsx", import.meta.url), "utf8");
  for (const id of ["gl", "ar", "ap", "cash", "tax", "reports", "company", "coa", "users", "integration", "mapping", "errors", "reconciliation", "audit", "settings"]) {
    assert.match(source, new RegExp(`id: "${id}"`));
  }
  assert.match(source, /ACCOUNTING_NAV/);
  assert.match(source, /OPERATIONS_NAV/);
  assert.match(source, /SYSTEM_CONTROL_NAV/);
  assert.match(source, /INTEGRATION_TABS/);
});

test("supports full-width responsive registers, reports, filtering, and pagination", async () => {
  const source = await readFile(new URL("../app/kc-account-app.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /function FinancialReportsView/);
  assert.match(source, /statusFilter/);
  assert.match(source, /className="table-pagination"/);
  assert.match(source, /className="table-scroll"/);
  assert.match(css, /\.content\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*none/s);
  assert.match(css, /\.report-grid\s*\{/);
  assert.match(css, /\.integration-tabs\s*\{/);
});

test("protects editable workflows and administrator continuity", async () => {
  const source = await readFile(new URL("../app/kc-account-app.tsx", import.meta.url), "utf8");
  const api = await readFile(new URL("../app/api/records/route.ts", import.meta.url), "utf8");
  assert.match(source, /function EditRecordDialog/);
  assert.match(source, /action:\s*"update_record"/);
  assert.match(source, /action:\s*editing \? "update_master" : "create_master"/);
  assert.match(api, /body\.action === "update_record"/);
  assert.match(api, /body\.action === "update_master"/);
  assert.match(api, /ไม่สามารถระงับผู้ใช้ที่กำลังเข้าสู่ระบบ/);
  assert.match(api, /ระบบต้องมี Admin ที่ใช้งานอยู่อย่างน้อย 1 คน/);
});

test("allows administrators to edit connector endpoints and matches email case-insensitively", async () => {
  const source = await readFile(new URL("../app/kc-account-app.tsx", import.meta.url), "utf8");
  const access = await readFile(new URL("../app/api/access.ts", import.meta.url), "utf8");
  assert.match(source, /setEditing\(true\)/);
  assert.match(source, /บันทึกการแก้ไข/);
  assert.match(source, /สิทธิ์อ่านอย่างเดียว/);
  assert.match(source, /action:\s*"update_connector"/);
  assert.match(access, /normalizedEmail = email\.trim\(\)\.toLowerCase\(\)/);
  assert.match(access, /lower\(\$\{masterData\.name\}\)/);
});

test("provides customer master and complete sales document creation", async () => {
  const source = await readFile(new URL("../app/kc-account-app.tsx", import.meta.url), "utf8");
  const api = await readFile(new URL("../app/api/records/route.ts", import.meta.url), "utf8");
  const workflow = await readFile(new URL("../lib/workflow.ts", import.meta.url), "utf8");
  for (const documentType of ["Quotation", "Sales Order", "Deposit Receipt", "Delivery Note", "Invoice", "Billing Note", "Receipt", "Credit Note", "Debit Note"]) {
    assert.match(source, new RegExp(documentType.replace(/[+]/g, "\\$&")));
    assert.match(api, new RegExp(documentType.replace(/[+]/g, "\\$&")));
  }
  assert.match(source, /id: "customers"/);
  assert.match(source, /lineItems/);
  assert.match(api, /eq\(masterData\.category, "CUSTOMER"\)/);
  assert.match(api, /subtotal: cents\(amount\)/);
  assert.match(workflow, /issue: \["Draft"\]/);
});

test("forwards progress semantics to the primitive", async () => {
  const { Progress } = await vite.ssrLoadModule("/components/ui/progress.tsx");
  const html = renderToStaticMarkup(React.createElement(Progress, { value: 37 }));

  assert.match(html, /aria-valuenow="37"/);
  assert.match(html, /aria-valuetext="37%"/);
  assert.match(html, /data-state="loading"/);
});

test("emits chart themes for the starter's media dark mode", async () => {
  const { ChartStyle } = await vite.ssrLoadModule("/components/ui/chart.tsx");
  const html = renderToStaticMarkup(
    React.createElement(ChartStyle, {
      id: "contract",
      config: {
        latency: { theme: { light: "#ffffff", dark: "#000000" } },
      },
    }),
  );

  assert.match(html, /\[data-chart=contract\]/);
  assert.match(html, /@media \(prefers-color-scheme: dark\)/);
  assert.doesNotMatch(html, /\.dark/);
});

test("renders sidebar skeletons deterministically", async () => {
  const { SidebarMenuSkeleton } = await vite.ssrLoadModule(
    "/components/ui/sidebar.tsx",
  );
  const first = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));
  const second = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));

  assert.equal(first, second);
  assert.match(first, /--skeleton-width:70%/);
});

test("finance insights prioritize integration and approval risks", async () => {
  const { buildFinanceInsights } = await vite.ssrLoadModule(
    "/lib/finance-insights.ts",
  );
  const insights = buildFinanceInsights(
    [
      { module: "INTEGRATION", status: "Failed", amount: 250000, metadata: "{}" },
      { module: "AP", status: "Pending Approval", amount: 900000, metadata: "{}" },
      { module: "CASH", status: "Unreconciled", amount: 100000, metadata: "{}" },
    ],
    [],
    {},
    new Date("2026-09-02T00:00:00Z"),
  );
  assert.equal(insights[0].id, "integration-errors");
  assert.equal(insights[0].severity, "critical");
  assert.ok(insights.some((item) => item.id === "pending-approvals"));
  assert.ok(insights.some((item) => item.id === "bank-reconciliation"));
});

test("finance insights return no fake trend when records are healthy", async () => {
  const { buildFinanceInsights } = await vite.ssrLoadModule(
    "/lib/finance-insights.ts",
  );
  const insights = buildFinanceInsights(
    [{ module: "GL", status: "Posted", amount: 100000, metadata: "{}" }],
    [],
    {},
    new Date("2026-09-02T00:00:00Z"),
  );
  assert.deepEqual(insights, []);
});

test("finance insights include failed production integration events", async () => {
  const { buildFinanceInsights } = await vite.ssrLoadModule("/lib/finance-insights.ts");
  const insights = buildFinanceInsights([], [], {}, new Date("2026-09-02T00:00:00Z"), [{ status: "Failed" }, { status: "Processed" }]);
  assert.equal(insights[0].id, "integration-errors");
  assert.equal(insights[0].count, 1);
});

test("workflow blocks invalid state changes", async () => {
  const { transitionStatus } = await vite.ssrLoadModule("/lib/workflow.ts");
  assert.equal(transitionStatus("Pending Approval", "approve"), "Approved");
  assert.equal(transitionStatus("Posted", "approve"), null);
  assert.equal(transitionStatus("Failed", "retry"), "Synced");
  assert.equal(transitionStatus("Preparing", "set_status", "Posted"), null);
});

test("covers the complete AP and AR document workflows", async () => {
  const { ACCOUNTING_DOCUMENTS, findAccountingDocument } = await vite.ssrLoadModule("/lib/accounting-documents.ts");
  const source = await readFile(new URL("../app/kc-account-app.tsx", import.meta.url), "utf8");
  const api = await readFile(new URL("../app/api/records/route.ts", import.meta.url), "utf8");
  assert.equal(ACCOUNTING_DOCUMENTS.filter((item) => item.module === "AP").length, 9);
  assert.equal(ACCOUNTING_DOCUMENTS.filter((item) => item.module === "AR").length, 9);
  assert.equal(findAccountingDocument("AP", "Purchase Credit Note").supportsStockImpact, true);
  assert.equal(findAccountingDocument("AR", "Credit Note").supportsStockImpact, true);
  for (const code of ["PR", "PO", "PD", "GR", "PI", "PBR", "PP", "PCN", "PDN", "SQ", "SO", "SD", "DN", "SI", "BL", "RC", "SCN", "SDN"]) {
    assert.ok(ACCOUNTING_DOCUMENTS.some((item) => item.code === code), `missing ${code}`);
  }
  assert.match(source, /function DocumentWorkflowPanel/);
  assert.match(source, /name="linkedDocumentNo"/);
  assert.match(source, /name="affectsStock"/);
  assert.match(api, /ประเภทเอกสารไม่ถูกต้อง/);
  assert.match(api, /documentDefinition\?\.initialStatus/);
});

test("implements one production document form for all AP and AR documents", async () => {
  const source = await readFile(new URL("../app/kc-account-app.tsx", import.meta.url), "utf8");
  const api = await readFile(new URL("../app/api/records/route.ts", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /function AccountingDocumentDialog/);
  assert.match(source, /function DocumentPreviewSheet/);
  assert.match(source, /action: "update_document"/);
  assert.match(source, /พิมพ์ \/ บันทึก PDF/);
  assert.match(source, /หัก ณ ที่จ่าย/);
  assert.match(source, /current\.length < 10/);
  assert.match(api, /body\.action === "update_document"/);
  assert.match(api, /rawItems\.slice\(0, 10\)/);
  assert.match(api, /withholdingTax/);
  assert.match(css, /\.standard-document-dialog/);
  assert.match(css, /\.document-preview-sheet/);
  assert.match(css, /@media print/);
  assert.match(css, /size: A4 portrait/);
});

test("groups AP and AR by workflow and validates document-specific controls", async () => {
  const { ACCOUNTING_DOCUMENTS, findAccountingDocument } = await vite.ssrLoadModule("/lib/accounting-documents.ts");
  const source = await readFile(new URL("../app/kc-account-app.tsx", import.meta.url), "utf8");
  const api = await readFile(new URL("../app/api/records/route.ts", import.meta.url), "utf8");
  assert.deepEqual([...new Set(ACCOUNTING_DOCUMENTS.filter((item) => item.module === "AP").map((item) => item.group))].sort(), ["adjustment", "payment", "procurement", "receiving"]);
  assert.deepEqual([...new Set(ACCOUNTING_DOCUMENTS.filter((item) => item.module === "AR").map((item) => item.group))].sort(), ["adjustment", "billing", "collection", "sales"]);
  assert.equal(findAccountingDocument("AP", "Purchase Invoice").referenceRequired, true);
  assert.equal(findAccountingDocument("AR", "Delivery Note").referenceRequired, true);
  assert.match(source, /name="vendorInvoiceNo"/);
  assert.match(source, /name="documentTiming"/);
  assert.match(source, /ทะเบียนเอกสารซื้อ/);
  assert.match(api, /เลข Invoice ของ Vendor นี้ถูกบันทึกแล้ว/);
  assert.match(api, /documentDefinition\?\.referenceRequired/);
});

test("integration contract maps each KC source to the correct accounting module", async () => {
  const { inboundEventSchema, mapInboundEvent } = await vite.ssrLoadModule("/lib/integration-contract.ts");
  const base = { event_id: "evt-1001", occurred_at: "2026-09-02T10:00:00+07:00", document_no: "2609-1001", period: "2026-09", description: "Production integration test", counterparty: "KC Test", amount: 1250, tax_amount: 87.5, currency: "THB", metadata: {} };
  const cases = [
    ["cuto", "sales_invoice", "AR"],
    ["tory", "vendor_bill", "AP"],
    ["eam", "asset_capitalization", "GL"],
    ["hr", "payroll_tax", "TAX"],
  ];
  for (const [system, eventType, expectedModule] of cases) {
    const event = inboundEventSchema.parse({ ...base, event_id: `evt-${system}`, event_type: eventType, document_no: `${system}-1001` });
    const mapped = mapInboundEvent(system, event);
    assert.equal(mapped.module, expectedModule);
    assert.match(mapped.documentNo, new RegExp(`^${system.toUpperCase()}-`));
    assert.equal(mapped.amount, 125000);
  }
  const inventoryEvent = inboundEventSchema.parse({ ...base, event_id: "evt-inventory-name", event_type: "vendor_bill", document_no: "inventory-1001" });
  assert.equal(mapInboundEvent("tory", inventoryEvent).sourceSystem, "KC Inventory");
});

test("export permission is granted only to finance roles that can export", async () => {
  const source = await readFile(new URL("../app/api/access.ts", import.meta.url), "utf8");
  assert.match(source, /Admin:\s*\[[^\]]*"export"/);
  assert.match(source, /Accountant:\s*\[[^\]]*"export"/);
  assert.doesNotMatch(source, /Approver:\s*\[[^\]]*"export"/);
  assert.doesNotMatch(source, /Viewer:\s*\[[^\]]*"export"/);
});

test("production seed is atomic, idempotent, and PostgreSQL-safe", async () => {
  const source = await readFile(new URL("../app/api/records/route.ts", import.meta.url), "utf8");
  assert.match(source, /db\.transaction/);
  assert.match(source, /pg_advisory_xact_lock/);
  assert.match(source, /onConflictDoNothing/);
  assert.match(source, /seed_version/);
  assert.doesNotMatch(source, /env\.DB/);
});

test("client handles empty and malformed responses for every API action", async () => {
  const source = await readFile(new URL("../app/kc-account-app.tsx", import.meta.url), "utf8");
  assert.match(source, /async function readApiJson/);
  assert.match(source, /const raw = await response\.text\(\)/);
  assert.match(source, /ระบบตอบกลับข้อมูลไม่ถูกต้อง/);
  assert.match(source, /เซิร์ฟเวอร์ไม่ส่งข้อมูลกลับมา/);
  assert.doesNotMatch(source, /response\.json\(\)/);
});

test("language switch supports Thai and English and remembers the selection", async () => {
  const source = await readFile(new URL("../app/kc-account-app.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /<ToggleGroup type="single"/);
  assert.match(source, /<ToggleGroupItem value="th"/);
  assert.match(source, /<ToggleGroupItem value="en"/);
  assert.match(source, /kc-account-language/);
  assert.match(source, /document\.documentElement\.lang/);
  assert.match(source, /LanguageContext\.Provider/);
  assert.match(source, /PAGE_THAI/);
  assert.match(styles, /\.language-switch/);
  assert.match(styles, /\[data-state="on"\]/);
});

test("sign-in page follows the split enterprise layout and preserves ChatGPT authentication", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const source = await readFile(new URL("../app/signin-view.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /<SignInView signInHref=\{chatGPTSignInPath\("\/"\)\}/);
  assert.match(source, /className="signin-brand-panel"/);
  assert.match(source, /className="signin-access-panel"/);
  assert.match(source, /ChatGPT Workspace/);
  assert.match(source, /<ToggleGroup type="single"/);
  assert.doesNotMatch(source, /type="password"/);
  assert.match(styles, /\.signin-shell\s*\{[^}]*grid-template-columns:/s);
  assert.match(styles, /@media \(max-width: 820px\)/);
});

test("integration contract rejects unsupported events and unsafe source URLs", async () => {
  const { inboundEventSchema, mapInboundEvent, validateExternalBaseUrl } = await vite.ssrLoadModule("/lib/integration-contract.ts");
  const event = inboundEventSchema.parse({ event_id: "evt-invalid", event_type: "unsupported", occurred_at: "2026-09-02T10:00:00Z", document_no: "BAD-100", period: "2026-09", description: "Invalid event", amount: 1 });
  assert.throws(() => mapInboundEvent("cuto", event), /ไม่รองรับ event_type/);
  assert.throws(() => validateExternalBaseUrl("http://example.com"), /HTTPS/);
  assert.throws(() => validateExternalBaseUrl("https://127.0.0.1"), /ปลอดภัย/);
  assert.equal(validateExternalBaseUrl("https://api.example.com/"), "https://api.example.com");
});
