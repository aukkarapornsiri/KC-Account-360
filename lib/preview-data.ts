import type { ChatGPTUser } from "@/app/chatgpt-auth";

const createdAt = "2026-09-05T01:30:00.000Z";

export function buildPreviewData(user: ChatGPTUser) {
  const qaDocuments = [
    ["AP", "PR", "Purchase Requisition", "Draft"], ["AP", "PO", "Purchase Order", "Pending Approval"], ["AP", "PD", "Purchase Deposit", "Pending Approval"],
    ["AP", "GR", "Goods Receipt", "Draft"], ["AP", "PI", "Purchase Invoice", "Pending Approval"], ["AP", "PBR", "Purchase Billing Receipt", "Draft"],
    ["AP", "PP", "Purchase Payment", "Pending Approval"], ["AP", "PCN", "Purchase Credit Note", "Pending Approval"], ["AP", "PDN", "Purchase Debit Note", "Pending Approval"],
    ["AR", "SQ", "Quotation", "Draft"], ["AR", "SO", "Sales Order", "Pending Approval"], ["AR", "SD", "Deposit Receipt", "Pending Approval"],
    ["AR", "DN", "Delivery Note", "Draft"], ["AR", "SI", "Invoice", "Pending Approval"], ["AR", "BL", "Billing Note", "Draft"],
    ["AR", "RC", "Receipt", "Pending Approval"], ["AR", "SCN", "Credit Note", "Pending Approval"], ["AR", "SDN", "Debit Note", "Pending Approval"],
  ].map(([module, code, recordType, status], index) => ({ id: `bde7c577-143a-47ac-92bf-${String(720834950000 + index)}`, module, recordType, documentNo: `${code}-QA-001`, sourceSystem: module === "AR" ? "KC CuTo CRM" : "KC ToRy", counterparty: module === "AR" ? "QA Customer Co., Ltd." : "QA Vendor Co., Ltd.", description: `${recordType} functional test document`, amount: 100000, taxAmount: 7000, currency: "THB", status, dueDate: "2026-09-30", period: "2026-09", metadata: JSON.stringify({ qaFixture: true, documentCode: code }), createdBy: user.email, approver: null, postedAt: null, createdAt, updatedAt: createdAt }));
  const records = [
    ...qaDocuments,
    { id: "bde7c577-143a-47ac-92bf-72e083494101", module: "AR", recordType: "Invoice", documentNo: "SI-PREVIEW-001", sourceSystem: "KC CuTo CRM", counterparty: "ลูกค้าตัวอย่าง A", description: "ค่าบริการรายเดือน", amount: 12840000, taxAmount: 898800, currency: "THB", status: "Pending Approval", dueDate: "2026-08-31", period: "2026-09", metadata: "{}", createdBy: user.email, approver: null, postedAt: null, createdAt, updatedAt: createdAt },
    { id: "bde7c577-143a-47ac-92bf-72e083494102", module: "AP", recordType: "Purchase Invoice", documentNo: "PI-PREVIEW-004", sourceSystem: "KC Inventory", counterparty: "ผู้ขายตัวอย่าง B", description: "วัสดุสำนักงาน", amount: 4680000, taxAmount: 327600, currency: "THB", status: "Pending Approval", dueDate: "2026-09-18", period: "2026-09", metadata: "{}", createdBy: user.email, approver: null, postedAt: null, createdAt, updatedAt: createdAt },
    { id: "bde7c577-143a-47ac-92bf-72e083494103", module: "CASH", recordType: "Bank Transaction", documentNo: "BNK-PREVIEW-008", sourceSystem: "Manual", counterparty: "ธนาคารตัวอย่าง", description: "รายการรับชำระรอกระทบยอด", amount: 7250000, taxAmount: 0, currency: "THB", status: "Unreconciled", dueDate: null, period: "2026-09", metadata: "{}", createdBy: user.email, approver: null, postedAt: null, createdAt, updatedAt: createdAt },
    { id: "bde7c577-143a-47ac-92bf-72e083494104", module: "GL", recordType: "Journal", documentNo: "JV-PREVIEW-012", sourceSystem: "Manual", counterparty: "", description: "ปรับปรุงค่าใช้จ่ายค้างจ่าย", amount: 2400000, taxAmount: 0, currency: "THB", status: "Posted", dueDate: null, period: "2026-09", metadata: "{}", createdBy: user.email, approver: "approver@example.invalid", postedAt: createdAt, createdAt, updatedAt: createdAt },
    { id: "bde7c577-143a-47ac-92bf-72e083494105", module: "TAX", recordType: "Tax Filing", documentNo: "TAX-PREVIEW-003", sourceSystem: "KC Account 360", counterparty: "", description: "แบบภาษีประจำเดือน", amount: 1226400, taxAmount: 0, currency: "THB", status: "Preparing", dueDate: "2026-09-15", period: "2026-09", metadata: "{}", createdBy: user.email, approver: null, postedAt: null, createdAt, updatedAt: createdAt },
    { id: "bde7c577-143a-47ac-92bf-72e083494106", module: "INTEGRATION", recordType: "Inbound Event", documentNo: "INT-PREVIEW-021", sourceSystem: "KC EAM", counterparty: "", description: "Asset mapping requires review", amount: 0, taxAmount: 0, currency: "THB", status: "Failed", dueDate: null, period: "2026-09", metadata: "{}", createdBy: user.email, approver: null, postedAt: null, createdAt, updatedAt: createdAt },
    { id: "bde7c577-143a-47ac-92bf-72e083494107", module: "CLOSING", recordType: "Closing Task", documentNo: "CLS-PREVIEW-002", sourceSystem: "KC Account 360", counterparty: "", description: "ตรวจสอบบัญชีพัก", amount: 0, taxAmount: 0, currency: "THB", status: "Pending", dueDate: "2026-09-07", period: "2026-09", metadata: "{}", createdBy: user.email, approver: null, postedAt: null, createdAt, updatedAt: createdAt },
  ];
  return {
    user,
    access: { role: "Admin", permissions: ["read", "create", "post", "approve", "reconcile", "close_period", "review_ai", "export", "manage_master", "manage_users", "manage_settings", "manage_integrations"] },
    insights: [],
    records,
    audit: [{ id: 1, recordId: null, action: "PREVIEW_OPENED", actorEmail: user.email, details: "Opened sanitized UX preview", createdAt }],
    settings: { preview_mode: "true", company_name: "KC Account 360 · Preview", current_period: "2026-09", locked_period: "", approval_limit: "500000", brand_primary: "#0AADA9", brand_control: "#172033", brand_sync_control: "false" },
    preferences: { language: "th", theme: "light", tableDensity: "comfortable", sidebarMode: "expanded", pageWidth: "full", dateFormat: "DD/MM/YYYY", negativeNumberFormat: "parentheses" },
    documents: [],
    masters: [
      { id: "6f333eb5-8a33-41c2-89fe-a097c3381001", category: "COMPANY", code: "COMPANY-PREVIEW", name: "KC Account 360 · Preview", description: "พื้นที่ตรวจหน้าจอ ไม่ใช่ข้อมูล Production", status: "Active", metadata: "{}", createdBy: user.email, createdAt, updatedAt: createdAt },
      { id: "6f333eb5-8a33-41c2-89fe-a097c3381002", category: "CUSTOMER", code: "CUS-PREVIEW-01", name: "ลูกค้าตัวอย่าง A", description: "ข้อมูลสำหรับ Preview เท่านั้น", status: "Active", metadata: "{}", createdBy: user.email, createdAt, updatedAt: createdAt },
      ...[
        ["USR-QA-ADMIN", "qa.admin@example.invalid", "SYSTEM_ADMIN", "IT"], ["USR-QA-MGR", "qa.accounting.manager@example.invalid", "ACCOUNTING_MANAGER", "Accounting"],
        ["USR-QA-ACC", "qa.accountant@example.invalid", "ACCOUNTANT", "Accounting"], ["USR-QA-AP", "qa.ap@example.invalid", "AP_OFFICER", "Procurement / AP"],
        ["USR-QA-AR", "qa.ar@example.invalid", "AR_OFFICER", "Sales / AR"], ["USR-QA-TR", "qa.treasury@example.invalid", "TREASURY", "Finance"],
        ["USR-QA-TAX", "qa.tax@example.invalid", "TAX_OFFICER", "Tax"], ["USR-QA-CFO", "qa.cfo@example.invalid", "EXECUTIVE_APPROVER", "Management"],
        ["USR-QA-AUD", "qa.audit@example.invalid", "INTERNAL_AUDITOR", "Audit"], ["USR-QA-INT", "qa.integration@example.invalid", "INTEGRATION_ADMIN", "IT / Integration"],
      ].map(([code, email, role, department], index) => ({ id: `6f333eb5-8a33-41c2-89fe-${String(109700000000 + index)}`, category: "USER", code, name: email, description: `${department} · QA only`, status: "Active", metadata: JSON.stringify({ role, scope: "All branches", qaFixture: true }), createdBy: user.email, createdAt, updatedAt: createdAt })),
    ],
    connectors: [
      { key: "cuto", name: "KC CuTo CRM", baseUrl: "https://preview.invalid", status: "Ready", cursor: "", recordsSynced: 128, lastSyncAt: createdAt, lastSuccessAt: createdAt, lastError: null, updatedAt: createdAt, inboundKeyConfigured: false, outboundTokenConfigured: false, inboundEndpoint: "/api/integrations/cuto" },
      { key: "tory", name: "KC Inventory", baseUrl: "https://preview.invalid", status: "Ready", cursor: "", recordsSynced: 64, lastSyncAt: createdAt, lastSuccessAt: createdAt, lastError: null, updatedAt: createdAt, inboundKeyConfigured: false, outboundTokenConfigured: false, inboundEndpoint: "/api/integrations/tory" },
      { key: "eam", name: "KC EAM", baseUrl: "https://preview.invalid", status: "Needs Review", cursor: "", recordsSynced: 31, lastSyncAt: createdAt, lastSuccessAt: null, lastError: "Preview mapping exception", updatedAt: createdAt, inboundKeyConfigured: false, outboundTokenConfigured: false, inboundEndpoint: "/api/integrations/eam" },
      { key: "hr", name: "KC HR", baseUrl: "https://preview.invalid", status: "Ready", cursor: "", recordsSynced: 42, lastSyncAt: createdAt, lastSuccessAt: createdAt, lastError: null, updatedAt: createdAt, inboundKeyConfigured: false, outboundTokenConfigured: false, inboundEndpoint: "/api/integrations/hr" },
    ],
    integrationEvents: [{ id: "31243e14-3ad8-4dda-9e4c-2825bb8f3801", sourceSystem: "KC EAM", externalEventId: "preview-event-021", eventType: "asset_capitalization", direction: "INBOUND", status: "Failed", financialRecordId: null, error: "Preview mapping exception", retryCount: 1, receivedAt: createdAt, processedAt: null }],
  };
}
