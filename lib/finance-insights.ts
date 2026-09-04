export type InsightSeverity = "critical" | "high" | "medium" | "low";
export type FinanceInsight = {
  id: string;
  severity: InsightSeverity;
  category: string;
  title: string;
  explanation: string;
  recommendation: string;
  target: string;
  count: number;
  amount: number;
};

type InsightRecord = { module: string; status: string; amount: number; dueDate?: string | null; metadata: string };
type InsightMaster = { category: string; status: string; name: string };
type InsightIntegrationEvent = { status: string };

export function buildFinanceInsights(records: InsightRecord[], masters: InsightMaster[], settings: Record<string, string>, now = new Date(), integrationEvents: InsightIntegrationEvent[] = []): FinanceInsight[] {
  const insights: FinanceInsight[] = [];
  const sum = (items: InsightRecord[]) => items.reduce((total, item) => total + item.amount, 0);
  const failed = records.filter((item) => item.module === "INTEGRATION" && item.status === "Failed");
  const failedEventCount = integrationEvents.filter((item) => item.status === "Failed").length;
  const integrationFailureCount = failed.length + failedEventCount;
  if (integrationFailureCount) insights.push({ id: "integration-errors", severity: "critical", category: "Integration", title: `พบ Integration ล้มเหลว ${integrationFailureCount} รายการ`, explanation: "ข้อมูลจากระบบต้นทางยังไม่ถูกบันทึกเข้าบัญชีและอาจทำให้ยอดรายงานไม่ครบ", recommendation: "ตรวจสอบ Mapping ที่ขาด แล้วกด Retry ใน Error Queue", target: "errors", count: integrationFailureCount, amount: sum(failed) });

  const approvals = records.filter((item) => item.status === "Pending Approval");
  if (approvals.length) insights.push({ id: "pending-approvals", severity: "high", category: "Approval", title: `มี ${approvals.length} รายการรออนุมัติ`, explanation: `มูลค่ารวม ${(sum(approvals) / 100).toLocaleString("th-TH")} บาท ยังไม่สามารถเดินรายการต่อได้`, recommendation: "ตรวจเอกสารและดำเนินการอนุมัติหรือปฏิเสธ", target: "approval", count: approvals.length, amount: sum(approvals) });

  const unreconciled = records.filter((item) => item.status === "Unreconciled");
  if (unreconciled.length) insights.push({ id: "bank-reconciliation", severity: "high", category: "Cash & Bank", title: `รายการธนาคารรอกระทบยอด ${unreconciled.length} รายการ`, explanation: "ยอดบัญชีธนาคารและบัญชีแยกประเภทอาจยังไม่ตรงกัน", recommendation: "เปิด Reconciliation และตรวจสอบคู่รายการ", target: "reconciliation", count: unreconciled.length, amount: sum(unreconciled) });

  const closing = records.filter((item) => item.module === "CLOSING" && item.status !== "Completed");
  if (closing.length) insights.push({ id: "closing-tasks", severity: "medium", category: "Financial Closing", title: `Closing Checklist เหลือ ${closing.length} งาน`, explanation: "ยังไม่สามารถล็อกงวดบัญชีได้จนกว่างานปิดงวดจะเสร็จครบ", recommendation: "มอบหมายและปิดงานคงค้างก่อนสิ้นงวด", target: "closing", count: closing.length, amount: 0 });

  const mapping = masters.filter((item) => item.category === "MAPPING" && item.status === "Needs Review");
  if (mapping.length) insights.push({ id: "mapping-review", severity: "medium", category: "Mapping", title: `Mapping ต้องตรวจสอบ ${mapping.length} รายการ`, explanation: mapping.map((item) => item.name).join(", "), recommendation: "กำหนดบัญชีปลายทางและ Cost Center ให้ครบ", target: "mapping", count: mapping.length, amount: 0 });

  const taxDue = records.filter((item) => item.module === "TAX" && item.status !== "Ready to File" && item.dueDate && new Date(item.dueDate).getTime() - now.getTime() <= 45 * 86400000);
  if (taxDue.length) insights.push({ id: "tax-due", severity: "high", category: "VAT/WHT", title: `ภาษีใกล้ครบกำหนด ${taxDue.length} รายการ`, explanation: "รายการภาษียังอยู่ระหว่างจัดเตรียมและมีกำหนดยื่นภายใน 45 วัน", recommendation: "ตรวจเลขประจำตัวผู้เสียภาษีและยอดภาษีก่อนยื่น", target: "tax", count: taxDue.length, amount: sum(taxDue) });

  const budgetRisk = records.filter((item) => {
    if (item.module !== "BUDGET" || item.amount <= 0) return false;
    try { return Number((JSON.parse(item.metadata) as { used?: number }).used || 0) / item.amount >= 0.65; } catch { return false; }
  });
  if (budgetRisk.length) insights.push({ id: "budget-watch", severity: "low", category: "Budget", title: `ควรติดตามงบประมาณ ${budgetRisk.length} รายการ`, explanation: "มีการใช้งบตั้งแต่ 65% ขึ้นไป ควรประเมินแนวโน้มก่อนเกิดการใช้เกินวงเงิน", recommendation: "ทบทวนประมาณการใช้จ่ายถึงสิ้นปี", target: "budget", count: budgetRisk.length, amount: sum(budgetRisk) });

  if (settings.locked_period) insights.push({ id: "period-locked", severity: "low", category: "Control", title: `งวด ${settings.locked_period} ถูกล็อกแล้ว`, explanation: "ระบบป้องกันการแก้ไขธุรกรรมในงวดที่ปิดบัญชี", recommendation: "เปิดงวดใหม่สำหรับรายการถัดไป", target: "settings", count: 1, amount: 0 });
  return insights;
}
