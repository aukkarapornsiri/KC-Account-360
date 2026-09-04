import "server-only";
import { and, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  accountingEvents,
  accountingPeriods,
  approvalInstances,
  approvalRules,
  approvalSteps,
  auditEvents,
  branches,
  chartOfAccounts,
  companies,
  exchangeRates,
  journalEntries,
  journalLines,
  postingRules,
} from "@/db/schema";

const lineRuleSchema = z.object({
  side: z.enum(["DEBIT", "CREDIT"]),
  accountCode: z.string().trim().min(1).max(50),
  amount: z.enum(["AMOUNT", "TAX", "GROSS"]),
  description: z.string().trim().max(250).optional(),
});

const postingLineRulesSchema = z.array(lineRuleSchema).min(2).max(50);
const postingConditionsSchema = z.object({
  sourceDocumentType: z.string().optional(),
  currency: z.string().length(3).optional(),
  minimumAmount: z.string().regex(/^\d{1,16}(\.\d{1,4})?$/).optional(),
  maximumAmount: z.string().regex(/^\d{1,16}(\.\d{1,4})?$/).optional(),
}).strict();

export const accountingEventInputSchema = z.object({
  tenantId: z.string().uuid(),
  companyId: z.string().uuid(),
  branchId: z.string().uuid().nullable().optional(),
  eventId: z.string().trim().min(3).max(100),
  eventType: z.string().trim().min(3).max(80),
  sourceSystem: z.string().trim().min(2).max(80).transform((value) => value.toLowerCase()),
  sourceDocumentType: z.string().trim().min(2).max(80),
  sourceDocumentId: z.string().trim().min(1).max(120),
  idempotencyKey: z.string().trim().min(3).max(160),
  correlationId: z.string().trim().max(160).nullable().optional(),
  transactionDate: z.string().date(),
  accountingDate: z.string().date(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  amount: z.string().regex(/^\d{1,16}(\.\d{1,4})?$/),
  tax: z.string().regex(/^\d{1,16}(\.\d{1,4})?$/).default("0"),
  dimensions: z.record(z.string(), z.string()).default({}),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type AccountingEventInput = z.infer<typeof accountingEventInputSchema>;

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function decimalToUnits(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 10_000n + BigInt(fraction.padEnd(4, "0"));
}

export function unitsToDecimal(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / 10_000n}.${String(absolute % 10_000n).padStart(4, "0")}`;
}

function rateToUnits(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 10_000_000_000n + BigInt(fraction.padEnd(10, "0").slice(0, 10));
}

function applyRate(value: bigint, rate: string) {
  return (value * rateToUnits(rate) + 5_000_000_000n) / 10_000_000_000n;
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505");
}

export async function processAccountingEvent(rawInput: unknown, actor: string) {
  const input = accountingEventInputSchema.parse(rawInput);
  const db = getDb();
  const payloadHash = await sha256(canonicalJson(input));

  try {
    return await db.transaction(async (tx) => {
      const [company] = await tx.select({ id: companies.id, baseCurrency: companies.baseCurrency }).from(companies).where(and(eq(companies.id, input.companyId), eq(companies.tenantId, input.tenantId), eq(companies.status, "ACTIVE"))).limit(1);
      if (!company) throw new Error("COMPANY_SCOPE_INVALID");
      if (input.branchId) {
        const [branch] = await tx.select({ id: branches.id }).from(branches).where(and(eq(branches.id, input.branchId), eq(branches.companyId, input.companyId), eq(branches.tenantId, input.tenantId), eq(branches.status, "ACTIVE"))).limit(1);
        if (!branch) throw new Error("BRANCH_SCOPE_INVALID");
      }

      const [existing] = await tx.select().from(accountingEvents).where(and(eq(accountingEvents.tenantId, input.tenantId), eq(accountingEvents.sourceSystem, input.sourceSystem), eq(accountingEvents.idempotencyKey, input.idempotencyKey))).limit(1);
      let retryEventId: string | null = null;
      if (existing) {
        if (existing.payloadHash !== payloadHash) throw new Error("IDEMPOTENCY_PAYLOAD_CONFLICT");
        if (existing.status !== "FAILED") {
          const [journal] = await tx.select({ id: journalEntries.id, journalNo: journalEntries.journalNo, status: journalEntries.status }).from(journalEntries).where(eq(journalEntries.accountingEventId, existing.id)).limit(1);
          return { duplicate: true, eventId: existing.id, eventStatus: existing.status, journal: journal || null };
        }
        retryEventId = existing.id;
      }

      const [period] = await tx.select().from(accountingPeriods).where(and(
        eq(accountingPeriods.companyId, input.companyId),
        lte(accountingPeriods.startsOn, input.accountingDate),
        gte(accountingPeriods.endsOn, input.accountingDate),
      )).limit(1);
      if (!period || !["OPEN", "SOFT_CLOSE"].includes(period.status)) throw new Error("ACCOUNTING_PERIOD_CLOSED");

      const amount = decimalToUnits(input.amount);
      const tax = decimalToUnits(input.tax);
      const gross = amount + tax;
      const candidateRules = await tx.select().from(postingRules).where(and(
        eq(postingRules.companyId, input.companyId),
        eq(postingRules.eventType, input.eventType),
        eq(postingRules.status, "APPROVED"),
        lte(postingRules.effectiveFrom, input.accountingDate),
        or(isNull(postingRules.effectiveTo), gte(postingRules.effectiveTo, input.accountingDate)),
      )).orderBy(desc(postingRules.versionNo));
      const rule = candidateRules.find((candidate) => {
        const conditions = postingConditionsSchema.parse(candidate.conditions);
        return (!conditions.sourceDocumentType || conditions.sourceDocumentType === input.sourceDocumentType)
          && (!conditions.currency || conditions.currency.toUpperCase() === input.currency)
          && (!conditions.minimumAmount || amount >= decimalToUnits(conditions.minimumAmount))
          && (!conditions.maximumAmount || amount <= decimalToUnits(conditions.maximumAmount));
      });
      if (!rule) throw new Error("POSTING_RULE_NOT_FOUND");

      const ruleLines = postingLineRulesSchema.parse(rule.lineRules);
      const calculated = ruleLines.map((line) => ({ ...line, units: line.amount === "AMOUNT" ? amount : line.amount === "TAX" ? tax : gross })).filter((line) => line.units > 0n);
      const debit = calculated.filter((line) => line.side === "DEBIT").reduce((sum, line) => sum + line.units, 0n);
      const credit = calculated.filter((line) => line.side === "CREDIT").reduce((sum, line) => sum + line.units, 0n);
      if (debit === 0n || debit !== credit) throw new Error("JOURNAL_UNBALANCED");

      const accountCodes = [...new Set(calculated.map((line) => line.accountCode))];
      const accounts = await tx.select({ id: chartOfAccounts.id, code: chartOfAccounts.code }).from(chartOfAccounts).where(and(eq(chartOfAccounts.companyId, input.companyId), eq(chartOfAccounts.status, "ACTIVE")));
      const accountMap = new Map(accounts.filter((account) => accountCodes.includes(account.code)).map((account) => [account.code, account.id]));
      if (accountMap.size !== accountCodes.length) throw new Error("POSTING_ACCOUNT_NOT_FOUND");

      let exchangeRate = "1";
      if (input.currency !== company.baseCurrency) {
        const [rate] = await tx.select({ rate: exchangeRates.rate }).from(exchangeRates).where(and(
          eq(exchangeRates.companyId, input.companyId),
          eq(exchangeRates.fromCurrency, input.currency),
          eq(exchangeRates.toCurrency, company.baseCurrency),
          lte(exchangeRates.rateDate, input.accountingDate),
        )).orderBy(desc(exchangeRates.rateDate)).limit(1);
        if (!rate) throw new Error("EXCHANGE_RATE_NOT_FOUND");
        exchangeRate = rate.rate;
      }

      const eventValues = {
        tenantId: input.tenantId,
        companyId: input.companyId,
        branchId: input.branchId || null,
        eventId: input.eventId,
        eventType: input.eventType,
        sourceSystem: input.sourceSystem,
        sourceDocumentType: input.sourceDocumentType,
        sourceDocumentId: input.sourceDocumentId,
        idempotencyKey: input.idempotencyKey,
        correlationId: input.correlationId || null,
        transactionDate: input.transactionDate,
        accountingDate: input.accountingDate,
        currency: input.currency,
        amount: input.amount,
        tax: input.tax,
        dimensions: input.dimensions,
        metadata: input.metadata,
        payloadHash,
        status: "VALIDATED",
        failureCode: null,
        failureDetail: null,
        processedAt: new Date().toISOString(),
      };
      const [event] = retryEventId
        ? await tx.update(accountingEvents).set({ ...eventValues, retryCount: sql`${accountingEvents.retryCount} + 1` }).where(eq(accountingEvents.id, retryEventId)).returning()
        : await tx.insert(accountingEvents).values(eventValues).returning();

      const [approvalRule] = await tx.select().from(approvalRules).where(and(eq(approvalRules.companyId, input.companyId), eq(approvalRules.documentType, `JOURNAL:${input.eventType}`), eq(approvalRules.status, "ACTIVE"))).limit(1);
      const status = approvalRule ? "PENDING_APPROVAL" : "DRAFT";
      const journalNo = `EV-${event.id.replaceAll("-", "").slice(0, 20).toUpperCase()}`;
      const [journal] = await tx.insert(journalEntries).values({
        tenantId: input.tenantId,
        companyId: input.companyId,
        branchId: input.branchId || null,
        periodId: period.id,
        accountingEventId: event.id,
        journalNo,
        journalType: input.eventType,
        accountingDate: input.accountingDate,
        description: `${input.sourceDocumentType} ${input.sourceDocumentId}`,
        currency: input.currency,
        exchangeRate,
        status,
        createdBy: actor,
      }).returning();

      await tx.insert(journalLines).values(calculated.map((line, index) => ({
        journalEntryId: journal.id,
        lineNo: index + 1,
        accountId: accountMap.get(line.accountCode)!,
        description: line.description || journal.description,
        debit: line.side === "DEBIT" ? unitsToDecimal(line.units) : "0",
        credit: line.side === "CREDIT" ? unitsToDecimal(line.units) : "0",
        baseDebit: line.side === "DEBIT" ? unitsToDecimal(applyRate(line.units, exchangeRate)) : "0",
        baseCredit: line.side === "CREDIT" ? unitsToDecimal(applyRate(line.units, exchangeRate)) : "0",
        dimensions: input.dimensions,
      })));

      await tx.insert(auditEvents).values({
        tenantId: input.tenantId,
        companyId: input.companyId,
        branchId: input.branchId || null,
        module: "GL",
        entityType: "JOURNAL",
        entityId: journal.id,
        action: "CREATE_FROM_ACCOUNTING_EVENT",
        actorUserId: actor,
        newValue: { journalNo: journal.journalNo, status, eventType: input.eventType },
        sourceSystem: input.sourceSystem,
        requestId: input.idempotencyKey,
        correlationId: input.correlationId || null,
      });

      if (approvalRule) {
        const steps = z.array(z.object({ role: z.string().min(1), userId: z.string().optional() })).min(1).parse(approvalRule.steps);
        const [instance] = await tx.insert(approvalInstances).values({ tenantId: input.tenantId, companyId: input.companyId, ruleId: approvalRule.id, entityType: "JOURNAL", entityId: journal.id, makerUserId: actor }).returning();
        await tx.insert(approvalSteps).values(steps.map((step, index) => ({ approvalInstanceId: instance.id, stepNo: index + 1, approverRole: step.role, approverUserId: step.userId || null })));
      }

      return { duplicate: false, eventId: event.id, eventStatus: event.status, journal: { id: journal.id, journalNo: journal.journalNo, status: journal.status } };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const [existing] = await db.select().from(accountingEvents).where(and(eq(accountingEvents.tenantId, input.tenantId), eq(accountingEvents.sourceSystem, input.sourceSystem), eq(accountingEvents.idempotencyKey, input.idempotencyKey))).limit(1);
      if (existing?.payloadHash === payloadHash) {
        const [journal] = await db.select({ id: journalEntries.id, journalNo: journalEntries.journalNo, status: journalEntries.status }).from(journalEntries).where(eq(journalEntries.accountingEventId, existing.id)).limit(1);
        return { duplicate: true, eventId: existing.id, eventStatus: existing.status, journal: journal || null };
      }
      throw new Error("IDEMPOTENCY_CONFLICT");
    }
    const failureCode = error instanceof Error ? error.message.slice(0, 100) : "ACCOUNTING_EVENT_FAILED";
    if (!failureCode.includes("SCOPE_INVALID") && !failureCode.includes("IDEMPOTENCY")) {
      try {
        await db.insert(accountingEvents).values({
          tenantId: input.tenantId,
          companyId: input.companyId,
          branchId: input.branchId || null,
          eventId: input.eventId,
          eventType: input.eventType,
          sourceSystem: input.sourceSystem,
          sourceDocumentType: input.sourceDocumentType,
          sourceDocumentId: input.sourceDocumentId,
          idempotencyKey: input.idempotencyKey,
          correlationId: input.correlationId || null,
          transactionDate: input.transactionDate,
          accountingDate: input.accountingDate,
          currency: input.currency,
          amount: input.amount,
          tax: input.tax,
          dimensions: input.dimensions,
          metadata: input.metadata,
          payloadHash,
          status: "FAILED",
          failureCode,
          failureDetail: failureCode,
        }).onConflictDoUpdate({
          target: [accountingEvents.tenantId, accountingEvents.sourceSystem, accountingEvents.idempotencyKey],
          set: { status: "FAILED", failureCode, failureDetail: failureCode },
          setWhere: and(eq(accountingEvents.payloadHash, payloadHash), eq(accountingEvents.status, "FAILED")),
        });
      } catch (recordError) {
        console.error("accounting_event.failure_record.failed", recordError instanceof Error ? recordError.message : recordError);
      }
    }
    throw error;
  }
}
