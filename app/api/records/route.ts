import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { auditLogs, documentNumberSequences, documents, financialRecords, masterData, settings, userPreferences } from "@/db/schema";
import { getUserAccess, hasPermission } from "@/app/api/access";
import { buildFinanceInsights } from "@/lib/finance-insights";
import { transitionStatus, type WorkflowAction } from "@/lib/workflow";
import { connectorSecretEnvKey, type ConnectorKey } from "@/lib/integration-contract";
import { getIntegrationSnapshot } from "@/lib/integration-service";
import { findAccountingDocument } from "@/lib/accounting-documents";
import { buildPreviewData } from "@/lib/preview-data";
import { getHostedLogoKey } from "@/lib/hosted-branding";
import { documentNumberPeriod, documentNumberPrefix, documentNumberSeriesKey, formatDocumentNumber } from "@/lib/document-numbering";

export const dynamic = "force-dynamic";
const PERIOD = new Date().toISOString().slice(0, 7);
const cents = (value: number) => Math.round(value * 100);
const jsonError = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const parseMetadata = (value: string) => {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};
const MODULE_DEFAULT_STATUS: Record<string, string> = {
  GL: "Draft",
  AR: "Pending Approval",
  AP: "Pending Approval",
  CASH: "Unreconciled",
  TAX: "Preparing",
  INTEGRATION: "Queued",
  CLOSING: "Pending",
  BUDGET: "Active",
};
const SALES_DOCUMENT_STATUS: Record<string, string> = {
  Quotation: "Draft",
  "Sales Order": "Pending Approval",
  "Deposit Receipt": "Pending Approval",
  "Delivery Note": "Draft",
  Invoice: "Pending Approval",
  "Billing Note": "Draft",
  Receipt: "Received",
  "Credit Note": "Pending Approval",
  "Debit Note": "Pending Approval",
};

async function seedIfEmpty(email: string) {
  const db = getDb();
  const now = new Date().toISOString();
  // Public source distributions never include company transactions, counterparties,
  // tax identifiers, or monetary demo data. A fresh installation starts empty.
  const financialSeed: Array<{
    id: string;
    module: string;
    recordType: string;
    documentNo: string;
    sourceSystem: string;
    counterparty: string;
    description: string;
    amount: number;
    taxAmount: number;
    status: string;
    metadata: string;
    currency: string;
    period: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    dueDate?: string;
    approver?: string;
    postedAt?: string;
  }> = [];
  const settingSeed = [
    {
      key: "company_name",
      value: "KC Account 360",
      updatedBy: email,
      updatedAt: now,
    },
    { key: "tax_id", value: "", updatedBy: email, updatedAt: now },
    {
      key: "approval_limit",
      value: "500000",
      updatedBy: email,
      updatedAt: now,
    },
    { key: "current_period", value: PERIOD, updatedBy: email, updatedAt: now },
    { key: "locked_period", value: "", updatedBy: email, updatedAt: now },
  ];
  const masterSeed = [
    {
      id: crypto.randomUUID(),
      category: "COMPANY",
      code: "COMPANY-001",
      name: "KC Account 360",
      description: "กรุณากำหนดข้อมูลบริษัทก่อนเริ่มใช้งาน",
      status: "Active",
      metadata: JSON.stringify({ taxId: "" }),
      createdBy: email,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      category: "BRANCH",
      code: "BR-00000",
      name: "สำนักงานใหญ่",
      description: "กรุณากำหนดที่อยู่สาขา",
      status: "Active",
      metadata: JSON.stringify({ company: "COMPANY-001" }),
      createdBy: email,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      category: "ACCOUNT",
      code: "110100",
      name: "เงินสดและรายการเทียบเท่าเงินสด",
      description: "สินทรัพย์หมุนเวียน",
      status: "Active",
      metadata: JSON.stringify({ type: "Asset" }),
      createdBy: email,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      category: "ACCOUNT",
      code: "120100",
      name: "ลูกหนี้การค้า",
      description: "สินทรัพย์หมุนเวียน",
      status: "Active",
      metadata: JSON.stringify({ type: "Asset" }),
      createdBy: email,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      category: "ACCOUNT",
      code: "210100",
      name: "เจ้าหนี้การค้า",
      description: "หนี้สินหมุนเวียน",
      status: "Active",
      metadata: JSON.stringify({ type: "Liability" }),
      createdBy: email,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      category: "ACCOUNT",
      code: "310100",
      name: "ทุนจดทะเบียน",
      description: "ส่วนของผู้ถือหุ้น",
      status: "Active",
      metadata: JSON.stringify({ type: "Equity" }),
      createdBy: email,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      category: "ACCOUNT",
      code: "410100",
      name: "รายได้จากการขายและบริการ",
      description: "รายได้",
      status: "Active",
      metadata: JSON.stringify({ type: "Revenue" }),
      createdBy: email,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      category: "ACCOUNT",
      code: "510100",
      name: "ต้นทุนขายและบริการ",
      description: "ต้นทุน",
      status: "Active",
      metadata: JSON.stringify({ type: "Expense" }),
      createdBy: email,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      category: "USER",
      code: "USR-FIN-ADMIN",
      name: email,
      description: "Finance Administrator",
      status: "Active",
      metadata: JSON.stringify({ role: "Admin", scope: "All branches" }),
      createdBy: email,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      category: "MAPPING",
      code: "MAP-CUTO-AR",
      name: "KC CuTo CRM → AR Invoice",
      description: "customer_id → counterparty, net_total → amount",
      status: "Active",
      metadata: JSON.stringify({ source: "KC CuTo CRM", target: "AR" }),
      createdBy: email,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      category: "MAPPING",
      code: "MAP-TORY-AP",
      name: "KC Inventory → AP / Inventory Accounting",
      description: "vendor_code → counterparty, gr_value → amount",
      status: "Active",
      metadata: JSON.stringify({ source: "KC Inventory", target: "AP" }),
      createdBy: email,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      category: "MAPPING",
      code: "MAP-EAM-FA",
      name: "KC EAM → Fixed Asset",
      description: "asset_class → GL account, cost_center → branch",
      status: "Needs Review",
      metadata: JSON.stringify({ source: "KC EAM", target: "GL" }),
      createdBy: email,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      category: "MAPPING",
      code: "MAP-HR-GL",
      name: "KC HR → Payroll Journal",
      description: "department → cost center, gross_pay → debit",
      status: "Active",
      metadata: JSON.stringify({ source: "KC HR", target: "GL" }),
      createdBy: email,
      createdAt: now,
      updatedAt: now,
    },
  ];
  await db.transaction(async (tx) => {
    // Serializes concurrent first requests without holding an application-level lock.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('kc-account-bootstrap'))`);
    const [seedMarker] = await tx.select().from(settings).where(eq(settings.key, "seed_version")).limit(1);
    if (seedMarker?.value === "1") return;
    if (financialSeed.length) await tx.insert(financialRecords).values(financialSeed).onConflictDoNothing();
    await tx.insert(settings).values(settingSeed).onConflictDoNothing({ target: settings.key });
    await tx.insert(masterData).values(masterSeed).onConflictDoNothing({ target: masterData.id });
    await tx.insert(auditLogs).values({
      recordId: null,
      action: "SYSTEM_BOOTSTRAP",
      actorEmail: email,
      details: "Initialized KC Account production workspace",
      createdAt: now,
    });
    await tx
      .insert(settings)
      .values({
        key: "seed_version",
        value: "1",
        updatedBy: email,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: "1", updatedBy: email, updatedAt: now },
      });
  });
}

export async function GET() {
  try {
    const user = await getChatGPTUser();
    if (!user) return jsonError("กรุณาเข้าสู่ระบบ", 401);
    if (process.env.KC_PREVIEW_MODE === "true" || process.env.NODE_ENV === "development") {
      const preview = buildPreviewData(user);
      if (process.env.KC_PREVIEW_MODE === "true") preview.settings.brand_logo_key = await getHostedLogoKey();
      return NextResponse.json(preview, {
        headers: { "cache-control": "private, no-store" },
      });
    }
    await seedIfEmpty(user.email);
    const db = getDb();
    const [records, logs, config, files, masters, integration, preferences] = await Promise.all([db.select().from(financialRecords).orderBy(desc(financialRecords.updatedAt)), db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(80), db.select().from(settings), db.select().from(documents).orderBy(desc(documents.createdAt)), db.select().from(masterData).orderBy(masterData.category, masterData.code), getIntegrationSnapshot(user.email), db.select().from(userPreferences).where(eq(userPreferences.userId, user.email.trim().toLowerCase())).limit(1)]);
    const access = await getUserAccess(user.email);
    const configMap = Object.fromEntries(config.map((item) => [item.key, item.value]));
    const safeMasters = hasPermission(access, "manage_users") ? masters : masters.filter((item) => item.category !== "USER");
    const insights = buildFinanceInsights(records, masters, configMap, new Date(), integration.events);
    const connectors = integration.connectors.map((connector) => ({
      ...connector,
      outboundTokenConfigured: Boolean(process.env[connectorSecretEnvKey(connector.key as ConnectorKey)]?.trim()),
      inboundEndpoint: `/api/integrations/${connector.key}`,
    }));
    return NextResponse.json(
      {
        user,
        access,
        insights,
        records,
        audit: logs,
        settings: configMap,
        preferences: preferences[0] || null,
        documents: files,
        masters: safeMasters,
        connectors,
        integrationEvents: integration.events,
      },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    console.error("records.get.failed", error instanceof Error ? error.message : error);
    return jsonError("ไม่สามารถโหลดข้อมูลบัญชีได้ กรุณาลองใหม่อีกครั้ง", 500);
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return jsonError("กรุณาเข้าสู่ระบบ", 401);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") return jsonError("คำขอไม่ถูกต้อง");
  const db = getDb();
  const now = new Date().toISOString();
  const access = await getUserAccess(user.email);
  const deny = () => jsonError("คุณไม่มีสิทธิ์ดำเนินการนี้", 403);

  if (body.action === "create") {
    if (!hasPermission(access, "create")) return deny();
    const required = ["module", "recordType", "description"];
    if (required.some((key) => typeof body[key] !== "string" || !String(body[key]).trim())) return jsonError("กรอกข้อมูลที่จำเป็นให้ครบ");
    const moduleKey = String(body.module);
    if (!MODULE_DEFAULT_STATUS[moduleKey]) return jsonError("โมดูลไม่ถูกต้อง", 422);
    const recordType = String(body.recordType).trim();
    const documentDefinition = ["AR", "AP"].includes(moduleKey) ? findAccountingDocument(moduleKey, recordType) : null;
    if (["AR", "AP"].includes(moduleKey) && !documentDefinition) return jsonError("ประเภทเอกสารไม่ถูกต้อง", 422);
    const description = String(body.description).trim();
    if (description.length > 500) return jsonError("รายละเอียดต้องไม่เกิน 500 ตัวอักษร", 422);
    let amount = Number(body.amount ?? 0);
    let taxAmount = Number(body.taxAmount ?? 0);
    let metadata = "{}";
    let status = MODULE_DEFAULT_STATUS[moduleKey];
    let issueDateForNumber = "";
    if (["AR", "AP"].includes(moduleKey)) {
      const counterparty = String(body.counterparty || "").trim();
      if (!counterparty) return jsonError(moduleKey === "AR" ? "กรุณาเลือกลูกค้า" : "กรุณาระบุผู้ขายหรือเจ้าหนี้");
      if (moduleKey === "AR") {
        if (!SALES_DOCUMENT_STATUS[recordType]) return jsonError("ประเภทเอกสารขายไม่ถูกต้อง", 422);
        const [customer] = await db
          .select({ id: masterData.id })
          .from(masterData)
          .where(and(eq(masterData.category, "CUSTOMER"), eq(masterData.name, counterparty), eq(masterData.status, "Active")))
          .limit(1);
        if (!customer) return jsonError("ไม่พบลูกค้าที่ใช้งานอยู่ในทะเบียนลูกค้า", 422);
      }
      const rawMetadata = body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? (body.metadata as Record<string, unknown>) : {};
      const rawItems = Array.isArray(rawMetadata.lineItems) ? rawMetadata.lineItems : [];
      const lineItems = rawItems
        .slice(0, 10)
        .map((value) => {
          const item = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
          return {
            code: String(item.code || "")
              .trim()
              .slice(0, 80),
            description: String(item.description || "")
              .trim()
              .slice(0, 200),
            unit: String(item.unit || "รายการ")
              .trim()
              .slice(0, 40),
            quantity: Number(item.quantity || 0),
            unitPrice: Number(item.unitPrice || 0),
            discount: Number(item.discount || 0),
          };
        })
        .filter((item) => item.description && item.quantity > 0);
      if (!lineItems.length) return jsonError("กรุณาระบุสินค้า/บริการอย่างน้อย 1 รายการ");
      if (lineItems.some((item) => !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0 || !Number.isFinite(item.discount) || item.discount < 0 || item.discount > item.quantity * item.unitPrice)) return jsonError("จำนวน ราคา หรือส่วนลดของรายการไม่ถูกต้อง", 422);
      amount = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice - item.discount, 0);
      const taxRate = Number(rawMetadata.taxRate || 0);
      const whtRate = Number(rawMetadata.whtRate || 0);
      if (![0, 7].includes(taxRate)) return jsonError("อัตรา VAT ต้องเป็น 0% หรือ 7%", 422);
      if (![0, 1, 3, 5].includes(whtRate)) return jsonError("อัตราภาษีหัก ณ ที่จ่ายไม่ถูกต้อง", 422);
      taxAmount = (amount * taxRate) / 100;
      const referenceDocumentNo = String(rawMetadata.referenceDocumentNo || rawMetadata.linkedDocumentNo || "")
        .trim()
        .slice(0, 40);
      if (documentDefinition?.referenceRequired && !referenceDocumentNo) return jsonError("เอกสารประเภทนี้ต้องระบุเลขที่เอกสารต้นทาง");
      const issueDate = String(rawMetadata.issueDate || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) return jsonError("วันที่เอกสารไม่ถูกต้อง", 422);
      issueDateForNumber = issueDate;
      const paymentTerms = Number(rawMetadata.paymentTerms || 0);
      if (!Number.isFinite(paymentTerms) || paymentTerms < 0 || paymentTerms > 365) return jsonError("จำนวนวันเครดิตไม่ถูกต้อง", 422);
      const cleanText = (key: string, limit: number) =>
        String(rawMetadata[key] || "")
          .trim()
          .slice(0, limit);
      const affectsStock = documentDefinition?.supportsStockImpact ? rawMetadata.affectsStock === true || rawMetadata.affectsStock === "true" : false;
      const vendorInvoiceNo = recordType === "Purchase Invoice" ? cleanText("vendorInvoiceNo", 80) : "";
      if (recordType === "Purchase Invoice" && !vendorInvoiceNo) return jsonError("กรุณาระบุเลข Invoice ของ Vendor");
      if (vendorInvoiceNo) {
        const vendorInvoices = await db
          .select({
            counterparty: financialRecords.counterparty,
            metadata: financialRecords.metadata,
          })
          .from(financialRecords)
          .where(and(eq(financialRecords.module, "AP"), eq(financialRecords.recordType, "Purchase Invoice")));
        if (
          vendorInvoices.some(
            (item) =>
              item.counterparty.trim().toLowerCase() === counterparty.toLowerCase() &&
              String(parseMetadata(item.metadata).vendorInvoiceNo || "")
                .trim()
                .toLowerCase() === vendorInvoiceNo.toLowerCase(),
          )
        )
          return jsonError("เลข Invoice ของ Vendor นี้ถูกบันทึกแล้ว", 409);
      }
      const documentTiming = recordType === "Goods Receipt" ? "before_invoice" : recordType === "Delivery Note" ? String(rawMetadata.documentTiming || "before_invoice") : "";
      if (recordType === "Delivery Note" && !["before_invoice", "after_invoice"].includes(documentTiming)) return jsonError("ลำดับการส่งของไม่ถูกต้อง", 422);
      const withholdingTax = (amount * whtRate) / 100;
      const linkedDocumentNo = referenceDocumentNo;
      metadata = JSON.stringify({
        documentCode: documentDefinition?.code,
        issueDate,
        referenceDocumentNo,
        linkedDocumentNo,
        paymentTerms,
        taxRate,
        whtRate,
        lineItems,
        vendorInvoiceNo,
        documentTiming,
        counterpartyAddress: cleanText("counterpartyAddress", 500),
        counterpartyTaxId: cleanText("counterpartyTaxId", 20),
        contactName: cleanText("contactName", 120),
        projectName: cleanText("projectName", 200),
        preparedBy: cleanText("preparedBy", 120),
        notes: cleanText("notes", 1000),
        paymentInstructions: cleanText("paymentInstructions", 1000),
        subtotal: cents(amount),
        withholdingTax: cents(withholdingTax),
        total: cents(amount + taxAmount),
        netTotal: cents(amount + taxAmount - withholdingTax),
        affectsStock,
      });
      status = documentDefinition?.initialStatus || MODULE_DEFAULT_STATUS[moduleKey];
    }
    if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(taxAmount) || taxAmount < 0) return jsonError("จำนวนเงินหรือภาษีไม่ถูกต้อง", 422);
    const [lock] = await db.select().from(settings).where(eq(settings.key, "locked_period"));
    const period = String(body.period || PERIOD);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return jsonError("งวดบัญชีไม่ถูกต้อง", 422);
    if (lock?.value === period) return jsonError("งวดบัญชีนี้ถูกล็อกแล้ว", 409);
    const id = crypto.randomUUID();
    let documentNo = "";
    try {
      const prefix = documentNumberPrefix(moduleKey, recordType);
      const periodKey = documentNumberPeriod(issueDateForNumber, period);
      const seriesKey = documentNumberSeriesKey(prefix, periodKey);
      await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${seriesKey}))`);
        const [sequence] = await tx.select().from(documentNumberSequences).where(eq(documentNumberSequences.seriesKey, seriesKey)).limit(1);
        const allocated = sequence?.nextNumber ?? 1;
        documentNo = formatDocumentNumber(prefix, periodKey, allocated);
        if (sequence) {
          await tx
            .update(documentNumberSequences)
            .set({ nextNumber: allocated + 1, updatedAt: now })
            .where(eq(documentNumberSequences.seriesKey, seriesKey));
        } else {
          await tx.insert(documentNumberSequences).values({
            seriesKey,
            prefix,
            periodKey,
            nextNumber: 2,
            updatedAt: now,
          });
        }
        await tx.insert(financialRecords).values({
          id,
          module: moduleKey,
          recordType,
          documentNo,
          sourceSystem: String(body.sourceSystem || "KC Account"),
          counterparty: String(body.counterparty || "").slice(0, 200),
          description,
          amount: cents(amount),
          taxAmount: cents(taxAmount),
          currency: "THB",
          status,
          dueDate: body.dueDate ? String(body.dueDate) : null,
          period,
          metadata,
          createdBy: user.email,
          approver: null,
          postedAt: ["Receipt"].includes(recordType) ? now : null,
          createdAt: now,
          updatedAt: now,
        });
        await tx.insert(auditLogs).values({
          recordId: id,
          action: "CREATE",
          actorEmail: user.email,
          details: `Created ${recordType} ${documentNo}`,
          createdAt: now,
        });
      });
    } catch (error) {
      console.error("document.create.failed", error instanceof Error ? error.message : error);
      return jsonError("ไม่สามารถออกเลขที่เอกสารหรือบันทึกข้อมูลได้ กรุณาลองใหม่", 409);
    }
    return NextResponse.json({ ok: true, id, documentNo });
  }

  if (body.action === "update_document") {
    if (!hasPermission(access, "create")) return deny();
    const id = String(body.id || "");
    const [record] = await db.select().from(financialRecords).where(eq(financialRecords.id, id)).limit(1);
    if (!record) return jsonError("ไม่พบเอกสาร", 404);
    if (!["AR", "AP"].includes(record.module)) return jsonError("รายการนี้ไม่ใช่เอกสารซื้อหรือขาย", 422);
    if (!["Draft", "Pending Approval", "Rejected"].includes(record.status)) return jsonError("เอกสารสถานะนี้ไม่อนุญาตให้แก้ไข", 409);
    const definition = findAccountingDocument(record.module, record.recordType);
    if (!definition) return jsonError("ประเภทเอกสารไม่ถูกต้อง", 422);
    const [lock] = await db.select().from(settings).where(eq(settings.key, "locked_period")).limit(1);
    if (lock?.value === record.period) return jsonError("งวดบัญชีนี้ถูกล็อกแล้ว", 409);
    const counterparty = String(body.counterparty || "").trim();
    if (!counterparty) return jsonError(record.module === "AR" ? "กรุณาเลือกลูกค้า" : "กรุณาระบุผู้ขายหรือเจ้าหนี้");
    if (record.module === "AR") {
      const [customer] = await db
        .select({ id: masterData.id })
        .from(masterData)
        .where(and(eq(masterData.category, "CUSTOMER"), eq(masterData.name, counterparty), eq(masterData.status, "Active")))
        .limit(1);
      if (!customer) return jsonError("ไม่พบลูกค้าที่ใช้งานอยู่ในทะเบียนลูกค้า", 422);
    }
    const rawMetadata = body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? (body.metadata as Record<string, unknown>) : {};
    const rawItems = Array.isArray(rawMetadata.lineItems) ? rawMetadata.lineItems : [];
    const lineItems = rawItems
      .slice(0, 10)
      .map((value) => {
        const item = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
        return {
          code: String(item.code || "")
            .trim()
            .slice(0, 80),
          description: String(item.description || "")
            .trim()
            .slice(0, 200),
          unit: String(item.unit || "รายการ")
            .trim()
            .slice(0, 40),
          quantity: Number(item.quantity || 0),
          unitPrice: Number(item.unitPrice || 0),
          discount: Number(item.discount || 0),
        };
      })
      .filter((item) => item.description && item.quantity > 0);
    if (!lineItems.length) return jsonError("กรุณาระบุสินค้า/บริการอย่างน้อย 1 รายการ");
    if (lineItems.some((item) => !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0 || !Number.isFinite(item.discount) || item.discount < 0 || item.discount > item.quantity * item.unitPrice)) return jsonError("จำนวน ราคา หรือส่วนลดของรายการไม่ถูกต้อง", 422);
    const amount = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice - item.discount, 0);
    const taxRate = Number(rawMetadata.taxRate || 0);
    const whtRate = Number(rawMetadata.whtRate || 0);
    if (![0, 7].includes(taxRate) || ![0, 1, 3, 5].includes(whtRate)) return jsonError("อัตราภาษีไม่ถูกต้อง", 422);
    const taxAmount = (amount * taxRate) / 100;
    const withholdingTax = (amount * whtRate) / 100;
    const referenceDocumentNo = String(rawMetadata.referenceDocumentNo || rawMetadata.linkedDocumentNo || "")
      .trim()
      .slice(0, 40);
    if (definition.referenceRequired && !referenceDocumentNo) return jsonError("เอกสารประเภทนี้ต้องระบุเลขที่เอกสารต้นทาง");
    const issueDate = String(rawMetadata.issueDate || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) return jsonError("วันที่เอกสารไม่ถูกต้อง", 422);
    const paymentTerms = Number(rawMetadata.paymentTerms || 0);
    if (!Number.isFinite(paymentTerms) || paymentTerms < 0 || paymentTerms > 365) return jsonError("จำนวนวันเครดิตไม่ถูกต้อง", 422);
    const dueDate = body.dueDate ? String(body.dueDate) : null;
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return jsonError("รูปแบบวันครบกำหนดไม่ถูกต้อง", 422);
    const cleanText = (key: string, limit: number) =>
      String(rawMetadata[key] || "")
        .trim()
        .slice(0, limit);
    const affectsStock = definition.supportsStockImpact ? rawMetadata.affectsStock === true || rawMetadata.affectsStock === "true" : false;
    const vendorInvoiceNo = record.recordType === "Purchase Invoice" ? cleanText("vendorInvoiceNo", 80) : "";
    if (record.recordType === "Purchase Invoice" && !vendorInvoiceNo) return jsonError("กรุณาระบุเลข Invoice ของ Vendor");
    if (vendorInvoiceNo) {
      const vendorInvoices = await db
        .select({
          id: financialRecords.id,
          counterparty: financialRecords.counterparty,
          metadata: financialRecords.metadata,
        })
        .from(financialRecords)
        .where(and(eq(financialRecords.module, "AP"), eq(financialRecords.recordType, "Purchase Invoice")));
      if (
        vendorInvoices.some(
          (item) =>
            item.id !== id &&
            item.counterparty.trim().toLowerCase() === counterparty.toLowerCase() &&
            String(parseMetadata(item.metadata).vendorInvoiceNo || "")
              .trim()
              .toLowerCase() === vendorInvoiceNo.toLowerCase(),
        )
      )
        return jsonError("เลข Invoice ของ Vendor นี้ถูกบันทึกแล้ว", 409);
    }
    const documentTiming = record.recordType === "Goods Receipt" ? "before_invoice" : record.recordType === "Delivery Note" ? String(rawMetadata.documentTiming || "before_invoice") : "";
    if (record.recordType === "Delivery Note" && !["before_invoice", "after_invoice"].includes(documentTiming)) return jsonError("ลำดับการส่งของไม่ถูกต้อง", 422);
    const metadata = JSON.stringify({
      documentCode: definition.code,
      issueDate,
      referenceDocumentNo,
      linkedDocumentNo: referenceDocumentNo,
      paymentTerms,
      taxRate,
      whtRate,
      lineItems,
      vendorInvoiceNo,
      documentTiming,
      counterpartyAddress: cleanText("counterpartyAddress", 500),
      counterpartyTaxId: cleanText("counterpartyTaxId", 20),
      contactName: cleanText("contactName", 120),
      projectName: cleanText("projectName", 200),
      preparedBy: cleanText("preparedBy", 120),
      notes: cleanText("notes", 1000),
      paymentInstructions: cleanText("paymentInstructions", 1000),
      subtotal: cents(amount),
      withholdingTax: cents(withholdingTax),
      total: cents(amount + taxAmount),
      netTotal: cents(amount + taxAmount - withholdingTax),
      affectsStock,
    });
    await db
      .update(financialRecords)
      .set({
        counterparty: counterparty.slice(0, 200),
        description: lineItems
          .map((item) => item.description)
          .join(", ")
          .slice(0, 500),
        amount: cents(amount),
        taxAmount: cents(taxAmount),
        dueDate,
        metadata,
        updatedAt: now,
      })
      .where(eq(financialRecords.id, id));
    await db.insert(auditLogs).values({
      recordId: id,
      action: "UPDATE_DOCUMENT",
      actorEmail: user.email,
      details: `Updated ${record.recordType} ${record.documentNo}`,
      createdAt: now,
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "update_record") {
    if (!hasPermission(access, "create")) return deny();
    const id = String(body.id || "");
    const [record] = await db.select().from(financialRecords).where(eq(financialRecords.id, id)).limit(1);
    if (!record) return jsonError("ไม่พบรายการ", 404);
    if (record.module === "AR") {
      try {
        if (Array.isArray((JSON.parse(record.metadata) as { lineItems?: unknown }).lineItems)) return jsonError("เอกสารขายแบบมีรายการสินค้าไม่อนุญาตให้แก้ยอดรวมโดยตรง กรุณายกเลิกและสร้างเอกสารใหม่", 409);
      } catch {}
    }
    if (!["Draft", "Pending Approval", "Preparing", "Unreconciled"].includes(record.status)) return jsonError("รายการสถานะนี้ไม่อนุญาตให้แก้ไข", 409);
    const [lock] = await db.select().from(settings).where(eq(settings.key, "locked_period")).limit(1);
    if (lock?.value === record.period) return jsonError("งวดบัญชีนี้ถูกล็อกแล้ว", 409);
    const description = String(body.description || "").trim();
    const counterparty = String(body.counterparty || "").trim();
    const amount = Number(body.amount ?? 0);
    const taxAmount = Number(body.taxAmount ?? 0);
    const dueDate = body.dueDate ? String(body.dueDate) : null;
    if (!description) return jsonError("กรุณาระบุรายละเอียดรายการ");
    if (description.length > 500 || counterparty.length > 200) return jsonError("ข้อมูลยาวเกินกว่าที่ระบบกำหนด", 422);
    if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(taxAmount) || taxAmount < 0) return jsonError("จำนวนเงินหรือภาษีไม่ถูกต้อง", 422);
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return jsonError("รูปแบบวันครบกำหนดไม่ถูกต้อง", 422);
    await db
      .update(financialRecords)
      .set({
        description,
        counterparty,
        amount: cents(amount),
        taxAmount: cents(taxAmount),
        dueDate,
        updatedAt: now,
      })
      .where(eq(financialRecords.id, id));
    await db.insert(auditLogs).values({
      recordId: id,
      action: "UPDATE",
      actorEmail: user.email,
      details: `Updated ${record.documentNo}`,
      createdAt: now,
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "update_settings") {
    if (!hasPermission(access, "manage_settings")) return deny();
    const settingValues = body.settings;
    if (!settingValues || typeof settingValues !== "object" || Array.isArray(settingValues)) return jsonError("ข้อมูลการตั้งค่าไม่ถูกต้อง");
    const allowed = new Set(["company_name", "company_website", "tax_id", "approval_limit", "brand_primary", "brand_control", "brand_sync_control"]);
    const entries = Object.entries(settingValues)
      .filter(([key]) => allowed.has(key))
      .map(([key, value]) => [key, String(value ?? "").trim()] as const);
    if (!entries.length) return jsonError("ไม่พบข้อมูลการตั้งค่าที่บันทึกได้");
    const values = Object.fromEntries(entries);
    if (!values.company_name || values.company_name.length > 200) return jsonError("ชื่อ Workspace ต้องมีความยาวไม่เกิน 200 ตัวอักษร", 422);
    if (values.company_website && !/^https?:\/\/[^\s]+$/i.test(values.company_website)) return jsonError("เว็บไซต์หลักต้องขึ้นต้นด้วย http:// หรือ https://", 422);
    if (values.approval_limit && (!Number.isFinite(Number(values.approval_limit)) || Number(values.approval_limit) < 0)) return jsonError("วงเงินอนุมัติไม่ถูกต้อง", 422);
    if (values.brand_primary && !/^#[0-9a-f]{6}$/i.test(values.brand_primary)) return jsonError("สี CI หลักไม่ถูกต้อง", 422);
    if (values.brand_control && !/^#[0-9a-f]{6}$/i.test(values.brand_control)) return jsonError("สีพื้นที่ควบคุมไม่ถูกต้อง", 422);
    if (values.brand_sync_control && !["true", "false"].includes(values.brand_sync_control)) return jsonError("การตั้งค่า Sync สีไม่ถูกต้อง", 422);
    for (const [key, value] of entries)
      await db
        .insert(settings)
        .values({ key, value, updatedBy: user.email, updatedAt: now })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value, updatedBy: user.email, updatedAt: now },
        });
    await db.insert(auditLogs).values({
      recordId: null,
      action: "UPDATE_SYSTEM_SETTINGS",
      actorEmail: user.email,
      details: `Updated ${entries.map(([key]) => key).join(", ")}`,
      createdAt: now,
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "update_setting") {
    if (!hasPermission(access, "manage_settings")) return deny();
    const key = String(body.key || "");
    if (!key || key === "locked_period") return jsonError("ไม่อนุญาตให้อัปเดตค่านี้โดยตรง");
    await db
      .insert(settings)
      .values({
        key,
        value: String(body.value ?? ""),
        updatedBy: user.email,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          value: String(body.value ?? ""),
          updatedBy: user.email,
          updatedAt: now,
        },
      });
    await db.insert(auditLogs).values({
      recordId: null,
      action: "UPDATE_SETTING",
      actorEmail: user.email,
      details: `Updated ${key}`,
      createdAt: now,
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "lock_period") {
    if (!hasPermission(access, "manage_settings")) return deny();
    const period = String(body.period || PERIOD);
    const closingTasks = await db.select().from(financialRecords).where(eq(financialRecords.module, "CLOSING"));
    if (closingTasks.some((item) => item.status !== "Completed")) return jsonError("ต้องทำ Closing Checklist ให้ครบก่อนล็อกงวด", 409);
    await db
      .insert(settings)
      .values({
        key: "locked_period",
        value: period,
        updatedBy: user.email,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: period, updatedBy: user.email, updatedAt: now },
      });
    await db.insert(auditLogs).values({
      recordId: null,
      action: "LOCK_PERIOD",
      actorEmail: user.email,
      details: `Locked accounting period ${period}`,
      createdAt: now,
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "create_master") {
    const category = String(body.category || "");
    const code = String(body.code || "").trim();
    const name = String(body.name || "").trim();
    if (!["COMPANY", "BRANCH", "ACCOUNT", "CUSTOMER", "USER", "MAPPING"].includes(category)) return jsonError("ประเภท Master Data ไม่ถูกต้อง", 422);
    if (category === "USER" ? !hasPermission(access, "manage_users") : !hasPermission(access, "manage_master")) return deny();
    if (!category || !code || !name) return jsonError("กรอกประเภท รหัส และชื่อให้ครบ");
    if (category === "USER" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(name)) return jsonError("รูปแบบอีเมลผู้ใช้ไม่ถูกต้อง", 422);
    const masterMetadata = body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? (body.metadata as Record<string, unknown>) : {};
    if (category === "CUSTOMER") {
      const taxId = String(masterMetadata.taxId || "").trim();
      const email = String(masterMetadata.email || "").trim();
      const paymentTerms = Number(masterMetadata.paymentTerms || 0);
      if (taxId && !/^\d{13}$/.test(taxId)) return jsonError("เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก", 422);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError("รูปแบบอีเมลลูกค้าไม่ถูกต้อง", 422);
      if (!Number.isFinite(paymentTerms) || paymentTerms < 0 || paymentTerms > 365) return jsonError("จำนวนวันเครดิตไม่ถูกต้อง", 422);
    }
    const id = crypto.randomUUID();
    try {
      await db.insert(masterData).values({
        id,
        category,
        code,
        name,
        description: String(body.description || ""),
        status: "Active",
        metadata: JSON.stringify(masterMetadata),
        createdBy: user.email,
        createdAt: now,
        updatedAt: now,
      });
    } catch {
      return jsonError("รหัส Master ซ้ำหรือข้อมูลไม่ถูกต้อง", 409);
    }
    await db.insert(auditLogs).values({
      recordId: id,
      action: "CREATE_MASTER",
      actorEmail: user.email,
      details: `${category}: ${code} ${name}`,
      createdAt: now,
    });
    return NextResponse.json({ ok: true, id });
  }

  if (body.action === "update_master") {
    const id = String(body.id || "");
    const [item] = await db.select().from(masterData).where(eq(masterData.id, id)).limit(1);
    if (!item) return jsonError("ไม่พบ Master Data", 404);
    if (item.category === "USER" ? !hasPermission(access, "manage_users") : !hasPermission(access, "manage_master")) return deny();
    const code = String(body.code || "").trim();
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    if (!code || !name) return jsonError("กรอกรหัสและชื่อให้ครบ");
    if (code.length > 80 || name.length > 200 || description.length > 500) return jsonError("ข้อมูลยาวเกินกว่าที่ระบบกำหนด", 422);
    if (item.category === "USER" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(name)) return jsonError("รูปแบบอีเมลผู้ใช้ไม่ถูกต้อง", 422);
    const metadata = body.metadata && typeof body.metadata === "object" ? (body.metadata as Record<string, unknown>) : {};
    if (item.category === "CUSTOMER") {
      const taxId = String(metadata.taxId || "").trim();
      const email = String(metadata.email || "").trim();
      const paymentTerms = Number(metadata.paymentTerms || 0);
      if (taxId && !/^\d{13}$/.test(taxId)) return jsonError("เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก", 422);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError("รูปแบบอีเมลลูกค้าไม่ถูกต้อง", 422);
      if (!Number.isFinite(paymentTerms) || paymentTerms < 0 || paymentTerms > 365) return jsonError("จำนวนวันเครดิตไม่ถูกต้อง", 422);
    }
    if (item.category === "USER") {
      const nextRole = String(metadata.role || "Viewer");
      if (!["Admin", "Accountant", "Approver", "Viewer"].includes(nextRole)) return jsonError("Role ไม่ถูกต้อง", 422);
      let currentRole = "Viewer";
      try {
        currentRole = String((JSON.parse(item.metadata) as { role?: string }).role || "Viewer");
      } catch {}
      if (currentRole === "Admin" && nextRole !== "Admin") {
        const users = await db.select().from(masterData).where(eq(masterData.category, "USER"));
        const activeAdmins = users.filter((candidate) => {
          try {
            return candidate.status === "Active" && (JSON.parse(candidate.metadata) as { role?: string }).role === "Admin";
          } catch {
            return false;
          }
        });
        if (activeAdmins.length <= 1) return jsonError("ระบบต้องมี Admin ที่ใช้งานอยู่อย่างน้อย 1 คน", 409);
      }
    }
    try {
      await db
        .update(masterData)
        .set({
          code,
          name,
          description,
          metadata: JSON.stringify(metadata),
          updatedAt: now,
        })
        .where(eq(masterData.id, id));
    } catch {
      return jsonError("รหัส Master ซ้ำหรือข้อมูลไม่ถูกต้อง", 409);
    }
    await db.insert(auditLogs).values({
      recordId: id,
      action: "UPDATE_MASTER",
      actorEmail: user.email,
      details: `${item.category}: ${item.code} → ${code}`,
      createdAt: now,
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "toggle_master") {
    const masterId = String(body.id || "");
    const [item] = await db.select().from(masterData).where(eq(masterData.id, masterId));
    if (!item) return jsonError("ไม่พบ Master Data", 404);
    if (item.category === "USER" ? !hasPermission(access, "manage_users") : !hasPermission(access, "manage_master")) return deny();
    if (item.category === "USER" && item.status === "Active") {
      if (item.name.toLowerCase() === user.email.toLowerCase()) return jsonError("ไม่สามารถระงับผู้ใช้ที่กำลังเข้าสู่ระบบ", 409);
      let role = "Viewer";
      try {
        role = String((JSON.parse(item.metadata) as { role?: string }).role || "Viewer");
      } catch {}
      if (role === "Admin") {
        const users = await db.select().from(masterData).where(eq(masterData.category, "USER"));
        const activeAdmins = users.filter((candidate) => {
          try {
            return candidate.status === "Active" && (JSON.parse(candidate.metadata) as { role?: string }).role === "Admin";
          } catch {
            return false;
          }
        });
        if (activeAdmins.length <= 1) return jsonError("ระบบต้องมี Admin ที่ใช้งานอยู่อย่างน้อย 1 คน", 409);
      }
    }
    const status = item.status === "Active" ? "Inactive" : "Active";
    await db.update(masterData).set({ status, updatedAt: now }).where(eq(masterData.id, masterId));
    await db.insert(auditLogs).values({
      recordId: masterId,
      action: "TOGGLE_MASTER",
      actorEmail: user.email,
      details: `${item.code}: ${item.status} → ${status}`,
      createdAt: now,
    });
    return NextResponse.json({ ok: true });
  }

  const id = String(body.id || "");
  if (!id) return jsonError("ไม่พบรหัสรายการ");
  const [record] = await db.select().from(financialRecords).where(eq(financialRecords.id, id));
  if (!record) return jsonError("ไม่พบรายการ", 404);
  if (["approve", "reject"].includes(body.action) && !hasPermission(access, "approve")) return deny();
  if (["reconcile", "retry"].includes(body.action) && !hasPermission(access, "reconcile")) return deny();
  if (["post", "issue", "complete", "void", "set_status"].includes(body.action) && !hasPermission(access, "post")) return deny();
  const [lock] = await db.select().from(settings).where(eq(settings.key, "locked_period"));
  if (lock?.value === record.period && body.action !== "retry") return jsonError("งวดบัญชีนี้ถูกล็อกแล้ว", 409);
  if (body.action === "retry" && record.module === "INTEGRATION") return jsonError("รายการเดิมไม่มี Source Payload สำหรับ Retry กรุณาใช้ Integration Event Queue", 409);
  const workflowActions = ["approve", "reject", "post", "issue", "reconcile", "retry", "complete", "void", "set_status"];
  if (!workflowActions.includes(body.action)) return jsonError("การดำเนินการไม่รองรับ");
  const status = transitionStatus(record.status, body.action as WorkflowAction, typeof body.status === "string" ? body.status : undefined);
  if (!status) return jsonError(`ไม่สามารถทำรายการ ${body.action} จากสถานะ ${record.status}`, 409);
  const auditActions: Record<WorkflowAction, string> = {
    approve: "APPROVE",
    reject: "REJECT",
    post: "POST",
    issue: "ISSUE_DOCUMENT",
    reconcile: "RECONCILE",
    retry: "RETRY_INTEGRATION",
    complete: "COMPLETE_TASK",
    void: "VOID",
    set_status: "STATUS_CHANGE",
  };
  const auditAction = auditActions[body.action as WorkflowAction];
  await db
    .update(financialRecords)
    .set({
      status,
      approver: ["approve", "reject"].includes(body.action) ? user.email : record.approver,
      postedAt: body.action === "post" ? now : record.postedAt,
      updatedAt: now,
    })
    .where(eq(financialRecords.id, id));
  await db.insert(auditLogs).values({
    recordId: id,
    action: auditAction,
    actorEmail: user.email,
    details: `${record.documentNo}: ${record.status} → ${status}`,
    createdAt: now,
  });
  return NextResponse.json({ ok: true });
}
