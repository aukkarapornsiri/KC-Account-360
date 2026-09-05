import { findAccountingDocument } from "@/lib/accounting-documents";

const MODULE_PREFIXES: Record<string, string> = {
  GL: "JV",
  AR: "AR",
  AP: "AP",
  CASH: "BNK",
  TAX: "TAX",
  INTEGRATION: "INT",
  CLOSING: "CLS",
  BUDGET: "BUD",
};

export function documentNumberPrefix(module: string, recordType: string) {
  const normalizedModule = module.trim().toUpperCase();
  const definition = findAccountingDocument(normalizedModule, recordType.trim());
  const prefix = definition?.prefix || MODULE_PREFIXES[normalizedModule];
  if (!prefix) throw new Error("Unsupported document module");
  return prefix;
}

export function documentNumberPeriod(issueDate?: string | null, period?: string | null, now = new Date()) {
  const source = [issueDate, period].find((value) => typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])(?:-\d{2})?$/.test(value));
  return source ? source.slice(0, 7).replace("-", "") : now.toISOString().slice(0, 7).replace("-", "");
}

export function documentNumberSeriesKey(prefix: string, periodKey: string) {
  return `${prefix}:${periodKey}`;
}

export function formatDocumentNumber(prefix: string, periodKey: string, sequence: number, padding = 6) {
  if (!/^[A-Z][A-Z0-9]{0,7}$/.test(prefix) || !/^\d{6}$/.test(periodKey) || !Number.isSafeInteger(sequence) || sequence < 1) {
    throw new Error("Invalid document number components");
  }
  return `${prefix}-${periodKey}-${String(sequence).padStart(padding, "0")}`;
}

export function nextPreviewDocumentNumber(records: Array<{ documentNo: string }>, module: string, recordType: string, issueDate?: string | null, period?: string | null) {
  const prefix = documentNumberPrefix(module, recordType);
  const periodKey = documentNumberPeriod(issueDate, period);
  const pattern = new RegExp(`^${prefix}-${periodKey}-(\\d{6})$`);
  const latest = records.reduce((maximum, record) => {
    const match = record.documentNo.match(pattern);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  return formatDocumentNumber(prefix, periodKey, latest + 1);
}
