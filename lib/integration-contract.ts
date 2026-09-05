import { z } from "zod";

export const CONNECTOR_KEYS = ["cuto", "tory", "eam", "hr"] as const;
export type ConnectorKey = (typeof CONNECTOR_KEYS)[number];

export type ConnectorDefinition = {
  key: ConnectorKey;
  name: string;
  target: string;
  exportPath: string;
  supportedEvents: string[];
};

export const CONNECTORS: Record<ConnectorKey, ConnectorDefinition> = {
  cuto: {
    key: "cuto",
    name: "KC CuTo CRM",
    target: "AR / Cash",
    exportPath: "/api/v1/accounting/events",
    supportedEvents: ["sales_invoice", "credit_note", "receipt"],
  },
  tory: {
    key: "tory",
    name: "KC Inventory",
    target: "AP / GL",
    exportPath: "/api/v1/accounting/events",
    supportedEvents: ["vendor_bill", "goods_receipt", "inventory_adjustment"],
  },
  eam: {
    key: "eam",
    name: "KC EAM",
    target: "GL / Fixed Asset",
    exportPath: "/api/v1/accounting/events",
    supportedEvents: ["asset_capitalization", "asset_disposal", "depreciation"],
  },
  hr: {
    key: "hr",
    name: "KC HR",
    target: "GL / AP / Tax",
    exportPath: "/api/v1/accounting/events",
    supportedEvents: ["payroll_journal", "payroll_payable", "payroll_tax"],
  },
};

export const inboundEventSchema = z.object({
  event_id: z.string().trim().min(3).max(100),
  event_type: z.string().trim().min(3).max(80),
  occurred_at: z.string().datetime({ offset: true }),
  document_no: z.string().trim().min(3).max(40),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  description: z.string().trim().min(1).max(500),
  counterparty: z.string().trim().max(200).default(""),
  amount: z.number().finite().nonnegative(),
  tax_amount: z.number().finite().nonnegative().default(0),
  currency: z.string().trim().length(3).default("THB"),
  due_date: z.string().date().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type InboundEvent = z.infer<typeof inboundEventSchema>;

const EVENT_TARGETS: Record<ConnectorKey, Record<string, { module: string; recordType: string; status: string }>> = {
  cuto: {
    sales_invoice: {
      module: "AR",
      recordType: "Invoice",
      status: "Pending Approval",
    },
    credit_note: {
      module: "AR",
      recordType: "Credit Note",
      status: "Pending Approval",
    },
    receipt: { module: "CASH", recordType: "Receipt", status: "Unreconciled" },
  },
  tory: {
    vendor_bill: {
      module: "AP",
      recordType: "Vendor Bill",
      status: "Pending Approval",
    },
    goods_receipt: {
      module: "AP",
      recordType: "Goods Receipt",
      status: "Pending Approval",
    },
    inventory_adjustment: {
      module: "GL",
      recordType: "Inventory Journal",
      status: "Draft",
    },
  },
  eam: {
    asset_capitalization: {
      module: "GL",
      recordType: "Asset Capitalization",
      status: "Draft",
    },
    asset_disposal: {
      module: "GL",
      recordType: "Asset Disposal",
      status: "Draft",
    },
    depreciation: {
      module: "GL",
      recordType: "Depreciation Journal",
      status: "Draft",
    },
  },
  hr: {
    payroll_journal: {
      module: "GL",
      recordType: "Payroll Journal",
      status: "Draft",
    },
    payroll_payable: {
      module: "AP",
      recordType: "Payroll Payable",
      status: "Pending Approval",
    },
    payroll_tax: {
      module: "TAX",
      recordType: "Payroll Tax",
      status: "Preparing",
    },
  },
};

export function isConnectorKey(value: string): value is ConnectorKey {
  return CONNECTOR_KEYS.includes(value as ConnectorKey);
}

export function mapInboundEvent(system: ConnectorKey, event: InboundEvent) {
  const target = EVENT_TARGETS[system][event.event_type];
  if (!target) {
    throw new Error(`ไม่รองรับ event_type ${event.event_type} สำหรับ ${CONNECTORS[system].name}`);
  }
  return {
    ...target,
    documentNo: `${system.toUpperCase()}-${event.document_no}`.slice(0, 40),
    sourceSystem: CONNECTORS[system].name,
    counterparty: event.counterparty,
    description: event.description,
    amount: Math.round(event.amount * 100),
    taxAmount: Math.round(event.tax_amount * 100),
    currency: event.currency.toUpperCase(),
    dueDate: event.due_date || null,
    period: event.period,
    metadata: JSON.stringify({
      ...event.metadata,
      integration: {
        source: system,
        eventId: event.event_id,
        occurredAt: event.occurred_at,
        sourceDocumentNo: event.document_no,
      },
    }),
  };
}

export function connectorSecretEnvKey(system: ConnectorKey) {
  return `KC_${system.toUpperCase()}_OUTBOUND_TOKEN`;
}

export function validateExternalBaseUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Endpoint ต้องใช้ HTTPS");
  if (url.username || url.password) throw new Error("ห้ามฝัง Username หรือ Password ใน Endpoint");
  const host = url.hostname.toLowerCase();
  const allowedHosts = new Set(
    (process.env.KC_INTEGRATION_ALLOWED_HOSTS || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
  const normalizedHost = host.replace(/^\[/, "").replace(/\]$/, "");
  const blockedHost = normalizedHost === "localhost" || normalizedHost.endsWith(".local") || normalizedHost.endsWith(".internal") || normalizedHost === "::1" || normalizedHost.startsWith("fc") || normalizedHost.startsWith("fd") || normalizedHost.startsWith("fe80:") || normalizedHost === "0.0.0.0";
  const ipv4 = host
    .match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
    ?.slice(1)
    .map(Number);
  const privateIpv4 = ipv4 && (ipv4.some((part) => part > 255) || ipv4[0] === 10 || ipv4[0] === 127 || (ipv4[0] === 169 && ipv4[1] === 254) || (ipv4[0] === 172 && ipv4[1] >= 16 && ipv4[1] <= 31) || (ipv4[0] === 192 && ipv4[1] === 168));
  if ((blockedHost || privateIpv4) && !allowedHosts.has(host)) throw new Error("Endpoint ต้องเป็น Public HTTPS URL ที่ปลอดภัย หรือ Host ที่อนุญาตไว้");
  url.pathname = url.pathname.replace(/\/$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}
