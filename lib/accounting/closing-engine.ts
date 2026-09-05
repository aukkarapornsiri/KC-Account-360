import "server-only";
import { and, eq, ne, notInArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  accountingPeriods,
  auditEvents,
  bankAccounts,
  bankStatementLines,
  externalSubledgerBalances,
  journalEntries,
  periodCloseRuns,
  periodCloseTasks,
} from "@/db/schema";
import { getTrialBalance } from "@/lib/accounting/reporting";

type CloseScope = { tenantId: string; companyId: string; periodId: string };
const countValue = (value: unknown) => Number(value || 0);

async function evaluate(scope: CloseScope) {
  const db = getDb();
  const [unposted] = await db.select({ count: sql<number>`count(*)` }).from(journalEntries).where(and(
    eq(journalEntries.tenantId, scope.tenantId),
    eq(journalEntries.companyId, scope.companyId),
    eq(journalEntries.periodId, scope.periodId),
    notInArray(journalEntries.status, ["POSTED", "REJECTED", "VOID"]),
  ));
  const [subledgers] = await db.select({ count: sql<number>`count(*)` }).from(externalSubledgerBalances).where(and(
    eq(externalSubledgerBalances.tenantId, scope.tenantId),
    eq(externalSubledgerBalances.companyId, scope.companyId),
    eq(externalSubledgerBalances.periodId, scope.periodId),
    ne(externalSubledgerBalances.status, "RECONCILED"),
  ));
  const [bank] = await db.select({ count: sql<number>`count(*)` }).from(bankStatementLines)
    .innerJoin(bankAccounts, eq(bankAccounts.id, bankStatementLines.bankAccountId))
    .where(and(eq(bankAccounts.tenantId, scope.tenantId), eq(bankAccounts.companyId, scope.companyId), ne(bankStatementLines.status, "MATCHED")));
  let trialBalanceError: string | null = null;
  try { await getTrialBalance(scope.tenantId, scope.companyId, scope.periodId); }
  catch (error) { trialBalanceError = error instanceof Error ? error.message : "TRIAL_BALANCE_FAILED"; }
  return [
    { taskKey: "unposted_journals", title: "ตรวจสอบรายการบัญชีที่ยังไม่ Post", sequence: 10, blocking: true, count: countValue(unposted?.count), error: null },
    { taskKey: "subledger_reconciliation", title: "กระทบยอดระบบย่อย KC CuTo / ToRy / EAM / HR", sequence: 20, blocking: true, count: countValue(subledgers?.count), error: null },
    { taskKey: "bank_reconciliation", title: "กระทบยอดรายการธนาคาร", sequence: 30, blocking: true, count: countValue(bank?.count), error: null },
    { taskKey: "trial_balance", title: "ตรวจสอบ Trial Balance", sequence: 40, blocking: true, count: trialBalanceError ? 1 : 0, error: trialBalanceError },
    { taskKey: "management_review", title: "ผู้อนุมัติตรวจสอบและยืนยันปิดงวด", sequence: 50, blocking: true, count: 1, error: null },
  ];
}

async function getScopedPeriod(scope: CloseScope) {
  const [period] = await getDb().select().from(accountingPeriods).where(and(
    eq(accountingPeriods.id, scope.periodId),
    eq(accountingPeriods.tenantId, scope.tenantId),
    eq(accountingPeriods.companyId, scope.companyId),
  )).limit(1);
  if (!period) throw new Error("ACCOUNTING_PERIOD_NOT_FOUND");
  return period;
}

export async function startPeriodClose(scope: CloseScope, actor: string) {
  const period = await getScopedPeriod(scope);
  if (!["OPEN", "SOFT_CLOSE", "REVIEW"].includes(period.status)) throw new Error("ACCOUNTING_PERIOD_NOT_OPEN_FOR_CLOSE");
  const checks = await evaluate(scope);
  const runId = await getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`period-close:${scope.companyId}:${scope.periodId}`}))`);
    const [active] = await tx.select().from(periodCloseRuns).where(and(eq(periodCloseRuns.periodId, scope.periodId), sql`${periodCloseRuns.status} in ('IN_PROGRESS','READY_FOR_APPROVAL','APPROVED')`)).limit(1);
    if (active) return active.id;
    const [run] = await tx.insert(periodCloseRuns).values({ ...scope, startedBy: actor }).returning();
    await tx.insert(periodCloseTasks).values(checks.map((check) => ({
      closeRunId: run.id,
      taskKey: check.taskKey,
      title: check.title,
      sequence: check.sequence,
      blocking: check.blocking,
      status: check.taskKey === "management_review" ? "PENDING" : check.count === 0 ? "COMPLETED" : "BLOCKED",
      evidence: { count: check.count, error: check.error },
      completedBy: check.taskKey !== "management_review" && check.count === 0 ? "system" : null,
      completedAt: check.taskKey !== "management_review" && check.count === 0 ? new Date().toISOString() : null,
    })));
    await tx.update(accountingPeriods).set({ status: "REVIEW", updatedAt: new Date().toISOString(), version: period.version + 1 }).where(eq(accountingPeriods.id, period.id));
    await tx.insert(auditEvents).values({ tenantId: scope.tenantId, companyId: scope.companyId, module: "CLOSING", entityType: "PERIOD_CLOSE", entityId: run.id, action: "START", actorUserId: actor, newValue: { periodId: scope.periodId } });
    return run.id;
  });
  return getPeriodClose(scope, runId);
}

export async function refreshPeriodClose(scope: CloseScope, runId: string, actor: string) {
  const checks = await evaluate(scope);
  const db = getDb();
  await db.transaction(async (tx) => {
    for (const check of checks.filter((item) => item.taskKey !== "management_review")) {
      await tx.update(periodCloseTasks).set({
        status: check.count === 0 ? "COMPLETED" : "BLOCKED",
        evidence: { count: check.count, error: check.error },
        completedBy: check.count === 0 ? "system" : null,
        completedAt: check.count === 0 ? new Date().toISOString() : null,
      }).where(and(eq(periodCloseTasks.closeRunId, runId), eq(periodCloseTasks.taskKey, check.taskKey)));
    }
    await tx.insert(auditEvents).values({ tenantId: scope.tenantId, companyId: scope.companyId, module: "CLOSING", entityType: "PERIOD_CLOSE", entityId: runId, action: "REFRESH_CHECKS", actorUserId: actor });
  });
  return getPeriodClose(scope, runId);
}

export async function completeCloseReview(scope: CloseScope, runId: string, actor: string, reason: string) {
  if (!reason.trim()) throw new Error("CLOSE_REVIEW_REASON_REQUIRED");
  const db = getDb();
  await db.transaction(async (tx) => {
    const [run] = await tx.select().from(periodCloseRuns).where(and(eq(periodCloseRuns.id, runId), eq(periodCloseRuns.periodId, scope.periodId), eq(periodCloseRuns.companyId, scope.companyId))).limit(1);
    if (!run || !["IN_PROGRESS", "READY_FOR_APPROVAL"].includes(run.status)) throw new Error("PERIOD_CLOSE_NOT_ACTIVE");
    if (run.startedBy.toLowerCase() === actor.toLowerCase()) throw new Error("MAKER_CHECKER_REQUIRED");
    const tasks = await tx.select().from(periodCloseTasks).where(eq(periodCloseTasks.closeRunId, run.id));
    if (tasks.some((task) => task.blocking && task.taskKey !== "management_review" && task.status !== "COMPLETED")) throw new Error("PERIOD_CLOSE_BLOCKED");
    const now = new Date().toISOString();
    await tx.update(periodCloseTasks).set({ status: "COMPLETED", evidence: { reason }, completedBy: actor, completedAt: now }).where(and(eq(periodCloseTasks.closeRunId, run.id), eq(periodCloseTasks.taskKey, "management_review")));
    await tx.update(periodCloseRuns).set({ status: "APPROVED", approvedBy: actor, completedAt: now, version: run.version + 1 }).where(eq(periodCloseRuns.id, run.id));
    await tx.insert(auditEvents).values({ tenantId: scope.tenantId, companyId: scope.companyId, module: "CLOSING", entityType: "PERIOD_CLOSE", entityId: run.id, action: "APPROVE", actorUserId: actor, reason });
  });
  return getPeriodClose(scope, runId);
}

export async function lockClosedPeriod(scope: CloseScope, runId: string, actor: string) {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`period-lock:${scope.companyId}:${scope.periodId}`}))`);
    const [run] = await tx.select().from(periodCloseRuns).where(and(eq(periodCloseRuns.id, runId), eq(periodCloseRuns.periodId, scope.periodId), eq(periodCloseRuns.companyId, scope.companyId))).limit(1);
    if (!run || run.status !== "APPROVED") throw new Error("PERIOD_CLOSE_NOT_APPROVED");
    const now = new Date().toISOString();
    await tx.update(accountingPeriods).set({ status: "LOCKED", lockedAt: now, lockedBy: actor, updatedAt: now }).where(and(eq(accountingPeriods.id, scope.periodId), eq(accountingPeriods.status, "REVIEW")));
    await tx.update(periodCloseRuns).set({ status: "LOCKED", lockedAt: now, version: run.version + 1 }).where(eq(periodCloseRuns.id, run.id));
    await tx.insert(auditEvents).values({ tenantId: scope.tenantId, companyId: scope.companyId, module: "CLOSING", entityType: "PERIOD_CLOSE", entityId: run.id, action: "LOCK", actorUserId: actor, newValue: { periodStatus: "LOCKED" } });
  });
  return getPeriodClose(scope, runId);
}

export async function getPeriodClose(scope: CloseScope, runId?: string) {
  const db = getDb();
  const conditions = [eq(periodCloseRuns.periodId, scope.periodId), eq(periodCloseRuns.tenantId, scope.tenantId), eq(periodCloseRuns.companyId, scope.companyId)];
  if (runId) conditions.push(eq(periodCloseRuns.id, runId));
  const [run] = await db.select().from(periodCloseRuns).where(and(...conditions)).orderBy(sql`${periodCloseRuns.startedAt} desc`).limit(1);
  if (!run) throw new Error("PERIOD_CLOSE_NOT_FOUND");
  const tasks = await db.select().from(periodCloseTasks).where(eq(periodCloseTasks.closeRunId, run.id)).orderBy(periodCloseTasks.sequence);
  return { run, tasks };
}
