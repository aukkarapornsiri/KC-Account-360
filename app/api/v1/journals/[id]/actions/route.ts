import { and, eq, gt, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getCompanyAccess, hasPermission } from "@/app/api/access";
import { getDb } from "@/db";
import { accountingPeriods, approvalInstances, approvalSteps, auditEvents, journalEntries, journalLines } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: string; reason?: string; reversalPeriodId?: string; accountingDate?: string } | null;
  const action = body?.action;
  if (!action || !["approve", "reject", "post", "reverse"].includes(action)) return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  const { id } = await context.params;
  const reason = body?.reason?.trim().slice(0, 500) || null;

  try {
    const result = await getDb().transaction(async (tx) => {
      await tx.execute(sql`select id from journal_entries where id = ${id}::uuid for update`);
      const [journal] = await tx.select().from(journalEntries).where(eq(journalEntries.id, id)).limit(1);
      if (!journal) throw new Error("JOURNAL_NOT_FOUND");
      const access = await getCompanyAccess(user.email, journal.tenantId, journal.companyId);
      if (!access || (["post", "reverse"].includes(action) ? !hasPermission(access, "post") : !hasPermission(access, "approve"))) throw new Error("COMPANY_ACCESS_REQUIRED");
      const now = new Date().toISOString();

      if (action === "reverse") {
        if (journal.status !== "POSTED") throw new Error("JOURNAL_NOT_POSTED");
        if (!reason) throw new Error("REVERSAL_REASON_REQUIRED");
        const reversalPeriodId = body?.reversalPeriodId || journal.periodId;
        const accountingDate = body?.accountingDate || journal.accountingDate;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(accountingDate)) throw new Error("REVERSAL_DATE_INVALID");
        const [targetPeriod] = await tx.select().from(accountingPeriods).where(and(eq(accountingPeriods.id, reversalPeriodId), eq(accountingPeriods.companyId, journal.companyId))).limit(1);
        if (!targetPeriod || !["OPEN", "SOFT_CLOSE"].includes(targetPeriod.status) || accountingDate < targetPeriod.startsOn || accountingDate > targetPeriod.endsOn) throw new Error("REVERSAL_PERIOD_CLOSED");
        const [existingReversal] = await tx.select({ id: journalEntries.id }).from(journalEntries).where(eq(journalEntries.reversalOfId, journal.id)).limit(1);
        if (existingReversal) throw new Error("JOURNAL_ALREADY_REVERSED");
        const sourceLines = await tx.select().from(journalLines).where(eq(journalLines.journalEntryId, journal.id)).orderBy(journalLines.lineNo);
        if (!sourceLines.length) throw new Error("JOURNAL_LINES_NOT_FOUND");
        const reversalNo = `RV-${journal.journalNo}-${Date.now().toString(36).toUpperCase()}`.slice(0, 80);
        const [reversal] = await tx.insert(journalEntries).values({
          tenantId: journal.tenantId, companyId: journal.companyId, branchId: journal.branchId,
          periodId: targetPeriod.id, accountingEventId: null, journalNo: reversalNo,
          journalType: `REVERSAL:${journal.journalType}`, accountingDate,
          description: `Reverse ${journal.journalNo}: ${reason}`, currency: journal.currency,
          exchangeRate: journal.exchangeRate, status: "APPROVED", reversalOfId: journal.id,
          createdBy: user.email, approvedBy: user.email,
        }).returning();
        await tx.insert(journalLines).values(sourceLines.map((line) => ({
          journalEntryId: reversal.id, lineNo: line.lineNo, accountId: line.accountId,
          description: `Reverse: ${line.description}`, debit: line.credit, credit: line.debit,
          baseDebit: line.baseCredit, baseCredit: line.baseDebit, dimensions: line.dimensions,
        })));
        await tx.update(journalEntries).set({ status: "POSTED", postedBy: user.email, postedAt: now, updatedAt: now, version: 2 }).where(and(eq(journalEntries.id, reversal.id), eq(journalEntries.status, "APPROVED")));
        await tx.insert(auditEvents).values({ tenantId: journal.tenantId, companyId: journal.companyId, branchId: journal.branchId, module: "GL", entityType: "JOURNAL", entityId: reversal.id, action: "REVERSE", actorUserId: user.email, reason, oldValue: { journalId: journal.id, journalNo: journal.journalNo }, newValue: { reversalJournalId: reversal.id, reversalNo } });
        return { status: "POSTED", reversalJournalId: reversal.id, reversalNo };
      }

      if (action === "post") {
        if (journal.status !== "APPROVED") throw new Error("JOURNAL_NOT_APPROVED");
        const [period] = await tx.select({ status: accountingPeriods.status }).from(accountingPeriods).where(eq(accountingPeriods.id, journal.periodId)).limit(1);
        if (!period || !["OPEN", "SOFT_CLOSE"].includes(period.status)) throw new Error("ACCOUNTING_PERIOD_CLOSED");
        await tx.update(journalEntries).set({ status: "POSTED", postedBy: user.email, postedAt: now, updatedAt: now, version: journal.version + 1 }).where(and(eq(journalEntries.id, id), eq(journalEntries.status, "APPROVED")));
        await tx.insert(auditEvents).values({ tenantId: journal.tenantId, companyId: journal.companyId, branchId: journal.branchId, module: "GL", entityType: "JOURNAL", entityId: journal.id, action: "POST", actorUserId: user.email, reason, newValue: { status: "POSTED" } });
        return { status: "POSTED" };
      }

      const [instance] = await tx.select().from(approvalInstances).where(and(eq(approvalInstances.entityType, "JOURNAL"), eq(approvalInstances.entityId, id))).limit(1);
      if (!instance || instance.status !== "PENDING") throw new Error("APPROVAL_NOT_PENDING");
      if (instance.makerUserId.toLowerCase() === user.email.toLowerCase()) throw new Error("MAKER_CHECKER_REQUIRED");
      const [step] = await tx.select().from(approvalSteps).where(and(eq(approvalSteps.approvalInstanceId, instance.id), eq(approvalSteps.stepNo, instance.currentStep), eq(approvalSteps.status, "PENDING"))).limit(1);
      if (!step) throw new Error("APPROVAL_STEP_NOT_FOUND");
      if (step.approverUserId && step.approverUserId.toLowerCase() !== user.email.toLowerCase()) throw new Error("APPROVER_NOT_ASSIGNED");
      if (!step.approverUserId && step.approverRole.toLowerCase() !== access.role.toLowerCase() && access.role !== "Admin") throw new Error("APPROVER_ROLE_REQUIRED");

      if (action === "reject") {
        if (!reason) throw new Error("REJECTION_REASON_REQUIRED");
        await tx.update(approvalSteps).set({ status: "REJECTED", actionBy: user.email, actionAt: now, reason }).where(eq(approvalSteps.id, step.id));
        await tx.update(approvalInstances).set({ status: "REJECTED", completedAt: now }).where(eq(approvalInstances.id, instance.id));
        await tx.update(journalEntries).set({ status: "REJECTED", updatedAt: now, version: journal.version + 1 }).where(eq(journalEntries.id, id));
        await tx.insert(auditEvents).values({ tenantId: journal.tenantId, companyId: journal.companyId, branchId: journal.branchId, module: "GL", entityType: "JOURNAL", entityId: journal.id, action: "REJECT", actorUserId: user.email, reason, approvalReference: instance.id, newValue: { status: "REJECTED" } });
        return { status: "REJECTED" };
      }

      await tx.update(approvalSteps).set({ status: "APPROVED", actionBy: user.email, actionAt: now, reason }).where(eq(approvalSteps.id, step.id));
      const [next] = await tx.select({ id: approvalSteps.id }).from(approvalSteps).where(and(eq(approvalSteps.approvalInstanceId, instance.id), gt(approvalSteps.stepNo, instance.currentStep), eq(approvalSteps.status, "PENDING"))).orderBy(approvalSteps.stepNo).limit(1);
      const finalStatus = next ? "PENDING_APPROVAL" : "APPROVED";
      if (next) await tx.update(approvalInstances).set({ currentStep: instance.currentStep + 1 }).where(eq(approvalInstances.id, instance.id));
      else await tx.update(approvalInstances).set({ status: "APPROVED", completedAt: now }).where(eq(approvalInstances.id, instance.id));
      await tx.update(journalEntries).set({ status: finalStatus, approvedBy: next ? null : user.email, updatedAt: now, version: journal.version + 1 }).where(eq(journalEntries.id, id));
      await tx.insert(auditEvents).values({ tenantId: journal.tenantId, companyId: journal.companyId, branchId: journal.branchId, module: "GL", entityType: "JOURNAL", entityId: journal.id, action: "APPROVE", actorUserId: user.email, reason, approvalReference: instance.id, newValue: { status: finalStatus, step: instance.currentStep } });
      return { status: finalStatus };
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const code = error instanceof Error ? error.message : "JOURNAL_ACTION_FAILED";
    const status = code.endsWith("NOT_FOUND") ? 404 : code.includes("REQUIRED") || code.includes("ASSIGNED") || code.includes("MAKER_CHECKER") ? 403 : 409;
    return NextResponse.json({ error: code }, { status });
  }
}
