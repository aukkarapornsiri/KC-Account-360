import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { accountGroups, accountingPeriods, chartOfAccounts, journalEntries, journalLines } from "@/db/schema";

export type TrialBalanceRow = {
  accountId: string;
  accountCode: string;
  accountName: string;
  category: string;
  normalBalance: string;
  debit: string;
  credit: string;
  balance: string;
};

const decimal = (value: unknown) => Number.parseFloat(String(value || "0"));
const fixed = (value: number) => value.toFixed(4);

export async function getTrialBalance(tenantId: string, companyId: string, periodId: string) {
  const db = getDb();
  const [period] = await db.select().from(accountingPeriods).where(and(
    eq(accountingPeriods.id, periodId),
    eq(accountingPeriods.tenantId, tenantId),
    eq(accountingPeriods.companyId, companyId),
  )).limit(1);
  if (!period) throw new Error("ACCOUNTING_PERIOD_NOT_FOUND");

  const rows = await db.select({
    accountId: chartOfAccounts.id,
    accountCode: chartOfAccounts.code,
    accountName: chartOfAccounts.nameTh,
    category: accountGroups.category,
    normalBalance: chartOfAccounts.normalBalance,
    debit: sql<string>`coalesce(sum(${journalLines.baseDebit}), 0)`,
    credit: sql<string>`coalesce(sum(${journalLines.baseCredit}), 0)`,
  }).from(journalLines)
    .innerJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId))
    .innerJoin(chartOfAccounts, eq(chartOfAccounts.id, journalLines.accountId))
    .innerJoin(accountGroups, eq(accountGroups.id, chartOfAccounts.accountGroupId))
    .where(and(
      eq(journalEntries.tenantId, tenantId),
      eq(journalEntries.companyId, companyId),
      eq(journalEntries.periodId, periodId),
      eq(journalEntries.status, "POSTED"),
    ))
    .groupBy(chartOfAccounts.id, chartOfAccounts.code, chartOfAccounts.nameTh, accountGroups.category, chartOfAccounts.normalBalance)
    .orderBy(chartOfAccounts.code);

  const result: TrialBalanceRow[] = rows.map((row) => {
    const debit = decimal(row.debit);
    const credit = decimal(row.credit);
    return { ...row, debit: fixed(debit), credit: fixed(credit), balance: fixed(debit - credit) };
  });
  const totalDebit = result.reduce((sum, row) => sum + decimal(row.debit), 0);
  const totalCredit = result.reduce((sum, row) => sum + decimal(row.credit), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.0001) throw new Error("TRIAL_BALANCE_UNBALANCED");
  return { period, rows: result, totals: { debit: fixed(totalDebit), credit: fixed(totalCredit), difference: fixed(totalDebit - totalCredit) } };
}

export async function getFinancialStatements(tenantId: string, companyId: string, periodId: string) {
  const trialBalance = await getTrialBalance(tenantId, companyId, periodId);
  const categories = Object.fromEntries(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"].map((category) => [category, 0]));
  for (const row of trialBalance.rows) {
    const raw = decimal(row.balance);
    categories[row.category] = (categories[row.category] || 0) + (row.normalBalance === "CREDIT" ? -raw : raw);
  }
  const netIncome = categories.REVENUE - categories.EXPENSE;
  return {
    ...trialBalance,
    statements: {
      balanceSheet: { assets: fixed(categories.ASSET), liabilities: fixed(categories.LIABILITY), equity: fixed(categories.EQUITY + netIncome) },
      profitAndLoss: { revenue: fixed(categories.REVENUE), expenses: fixed(categories.EXPENSE), netIncome: fixed(netIncome) },
    },
  };
}
