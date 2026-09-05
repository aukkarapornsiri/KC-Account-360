import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { financialRecords } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUserAccess, hasPermission } from "@/app/api/access";
import { buildPreviewData } from "@/lib/preview-data";

export const dynamic = "force-dynamic";
const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const preview = process.env.KC_PREVIEW_MODE === "true" || process.env.NODE_ENV === "development" ? buildPreviewData(user) : null;
  const access = preview ? { ...preview.access, permissions: preview.access.permissions as import("@/app/api/access").Permission[], modules: ["ALL"] } : await getUserAccess(user.email);
  if (!hasPermission(access, "export")) return new Response("Forbidden", { status: 403 });
  const moduleFilter = new URL(request.url).searchParams.get("module");
  const records = preview ? (moduleFilter && moduleFilter !== "ALL" ? preview.records.filter((record) => record.module === moduleFilter) : preview.records) : moduleFilter && moduleFilter !== "ALL" ? await getDb().select().from(financialRecords).where(eq(financialRecords.module, moduleFilter)) : await getDb().select().from(financialRecords);
  const header = ["Document No", "Module", "Type", "Counterparty", "Description", "Amount THB", "Tax THB", "Status", "Period", "Source"];
  const rows = records.map((r) => [r.documentNo, r.module, r.recordType, r.counterparty, r.description, (r.amount / 100).toFixed(2), (r.taxAmount / 100).toFixed(2), r.status, r.period, r.sourceSystem]);
  const csv = `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="kc-account-${moduleFilter || "all"}.csv"` } });
}
