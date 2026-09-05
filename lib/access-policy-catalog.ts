import type { Permission } from "@/app/api/access";

export type PolicyTemplate = {
  key: string;
  name: string;
  department: string;
  description: string;
  permissions: Permission[];
  modules: string[];
  isSystem: boolean;
};

export const DEFAULT_POLICY_TEMPLATES: PolicyTemplate[] = [
  { key: "SYSTEM_ADMIN", name: "System Administrator", department: "IT", description: "จัดการระบบ ผู้ใช้ Policy Integration และการตั้งค่าทั้งหมด", permissions: ["read", "create", "post", "approve", "reconcile", "close_period", "review_ai", "export", "manage_master", "manage_users", "manage_settings", "manage_integrations"], modules: ["ALL"], isSystem: true },
  { key: "ACCOUNTING_MANAGER", name: "Accounting Manager", department: "Accounting", description: "ควบคุมบัญชี อนุมัติ ปิดงวด และตรวจ AI recommendation", permissions: ["read", "create", "post", "approve", "reconcile", "close_period", "review_ai", "export", "manage_master"], modules: ["GL", "AP", "AR", "CASH", "TAX", "CLOSING", "REPORTS"], isSystem: true },
  { key: "ACCOUNTANT", name: "Accountant", department: "Accounting", description: "บันทึกและ Post รายการ กระทบยอด และจัดทำรายงาน", permissions: ["read", "create", "post", "reconcile", "review_ai", "export", "manage_master"], modules: ["GL", "AP", "AR", "CASH", "TAX", "REPORTS"], isSystem: true },
  { key: "AP_OFFICER", name: "Accounts Payable Officer", department: "Procurement / AP", description: "จัดทำเอกสารซื้อและเจ้าหนี้โดยไม่มีสิทธิ์อนุมัติเอง", permissions: ["read", "create", "export"], modules: ["AP", "CASH", "REPORTS"], isSystem: true },
  { key: "AR_OFFICER", name: "Accounts Receivable Officer", department: "Sales / AR", description: "จัดทำเอกสารขายและลูกหนี้โดยไม่มีสิทธิ์อนุมัติเอง", permissions: ["read", "create", "export"], modules: ["AR", "CASH", "REPORTS"], isSystem: true },
  { key: "TREASURY", name: "Treasury Officer", department: "Finance", description: "รับจ่ายเงินและกระทบยอดธนาคาร", permissions: ["read", "create", "reconcile", "export"], modules: ["CASH", "AP", "AR", "REPORTS"], isSystem: true },
  { key: "TAX_OFFICER", name: "Tax Officer", department: "Tax", description: "จัดทำและ Post รายการภาษี", permissions: ["read", "create", "post", "export"], modules: ["TAX", "AP", "AR", "REPORTS"], isSystem: true },
  { key: "EXECUTIVE_APPROVER", name: "Executive / CFO Approver", department: "Management", description: "อ่านรายงาน อนุมัติ และตรวจคำแนะนำ AI", permissions: ["read", "approve", "review_ai", "export"], modules: ["GL", "AP", "AR", "CASH", "CLOSING", "REPORTS", "AI"], isSystem: true },
  { key: "INTERNAL_AUDITOR", name: "Internal Auditor", department: "Audit", description: "อ่าน ตรวจสอบ Audit Trail และส่งออกรายงาน", permissions: ["read", "export"], modules: ["ALL"], isSystem: true },
  { key: "INTEGRATION_ADMIN", name: "Integration Administrator", department: "IT / Integration", description: "ดูแล Connector, API key, retry และ reconciliation", permissions: ["read", "reconcile", "manage_integrations"], modules: ["INTEGRATION", "RECONCILIATION"], isSystem: true },
];
