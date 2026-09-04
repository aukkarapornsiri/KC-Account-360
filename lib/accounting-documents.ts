export type AccountingModule = "AR" | "AP";

export type AccountingDocumentDefinition = {
  module: AccountingModule;
  code: string;
  type: string;
  th: string;
  en: string;
  prefix: string;
  initialStatus: "Draft" | "Pending Approval";
  supportsStockImpact?: boolean;
  group: "procurement" | "receiving" | "payment" | "adjustment" | "sales" | "billing" | "collection";
  referenceRequired?: boolean;
};

export const ACCOUNTING_DOCUMENTS: AccountingDocumentDefinition[] = [
  { module: "AP", code: "PR", type: "Purchase Requisition", th: "ใบขอซื้อ", en: "Purchase Requisition", prefix: "PR", initialStatus: "Draft", group: "procurement" },
  { module: "AP", code: "PO", type: "Purchase Order", th: "ใบสั่งซื้อ", en: "Purchase Order", prefix: "PO", initialStatus: "Pending Approval", group: "procurement", referenceRequired: true },
  { module: "AP", code: "PD", type: "Purchase Deposit", th: "ใบมัดจำซื้อ", en: "Purchase Deposit", prefix: "PD", initialStatus: "Pending Approval", group: "payment", referenceRequired: true },
  { module: "AP", code: "GR", type: "Goods Receipt", th: "ใบรับของ", en: "Goods Receipt", prefix: "GR", initialStatus: "Draft", group: "receiving", referenceRequired: true },
  { module: "AP", code: "PI", type: "Purchase Invoice", th: "ใบแจ้งหนี้ซื้อ", en: "Purchase Invoice", prefix: "PI", initialStatus: "Pending Approval", group: "receiving", referenceRequired: true },
  { module: "AP", code: "PBR", type: "Purchase Billing Receipt", th: "ใบรับวางบิล", en: "Purchase Billing Receipt", prefix: "PBR", initialStatus: "Draft", group: "receiving", referenceRequired: true },
  { module: "AP", code: "PP", type: "Purchase Payment", th: "ใบเสร็จซื้อ / จ่ายชำระ", en: "Purchase Payment", prefix: "PP", initialStatus: "Pending Approval", group: "payment", referenceRequired: true },
  { module: "AP", code: "PCN", type: "Purchase Credit Note", th: "ใบลดหนี้ซื้อ", en: "Purchase Credit Note", prefix: "PCN", initialStatus: "Pending Approval", supportsStockImpact: true, group: "adjustment", referenceRequired: true },
  { module: "AP", code: "PDN", type: "Purchase Debit Note", th: "ใบเพิ่มหนี้ซื้อ", en: "Purchase Debit Note", prefix: "PDN", initialStatus: "Pending Approval", group: "adjustment", referenceRequired: true },
  { module: "AR", code: "SQ", type: "Quotation", th: "ใบเสนอราคา", en: "Sales Quotation", prefix: "SQ", initialStatus: "Draft", group: "sales" },
  { module: "AR", code: "SO", type: "Sales Order", th: "ใบสั่งขาย", en: "Sales Order", prefix: "SO", initialStatus: "Pending Approval", group: "sales", referenceRequired: true },
  { module: "AR", code: "SD", type: "Deposit Receipt", th: "ใบรับมัดจำ", en: "Deposit Receipt", prefix: "SD", initialStatus: "Pending Approval", group: "collection", referenceRequired: true },
  { module: "AR", code: "DN", type: "Delivery Note", th: "ใบส่งของ", en: "Delivery Note", prefix: "DN", initialStatus: "Draft", group: "billing", referenceRequired: true },
  { module: "AR", code: "SI", type: "Invoice", th: "ใบแจ้งหนี้ขาย", en: "Sales Invoice", prefix: "SI", initialStatus: "Pending Approval", group: "billing" },
  { module: "AR", code: "BL", type: "Billing Note", th: "ใบวางบิล", en: "Billing Note", prefix: "BL", initialStatus: "Draft", group: "billing", referenceRequired: true },
  { module: "AR", code: "RC", type: "Receipt", th: "ใบเสร็จรับเงิน", en: "Receipt", prefix: "RC", initialStatus: "Pending Approval", group: "collection", referenceRequired: true },
  { module: "AR", code: "SCN", type: "Credit Note", th: "ใบลดหนี้ขาย", en: "Sales Credit Note", prefix: "SCN", initialStatus: "Pending Approval", supportsStockImpact: true, group: "adjustment", referenceRequired: true },
  { module: "AR", code: "SDN", type: "Debit Note", th: "ใบเพิ่มหนี้ขาย", en: "Sales Debit Note", prefix: "SDN", initialStatus: "Pending Approval", group: "adjustment", referenceRequired: true },
];

export const documentsForModule = (module: string) => ACCOUNTING_DOCUMENTS.filter((item) => item.module === module);
export const findAccountingDocument = (module: string, type: string) => ACCOUNTING_DOCUMENTS.find((item) => item.module === module && item.type === type);
