import "server-only";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  accountingEvents,
  aiRecommendationActions,
  aiRecommendations,
  bankAccounts,
  bankStatementLines,
  openItems,
  periodCloseRuns,
  periodCloseTasks,
} from "@/db/schema";

type Scope = { tenantId: string; companyId: string; branchId?: string | null };
type Proposal = {
  dedupeKey: string;
  recommendationType: string;
  entityType: string;
  entityId: string;
  title: string;
  rationale: string;
  confidence: string;
  sourceEvidence: Record<string, unknown>;
  proposedAction: Record<string, unknown>;
};

export async function generateAccountingRecommendations(scope: Scope) {
  const db = getDb();
  const proposals: Proposal[] = [];
  const failedEvents = await db.select().from(accountingEvents).where(and(eq(accountingEvents.tenantId, scope.tenantId), eq(accountingEvents.companyId, scope.companyId), eq(accountingEvents.status, "FAILED"))).orderBy(desc(accountingEvents.receivedAt)).limit(20);
  for (const event of failedEvents) proposals.push({
    dedupeKey: `integration:${event.id}`,
    recommendationType: "INTEGRATION_EXCEPTION",
    entityType: "ACCOUNTING_EVENT",
    entityId: event.id,
    title: `ตรวจสอบ Event ${event.eventId}`,
    rationale: `ระบบบัญชียังไม่รับรายการจาก ${event.sourceSystem}: ${event.failureCode || "ไม่ทราบสาเหตุ"}`,
    confidence: "1.0000",
    sourceEvidence: { sourceSystem: event.sourceSystem, eventType: event.eventType, failureCode: event.failureCode, receivedAt: event.receivedAt },
    proposedAction: { action: "OPEN_ERROR_QUEUE", target: event.id, requiresHumanApproval: true, mutatesLedger: false },
  });

  const unmatched = await db.select({ id: bankStatementLines.id, description: bankStatementLines.description, debit: bankStatementLines.debit, credit: bankStatementLines.credit, transactionDate: bankStatementLines.transactionDate }).from(bankStatementLines)
    .innerJoin(bankAccounts, eq(bankAccounts.id, bankStatementLines.bankAccountId))
    .where(and(eq(bankAccounts.tenantId, scope.tenantId), eq(bankAccounts.companyId, scope.companyId), eq(bankStatementLines.status, "UNMATCHED"))).limit(50);
  const outstanding = await db.select().from(openItems).where(and(eq(openItems.tenantId, scope.tenantId), eq(openItems.companyId, scope.companyId), eq(openItems.status, "OPEN"))).limit(500);
  for (const line of unmatched) {
    const amount = Number(line.credit) || Number(line.debit);
    const candidates = outstanding.filter((item) => Math.abs(Number(item.outstandingAmount) - amount) < 0.0001);
    if (candidates.length === 1) proposals.push({
      dedupeKey: `bank-match:${line.id}:${candidates[0].id}`,
      recommendationType: "BANK_MATCH",
      entityType: "BANK_STATEMENT_LINE",
      entityId: line.id,
      title: "พบรายการธนาคารที่อาจจับคู่ได้",
      rationale: `ยอด ${amount.toFixed(2)} ตรงกับ Open Item เพียงรายการเดียว`,
      confidence: "0.9200",
      sourceEvidence: { statementLineId: line.id, openItemId: candidates[0].id, amount, transactionDate: line.transactionDate },
      proposedAction: { action: "PROPOSE_BANK_MATCH", openItemId: candidates[0].id, requiresHumanApproval: true, mutatesLedger: false },
    });
  }

  const [cashFlow] = await db.select({ receivable: sql<string>`coalesce(sum(case when ${openItems.itemType} = 'RECEIVABLE' then ${openItems.outstandingAmount} else 0 end), 0)`, payable: sql<string>`coalesce(sum(case when ${openItems.itemType} = 'PAYABLE' then ${openItems.outstandingAmount} else 0 end), 0)`, count: sql<number>`count(*)` }).from(openItems).where(and(eq(openItems.tenantId, scope.tenantId), eq(openItems.companyId, scope.companyId), eq(openItems.status, "OPEN")));
  if (Number(cashFlow?.count || 0) > 0) proposals.push({
    dedupeKey: `cash-flow:${new Date().toISOString().slice(0, 10)}`,
    recommendationType: "CASH_FLOW_FORECAST",
    entityType: "COMPANY",
    entityId: scope.companyId,
    title: "ประมาณการกระแสเงินสดจาก Open Items",
    rationale: `ลูกหนี้คงค้าง ${Number(cashFlow.receivable).toFixed(2)} และเจ้าหนี้คงค้าง ${Number(cashFlow.payable).toFixed(2)}`,
    confidence: "0.8500",
    sourceEvidence: { receivable: cashFlow.receivable, payable: cashFlow.payable, openItemCount: cashFlow.count, method: "contractual-due-date" },
    proposedAction: { action: "OPEN_CASH_FLOW_WORKSPACE", requiresHumanApproval: false, mutatesLedger: false },
  });

  const blockedCloseTasks = await db.select({ runId: periodCloseRuns.id, taskKey: periodCloseTasks.taskKey, title: periodCloseTasks.title, evidence: periodCloseTasks.evidence }).from(periodCloseTasks)
    .innerJoin(periodCloseRuns, eq(periodCloseRuns.id, periodCloseTasks.closeRunId))
    .where(and(eq(periodCloseRuns.tenantId, scope.tenantId), eq(periodCloseRuns.companyId, scope.companyId), eq(periodCloseTasks.status, "BLOCKED"))).limit(20);
  for (const task of blockedCloseTasks) proposals.push({
    dedupeKey: `closing:${task.runId}:${task.taskKey}`,
    recommendationType: "CLOSING_COPILOT",
    entityType: "PERIOD_CLOSE",
    entityId: task.runId,
    title: `งานปิดงวดติดเงื่อนไข: ${task.title}`,
    rationale: "ต้องแก้รายการที่เป็น Blocking ก่อนส่งอนุมัติปิดงวด",
    confidence: "1.0000",
    sourceEvidence: { taskKey: task.taskKey, evidence: task.evidence },
    proposedAction: { action: "OPEN_CLOSING_TASK", taskKey: task.taskKey, requiresHumanApproval: true, mutatesLedger: false },
  });

  for (const proposal of proposals) {
    await db.insert(aiRecommendations).values({ ...scope, ...proposal, status: "PROPOSED", model: "accounting-rules-v1" }).onConflictDoUpdate({
      target: [aiRecommendations.companyId, aiRecommendations.dedupeKey],
      set: { title: proposal.title, rationale: proposal.rationale, confidence: proposal.confidence, sourceEvidence: proposal.sourceEvidence, proposedAction: proposal.proposedAction, status: "PROPOSED", model: "accounting-rules-v1", createdAt: new Date().toISOString() },
      setWhere: ne(aiRecommendations.status, "APPLIED"),
    });
  }
  return getAccountingRecommendations(scope);
}

export async function getAccountingRecommendations(scope: Scope) {
  return getDb().select().from(aiRecommendations).where(and(eq(aiRecommendations.tenantId, scope.tenantId), eq(aiRecommendations.companyId, scope.companyId))).orderBy(desc(aiRecommendations.createdAt)).limit(100);
}

export async function reviewAccountingRecommendation(scope: Scope, recommendationId: string, actor: string, action: "ACCEPT" | "REJECT" | "EDIT" | "APPLY", reason?: string, editedAction?: Record<string, unknown>) {
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from ai_recommendations where id = ${recommendationId}::uuid for update`);
    const [item] = await tx.select().from(aiRecommendations).where(and(eq(aiRecommendations.id, recommendationId), eq(aiRecommendations.tenantId, scope.tenantId), eq(aiRecommendations.companyId, scope.companyId))).limit(1);
    if (!item) throw new Error("AI_RECOMMENDATION_NOT_FOUND");
    if (["REJECT", "EDIT"].includes(action) && !reason?.trim()) throw new Error("AI_REVIEW_REASON_REQUIRED");
    if (action === "APPLY" && item.status !== "ACCEPTED") throw new Error("AI_RECOMMENDATION_NOT_ACCEPTED");
    const status = action === "REJECT" ? "REJECTED" : action === "APPLY" ? "APPLIED" : "ACCEPTED";
    const now = new Date().toISOString();
    await tx.update(aiRecommendations).set({ status, reviewedBy: actor, reviewedAt: now, reviewReason: reason?.trim() || null, proposedAction: action === "EDIT" && editedAction ? editedAction : item.proposedAction }).where(eq(aiRecommendations.id, item.id));
    await tx.insert(aiRecommendationActions).values({ recommendationId: item.id, action, actorUserId: actor, reason: reason?.trim() || null, editedAction: editedAction || null });
    return { id: item.id, status, ledgerMutation: false, nextStep: action === "APPLY" ? "Open the controlled accounting workflow to execute the approved action." : null };
  });
}
