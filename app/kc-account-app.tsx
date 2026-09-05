"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import {
  Activity, AlertTriangle, ArrowDownLeft, ArrowUpRight, Banknote, BellRing, Bookmark, BookOpen, BrainCircuit, Building2, CalendarCheck,
  Check, ChevronDown, ChevronRight, CircleCheck, CircleDollarSign, ClipboardCheck, Command, Download, FileBarChart,
  Copy, FileImage, FileText, Gauge, Globe2, History, KeyRound, Landmark, LayoutDashboard, Link2, Loader2, LockKeyhole,
  ListTodo, LogOut, Palette, Paperclip, Pencil, Plus, Printer, RefreshCw, RotateCcw, Save, Search, Settings, ShieldCheck, SlidersHorizontal,
  Trash2, Upload, Users, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import type { ChatGPTUser } from "@/app/chatgpt-auth";
import { documentsForModule, findAccountingDocument } from "@/lib/accounting-documents";

type RecordItem = {
  id: string; module: string; recordType: string; documentNo: string; sourceSystem: string;
  counterparty: string; description: string; amount: number; taxAmount: number; currency: string;
  status: string; dueDate: string | null; period: string; metadata: string; createdBy: string;
  approver: string | null; postedAt: string | null; createdAt: string; updatedAt: string;
};
type AuditItem = { id: number; recordId: string | null; action: string; actorEmail: string; details: string; createdAt: string };
type DocumentItem = { id: string; recordId: string; name: string; size: number; createdAt: string };
type MasterItem = { id: string; category: string; code: string; name: string; description: string; status: string; metadata: string; createdBy: string; createdAt: string; updatedAt: string };
type FinanceInsight = { id: string; severity: "critical" | "high" | "medium" | "low"; category: string; title: string; explanation: string; recommendation: string; target: string; count: number; amount: number };
type ConnectorItem = { key: "cuto" | "tory" | "eam" | "hr"; name: string; baseUrl: string; status: string; cursor: string; recordsSynced: number; lastSyncAt: string | null; lastSuccessAt: string | null; lastError: string | null; updatedAt: string; inboundKeyConfigured: boolean; outboundTokenConfigured: boolean; inboundEndpoint: string };
type IntegrationEventItem = { id: string; sourceSystem: string; externalEventId: string; eventType: string; direction: string; status: string; financialRecordId: string | null; error: string | null; retryCount: number; receivedAt: string; processedAt: string | null };
type UserPreferences = { language: Language; theme: "light" | "dark" | "system"; tableDensity: "comfortable" | "compact"; sidebarMode: "expanded" | "collapsed" | "auto"; pageWidth: "full" | "contained"; dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD"; negativeNumberFormat: "parentheses" | "minus" };
type SavedView = { id: string; module: string; name: string; visibility: "PRIVATE" | "SHARED" | "ROLE_DEFAULT"; configuration: { statusFilter?: string; typeFilter?: string } | string; updatedAt: string };
type AppData = { user: ChatGPTUser; access: { role: string; permissions: string[] }; insights: FinanceInsight[]; records: RecordItem[]; audit: AuditItem[]; settings: Record<string, string>; preferences: UserPreferences | null; documents: DocumentItem[]; masters: MasterItem[]; connectors: ConnectorItem[]; integrationEvents: IntegrationEventItem[] };
type NavItem = { id: string; module?: string; label: string; helper: string; icon: LucideIcon; phase: "core" | "phase1" | "phase2" | "phase3" };
type Language = "th" | "en";
const DEFAULT_USER_PREFERENCES: UserPreferences = { language: "th", theme: "light", tableDensity: "comfortable", sidebarMode: "expanded", pageWidth: "full", dateFormat: "DD/MM/YYYY", negativeNumberFormat: "parentheses" };
type AccountingLineItem = { code: string; description: string; unit: string; quantity: number; unitPrice: number; discount: number };
type AccountingDocumentMeta = {
  documentCode?: string; issueDate?: string; referenceDocumentNo?: string; linkedDocumentNo?: string;
  paymentTerms?: number; taxRate?: number; whtRate?: number; affectsStock?: boolean;
  vendorInvoiceNo?: string; documentTiming?: "before_invoice" | "after_invoice";
  counterpartyAddress?: string; counterpartyTaxId?: string; contactName?: string; projectName?: string;
  preparedBy?: string; notes?: string; paymentInstructions?: string;
  subtotal?: number; withholdingTax?: number; total?: number; netTotal?: number;
  lineItems?: AccountingLineItem[];
};

const LanguageContext = createContext<Language>("th");
const useLanguage = () => { const language = useContext(LanguageContext); return { language, tr: (thai: string, english: string) => language === "th" ? thai : english }; };

const NAV: NavItem[] = [
  { id: "dashboard", label: "ภาพรวม", helper: "Executive dashboard", icon: LayoutDashboard, phase: "core" },
  { id: "ai", label: "AI Finance Advisor", helper: "Recommendations & alerts", icon: BrainCircuit, phase: "core" },
  { id: "company", label: "Company และ Branch", helper: "Organization master", icon: Building2, phase: "phase1" },
  { id: "coa", label: "Chart of Accounts", helper: "Account master", icon: BookOpen, phase: "phase1" },
  { id: "gl", module: "GL", label: "General Ledger", helper: "Journal & ledger", icon: BookOpen, phase: "phase1" },
  { id: "customers", label: "Customer Master", helper: "Customer profiles & payment terms", icon: Users, phase: "phase1" },
  { id: "ar", module: "AR", label: "AR", helper: "Accounts receivable", icon: ArrowDownLeft, phase: "phase1" },
  { id: "ap", module: "AP", label: "AP", helper: "Accounts payable", icon: ArrowUpRight, phase: "phase1" },
  { id: "cash", module: "CASH", label: "Cash and Bank", helper: "Cash & bank", icon: Landmark, phase: "phase1" },
  { id: "tax", module: "TAX", label: "VAT / WHT", helper: "Tax management", icon: FileText, phase: "phase1" },
  { id: "reports", label: "Financial Reports", helper: "Reports & export", icon: FileBarChart, phase: "phase1" },
  { id: "users", label: "User Permission", helper: "Roles & access", icon: Users, phase: "phase1" },
  { id: "audit", label: "Audit Log", helper: "Change history", icon: History, phase: "phase1" },
  { id: "integration", module: "INTEGRATION", label: "Integration Overview", helper: "Connector health", icon: Link2, phase: "phase2" },
  { id: "cuto", label: "KC CuTo CRM", helper: "Sales integration", icon: CircleDollarSign, phase: "phase2" },
  { id: "tory", label: "KC Inventory", helper: "Inventory integration", icon: Gauge, phase: "phase2" },
  { id: "eam", label: "KC EAM", helper: "Asset integration", icon: Building2, phase: "phase2" },
  { id: "hr", label: "KC HR", helper: "Payroll integration", icon: Users, phase: "phase2" },
  { id: "mapping", label: "Mapping Center", helper: "Source to target", icon: SlidersHorizontal, phase: "phase2" },
  { id: "errors", label: "Error Queue", helper: "Integration exceptions", icon: Activity, phase: "phase2" },
  { id: "reconciliation", label: "Reconciliation", helper: "Cross-system matching", icon: ClipboardCheck, phase: "phase2" },
  { id: "approval", label: "Approval Center", helper: "Approval workflow", icon: ClipboardCheck, phase: "phase3" },
  { id: "closing", module: "CLOSING", label: "Financial Closing", helper: "Period close checklist", icon: CalendarCheck, phase: "phase3" },
  { id: "budget", module: "BUDGET", label: "Budget Control", helper: "Budget monitoring", icon: Gauge, phase: "phase3" },
  { id: "settings", label: "System Control", helper: "Production operations", icon: Settings, phase: "phase3" },
];

const PAGE_THAI: Record<string, { label: string; helper: string }> = {
  dashboard: { label: "ภาพรวม", helper: "แดชบอร์ดผู้บริหาร" }, ai: { label: "ผู้ช่วย AI ด้านการเงิน", helper: "คำแนะนำและการแจ้งเตือน" },
  company: { label: "บริษัทและสาขา", helper: "ข้อมูลหลักขององค์กร" }, coa: { label: "ผังบัญชี", helper: "ข้อมูลหลักทางบัญชี" }, gl: { label: "บัญชีแยกประเภท", helper: "สมุดรายวันและบัญชีแยกประเภท" },
  customers: { label: "ทะเบียนลูกค้า", helper: "ข้อมูลลูกค้าและเงื่อนไขการชำระเงิน" }, ar: { label: "เอกสารขายและลูกหนี้", helper: "SQ, SO, มัดจำ, ส่งของ, แจ้งหนี้, วางบิล, รับชำระ และปรับปรุงหนี้" }, ap: { label: "เอกสารซื้อและเจ้าหนี้", helper: "PR, PO, มัดจำ, รับของ, ตั้งหนี้, วางบิล, จ่ายชำระ และปรับปรุงหนี้" }, cash: { label: "เงินสดและธนาคาร", helper: "บริหารเงินสดและบัญชีธนาคาร" }, tax: { label: "ภาษีมูลค่าเพิ่ม / หัก ณ ที่จ่าย", helper: "การจัดการภาษี" },
  reports: { label: "รายงานทางการเงิน", helper: "รายงานและการส่งออก" }, users: { label: "ผู้ใช้และสิทธิ์", helper: "บทบาทและการเข้าถึง" }, audit: { label: "บันทึกการตรวจสอบ", helper: "ประวัติการเปลี่ยนแปลง" },
  integration: { label: "การเชื่อมต่อระบบ", helper: "สถานะ Connector" }, cuto: { label: "KC CuTo CRM", helper: "การเชื่อมต่อฝ่ายขาย" }, tory: { label: "KC Inventory", helper: "การเชื่อมต่อคลังสินค้า" }, eam: { label: "KC EAM", helper: "การเชื่อมต่อสินทรัพย์" }, hr: { label: "KC HR", helper: "การเชื่อมต่อเงินเดือน" },
  mapping: { label: "ศูนย์ Mapping", helper: "จับคู่ข้อมูลต้นทางและปลายทาง" }, errors: { label: "คิวข้อผิดพลาด", helper: "ข้อยกเว้นจากการเชื่อมต่อ" }, reconciliation: { label: "การกระทบยอด", helper: "ตรวจสอบข้อมูลข้ามระบบ" },
  approval: { label: "ศูนย์อนุมัติ", helper: "ขั้นตอนการอนุมัติ" }, closing: { label: "ปิดงวดบัญชี", helper: "รายการตรวจสอบการปิดงวด" }, budget: { label: "ควบคุมงบประมาณ", helper: "ติดตามการใช้งบประมาณ" }, settings: { label: "System Control", helper: "การควบคุมระบบ" },
};

const ACCOUNTING_NAV: { id: string; th: string; en: string; icon: LucideIcon }[] = [
  { id: "gl", th: "บัญชีแยกประเภท", en: "General Ledger", icon: BookOpen },
  { id: "customers", th: "ทะเบียนลูกค้า", en: "Customers", icon: Users },
  { id: "ar", th: "เอกสารขายและลูกหนี้", en: "Sales Documents & AR", icon: ArrowDownLeft },
  { id: "ap", th: "เอกสารซื้อและเจ้าหนี้", en: "Purchase Documents & AP", icon: ArrowUpRight },
  { id: "cash", th: "เงินสดและธนาคาร", en: "Cash & Bank", icon: Landmark },
  { id: "tax", th: "ภาษีมูลค่าเพิ่ม / หัก ณ ที่จ่าย", en: "VAT / WHT", icon: FileText },
];

const OPERATIONS_NAV: { id: string; th: string; en: string; icon: LucideIcon }[] = [
  { id: "reports", th: "รายงานทางการเงิน", en: "Financial Reports", icon: FileBarChart },
  { id: "approval", th: "ศูนย์อนุมัติ", en: "Approval Center", icon: ClipboardCheck },
  { id: "closing", th: "ปิดงวดบัญชี", en: "Financial Closing", icon: CalendarCheck },
  { id: "budget", th: "ควบคุมงบประมาณ", en: "Budget Control", icon: Gauge },
];

const SYSTEM_CONTROL_NAV: { id: string; th: string; en: string; icon: LucideIcon }[] = [
  { id: "company", th: "บริษัทและสาขา", en: "Company & Branches", icon: Building2 },
  { id: "coa", th: "ผังบัญชี", en: "Chart of Accounts", icon: BookOpen },
  { id: "users", th: "ผู้ใช้และสิทธิ์", en: "Users & Permissions", icon: Users },
  { id: "integration", th: "Integration Center", en: "Integration Center", icon: Link2 },
  { id: "audit", th: "Audit Log", en: "Audit Log", icon: History },
  { id: "settings", th: "การตั้งค่าระบบ", en: "System Settings", icon: Settings },
];

const SYSTEM_CONTROL_PAGES = ["company", "coa", "users", "integration", "cuto", "tory", "eam", "hr", "mapping", "errors", "reconciliation", "audit", "settings"];
const INTEGRATION_TABS: { id: string; th: string; en: string }[] = [
  { id: "integration", th: "ภาพรวม", en: "Overview" },
  { id: "cuto", th: "KC CuTo", en: "KC CuTo" },
  { id: "tory", th: "KC ToRy", en: "KC ToRy" },
  { id: "eam", th: "KC EAM", en: "KC EAM" },
  { id: "hr", th: "KC HR", en: "KC HR" },
  { id: "mapping", th: "Mapping", en: "Mapping" },
  { id: "errors", th: "Error Queue", en: "Error Queue" },
  { id: "reconciliation", th: "กระทบยอด", en: "Reconciliation" },
];

const MODULE_DEFAULTS: Record<string, { type: string; prefix: string; status: string }> = {
  GL: { type: "Journal", prefix: "JV", status: "Draft" }, AR: { type: "Invoice", prefix: "AR", status: "Pending Approval" },
  AP: { type: "Vendor Bill", prefix: "AP", status: "Pending Approval" }, CASH: { type: "Bank Transaction", prefix: "BNK", status: "Unreconciled" },
  TAX: { type: "Tax Filing", prefix: "TAX", status: "Preparing" }, INTEGRATION: { type: "Inbound Event", prefix: "INT", status: "Queued" },
  CLOSING: { type: "Closing Task", prefix: "CLS", status: "Pending" }, BUDGET: { type: "Budget", prefix: "BUD", status: "Active" },
};

const SALES_DOCUMENT_TYPES = [
  { value: "Quotation", th: "ใบเสนอราคา", en: "Quotation", prefix: "SQ" },
  { value: "Sales Order", th: "ใบสั่งขาย", en: "Sales order", prefix: "SO" },
  { value: "Deposit Receipt", th: "ใบรับมัดจำ", en: "Deposit receipt", prefix: "SD" },
  { value: "Delivery Note", th: "ใบส่งของ", en: "Delivery note", prefix: "DN" },
  { value: "Invoice", th: "ใบแจ้งหนี้ขาย", en: "Sales invoice", prefix: "SI" },
  { value: "Billing Note", th: "ใบวางบิล", en: "Billing note", prefix: "BL" },
  { value: "Receipt", th: "ใบเสร็จรับเงิน", en: "Receipt", prefix: "RC" },
  { value: "Credit Note", th: "ใบลดหนี้ขาย", en: "Sales credit note", prefix: "SCN" },
  { value: "Debit Note", th: "ใบเพิ่มหนี้ขาย", en: "Sales debit note", prefix: "SDN" },
] as const;

const money = (amount: number) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(amount / 100);
const shortMoney = (amount: number) => amount >= 100000000 ? `฿${(amount / 100000000).toFixed(1)}M` : money(amount);
const dateText = (date?: string | null) => date ? new Intl.DateTimeFormat("th-TH", { day: "2-digit", month: "short", year: "2-digit" }).format(new Date(date)) : "—";
const safeMeta = (value: string) => { try { return JSON.parse(value) as Record<string, unknown>; } catch { return {}; } };
const documentMeta = (value?: string): AccountingDocumentMeta => { try { return value ? JSON.parse(value) as AccountingDocumentMeta : {}; } catch { return {}; } };
const decimalMoney = (amount: number) => new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
const normalizeHex = (value?: string) => value && /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : null;
const contrastRatio = (first: string, second: string) => {
  const luminance = (hex: string) => {
    const rgb = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255).map((channel) => channel <= .03928 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
    return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
  };
  const lighter = Math.max(luminance(first), luminance(second)); const darker = Math.min(luminance(first), luminance(second));
  return (lighter + .05) / (darker + .05);
};

async function readApiJson<T extends object>(response: Response): Promise<T> {
  const raw = await response.text();
  if (!raw) throw new Error(`เซิร์ฟเวอร์ไม่ส่งข้อมูลกลับมา (HTTP ${response.status})`);
  let body: unknown;
  try { body = JSON.parse(raw); }
  catch { throw new Error(`ระบบตอบกลับข้อมูลไม่ถูกต้อง (HTTP ${response.status})`); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("รูปแบบข้อมูลจากเซิร์ฟเวอร์ไม่ถูกต้อง");
  const message = "error" in body && typeof body.error === "string" ? body.error : null;
  if (!response.ok || message) throw new Error(message || `เซิร์ฟเวอร์ไม่สามารถดำเนินการได้ (HTTP ${response.status})`);
  return body as T;
}

function StatusBadge({ status }: { status: string }) {
  const tone = ["Posted", "Issued", "Approved", "Received", "Reconciled", "Completed", "Synced", "Active", "Ready", "Processed", "Ready to File"].includes(status)
    ? "success"
    : ["Failed", "Error", "Rejected", "Void"].includes(status)
      ? "danger"
      : ["Pending Approval", "Preparing", "Queued", "Needs Review", "Setup Required"].includes(status)
        ? "review"
        : ["In Progress", "Booked"].includes(status)
          ? "info"
          : ["Draft", "Unreconciled", "Maintenance"].includes(status)
            ? "warning"
            : "neutral";
  return <Badge variant="outline" className={`status-badge ${tone}`}><span className="status-dot" />{status}</Badge>;
}

function KpiCard({ icon: Icon, label, value, note, tone }: { icon: LucideIcon; label: string; value: string; note: string; tone: string }) {
  return <article className="kpi-card"><div className={`kpi-icon ${tone}`}><Icon /></div><div><p>{label}</p><strong>{value}</strong><small>{note}</small></div></article>;
}

function AIRobotIcon({ className = "" }: { className?: string }) {
  return <Image className={`ai-robot-icon ${className}`} src="/kai-com-ai-robot.webp" width={256} height={256} alt="" aria-hidden="true" unoptimized />;
}

function NavigationGroup({ label, icon: Icon, items, open, active, onToggle, onSelect }: { label: string; icon: LucideIcon; items: { id: string; th: string; en: string; icon?: LucideIcon }[]; open: boolean; active: string; onToggle: () => void; onSelect: (id: string) => void }) {
  const { language } = useLanguage();
  const groupActive = items.some((item) => item.id === active);
  return <SidebarMenuItem><SidebarMenuButton className={`kc-nav-button kc-system-toggle ${groupActive ? "active" : ""}`} isActive={groupActive} onClick={onToggle} aria-expanded={open}><Icon /><span>{label}</span><ChevronDown className={open ? "expanded" : ""} /></SidebarMenuButton>{open && <SidebarMenuSub className="kc-system-submenu">{items.map((item) => { const ItemIcon = item.icon; return <SidebarMenuSubItem key={item.id}><SidebarMenuSubButton asChild isActive={active === item.id}><button type="button" onClick={() => onSelect(item.id)}>{ItemIcon && <ItemIcon />}<span>{language === "th" ? item.th : item.en}</span></button></SidebarMenuSubButton></SidebarMenuSubItem>; })}</SidebarMenuSub>}</SidebarMenuItem>;
}

function SystemControlTabs({ active, onNavigate, permissions }: { active: string; onNavigate: (id: string) => void; permissions: string[] }) {
  const { language, tr } = useLanguage();
  const integrationActive = ["integration", "cuto", "tory", "eam", "hr", "mapping", "errors", "reconciliation"].includes(active);
  return <nav className="system-control-tabs" aria-label={tr("เมนูย่อย System Control", "System Control submenu")}>{SYSTEM_CONTROL_NAV.filter((item) => item.id !== "users" || permissions.includes("manage_users")).map((item) => { const Icon = item.icon; const selected = item.id === "integration" ? integrationActive : active === item.id; return <button key={item.id} type="button" className={selected ? "active" : ""} onClick={() => onNavigate(item.id)}><Icon />{language === "th" ? item.th : item.en}</button>; })}</nav>;
}

function IntegrationTabs({ active, onNavigate }: { active: string; onNavigate: (id: string) => void }) {
  const { language, tr } = useLanguage();
  return <nav className="integration-tabs" aria-label={tr("เมนู Integration", "Integration navigation")}>{INTEGRATION_TABS.map((item) => <button key={item.id} type="button" className={active === item.id ? "active" : ""} onClick={() => onNavigate(item.id)}>{language === "th" ? item.th : item.en}</button>)}</nav>;
}

function KCNavigation({ active, data, permissions, selectPage }: { active: string; data: AppData | null; permissions: string[]; selectPage: (id: string) => void }) {
  const { setOpenMobile } = useSidebar();
  const { tr } = useLanguage();
  const [accountingOpen, setAccountingOpen] = useState(true);
  const [operationsOpen, setOperationsOpen] = useState(OPERATIONS_NAV.some((item) => item.id === active));
  const [systemOpen, setSystemOpen] = useState(SYSTEM_CONTROL_PAGES.includes(active));
  const logoSrc = data?.settings.brand_logo_key && !data.settings.brand_logo_key.includes("-365_") ? `/api/branding/logo?v=${encodeURIComponent(data.settings.brand_logo_key)}` : "/account360-logo.png";
  const goTo = (id: string) => { selectPage(id); setOpenMobile(false); };

  return <>
    <SidebarHeader className="kc-sidebar-header"><button type="button" className="kc-sidebar-logo" onClick={() => goTo("dashboard")} aria-label={tr("ไปหน้าแดชบอร์ด", "Go to dashboard")}><Image src={logoSrc} width={2172} height={724} alt="Account 360" unoptimized /></button><div className="kc-current-company"><span>{tr("บริษัทปัจจุบัน", "CURRENT COMPANY")}</span><strong>{data?.settings.company_name || "KC Account 360"} · {tr("สำนักงานใหญ่", "Main Office")}</strong></div></SidebarHeader>
    <SidebarContent className="kc-sidebar-content"><SidebarMenu className="kc-sidebar-menu"><SidebarMenuItem><SidebarMenuButton className="kc-nav-button" isActive={active === "dashboard"} onClick={() => goTo("dashboard")} tooltip={tr("แดชบอร์ด", "Dashboard")}><LayoutDashboard /><span>{tr("แดชบอร์ด", "Dashboard")}</span></SidebarMenuButton></SidebarMenuItem><NavigationGroup label={tr("งานบัญชี", "Accounting")} icon={BookOpen} items={ACCOUNTING_NAV} open={accountingOpen} active={active} onToggle={() => setAccountingOpen((open) => !open)} onSelect={goTo} /><NavigationGroup label={tr("งานควบคุมการเงิน", "Finance Operations")} icon={ClipboardCheck} items={OPERATIONS_NAV} open={operationsOpen} active={active} onToggle={() => setOperationsOpen((open) => !open)} onSelect={goTo} /><NavigationGroup label="System Control" icon={Settings} items={SYSTEM_CONTROL_NAV.filter((item) => item.id !== "users" || permissions.includes("manage_users"))} open={systemOpen} active={SYSTEM_CONTROL_PAGES.includes(active) && !SYSTEM_CONTROL_NAV.some((item) => item.id === active) ? "integration" : active} onToggle={() => setSystemOpen((open) => !open)} onSelect={goTo} /></SidebarMenu></SidebarContent>
    <SidebarFooter className="kc-sidebar-footer"><button type="button" className="kc-ai-card" onClick={() => goTo("ai")}><span className="kc-ai-title"><AIRobotIcon className="sidebar" /><strong>{tr("ผู้ช่วย AI ด้านการเงิน", "AI Finance Assistant")}</strong></span><small>{tr("ถามได้ เช่น “มีรายการใดต้องอนุมัติหรือควรติดตาม?”", "Ask, for example, “Which items need approval or follow-up?”")}</small><b>{tr("เริ่มสนทนา →", "Start a conversation →")}</b></button></SidebarFooter>
  </>;
}

function CommandCenter({ open, onOpenChange, data, permissions, onNavigate, onOpenRecord, onCreate }: { open: boolean; onOpenChange: (open: boolean) => void; data: AppData | null; permissions: string[]; onNavigate: (id: string) => void; onOpenRecord: (record: RecordItem) => void; onCreate: (module: string) => void }) {
  const { language, tr } = useLanguage();
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>(() => { if (typeof window === "undefined") return []; try { return JSON.parse(window.localStorage.getItem("kc-account-recent-searches") || "[]"); } catch { return []; } });
  const normalized = query.trim().toLowerCase();
  const pages = NAV.filter((item) => {
    const translated = PAGE_THAI[item.id];
    return !normalized || [item.label, item.helper, translated?.label, translated?.helper].filter(Boolean).join(" ").toLowerCase().includes(normalized);
  }).slice(0, 6);
  const records = (data?.records ?? []).filter((record) => !normalized || [record.documentNo, record.recordType, record.description, record.counterparty, record.sourceSystem, record.status].join(" ").toLowerCase().includes(normalized)).slice(0, 6);
  const quickCreate = [
    { id: "gl", label: tr("บันทึก Journal", "Create journal"), icon: BookOpen },
    { id: "ar", label: tr("สร้างเอกสารขาย", "Create sales document"), icon: ArrowDownLeft },
    { id: "ap", label: tr("สร้างเอกสารซื้อ", "Create purchase document"), icon: ArrowUpRight },
    { id: "cash", label: tr("สร้างรายการธนาคาร", "Create bank entry"), icon: Landmark },
  ];
  function remember(value: string) {
    const next = [value, ...recent.filter((item) => item !== value)].slice(0, 5);
    setRecent(next);
    window.localStorage.setItem("kc-account-recent-searches", JSON.stringify(next));
  }
  function selectPage(id: string, label: string) { remember(label); onNavigate(id); onOpenChange(false); }
  function selectRecord(record: RecordItem) { remember(record.documentNo); onNavigate(record.module.toLowerCase()); onOpenRecord(record); onOpenChange(false); }
  return <Dialog open={open} onOpenChange={(value) => { if (!value) setQuery(""); onOpenChange(value); }}><DialogContent className="command-center"><DialogHeader><DialogTitle><Command />{tr("ค้นหาและสั่งงาน", "Search and command")}</DialogTitle><DialogDescription>{tr("ค้นหาข้ามโมดูล เปิดเอกสาร หรือสร้างรายการใหม่", "Search across modules, open a document, or create a new entry.")}</DialogDescription></DialogHeader><div className="command-search"><Search /><Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tr("ค้นหาเอกสาร คู่ค้า เมนู หรือสถานะ...", "Search documents, counterparties, pages, or statuses...")} aria-label={tr("ค้นหาทั่วทั้งระบบ", "Search across the application")} /><kbd>ESC</kbd></div>{!query && recent.length > 0 && <div className="command-recent"><span>{tr("ค้นหาล่าสุด", "Recent searches")}</span>{recent.map((item) => <button key={item} type="button" onClick={() => setQuery(item)}><History />{item}</button>)}</div>}<div className="command-results"><section><h3>{tr("เมนูและพื้นที่ทำงาน", "Pages and workspaces")}</h3>{pages.map((item) => { const Icon = item.icon; const translated = language === "th" ? PAGE_THAI[item.id] : null; return <button type="button" key={item.id} onClick={() => selectPage(item.id, translated?.label || item.label)}><span className="command-result-icon"><Icon /></span><span><strong>{translated?.label || item.label}</strong><small>{translated?.helper || item.helper}</small></span><ChevronRight /></button>; })}</section><section><h3>{tr("เอกสารและรายการ", "Documents and entries")}</h3>{records.map((record) => <button type="button" key={record.id} onClick={() => selectRecord(record)}><span className="command-result-icon"><FileText /></span><span><strong>{record.documentNo}</strong><small>{record.counterparty || record.description} · {record.module}</small></span><StatusBadge status={record.status} /></button>)}{records.length === 0 && <p className="command-empty">{tr("ไม่พบเอกสารที่ตรงกัน", "No matching documents found.")}</p>}</section></div>{permissions.includes("create") && <div className="command-quick-create"><h3>{tr("สร้างรายการด่วน", "Quick create")}</h3><div>{quickCreate.map((item) => { const Icon = item.icon; return <Button key={item.id} type="button" variant="outline" onClick={() => { onCreate(item.id); onOpenChange(false); }}><Icon />{item.label}</Button>; })}</div></div>}</DialogContent></Dialog>;
}

export default function KCAccountApp({ initialUser, signOutHref }: { initialUser: ChatGPTUser; signOutHref: string }) {
  const [data, setData] = useState<AppData | null>(null);
  const [active, setActive] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [language, setLanguage] = useState<Language>("th");
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDocumentType, setCreateDocumentType] = useState<string | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [detail, setDetail] = useState<RecordItem | null>(null);
  const [editRecord, setEditRecord] = useState<RecordItem | null>(null);
  const [uploadRecord, setUploadRecord] = useState<RecordItem | null>(null);
  const [issuedKey, setIssuedKey] = useState<{ name: string; key: string } | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/records", { cache: "no-store" });
      const body = await readApiJson<AppData>(response);
      setData(body);
      if (body.preferences) { setPreferences(body.preferences); setLanguage(body.preferences.language === "en" ? "en" : "th"); }
    } catch (error) { toast.error(error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void loadData(), 0); return () => window.clearTimeout(timer); }, [loadData]);
  useEffect(() => { const handler = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setCommandOpen(true); } }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, []);
  useEffect(() => { const timer = window.setTimeout(() => { const saved = window.localStorage.getItem("kc-account-language"); const selected = saved === "en" ? "en" : "th"; setLanguage(selected); document.documentElement.lang = selected; }, 0); return () => window.clearTimeout(timer); }, []);
  useEffect(() => { document.documentElement.lang = language; document.documentElement.dataset.theme = preferences.theme; }, [language, preferences.theme]);
  const nav = NAV.find((item) => item.id === active) ?? NAV[0];
  const filtered = useMemo(() => {
    const records = data?.records ?? [];
    let items = nav.module ? records.filter((r) => r.module === nav.module) : records;
    if (active === "approval") items = records.filter((r) => r.status === "Pending Approval");
    if (active === "reports") items = records.filter((r) => !["CLOSING", "INTEGRATION"].includes(r.module));
    if (active === "cuto") items = records.filter((r) => r.sourceSystem === "KC CuTo CRM");
    if (active === "tory") items = records.filter((r) => ["KC Inventory", "KC ToRy"].includes(r.sourceSystem));
    if (active === "eam") items = records.filter((r) => r.sourceSystem === "KC EAM");
    if (active === "hr") items = records.filter((r) => r.sourceSystem === "KC HR");
    if (active === "errors") items = records.filter((r) => r.module === "INTEGRATION" && r.status === "Failed");
    if (active === "reconciliation") items = records.filter((r) => r.status === "Unreconciled" || (r.module === "INTEGRATION" && ["Failed", "Queued"].includes(r.status)));
    const q = search.trim().toLowerCase();
    return q ? items.filter((r) => [r.documentNo, r.description, r.counterparty, r.sourceSystem, r.status].join(" ").toLowerCase().includes(q)) : items;
  }, [data, nav.module, active, search]);

  async function mutate(payload: Record<string, unknown>, success: string) {
    setWorking(true);
    try {
      const response = await fetch("/api/records", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      await readApiJson<{ ok: boolean }>(response);
      toast.success(success); await loadData(); setDetail(null);
      return true;
    } catch (error) { toast.error(error instanceof Error ? error.message : "ทำรายการไม่สำเร็จ"); return false; }
    finally { setWorking(false); }
  }

  async function mutateIntegration(payload: Record<string, unknown>, success: string) {
    setWorking(true);
    try {
      const response = await fetch("/api/integrations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = await readApiJson<Record<string, unknown>>(response);
      if (body.apiKey) setIssuedKey({ name: String(payload.system || "Connector"), key: String(body.apiKey) });
      if (body.ok === false) toast.warning(`${success} แต่พบ ${body.failed || 0} รายการที่ต้องแก้ไข`); else toast.success(success);
      await loadData();
      return body as Record<string, unknown>;
    } catch (error) { toast.error(error instanceof Error ? error.message : "ดำเนินการ Integration ไม่สำเร็จ"); return null; }
    finally { setWorking(false); }
  }

  async function createRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget); const moduleKey = String(form.get("module")); const defaults = MODULE_DEFAULTS[moduleKey];
    const recordType = String(form.get("recordType") || defaults.type);
    const lineItems = moduleKey === "AR" ? [1, 2, 3].map((index) => ({ description: String(form.get(`itemDescription${index}`) || "").trim(), quantity: Number(form.get(`quantity${index}`) || 0), unitPrice: Number(form.get(`unitPrice${index}`) || 0), discount: Number(form.get(`discount${index}`) || 0) })).filter((item) => item.description && item.quantity > 0) : [];
    const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice - item.discount, 0);
    const taxRate = Number(form.get("taxRate") || 0);
    const metadata = moduleKey === "AR" ? { issueDate: form.get("issueDate"), referenceDocumentNo: form.get("referenceDocumentNo"), paymentTerms: form.get("paymentTerms"), taxRate, lineItems, affectsStock: form.get("affectsStock") === "true" } : moduleKey === "AP" ? { linkedDocumentNo: form.get("linkedDocumentNo"), affectsStock: form.get("affectsStock") === "true" } : {};
    const ok = await mutate({ action: "create", module: moduleKey, recordType, documentNo: form.get("documentNo"), description: moduleKey === "AR" ? lineItems.map((item) => item.description).join(", ") : form.get("description"), counterparty: form.get("counterparty"), amount: moduleKey === "AR" ? subtotal : Number(form.get("amount") || 0), taxAmount: moduleKey === "AR" ? subtotal * taxRate / 100 : Number(form.get("taxAmount") || 0), dueDate: form.get("dueDate"), sourceSystem: form.get("sourceSystem"), period: data?.settings.current_period || "2026-09", metadata, status: defaults.status }, ["AR", "AP"].includes(moduleKey) ? "สร้างเอกสารแล้ว" : "สร้างรายการแล้ว");
    if (ok) setCreateOpen(false);
  }

  async function upload(file?: File) {
    if (!file || !uploadRecord) return;
    const form = new FormData(); form.set("file", file); form.set("recordId", uploadRecord.id); setWorking(true);
    try {
      const response = await fetch("/api/upload", { method: "POST", body: form });
      await readApiJson<{ ok: boolean }>(response);
      toast.success(`แนบ ${file.name} แล้ว`); await loadData();
    } catch (error) { toast.error(error instanceof Error ? error.message : "อัปโหลดไม่สำเร็จ"); }
    finally { setWorking(false); setUploadRecord(null); if (fileRef.current) fileRef.current.value = ""; }
  }

  const savePreferences = useCallback(async (updates: Partial<UserPreferences>) => {
    const response = await fetch("/api/preferences", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(updates) });
    const result = await readApiJson<{ ok: boolean; preferences: UserPreferences }>(response);
    setPreferences(result.preferences);
    return result.preferences;
  }, []);
  const changeLanguage = (value: string) => { if (value !== "th" && value !== "en") return; setLanguage(value); setPreferences((current) => ({ ...current, language: value })); window.localStorage.setItem("kc-account-language", value); document.documentElement.lang = value; void savePreferences({ language: value }).catch(() => toast.error(value === "th" ? "บันทึกภาษาไม่สำเร็จ" : "Could not save language")); };
  const selectPage = (id: string) => { setActive(id); setSearch(""); };
  const masterPages = ["company", "coa", "customers", "users"];
  const permissions = data?.access.permissions ?? [];
  const showCreate = permissions.includes("create") && ["gl", "ar", "ap", "cash", "tax"].includes(active);
  const integrationPages = ["integration", "cuto", "tory", "eam", "hr", "errors"];
  const utilityPages = ["ai", "settings", "company", "coa", "customers", "users", "mapping", "audit", ...integrationPages];
  const showExport = permissions.includes("export") && !utilityPages.includes(active);
  const showSearch = !utilityPages.includes(active);
  const currentModule = nav.module || "GL";
  const systemControlActive = SYSTEM_CONTROL_PAGES.includes(active);
  const displayNav = language === "th" ? PAGE_THAI[active] || nav : nav;
  const savedBrandColor = normalizeHex(data?.settings.brand_primary);
  const savedControlColor = data?.settings.brand_sync_control === "true" ? savedBrandColor : normalizeHex(data?.settings.brand_control);
  const appTheme = { "--sidebar-width": "14.5rem", "--kc-sidebar-surface": savedControlColor || "#172033", ...(savedBrandColor ? { "--kc-teal": savedBrandColor, "--kc-gradient": `linear-gradient(135deg, ${savedBrandColor}, ${savedBrandColor})` } : {}) } as React.CSSProperties;

  return (
    <LanguageContext.Provider value={language}><SidebarProvider className="app-shell" style={appTheme} data-theme={preferences.theme} data-density={preferences.tableDensity} data-page-width={preferences.pageWidth}>
      <Sidebar className="kc-sidebar" collapsible="offcanvas"><div className="kc-sidebar-shell"><KCNavigation active={active} data={data} permissions={permissions} selectPage={selectPage} /></div></Sidebar>
      <SidebarInset className="workspace">
        <header className="topbar"><div className="topbar-leading"><SidebarTrigger className="kc-sidebar-trigger" aria-label={language === "th" ? "เปิดหรือปิดแถบเมนู" : "Toggle navigation"} title={language === "th" ? "เปิดหรือปิดแถบเมนู" : "Toggle navigation"} /><div className="period-pill"><CalendarCheck /> {language === "th" ? "งวด" : "Period"} {data?.settings.current_period || "2026-09"}{data?.settings.locked_period && <LockKeyhole />}</div><button type="button" className="global-command-trigger" onClick={() => setCommandOpen(true)}><Search /><span>{language === "th" ? "ค้นหาทั่วทั้งระบบ" : "Search everything"}</span><kbd>Ctrl K</kbd></button></div><div className="top-actions"><ToggleGroup type="single" value={language} onValueChange={changeLanguage} className="language-switch" aria-label={language === "th" ? "เลือกภาษา" : "Select language"}><ToggleGroupItem value="th" aria-label="ภาษาไทย">TH</ToggleGroupItem><ToggleGroupItem value="en" aria-label="English">EN</ToggleGroupItem></ToggleGroup><button className="icon-button" onClick={() => setAuditOpen(true)} title="Audit log"><History /></button><div className="user-avatar">{(initialUser.fullName || initialUser.email).slice(0, 1).toUpperCase()}</div><div className="user-copy"><strong>{initialUser.fullName || "Finance User"}</strong><span>{data?.access.role || "Loading"} · {initialUser.email}</span></div><a className="icon-button" href={signOutHref} title={language === "th" ? "ออกจากระบบ" : "Sign out"} aria-label={language === "th" ? "ออกจากระบบ" : "Sign out"}><LogOut /></a></div></header>
        <section className="content">
          {systemControlActive && data && <SystemControlTabs active={active} onNavigate={selectPage} permissions={permissions} />}
          {!loading && data && ["ar", "ap"].includes(active) && <DocumentWorkflowPanel module={active.toUpperCase()} records={filtered} canCreate={permissions.includes("create")} onCreate={(type) => { setCreateDocumentType(type); setCreateOpen(true); }} />}
          {active !== "settings" && <div className="page-head"><div><p className="eyebrow">{displayNav.helper}</p><h1>{displayNav.label}</h1></div><div className="head-actions">{showSearch && <div className="search-box"><Search /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={language === "th" ? "ค้นหาเอกสาร คู่ค้า หรือสถานะ" : "Search documents, counterparties, or status"} aria-label={language === "th" ? "ค้นหา" : "Search"} /></div>}{showExport && <Button variant="outline" onClick={() => window.open(`/api/export?module=${nav.module || "ALL"}`, "_blank")}><Download />{language === "th" ? "ส่งออก CSV" : "Export CSV"}</Button>}{showCreate && <Button onClick={() => { setCreateDocumentType(null); setCreateOpen(true); }}><Plus />{active === "ar" ? language === "th" ? "สร้างเอกสารขาย" : "Create sales document" : active === "ap" ? language === "th" ? "สร้างเอกสารซื้อ" : "Create purchase document" : language === "th" ? "สร้างรายการ" : "Create entry"}</Button>}</div></div>}
          {loading ? <div className="loading-panel"><Loader2 className="spin" /><p>{language === "th" ? "กำลังโหลดข้อมูลบัญชี..." : "Loading accounting data..."}</p></div> : !data ? <div className="empty-panel">{language === "th" ? "ไม่สามารถโหลดข้อมูลได้" : "Unable to load data"} <Button onClick={loadData}>{language === "th" ? "ลองใหม่" : "Try again"}</Button></div> : active === "dashboard" ? <Dashboard data={data} onNavigate={selectPage} /> : active === "ai" ? <AIAdvisor insights={data.insights} onNavigate={selectPage} /> : active === "settings" ? <SettingsView data={data} working={working} mutate={mutate} canManage={permissions.includes("manage_settings")} preferences={preferences} savePreferences={savePreferences} /> : active === "audit" ? <AuditPage logs={data.audit} /> : integrationPages.includes(active) ? <IntegrationView active={active} data={data} working={working} action={mutateIntegration} permissions={permissions} onNavigate={selectPage} /> : active === "mapping" ? <div className="integration-workspace"><IntegrationTabs active={active} onNavigate={selectPage} /><MasterView active={active} data={data} working={working} mutate={mutate} canManage={permissions.includes("manage_master")} /></div> : active === "reconciliation" ? <div className="integration-workspace"><IntegrationTabs active={active} onNavigate={selectPage} /><ModuleView active={active} records={filtered} data={data} working={working} mutate={mutate} onDetail={setDetail} onEdit={setEditRecord} onUpload={(record) => { setUploadRecord(record); fileRef.current?.click(); }} permissions={permissions} /></div> : active === "reports" ? <FinancialReportsView records={filtered} data={data} working={working} mutate={mutate} onDetail={setDetail} onEdit={setEditRecord} onUpload={(record) => { setUploadRecord(record); fileRef.current?.click(); }} permissions={permissions} /> : masterPages.includes(active) ? <MasterView active={active} data={data} working={working} mutate={mutate} canManage={active === "users" ? permissions.includes("manage_users") : permissions.includes("manage_master")} /> : <ModuleView active={active} records={filtered} data={data} working={working} mutate={mutate} onDetail={setDetail} onEdit={setEditRecord} onUpload={(record) => { setUploadRecord(record); fileRef.current?.click(); }} permissions={permissions} />}
        </section>

      <input ref={fileRef} className="sr-only" type="file" accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.docx" onChange={(e) => void upload(e.target.files?.[0])} />
      {["AR", "AP"].includes(currentModule) ? <AccountingDocumentDialog key={`${currentModule}-${createDocumentType || "default"}-${createOpen}`} open={createOpen} onOpenChange={setCreateOpen} moduleKey={currentModule as "AR" | "AP"} initialType={createDocumentType} working={working} mutate={mutate} counterparties={data?.masters.filter((item) => item.category === "CUSTOMER" && item.status === "Active") ?? []} settings={data?.settings ?? {}} existingVendors={(data?.records ?? []).filter((item) => item.module === "AP").map((item) => item.counterparty).filter(Boolean)} /> : <CreateDialog key={`${currentModule}-${createOpen}`} open={createOpen} onOpenChange={setCreateOpen} moduleKey={currentModule} initialType={null} working={working} onSubmit={createRecord} customers={[]} />}
      <AuditDialog open={auditOpen} onOpenChange={setAuditOpen} logs={data?.audit ?? []} />
      <DetailDialog record={detail} onOpenChange={(open) => !open && setDetail(null)} documents={data?.documents ?? []} working={working} mutate={mutate} permissions={permissions} settings={data?.settings ?? {}} />
      {editRecord && ["AR", "AP"].includes(editRecord.module) ? <AccountingDocumentDialog key={`edit-${editRecord.id}`} open record={editRecord} onOpenChange={(open) => !open && setEditRecord(null)} moduleKey={editRecord.module as "AR" | "AP"} initialType={editRecord.recordType} working={working} mutate={mutate} counterparties={data?.masters.filter((item) => item.category === "CUSTOMER" && item.status === "Active") ?? []} settings={data?.settings ?? {}} existingVendors={(data?.records ?? []).filter((item) => item.module === "AP").map((item) => item.counterparty).filter(Boolean)} /> : <EditRecordDialog record={editRecord} onOpenChange={(open) => !open && setEditRecord(null)} working={working} mutate={mutate} />}
      <ApiKeyDialog value={issuedKey} onClose={() => setIssuedKey(null)} />
      <CommandCenter open={commandOpen} onOpenChange={setCommandOpen} data={data} permissions={permissions} onNavigate={selectPage} onOpenRecord={setDetail} onCreate={(moduleKey) => { setActive(moduleKey); setCreateDocumentType(null); setCreateOpen(true); }} />
      <Toaster position="top-right" richColors />
      </SidebarInset>
    </SidebarProvider></LanguageContext.Provider>
  );
}

function Dashboard({ data, onNavigate }: { data: AppData; onNavigate: (id: string) => void }) {
  const { tr } = useLanguage();
  const [taskNow] = useState(() => Date.now());
  const records = data.records;
  const ar = records.filter((r) => r.module === "AR" && ["Invoice", "Tax Invoice", "Credit Note", "Debit Note"].includes(r.recordType) && !["Received", "Void"].includes(r.status)).reduce((sum, record) => sum + (record.recordType === "Credit Note" ? -record.amount : record.amount), 0);
  const ap = records.filter((r) => r.module === "AP" && ["Purchase Invoice", "Purchase Credit Note", "Purchase Debit Note", "Vendor Bill"].includes(r.recordType) && !["Posted", "Paid", "Void"].includes(r.status)).reduce((sum, record) => sum + (record.recordType === "Purchase Credit Note" ? -record.amount : record.amount), 0);
  const cash = records.filter((r) => r.module === "CASH" && r.status !== "Void").reduce((s, r) => s + r.amount, 0);
  const pending = records.filter((r) => r.status === "Pending Approval");
  const overdue = records.filter((r) => r.dueDate && new Date(r.dueDate).getTime() < taskNow && !["Paid", "Received", "Completed", "Void", "Posted"].includes(r.status));
  const unreconciled = records.filter((r) => r.status === "Unreconciled");
  const closing = records.filter((r) => r.module === "CLOSING" && r.status !== "Completed");
  const failedIntegrations = data.integrationEvents.filter((event) => event.status === "Failed").length + records.filter((r) => r.module === "INTEGRATION" && r.status === "Failed").length;
  const tasks: { key: string; label: string; note: string; count: number; amount: number; target: string; tone: string; icon: LucideIcon }[] = [
    { key: "approval", label: tr("รออนุมัติ", "Pending approvals"), note: tr("ต้องตรวจสอบตาม Maker–Checker", "Review under maker-checker control"), count: pending.length, amount: pending.reduce((sum, item) => sum + item.amount, 0), target: "approval", tone: "review", icon: ClipboardCheck },
    { key: "overdue", label: tr("เกินกำหนดชำระ", "Overdue documents"), note: tr("ติดตามรับ–จ่ายและคู่ค้า", "Follow up collections, payments, and counterparties"), count: overdue.length, amount: overdue.reduce((sum, item) => sum + item.amount, 0), target: overdue.some((item) => item.module === "AR") ? "ar" : "ap", tone: "danger", icon: AlertTriangle },
    { key: "integration", label: tr("Integration ผิดพลาด", "Integration failures"), note: tr("ตรวจ Mapping และ Retry Event", "Review mapping and retry events"), count: failedIntegrations, amount: 0, target: "errors", tone: "danger", icon: Activity },
    { key: "reconciliation", label: tr("รอกระทบยอด", "Awaiting reconciliation"), note: tr("ตรวจรายการธนาคารที่ยังจับคู่ไม่ได้", "Review unmatched bank transactions"), count: unreconciled.length, amount: unreconciled.reduce((sum, item) => sum + item.amount, 0), target: "reconciliation", tone: "warning", icon: Landmark },
    { key: "closing", label: tr("งานปิดงวด", "Closing tasks"), note: tr("รายการตรวจสอบที่ยังไม่เสร็จ", "Incomplete period-close checklist items"), count: closing.length, amount: 0, target: "closing", tone: "info", icon: CalendarCheck },
  ].filter((task) => task.count > 0);
  const chartData = ["GL", "AR", "AP", "CASH", "TAX"].map((moduleKey) => ({ label: moduleKey, value: records.filter((r) => r.module === moduleKey && r.status !== "Void").reduce((sum, r) => sum + r.amount, 0) }));
  const chartMax = Math.max(...chartData.map((item) => item.value), 1);
  return <div className="dashboard-grid">
    <div className="kpi-grid"><KpiCard icon={Banknote} label={tr("เงินสดและรายการธนาคาร", "Cash & bank activity")} value={shortMoney(cash)} note={tr("ยอดเคลื่อนไหวในงวด", "Current-period movement")} tone="teal" /><KpiCard icon={ArrowDownLeft} label={tr("ลูกหนี้คงค้าง", "Outstanding receivables")} value={shortMoney(ar)} note={tr("รอรับชำระและอนุมัติ", "Awaiting payment and approval")} tone="blue" /><KpiCard icon={ArrowUpRight} label={tr("เจ้าหนี้คงค้าง", "Outstanding payables")} value={shortMoney(ap)} note={tr("ภาระจ่ายปัจจุบัน", "Current payment obligations")} tone="amber" /><KpiCard icon={ClipboardCheck} label={tr("รออนุมัติ", "Pending approval")} value={`${pending.length} ${tr("รายการ", "items")}`} note={shortMoney(pending.reduce((s, r) => s + r.amount, 0))} tone="purple" /></div>
    <section className="panel ai-summary-panel"><div className="ai-orb"><AIRobotIcon className="summary" /></div><div><p className="eyebrow">AI FINANCE ADVISOR</p><h2>{data.insights.length ? tr(`พบ ${data.insights.length} ประเด็นที่ควรดำเนินการ`, `${data.insights.length} items need attention`) : tr("สถานะการเงินและงานควบคุมปกติ", "Finance and controls are operating normally")}</h2><p>{data.insights[0]?.recommendation || tr("ยังไม่พบความเสี่ยงเร่งด่วนจากข้อมูลปัจจุบัน", "No urgent risk has been found in the current data")}</p></div><Button onClick={() => onNavigate("ai")}>{tr("ดูคำแนะนำทั้งหมด", "View all recommendations")} <ChevronRight /></Button></section>
    <section className="panel cashflow-panel"><div className="panel-head"><div><p className="eyebrow">CURRENT PERIOD</p><h2>{tr("มูลค่าธุรกรรมตามโมดูล", "Transaction value by module")}</h2></div><Badge variant="outline">{tr("ข้อมูลจากฐานข้อมูลจริง", "Live database data")}</Badge></div><div className="chart-wrap"><div className="chart-axis"><span>{shortMoney(chartMax)}</span><span>{shortMoney(chartMax * .75)}</span><span>{shortMoney(chartMax * .5)}</span><span>{shortMoney(chartMax * .25)}</span><span>0</span></div><div className="bar-chart">{chartData.map((item) => <div className="bar-col" key={item.label}><div className="bar-value" style={{ height: `${Math.max(item.value / chartMax * 100, 2)}%` }} title={money(item.value)} /><span>{item.label}</span></div>)}</div></div></section>
    <section className="panel task-center-panel"><div className="panel-head"><div><p className="eyebrow">ROLE-BASED TASK CENTER</p><h2><ListTodo />{tr("งานสำคัญที่ต้องดำเนินการ", "Priority work queue")}</h2></div><Badge variant="outline">{tasks.reduce((sum, task) => sum + task.count, 0)} {tr("งาน", "tasks")}</Badge></div><div className="task-center-list">{tasks.slice(0, 5).map((task) => { const Icon = task.icon; return <button type="button" key={task.key} onClick={() => onNavigate(task.target)}><span className={`task-icon ${task.tone}`}><Icon /></span><span><strong>{task.label}</strong><small>{task.note}</small></span><span className="task-metric"><b>{task.count}</b>{task.amount > 0 && <small>{money(task.amount)}</small>}</span><ChevronRight /></button>; })}{tasks.length === 0 && <div className="all-clear"><Check />{tr("ไม่มีงานเร่งด่วนในขณะนี้", "No priority tasks require attention.")}</div>}</div></section>
    <section className="panel integration-panel"><div className="panel-head"><div><p className="eyebrow">SYSTEM HEALTH</p><h2>{tr("สถานะการเชื่อมต่อ", "Integration status")}</h2></div><button className="text-link" onClick={() => onNavigate("integration")}>Integration Center <ChevronRight /></button></div><div className="system-grid">{data.connectors.map((connector) => <div key={connector.key}><span className={`system-dot ${connector.status === "Error" ? "down" : !["Active", "Ready"].includes(connector.status) ? "waiting" : ""}`} /><strong>{connector.name}</strong><small>{connector.status === "Error" ? connector.lastError || tr("พบข้อผิดพลาด", "Error detected") : connector.status === "Active" ? tr(`เชื่อมแล้ว ${connector.recordsSynced} รายการ`, `${connector.recordsSynced} records connected`) : connector.status}</small></div>)}</div></section>
    <section className="panel quick-panel"><div className="panel-head"><div><p className="eyebrow">QUICK ACCESS</p><h2>{tr("งานที่ใช้บ่อย", "Frequently used tasks")}</h2></div></div><div className="quick-grid"><button onClick={() => onNavigate("gl")}><BookOpen /><span>{tr("บันทึก Journal", "Create journal")}</span></button><button onClick={() => onNavigate("ar")}><CircleDollarSign /><span>{tr("ออกใบแจ้งหนี้", "Create invoice")}</span></button><button onClick={() => onNavigate("cash")}><Landmark /><span>{tr("กระทบยอดธนาคาร", "Reconcile bank")}</span></button><button onClick={() => onNavigate("reports")}><FileBarChart /><span>{tr("รายงานการเงิน", "Financial reports")}</span></button></div></section>
  </div>;
}

function AIAdvisor({ insights, onNavigate }: { insights: FinanceInsight[]; onNavigate: (id: string) => void }) {
  const { tr } = useLanguage();
  const urgent = insights.filter((item) => ["critical", "high"].includes(item.severity)).length;
  return <div className="ai-advisor"><section className="ai-hero"><div className="ai-orb large"><AIRobotIcon className="hero" /></div><div><p className="eyebrow">EXPLAINABLE FINANCE INTELLIGENCE</p><h2>AI Action Center</h2><p>{tr("วิเคราะห์ธุรกรรม งานอนุมัติ การปิดงวด งบประมาณ และสถานะ Integration จากข้อมูลปัจจุบัน พร้อมแนะนำขั้นตอนถัดไปที่ตรวจสอบย้อนกลับได้", "Analyze transactions, approvals, closing, budgets, and integration status with traceable next-step recommendations.")}</p></div><div className="ai-score"><strong>{urgent}</strong><span>{tr("เรื่องเร่งด่วน", "urgent items")}</span></div></section><div className="insight-grid">{insights.map((item) => <article key={item.id} className={`insight-card ${item.severity}`}><div className="insight-top"><span className="insight-severity"><BellRing />{item.severity === "critical" ? tr("วิกฤต", "Critical") : item.severity === "high" ? tr("เร่งด่วน", "High") : item.severity === "medium" ? tr("ควรดำเนินการ", "Action needed") : tr("เฝ้าระวัง", "Monitor")}</span><Badge variant="outline">{item.category}</Badge></div><h3>{item.title}</h3><p>{item.explanation}</p>{item.amount > 0 && <strong className="insight-amount">{money(item.amount)}</strong>}<div className="recommendation"><AIRobotIcon className="recommendation-icon" /><span><b>{tr("คำแนะนำ", "Recommendation")}</b>{item.recommendation}</span></div><Button variant="outline" onClick={() => onNavigate(item.target)}>{tr("ดำเนินการ", "Take action")} <ChevronRight /></Button></article>)}{!insights.length && <section className="panel all-clear-card"><Check /><h3>{tr("ไม่พบประเด็นที่ต้องดำเนินการ", "No items require action")}</h3><p>{tr("AI ตรวจสอบข้อมูลล่าสุดแล้ว ไม่พบความเสี่ยงหรือรายการค้างที่ต้องเร่งแก้ไข", "AI reviewed the latest data and found no urgent risks or outstanding items.")}</p></section>}</div><p className="ai-disclaimer">{tr("คำแนะนำสร้างจากกฎควบคุมทางบัญชีและข้อมูลในระบบ ควรให้ผู้มีอำนาจตรวจสอบก่อนบันทึกหรืออนุมัติรายการสำคัญ", "Recommendations are based on accounting controls and system data. Authorized reviewers should verify material entries before posting or approval.")}</p></div>;
}

const CONNECTOR_TARGETS: Record<ConnectorItem["key"], string> = { cuto: "AR และ Cash", tory: "AP และ GL", eam: "GL และ Fixed Asset", hr: "GL, AP และ Tax" };
const PAGE_CONNECTOR: Record<string, ConnectorItem["key"] | undefined> = { cuto: "cuto", tory: "tory", eam: "eam", hr: "hr" };

function IntegrationView({ active, data, working, action, permissions, onNavigate }: { active: string; data: AppData; working: boolean; action: (payload: Record<string, unknown>, success: string) => Promise<Record<string, unknown> | null>; permissions: string[]; onNavigate: (id: string) => void }) {
  const { tr } = useLanguage();
  const selected = PAGE_CONNECTOR[active];
  const connectors = selected ? data.connectors.filter((item) => item.key === selected) : data.connectors;
  const events = data.integrationEvents.filter((event) => (!selected || event.sourceSystem === selected) && (active !== "errors" || event.status === "Failed"));
  const connectorNames = new Set(connectors.map((item) => item.name));
  const legacyErrors = data.records.filter((record) => record.module === "INTEGRATION" && ["Failed", "Queued"].includes(record.status) && (!selected || connectorNames.has(record.sourceSystem)));
  const processed = events.filter((event) => event.status === "Processed").length;
  const failed = events.filter((event) => event.status === "Failed").length + legacyErrors.length;
  const canManage = permissions.includes("manage_integrations");
  const canSync = permissions.includes("reconcile");
  return <div className="integration-workspace">
    <IntegrationTabs active={active} onNavigate={onNavigate} />
    <div className="summary-strip"><div><span>Connector</span><strong>{connectors.length}</strong></div><div><span>{tr("พร้อมใช้งาน", "Ready")}</span><strong>{connectors.filter((item) => ["Active", "Ready"].includes(item.status)).length}</strong></div><div><span>{tr("ประมวลผลแล้ว", "Processed")}</span><strong>{processed}</strong></div><div><span>Error Queue</span><strong>{failed}</strong></div></div>
    {active !== "errors" && <><section className="integration-banner"><div><p className="eyebrow">ACCOUNT 360 INTEGRATION API · V1</p><h2>{tr("เชื่อมข้อมูลบัญชีอย่างปลอดภัยและป้องกันรายการซ้ำ", "Connect accounting data securely and prevent duplicate entries")}</h2><p>{tr("รองรับ API Key, Idempotency-Key, Payload Validation, Mapping, Retry และ Audit Log สำหรับระบบ KC ทั้ง 4 ระบบ", "Supports API keys, idempotency keys, payload validation, mapping, retries, and audit logs across all four KC systems.")}</p></div><Button variant="outline" onClick={() => window.open("/api/integrations/openapi", "_blank")}><Download />OpenAPI Specification</Button></section><div className="connector-grid">{connectors.map((connector) => <ConnectorCard key={`${connector.key}-${connector.updatedAt}`} connector={connector} working={working} action={action} canManage={canManage} canSync={canSync} />)}</div></>}
    {legacyErrors.length > 0 && <section className="legacy-integration-note"><strong>{tr(`ข้อมูลตัวอย่างเดิม ${legacyErrors.length} รายการ`, `${legacyErrors.length} legacy sample entries`)}</strong><span>{legacyErrors.map((record) => record.documentNo).join(", ")} {tr("ไม่มี Source Payload จึงไม่สามารถ Retry ไปยังระบบต้นทางได้ ระบบจะแยกรายการเหล่านี้ออกจาก Event Queue ใหม่", "do not include source payloads and cannot be retried to the source system. They are kept separate from the new event queue.")}</span></section>}
    <section className="panel table-panel"><div className="panel-head"><div><p className="eyebrow">INTEGRATION EVENT LOG</p><h2>{active === "errors" ? tr("รายการเชื่อมต่อที่ต้องแก้ไข", "Integration issues to resolve") : tr("เหตุการณ์ล่าสุด", "Recent events")}</h2></div><Badge variant="outline">{events.length} Events</Badge></div><Table><TableHeader><TableRow><TableHead>{tr("ระบบต้นทาง", "Source system")}</TableHead><TableHead>Event ID</TableHead><TableHead>{tr("ประเภทข้อมูล", "Event type")}</TableHead><TableHead>{tr("เวลา", "Time")}</TableHead><TableHead>{tr("สถานะ", "Status")}</TableHead><TableHead>{tr("รายละเอียด", "Details")}</TableHead><TableHead className="action-cell">{tr("ดำเนินการ", "Actions")}</TableHead></TableRow></TableHeader><TableBody>{events.map((event) => <TableRow key={event.id}><TableCell><strong>{data.connectors.find((item) => item.key === event.sourceSystem)?.name || event.sourceSystem}</strong></TableCell><TableCell><strong className="cell-title">{event.externalEventId}</strong><small className="cell-sub">Retry {event.retryCount}</small></TableCell><TableCell>{event.eventType}</TableCell><TableCell>{dateText(event.receivedAt)}</TableCell><TableCell><StatusBadge status={event.status} /></TableCell><TableCell><span className="event-error">{event.error || (event.financialRecordId ? tr(`สร้างรายการ ${event.financialRecordId.slice(0, 8)}…`, `Created entry ${event.financialRecordId.slice(0, 8)}…`) : tr("รอประมวลผล", "Waiting to process"))}</span></TableCell><TableCell className="action-cell">{event.status === "Failed" && canSync && <Button size="sm" disabled={working} onClick={() => action({ action: "retry", eventId: event.id }, tr("Retry Integration สำเร็จ", "Integration retry succeeded"))}><RefreshCw />Retry</Button>}</TableCell></TableRow>)}{!events.length && <TableRow><TableCell colSpan={7}><div className="empty-row"><Check />{tr("ยังไม่มี Integration Event ในรายการนี้", "There are no integration events in this view.")}</div></TableCell></TableRow>}</TableBody></Table></section>
  </div>;
}

function ConnectorCard({ connector, working, action, canManage, canSync }: { connector: ConnectorItem; working: boolean; action: (payload: Record<string, unknown>, success: string) => Promise<Record<string, unknown> | null>; canManage: boolean; canSync: boolean }) {
  const { tr } = useLanguage();
  const [baseUrl, setBaseUrl] = useState(connector.baseUrl);
  const [editing, setEditing] = useState(false);
  const healthy = ["Active", "Ready"].includes(connector.status);
  async function saveConnector() {
    const result = await action({ action: "update_connector", system: connector.key, baseUrl, enabled: connector.status !== "Disabled" }, tr("บันทึกการตั้งค่า Connector แล้ว", "Connector settings saved"));
    if (result) setEditing(false);
  }
  function cancelEdit() { setBaseUrl(connector.baseUrl); setEditing(false); }
  return <article className={`connector-card ${connector.status === "Error" ? "has-error" : ""}`}>
    <div className="connector-title"><div className={`connector-icon ${healthy ? "ready" : ""}`}><Link2 /></div><div><h3>{connector.name}</h3><p>{CONNECTOR_TARGETS[connector.key]}</p></div><div className="connector-title-actions"><StatusBadge status={connector.status} />{canManage && <Button size="icon-sm" variant={editing ? "default" : "outline"} title={tr("แก้ไข Connector", "Edit connector")} aria-label={tr(`แก้ไข ${connector.name}`, `Edit ${connector.name}`)} disabled={working} onClick={() => setEditing(true)}><Pencil /></Button>}</div></div>
    <div className="connector-meta"><div><span>Inbound API</span><code>{connector.inboundEndpoint}</code></div><div><span>Inbound Key</span><b>{connector.inboundKeyConfigured ? tr("ตั้งค่าแล้ว", "Configured") : tr("ยังไม่ได้ตั้งค่า", "Not configured")}</b></div><div><span>Outbound Token</span><b>{connector.outboundTokenConfigured ? tr("ตั้งค่าแล้ว", "Configured") : tr("ยังไม่ได้ตั้งค่า", "Not configured")}</b></div><div><span>{tr("ซิงก์แล้ว", "Synced")}</span><b>{connector.recordsSynced} {tr("รายการ", "records")}</b></div></div>
    <div className={`connector-editor ${editing ? "editing" : ""}`}><div className="connector-edit-head"><div><strong>{tr("การตั้งค่าการเชื่อมต่อ", "Connection settings")}</strong><span>{editing ? tr("กรอก URL ของ API ต้นทางแล้วกดบันทึก", "Enter the source API URL and save") : tr("กดปุ่มดินสอเพื่อแก้ไข Endpoint", "Select the pencil button to edit the endpoint")}</span></div>{editing && <Badge variant="outline">{tr("กำลังแก้ไข", "Editing")}</Badge>}</div><label className="endpoint-field">Source API Endpoint<Input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://system.example.com" disabled={!editing || working} /></label>{editing && <div className="connector-edit-actions"><Button variant="outline" disabled={working} onClick={cancelEdit}>{tr("ยกเลิก", "Cancel")}</Button><Button disabled={working || baseUrl === connector.baseUrl} onClick={() => void saveConnector()}><Save />{tr("บันทึกการแก้ไข", "Save changes")}</Button></div>}</div>
    {!canManage && <p className="connector-readonly"><LockKeyhole />{tr("สิทธิ์อ่านอย่างเดียว — เฉพาะ Admin ที่แก้ไข Connector ได้", "Read-only access — only Admins can edit connectors")}</p>}
    {connector.lastError && <p className="connector-error">{connector.lastError}</p>}
    <div className="connector-time"><span>{tr("ซิงก์ล่าสุด", "Last sync")}: {dateText(connector.lastSyncAt)}</span><span>{tr("สำเร็จล่าสุด", "Last success")}: {dateText(connector.lastSuccessAt)}</span></div>
    <div className="connector-actions">{canManage && <Button variant="outline" disabled={working || editing} onClick={() => action({ action: "update_connector", system: connector.key, baseUrl: connector.baseUrl, enabled: connector.status === "Disabled" }, connector.status === "Disabled" ? tr("เปิดใช้งาน Connector แล้ว", "Connector enabled") : tr("ระงับ Connector แล้ว", "Connector disabled"))}>{connector.status === "Disabled" ? tr("เปิดใช้งาน", "Enable") : tr("ระงับ", "Disable")}</Button>}{canManage && <Button variant="outline" disabled={working || editing} onClick={() => action({ action: "rotate_key", system: connector.key }, tr("สร้าง Inbound API Key แล้ว", "Inbound API key created"))}><KeyRound />{tr("สร้าง API Key", "Create API key")}</Button>}{canSync && <Button variant="outline" disabled={working || editing || !connector.baseUrl} onClick={() => action({ action: "test", system: connector.key }, tr("ทดสอบ Connector สำเร็จ", "Connector test succeeded"))}>{tr("ทดสอบ", "Test")}</Button>}{canSync && <Button disabled={working || editing || !connector.baseUrl} onClick={() => action({ action: "sync", system: connector.key }, tr("Sync ข้อมูลสำเร็จ", "Data sync completed"))}><RefreshCw />Sync Now</Button>}</div>
  </article>;
}

function ApiKeyDialog({ value, onClose }: { value: { name: string; key: string } | null; onClose: () => void }) {
  const { tr } = useLanguage();
  async function copyKey() {
    if (!value) return;
    await navigator.clipboard.writeText(value.key);
    toast.success(tr("คัดลอก API Key แล้ว", "API key copied"));
  }
  return <Dialog open={!!value} onOpenChange={(open) => !open && onClose()}><DialogContent><DialogHeader><DialogTitle>Inbound API Key</DialogTitle><DialogDescription>{tr("ระบบจะแสดง Key นี้เพียงครั้งเดียว กรุณาคัดลอกไปตั้งค่าที่ระบบต้นทางทันที", "This key is shown only once. Copy it to the source system now.")}</DialogDescription></DialogHeader>{value && <div className="api-key-box"><span>{value.name.toUpperCase()}</span><code>{value.key}</code></div>}<DialogFooter><Button variant="outline" onClick={onClose}>{tr("ปิด", "Close")}</Button><Button onClick={() => void copyKey()}><Copy />{tr("คัดลอก API Key", "Copy API key")}</Button></DialogFooter></DialogContent></Dialog>;
}

function FinancialReportsView({ records, data, working, mutate, onDetail, onEdit, onUpload, permissions }: { records: RecordItem[]; data: AppData; working: boolean; mutate: (payload: Record<string, unknown>, success: string) => Promise<boolean>; onDetail: (r: RecordItem) => void; onEdit: (r: RecordItem) => void; onUpload: (r: RecordItem) => void; permissions: string[] }) {
  const { tr } = useLanguage();
  const reports = [
    { key: "GL", title: tr("ทะเบียนบัญชีแยกประเภท", "General ledger register"), note: tr("รายการ Journal และสถานะการลงบัญชี", "Journal entries and posting status") },
    { key: "AR", title: tr("รายงานอายุลูกหนี้", "Accounts receivable aging"), note: tr("ลูกหนี้คงค้างและวันครบกำหนด", "Outstanding receivables and due dates") },
    { key: "AP", title: tr("รายงานอายุเจ้าหนี้", "Accounts payable aging"), note: tr("เจ้าหนี้คงค้างและภาระชำระ", "Outstanding payables and payment obligations") },
    { key: "TAX", title: tr("ทะเบียน VAT / WHT", "VAT / WHT register"), note: tr("ฐานภาษี ยอดภาษี และสถานะการยื่น", "Tax base, tax amount, and filing status") },
  ].map((report) => ({ ...report, rows: data.records.filter((record) => record.module === report.key) }));
  return <div className="report-center"><section className="report-grid">{reports.map((report) => <article className="report-card" key={report.key}><div><span className="report-icon"><FileBarChart /></span><Badge variant="outline">{report.rows.length} {tr("รายการ", "entries")}</Badge></div><h2>{report.title}</h2><p>{report.note}</p><strong>{money(report.rows.reduce((sum, record) => sum + record.amount, 0))}</strong><Button variant="outline" disabled={!permissions.includes("export")} onClick={() => window.open(`/api/export?module=${report.key}`, "_blank")}><Download />{tr("ส่งออก CSV", "Export CSV")}</Button></article>)}</section><ModuleView active="reports" records={records} data={data} working={working} mutate={mutate} onDetail={onDetail} onEdit={onEdit} onUpload={onUpload} permissions={permissions} /></div>;
}

function ModuleView({ active, records, data, working, mutate, onDetail, onEdit, onUpload, permissions }: { active: string; records: RecordItem[]; data: AppData; working: boolean; mutate: (payload: Record<string, unknown>, success: string) => Promise<boolean>; onDetail: (r: RecordItem) => void; onEdit: (r: RecordItem) => void; onUpload: (r: RecordItem) => void; permissions: string[] }) {
  const { tr } = useLanguage();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [selectedViewId, setSelectedViewId] = useState("DEFAULT");
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [viewBusy, setViewBusy] = useState(false);
  useEffect(() => {
    let activeRequest = true;
    void fetch(`/api/saved-views?module=${encodeURIComponent(active)}`, { cache: "no-store" }).then((response) => readApiJson<{ views: SavedView[] }>(response)).then((body) => { if (activeRequest) setSavedViews(body.views); }).catch(() => { if (activeRequest) setSavedViews([]); });
    return () => { activeRequest = false; };
  }, [active]);
  function applySavedView(id: string) {
    setSelectedViewId(id);
    if (id === "DEFAULT") { setStatusFilter("ALL"); setTypeFilter("ALL"); setPage(1); return; }
    const view = savedViews.find((item) => item.id === id);
    if (!view) return;
    const configuration = typeof view.configuration === "string" ? safeMeta(view.configuration) : view.configuration;
    setStatusFilter(String(configuration.statusFilter || "ALL"));
    setTypeFilter(String(configuration.typeFilter || "ALL"));
    setPage(1);
  }
  async function saveCurrentView() {
    if (!viewName.trim()) return;
    setViewBusy(true);
    try {
      const response = await fetch("/api/saved-views", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "save", module: active, name: viewName.trim(), configuration: { statusFilter, typeFilter } }) });
      const body = await readApiJson<{ ok: boolean; views: SavedView[] }>(response);
      setSavedViews(body.views); setViewName(""); setSaveViewOpen(false); toast.success(tr("บันทึกมุมมองส่วนตัวแล้ว", "Personal view saved"));
    } catch (error) { toast.error(error instanceof Error ? error.message : tr("บันทึกมุมมองไม่สำเร็จ", "Could not save view")); }
    finally { setViewBusy(false); }
  }
  const pageSize = 10;
  const recordTypes = useMemo(() => [...new Set(records.map((record) => record.recordType))].sort(), [records]);
  const effectiveTypeFilter = recordTypes.includes(typeFilter) ? typeFilter : "ALL";
  const typedRecords = useMemo(() => !["ar", "ap"].includes(active) || effectiveTypeFilter === "ALL" ? records : records.filter((record) => record.recordType === effectiveTypeFilter), [active, effectiveTypeFilter, records]);
  const statuses = useMemo(() => [...new Set(typedRecords.map((record) => record.status))].sort(), [typedRecords]);
  const effectiveStatusFilter = statuses.includes(statusFilter) ? statusFilter : "ALL";
  const visibleRecords = useMemo(() => effectiveStatusFilter === "ALL" ? typedRecords : typedRecords.filter((record) => record.status === effectiveStatusFilter), [effectiveStatusFilter, typedRecords]);
  const pageCount = Math.max(1, Math.ceil(visibleRecords.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pagedRecords = visibleRecords.slice((safePage - 1) * pageSize, safePage * pageSize);
  const total = records.reduce((sum, r) => sum + r.amount, 0);
  const completed = records.filter((r) => ["Posted", "Issued", "Approved", "Received", "Reconciled", "Completed", "Synced", "Active", "Ready to File"].includes(r.status)).length;
  const isBudget = active === "budget";
  return <><div className="summary-strip"><div><span>{tr("จำนวนรายการ", "Entries")}</span><strong>{records.length}</strong></div><div><span>{tr("มูลค่ารวม", "Total value")}</span><strong>{money(total)}</strong></div><div><span>{tr("ดำเนินการแล้ว", "Completed")}</span><strong>{completed}/{records.length}</strong></div><div><span>{tr("ไฟล์แนบ", "Attachments")}</span><strong>{data.documents.filter((d) => records.some((r) => r.id === d.recordId)).length}</strong></div></div><section className="panel table-panel"><div className="panel-head"><div><p className="eyebrow">TRANSACTION REGISTER</p><h2>{active === "approval" ? tr("คิวรออนุมัติ", "Approval queue") : active === "reports" ? tr("ข้อมูลรายงานรวม", "Consolidated report data") : active === "ar" ? tr("ทะเบียนเอกสารขาย", "Sales document register") : active === "ap" ? tr("ทะเบียนเอกสารซื้อ", "Purchase document register") : tr("รายการทั้งหมด", "All entries")}</h2></div><div className="table-tools"><label>{tr("มุมมอง", "View")}<select value={selectedViewId} onChange={(event) => applySavedView(event.target.value)}><option value="DEFAULT">{tr("ค่าเริ่มต้น", "Default")}</option>{savedViews.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}</select></label>{["ar", "ap"].includes(active) && <label>{tr("ประเภทเอกสาร", "Document type")}<select value={effectiveTypeFilter} onChange={(event) => { setTypeFilter(event.target.value); setStatusFilter("ALL"); setSelectedViewId("DEFAULT"); setPage(1); }}><option value="ALL">{tr("ทั้งหมด", "All")}</option>{recordTypes.map((type) => <option key={type}>{type}</option>)}</select></label>}<label>{tr("สถานะ", "Status")}<select value={effectiveStatusFilter} onChange={(event) => { setStatusFilter(event.target.value); setSelectedViewId("DEFAULT"); setPage(1); }}><option value="ALL">{tr("ทั้งหมด", "All")}</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label><Button size="sm" variant="outline" onClick={() => setSaveViewOpen(true)}><Bookmark />{tr("บันทึกมุมมอง", "Save view")}</Button><span><SlidersHorizontal /> {visibleRecords.length} {tr("รายการ", "entries")}</span></div></div>{isBudget && <div className="budget-cards">{visibleRecords.map((r) => { const used = Number(safeMeta(r.metadata).used || 0); const percent = r.amount ? Math.round(used / r.amount * 100) : 0; return <article key={r.id}><div><strong>{r.counterparty}</strong><StatusBadge status={r.status} /></div><p>{r.description}</p><div className="progress"><span style={{ width: `${Math.min(percent, 100)}%` }} /></div><small>{tr("ใช้แล้ว", "Used")} {money(used)} {tr("จาก", "of")} {money(r.amount)} · {percent}%</small></article>; })}</div>}{!isBudget && <><div className="table-scroll"><Table><TableHeader><TableRow><TableHead>{tr("เลขที่เอกสาร", "Document no.")}</TableHead><TableHead>{tr("รายละเอียด", "Details")}</TableHead><TableHead>{tr("แหล่งข้อมูล", "Source")}</TableHead><TableHead>{tr("ครบกำหนด", "Due date")}</TableHead><TableHead className="amount-cell">{tr("จำนวนเงิน", "Amount")}</TableHead><TableHead>{tr("สถานะ", "Status")}</TableHead><TableHead className="action-cell">{tr("ดำเนินการ", "Actions")}</TableHead></TableRow></TableHeader><TableBody>{pagedRecords.map((r) => <TableRow key={r.id}><TableCell><button className="doc-link" onClick={() => onDetail(r)}>{r.documentNo}</button><small className="cell-sub">{r.recordType}</small></TableCell><TableCell><strong className="cell-title">{r.description}</strong><small className="cell-sub">{r.counterparty || "—"}</small></TableCell><TableCell>{r.sourceSystem}</TableCell><TableCell>{dateText(r.dueDate)}</TableCell><TableCell className="amount-cell"><strong>{money(r.amount)}</strong>{r.taxAmount > 0 && <small className="cell-sub">{tr("ภาษี", "Tax")} {money(r.taxAmount)}</small>}</TableCell><TableCell><StatusBadge status={r.status} /></TableCell><TableCell className="action-cell"><RowActions record={r} working={working} mutate={mutate} onEdit={onEdit} onUpload={onUpload} permissions={permissions} /></TableCell></TableRow>)}{!pagedRecords.length && <TableRow><TableCell colSpan={7}><div className="empty-row"><Search />{tr("ไม่พบรายการที่ตรงกับการค้นหา", "No entries match your search.")}</div></TableCell></TableRow>}</TableBody></Table></div>{visibleRecords.length > pageSize && <div className="table-pagination"><span>{tr(`หน้า ${safePage} จาก ${pageCount}`, `Page ${safePage} of ${pageCount}`)}</span><div><Button size="sm" variant="outline" disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>{tr("ก่อนหน้า", "Previous")}</Button><Button size="sm" variant="outline" disabled={safePage === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>{tr("ถัดไป", "Next")}</Button></div></div>}</>}</section><Dialog open={saveViewOpen} onOpenChange={setSaveViewOpen}><DialogContent className="save-view-dialog"><DialogHeader><DialogTitle><Bookmark />{tr("บันทึกมุมมองส่วนตัว", "Save personal view")}</DialogTitle><DialogDescription>{tr("บันทึกตัวกรองประเภทเอกสารและสถานะ เพื่อเปิดใช้ซ้ำได้ทุกอุปกรณ์", "Save document-type and status filters for reuse on every device.")}</DialogDescription></DialogHeader><label>{tr("ชื่อมุมมอง", "View name")}<Input value={viewName} onChange={(event) => setViewName(event.target.value)} maxLength={60} autoFocus placeholder={tr("เช่น เอกสารรออนุมัติ", "For example: Pending approvals")} /></label><DialogFooter><Button variant="outline" onClick={() => setSaveViewOpen(false)}>{tr("ยกเลิก", "Cancel")}</Button><Button disabled={viewBusy || !viewName.trim()} onClick={() => void saveCurrentView()}>{viewBusy ? <Loader2 className="spin" /> : <Save />}{tr("บันทึก", "Save")}</Button></DialogFooter></DialogContent></Dialog></>;
}

function RowActions({ record, working, mutate, onEdit, onUpload, permissions }: { record: RecordItem; working: boolean; mutate: (p: Record<string, unknown>, s: string) => Promise<boolean>; onEdit: (r: RecordItem) => void; onUpload: (r: RecordItem) => void; permissions: string[] }) {
  const { tr } = useLanguage();
  const action = record.status === "Pending Approval" ? { key: "approve", label: tr("อนุมัติ", "Approve"), status: undefined } : record.status === "Draft" && ["AR", "AP"].includes(record.module) ? { key: "issue", label: tr("ออกเอกสาร", "Issue"), status: undefined } : ["Draft", "Approved"].includes(record.status) ? { key: "post", label: tr("ลงบัญชี", "Post"), status: undefined } : record.status === "Unreconciled" ? { key: "reconcile", label: tr("กระทบยอด", "Reconcile"), status: undefined } : ["Failed", "Queued"].includes(record.status) ? { key: "retry", label: "Retry", status: undefined } : record.module === "CLOSING" && record.status !== "Completed" ? { key: "complete", label: tr("เสร็จสิ้น", "Complete"), status: undefined } : record.status === "Preparing" ? { key: "set_status", label: tr("พร้อมยื่น", "Ready to file"), status: "Ready to File" } : null;
  const allowed = action && (action.key === "approve" ? permissions.includes("approve") : ["retry", "reconcile"].includes(action.key) ? permissions.includes("reconcile") : permissions.includes("post"));
  const editable = permissions.includes("create") && ["Draft", "Pending Approval", "Rejected", "Preparing", "Unreconciled"].includes(record.status);
  return <div className="row-actions">{action && allowed && <Button size="sm" disabled={working} onClick={() => mutate({ action: action.key, id: record.id, status: action.status }, tr(`${action.label}สำเร็จ`, `${action.label} completed`))}>{action.key === "retry" ? <RefreshCw /> : <Check />}{action.label}</Button>}{editable && <Button size="icon-sm" variant="outline" title={tr("แก้ไข", "Edit")} onClick={() => onEdit(record)} disabled={working}><Pencil /></Button>}{permissions.includes("create") && <Button size="icon-sm" variant="outline" title={tr("แนบไฟล์", "Attach file")} onClick={() => onUpload(record)} disabled={working}><Paperclip /></Button>}{record.status === "Pending Approval" && permissions.includes("approve") && <Button size="icon-sm" variant="ghost" title={tr("ไม่อนุมัติ", "Reject")} onClick={() => mutate({ action: "reject", id: record.id }, tr("ปฏิเสธรายการแล้ว", "Entry rejected"))}><X /></Button>}</div>;
}

function MasterView({ active, data, working, mutate, canManage }: { active: string; data: AppData; working: boolean; mutate: (p: Record<string, unknown>, s: string) => Promise<boolean>; canManage: boolean }) {
  const { tr } = useLanguage();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MasterItem | null>(null);
  const categories = active === "company" ? ["COMPANY", "BRANCH"] : active === "coa" ? ["ACCOUNT"] : active === "customers" ? ["CUSTOMER"] : active === "users" ? ["USER"] : ["MAPPING"];
  const rows = data.masters.filter((item) => categories.includes(item.category));
  const labels: Record<string, string> = { company: tr("บริษัทและสาขา", "Company & Branches"), coa: tr("ผังบัญชี", "Chart of Accounts"), customers: tr("ทะเบียนลูกค้า", "Customer Master"), users: tr("ผู้ใช้และสิทธิ์", "Users & Permissions"), mapping: tr("ศูนย์ Mapping", "Mapping Center") };
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const role = form.get("role");
    const category = editing?.category || String(form.get("category") || "");
    const currentMetadata = editing ? safeMeta(editing.metadata) : {};
    const metadata = active === "customers" ? { taxId: form.get("taxId"), contactName: form.get("contactName"), email: form.get("email"), phone: form.get("phone"), paymentTerms: form.get("paymentTerms") } : role ? { ...currentMetadata, role, scope: currentMetadata.scope || "All branches" } : currentMetadata;
    const ok = await mutate({ action: editing ? "update_master" : "create_master", id: editing?.id, category, code: form.get("code"), name: form.get("name"), description: form.get("description"), metadata }, editing ? tr("แก้ไข Master Data แล้ว", "Master data updated") : tr("เพิ่ม Master Data แล้ว", "Master data added"));
    if (ok) { setOpen(false); setEditing(null); }
  }
  const openCreate = () => { setEditing(null); setOpen(true); };
  const openEdit = (item: MasterItem) => { setEditing(item); setOpen(true); };
  return <>
    <div className="summary-strip"><div><span>{tr("Master ทั้งหมด", "All master records")}</span><strong>{rows.length}</strong></div><div><span>{tr("ใช้งานอยู่", "Active")}</span><strong>{rows.filter((r) => r.status === "Active").length}</strong></div><div><span>{tr("ต้องตรวจสอบ", "Needs review")}</span><strong>{rows.filter((r) => r.status === "Needs Review").length}</strong></div><div><span>{tr("แก้ไขล่าสุด", "Last updated")}</span><strong>{rows[0] ? dateText(rows[0].updatedAt) : "—"}</strong></div></div>
    <section className="panel table-panel">
      <div className="panel-head"><div><p className="eyebrow">MASTER DATA</p><h2>{labels[active]}</h2></div>{canManage && <Button onClick={openCreate}><Plus />{active === "customers" ? tr("เพิ่มลูกค้า", "Add customer") : tr("เพิ่มข้อมูล", "Add record")}</Button>}</div>
      <Table><TableHeader><TableRow><TableHead>{tr("ประเภท", "Type")}</TableHead><TableHead>{tr("รหัส", "Code")}</TableHead><TableHead>{tr("ชื่อ", "Name")}</TableHead><TableHead>{active === "customers" ? tr("เลขผู้เสียภาษี / ผู้ติดต่อ", "Tax ID / Contact") : tr("รายละเอียด / สิทธิ์ / Mapping", "Details / Permissions / Mapping")}</TableHead><TableHead>{tr("สถานะ", "Status")}</TableHead><TableHead className="action-cell">{tr("ดำเนินการ", "Actions")}</TableHead></TableRow></TableHeader><TableBody>{rows.map((item) => { const meta = safeMeta(item.metadata); return <TableRow key={item.id}><TableCell>{item.category}</TableCell><TableCell><strong>{item.code}</strong></TableCell><TableCell><strong className="cell-title">{item.name}</strong><small className="cell-sub">{item.description || "—"}</small></TableCell><TableCell>{active === "customers" ? <><strong className="cell-title">{String(meta.taxId || "—")}</strong><small className="cell-sub">{String(meta.contactName || meta.email || meta.phone || "—")}</small></> : item.description || String(meta.role || "—")}</TableCell><TableCell><StatusBadge status={item.status} /></TableCell><TableCell className="action-cell">{canManage && <div className="row-actions"><Button size="icon-sm" variant="outline" disabled={working} title={tr("แก้ไข", "Edit")} onClick={() => openEdit(item)}><Pencil /></Button><Button size="sm" variant="outline" disabled={working} onClick={() => mutate({ action: "toggle_master", id: item.id }, tr("อัปเดตสถานะแล้ว", "Status updated"))}>{item.status === "Active" ? tr("ระงับ", "Disable") : tr("เปิดใช้", "Enable")}</Button></div>}</TableCell></TableRow>; })}</TableBody></Table>
    </section>
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setEditing(null); }}><DialogContent key={editing?.id || "new-master"} className="create-dialog"><form onSubmit={submit}><DialogHeader><DialogTitle>{editing ? tr("แก้ไข", "Edit") : tr("เพิ่ม", "Add")} {labels[active]}</DialogTitle><DialogDescription>{tr("ระบบจะบันทึกผู้ดำเนินการและเวลาใน Audit Log", "The acting user and timestamp will be recorded in the audit log.")}</DialogDescription></DialogHeader><div className="form-grid master-form"><label>{tr("ประเภท", "Type")}<select name="category" defaultValue={editing?.category || categories[0]} disabled={!!editing}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label>{tr("รหัส", "Code")}<Input name="code" required defaultValue={editing?.code || ""} placeholder={tr("ระบุรหัสที่ไม่ซ้ำ", "Enter a unique code")} /></label><label className="wide">{active === "customers" ? tr("ชื่อลูกค้า / บริษัท", "Customer / company name") : tr("ชื่อ / อีเมลผู้ใช้", "Name / User email")}<Input name="name" required defaultValue={editing?.name || ""} placeholder={tr("ชื่อรายการหรืออีเมล", "Record name or email")} /></label>{active === "users" && <label>Role<select name="role" defaultValue={String(safeMeta(editing?.metadata || "{}").role || "Viewer")}><option>Admin</option><option>Accountant</option><option>Approver</option><option>Viewer</option></select></label>}{active === "customers" && <><label>{tr("เลขประจำตัวผู้เสียภาษี", "Tax ID")}<Input name="taxId" defaultValue={String(safeMeta(editing?.metadata || "{}").taxId || "")} maxLength={13} /></label><label>{tr("ชื่อผู้ติดต่อ", "Contact name")}<Input name="contactName" defaultValue={String(safeMeta(editing?.metadata || "{}").contactName || "")} /></label><label>{tr("อีเมล", "Email")}<Input name="email" type="email" defaultValue={String(safeMeta(editing?.metadata || "{}").email || "")} /></label><label>{tr("โทรศัพท์", "Phone")}<Input name="phone" defaultValue={String(safeMeta(editing?.metadata || "{}").phone || "")} /></label><label>{tr("เครดิต (วัน)", "Payment terms (days)")}<Input name="paymentTerms" type="number" min="0" max="365" defaultValue={String(safeMeta(editing?.metadata || "{}").paymentTerms || "30")} /></label></>}<label className="wide">{active === "customers" ? tr("ที่อยู่สำหรับออกเอกสาร", "Billing address") : tr("รายละเอียด / ขอบเขตสิทธิ์ / กฎ Mapping", "Details / Permission scope / Mapping rule")}<Input name="description" defaultValue={editing?.description || ""} placeholder={tr("รายละเอียดเพิ่มเติม", "Additional details")} /></label></div><DialogFooter><Button type="button" variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>{tr("ยกเลิก", "Cancel")}</Button><Button type="submit" disabled={working}>{tr("บันทึก", "Save")}</Button></DialogFooter></form></DialogContent></Dialog>
  </>;
}

function AuditPage({ logs }: { logs: AuditItem[] }) {
  const { tr } = useLanguage();
  return <section className="panel table-panel"><div className="panel-head"><div><p className="eyebrow">CONTROL & COMPLIANCE</p><h2>Audit Log</h2></div><Badge variant="outline">{tr(`ล่าสุด ${logs.length} รายการ`, `${logs.length} recent entries`)}</Badge></div><Table><TableHeader><TableRow><TableHead>{tr("เวลา", "Time")}</TableHead><TableHead>{tr("การดำเนินการ", "Action")}</TableHead><TableHead>{tr("รายละเอียด", "Details")}</TableHead><TableHead>{tr("ผู้ดำเนินการ", "Actor")}</TableHead><TableHead>Record ID</TableHead></TableRow></TableHeader><TableBody>{logs.map((log) => <TableRow key={log.id}><TableCell>{dateText(log.createdAt)}</TableCell><TableCell><strong>{log.action.replaceAll("_", " ")}</strong></TableCell><TableCell>{log.details}</TableCell><TableCell>{log.actorEmail}</TableCell><TableCell><small>{log.recordId || "SYSTEM"}</small></TableCell></TableRow>)}</TableBody></Table></section>;
}

function SettingsView({ data, working, mutate, canManage, preferences, savePreferences }: { data: AppData; working: boolean; mutate: (p: Record<string, unknown>, s: string) => Promise<boolean>; canManage: boolean; preferences: UserPreferences; savePreferences: (updates: Partial<UserPreferences>) => Promise<UserPreferences> }) {
  const { tr } = useLanguage();
  const defaultPrimary = "#0AADA9"; const defaultControl = "#172033";
  const [workspaceName, setWorkspaceName] = useState(data.settings.company_name || "KC Account 360");
  const [website, setWebsite] = useState(data.settings.company_website || "");
  const [taxId, setTaxId] = useState(data.settings.tax_id || "");
  const [approvalLimit, setApprovalLimit] = useState(data.settings.approval_limit || "500000");
  const [primaryColor, setPrimaryColor] = useState(normalizeHex(data.settings.brand_primary) || defaultPrimary);
  const [controlColor, setControlColor] = useState(normalizeHex(data.settings.brand_control) || defaultControl);
  const [syncControl, setSyncControl] = useState(data.settings.brand_sync_control === "true");
  const [theme, setTheme] = useState<UserPreferences["theme"]>(preferences.theme);
  const [tableDensity, setTableDensity] = useState<UserPreferences["tableDensity"]>(preferences.tableDensity);
  const [pageWidth, setPageWidth] = useState<UserPreferences["pageWidth"]>(preferences.pageWidth);
  const [dateFormat, setDateFormat] = useState<UserPreferences["dateFormat"]>(preferences.dateFormat);
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const [logoSrc, setLogoSrc] = useState(data.settings.brand_logo_key && !data.settings.brand_logo_key.includes("-365_") ? `/api/branding/logo?v=${encodeURIComponent(data.settings.brand_logo_key)}` : "/account360-logo.png");
  const [logoBusy, setLogoBusy] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const closing = data.records.filter((r) => r.module === "CLOSING"); const complete = closing.filter((r) => r.status === "Completed").length;
  const primary = normalizeHex(primaryColor) || defaultPrimary; const control = syncControl ? primary : normalizeHex(controlColor) || defaultControl;
  const primaryContrast = contrastRatio(primary, defaultControl); const controlContrast = contrastRatio(control, "#FFFFFF");

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutate({ action: "update_settings", settings: { company_name: workspaceName, company_website: website, tax_id: taxId, approval_limit: approvalLimit, brand_primary: primary, brand_control: normalizeHex(controlColor) || defaultControl, brand_sync_control: String(syncControl) } }, tr("บันทึกและใช้งานการตั้งค่าแล้ว", "Settings saved and applied"));
  }

  async function uploadLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type) || file.size > 1024 * 1024) { toast.error(tr("รองรับ PNG หรือ JPG ขนาดไม่เกิน 1 MB", "Use a PNG or JPG file up to 1 MB")); return; }
    setLogoBusy(true);
    try {
      const form = new FormData(); form.set("file", file);
      const response = await fetch("/api/branding/logo", { method: "POST", body: form });
      const body = await readApiJson<{ ok: boolean; key: string }>(response);
      setLogoSrc(`/api/branding/logo?v=${encodeURIComponent(body.key)}`); toast.success(tr("อัปโหลด Brand Logo แล้ว", "Brand logo uploaded"));
    } catch (error) { toast.error(error instanceof Error ? error.message : tr("อัปโหลด Logo ไม่สำเร็จ", "Logo upload failed")); }
    finally { setLogoBusy(false); }
  }

  async function resetLogo() {
    setLogoBusy(true);
    try { const response = await fetch("/api/branding/logo", { method: "DELETE" }); await readApiJson<{ ok: boolean }>(response); setLogoSrc("/account360-logo.png"); toast.success(tr("กลับไปใช้ Logo มาตรฐานแล้ว", "Default logo restored")); }
    catch (error) { toast.error(error instanceof Error ? error.message : tr("คืนค่า Logo ไม่สำเร็จ", "Could not restore the logo")); }
    finally { setLogoBusy(false); }
  }

  function restoreDefaults() { setPrimaryColor(defaultPrimary); setControlColor(defaultControl); setSyncControl(false); }

  async function savePersonalPreferences() {
    setPreferenceBusy(true);
    try { await savePreferences({ theme, tableDensity, pageWidth, dateFormat }); toast.success(tr("บันทึกประสบการณ์ส่วนตัวแล้ว", "Personal experience saved")); }
    catch (error) { toast.error(error instanceof Error ? error.message : tr("บันทึก Preference ไม่สำเร็จ", "Could not save preferences")); }
    finally { setPreferenceBusy(false); }
  }

  return <div className="system-settings">
    <form onSubmit={save}>
      <div className="system-settings-heading"><div><p className="settings-breadcrumb">System Control / {tr("การตั้งค่าระบบ", "System Settings")}</p><h1><Palette />{tr("การตั้งค่าระบบ", "System Settings")}</h1><p>{tr("กำหนดข้อมูล Workspace และ Corporate Identity ของ KC Account 360 โดยไม่กระทบ Workflow, Permission หรือโครงสร้างข้อมูลเดิม", "Configure the KC Account 360 workspace and corporate identity without changing workflows, permissions, or the existing data structure.")}</p></div><div className="settings-actions"><Button type="button" variant="outline" onClick={restoreDefaults} disabled={!canManage || working}><RotateCcw />{tr("คืนค่าเริ่มต้น", "Restore defaults")}</Button><Button type="submit" disabled={!canManage || working || logoBusy}><Save />{tr("บันทึกและใช้งาน", "Save and apply")}</Button></div></div>
      <div className="settings-layout">
        <div className="settings-main-column">
          <section className="settings-surface"><div className="settings-section-head"><span className="settings-section-icon"><Building2 /></span><div><h2>{tr("ตั้งค่า Workspace", "Workspace Settings")}</h2><p>{tr("ข้อมูลนี้จะแสดงใน Company selector และส่วนระบุตัวตนของระบบ", "This information appears in the company selector and system identity areas.")}</p></div></div><div className="workspace-fields"><label>{tr("ชื่อ Workspace", "Workspace name")}<Input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} disabled={!canManage} /><small>{tr("รองรับชื่อบริษัท หน่วยงาน หรือ Tenant", "Use a company, business unit, or tenant name.")}</small></label><label>{tr("เว็บไซต์หลัก", "Primary website")}<span className="input-with-icon"><Globe2 /><Input type="url" value={website} onChange={(event) => setWebsite(event.target.value)} disabled={!canManage} /></span><small>{tr("ใช้ใน Help, About และเอกสารที่ส่งออก", "Used in Help, About, and exported documents.")}</small></label><label>{tr("เลขประจำตัวผู้เสียภาษี", "Tax identification number")}<Input value={taxId} onChange={(event) => setTaxId(event.target.value)} disabled={!canManage} /><small>{tr("ใช้กับเอกสารภาษีและข้อมูลบริษัท", "Used for tax documents and company information.")}</small></label><label>{tr("วงเงินที่ต้องอนุมัติ (บาท)", "Approval threshold (THB)")}<Input type="number" min="0" value={approvalLimit} onChange={(event) => setApprovalLimit(event.target.value)} disabled={!canManage} /><small>{tr("กำหนดระดับควบคุมรายการทางการเงิน", "Sets the control threshold for financial transactions.")}</small></label></div></section>
          <section className="settings-surface"><div className="settings-section-head"><span className="settings-section-icon"><FileImage /></span><div><h2>Brand Logo</h2><p>{tr("ใช้ Logo เดียวกันในหน้าเข้าสู่ระบบ, Live Preview และเอกสารของระบบ", "Use one logo across sign-in, live preview, and system documents.")}</p></div></div><div className="brand-logo-editor"><div className="brand-logo-preview"><Image src={logoSrc} width={2172} height={724} alt="Account 360 Brand Logo" unoptimized /></div><div><strong>{tr("อัปโหลด Logo ขององค์กร", "Upload organization logo")}</strong><p>{tr("แนะนำ PNG พื้นหลังโปร่งใส อัตราส่วนแนวนอน · สูงสุด 1 MB", "Recommended: transparent PNG, landscape ratio · maximum 1 MB")}</p><input ref={logoInputRef} className="visually-hidden" type="file" accept="image/png,image/jpeg" onChange={uploadLogo} disabled={!canManage || logoBusy} /><div className="brand-logo-actions"><Button type="button" size="sm" variant="outline" onClick={() => logoInputRef.current?.click()} disabled={!canManage || logoBusy}>{logoBusy ? <Loader2 className="spin" /> : <Upload />}{tr("เลือกไฟล์", "Choose file")}</Button><Button type="button" size="sm" variant="outline" onClick={resetLogo} disabled={!canManage || logoBusy}>{tr("ใช้ Logo มาตรฐาน", "Use default logo")}</Button></div></div></div></section>
          <section className="settings-surface"><div className="settings-section-head"><span className="settings-section-icon"><Palette /></span><div><h2>{tr("สี Corporate Identity", "Corporate Identity Colors")}</h2><p>{tr("สีหลักจะใช้กับ Primary action, สถานะทำงาน และ Focus ring", "The primary color is used for primary actions, active states, and focus rings.")}</p></div></div><div className="identity-fields"><label>{tr("สี CI หลัก", "Primary CI color")}<span className="color-field"><input type="color" value={primary} onChange={(event) => setPrimaryColor(event.target.value)} disabled={!canManage} aria-label={tr("เลือกสี CI หลัก", "Choose primary CI color")} /><Input value={primaryColor} onChange={(event) => setPrimaryColor(event.target.value)} disabled={!canManage} /></span></label><label>{tr("สีเมนูและพื้นที่ควบคุม", "Navigation and control color")}<span className="color-field"><input type="color" value={normalizeHex(controlColor) || defaultControl} onChange={(event) => setControlColor(event.target.value)} disabled={!canManage || syncControl} aria-label={tr("เลือกสีเมนูและพื้นที่ควบคุม", "Choose navigation and control color")} /><Input value={controlColor} onChange={(event) => setControlColor(event.target.value)} disabled={!canManage || syncControl} /></span></label></div><div className="sync-color-row"><div><strong>{tr("ใช้สี CI หลักกับพื้นที่ควบคุม", "Use the primary CI color for controls")}</strong><span>{tr("เมื่อเปิด ระบบจะ Sync สีเมนูและพื้นที่ควบคุมกับสีหลักอัตโนมัติ", "When enabled, navigation and controls automatically match the primary color.")}</span></div><Switch checked={syncControl} onCheckedChange={setSyncControl} disabled={!canManage} aria-label={tr("ใช้สี CI หลักกับพื้นที่ควบคุม", "Use the primary CI color for controls")} /></div></section>
          <section className="settings-surface"><div className="settings-section-head"><span className="settings-section-icon"><SlidersHorizontal /></span><div><h2>{tr("ประสบการณ์ส่วนตัว", "Personal Experience")}</h2><p>{tr("บันทึกลงฐานข้อมูลและติดตามผู้ใช้ทุกอุปกรณ์", "Saved to the database and follows your account across devices.")}</p></div></div><div className="preference-fields"><label>{tr("ธีม", "Theme")}<select value={theme} onChange={(event) => setTheme(event.target.value as UserPreferences["theme"])}><option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option></select></label><label>{tr("ความหนาแน่นตาราง", "Table density")}<select value={tableDensity} onChange={(event) => setTableDensity(event.target.value as UserPreferences["tableDensity"])}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label><label>{tr("ความกว้างหน้า", "Page width")}<select value={pageWidth} onChange={(event) => setPageWidth(event.target.value as UserPreferences["pageWidth"])}><option value="full">Full</option><option value="contained">Contained</option></select></label><label>{tr("รูปแบบวันที่", "Date format")}<select value={dateFormat} onChange={(event) => setDateFormat(event.target.value as UserPreferences["dateFormat"])}><option>DD/MM/YYYY</option><option>MM/DD/YYYY</option><option>YYYY-MM-DD</option></select></label></div><div className="preference-actions"><Button type="button" variant="outline" onClick={() => { setTheme(preferences.theme); setTableDensity(preferences.tableDensity); setPageWidth(preferences.pageWidth); setDateFormat(preferences.dateFormat); }} disabled={preferenceBusy}>{tr("ยกเลิก", "Cancel")}</Button><Button type="button" onClick={savePersonalPreferences} disabled={preferenceBusy}>{preferenceBusy ? <Loader2 className="spin" /> : <Save />}{tr("บันทึก Preference", "Save preferences")}</Button></div></section>
        </div>
        <div className="settings-side-column">
          <section className="settings-surface live-preview-card"><div className="settings-preview-head"><div><h2>Live Preview</h2><p>{tr("ดูผลลัพธ์ก่อนบันทึก", "Preview changes before saving")}</p></div><Badge variant="outline" className="preview-live"><CircleCheck />Live</Badge></div><div className="brand-preview-canvas"><div className="brand-preview-rail" style={{ background: control }}><div className="preview-logo"><Image src={logoSrc} width={2172} height={724} alt={tr("ตัวอย่าง Account 360 Logo", "Account 360 logo preview")} unoptimized /></div><small>WORKSPACE</small><strong>{workspaceName || "KC Account 360"}</strong><span>{tr("ภาพรวม", "Overview")}</span><span>{tr("รายการบัญชี", "Transactions")}</span><span>{tr("รายงานการเงิน", "Financial Reports")}</span><span className="selected" style={{ background: primary }}>System Control</span></div><div className="brand-preview-page"><div className="preview-search" /><small>System Control</small><strong>{tr("การตั้งค่าระบบ", "System Settings")}</strong><div className="preview-content-card"><i /><i /><button type="button" style={{ background: primary }}>{tr("ปุ่ม CI", "CI button")}</button></div><div className="preview-swatch"><span>Selected color</span><b style={{ background: primary }} /><code>{primary}</code></div></div></div></section>
          <section className="settings-surface contrast-card"><h2>{tr("การตรวจสอบการเข้าถึง", "Accessibility Check")}</h2><div><span>{tr("ตัวอักษรเข้มบนสี CI หลัก", "Dark text on primary CI color")}</span><strong>{primaryContrast.toFixed(1)}:1</strong></div><div><span>{tr("ตัวอักษรสีขาวบนพื้นที่ควบคุม", "White text on control areas")}</span><strong>{controlContrast.toFixed(1)}:1</strong></div><p className={primaryContrast >= 4.5 && controlContrast >= 4.5 ? "pass" : "warning"}><ShieldCheck />{primaryContrast >= 4.5 && controlContrast >= 4.5 ? tr("สีที่เลือกผ่านเกณฑ์ความคมชัดสำหรับข้อความปกติ", "Selected colors meet normal-text contrast guidance.") : tr("ควรเพิ่มความต่างของสีเพื่อให้ข้อความอ่านง่ายขึ้น", "Increase color contrast to improve readability.")}</p></section>
          <p className="settings-note"><strong>{tr("ขอบเขตการตั้งค่า:", "Settings scope:")}</strong> {tr("ค่านี้ใช้กับ CI ของ KC Account 360 และไม่เปลี่ยนสิทธิ์ผู้ใช้หรือสถานะทางบัญชี", "These settings affect the KC Account 360 identity only and do not change user permissions or accounting status.")}</p>
        </div>
      </div>
    </form>
    <div className="control-grid"><section className="panel settings-card"><div className="panel-head"><div><p className="eyebrow">PERIOD CONTROL</p><h2>{tr("ควบคุมงวดบัญชี", "Accounting Period Control")}</h2></div><LockKeyhole /></div><div className="period-status"><span>{tr("งวดปัจจุบัน", "Current period")}</span><strong>{data.settings.current_period}</strong></div><div className="closing-progress"><div><span>Closing checklist</span><b>{complete}/{closing.length}</b></div><div className="progress"><span style={{ width: `${closing.length ? complete / closing.length * 100 : 0}%` }} /></div></div>{data.settings.locked_period ? <div className="locked-box"><LockKeyhole />{tr(`งวด ${data.settings.locked_period} ถูกล็อกแล้ว`, `Period ${data.settings.locked_period} is locked`)}</div> : canManage && <Button disabled={working || complete !== closing.length} onClick={() => mutate({ action: "lock_period", period: data.settings.current_period }, tr("ล็อกงวดบัญชีแล้ว", "Accounting period locked"))}><LockKeyhole />{tr("ล็อกงวดบัญชี", "Lock accounting period")}</Button>}<small>{tr("ระบบจะอนุญาตให้ล็อกเมื่อ Closing Checklist เสร็จครบทุกข้อ", "The period can be locked after every closing checklist item is complete.")}</small></section><section className="panel settings-card"><div className="panel-head"><div><p className="eyebrow">ACCESS & SECURITY</p><h2>{tr("ความปลอดภัย", "Security")}</h2></div><ShieldCheck /></div><div className="security-list"><div><Users /><span><strong>Workspace authentication</strong><small>{tr("ยืนยันตัวตนผ่าน ChatGPT Workspace", "Authentication through ChatGPT Workspace")}</small></span><Badge variant="outline" className="status-badge success">Active</Badge></div><div><History /><span><strong>Immutable audit trail</strong><small>{tr("บันทึกทุกการเปลี่ยนแปลงพร้อมผู้ดำเนินการ", "Records every change with the acting user")}</small></span><Badge variant="outline" className="status-badge success">Active</Badge></div><div><Upload /><span><strong>Secure document storage</strong><small>{tr("จัดเก็บไฟล์แนบแบบ private object storage", "Stores attachments in private object storage")}</small></span><Badge variant="outline" className="status-badge success">Active</Badge></div></div></section></div>
  </div>;
}

function DocumentWorkflowPanel({ module, records, canCreate, onCreate }: { module: string; records: RecordItem[]; canCreate: boolean; onCreate: (type: string) => void }) {
  const { tr } = useLanguage();
  const documents = documentsForModule(module);
  const groups = module === "AP" ? [
    { id: "procurement", th: "ขอซื้อและสั่งซื้อ", en: "Procurement" },
    { id: "receiving", th: "รับของและตั้งหนี้", en: "Receiving & payables" },
    { id: "payment", th: "มัดจำและจ่ายชำระ", en: "Deposits & payments" },
    { id: "adjustment", th: "ปรับปรุงหนี้", en: "Adjustments" },
  ] : [
    { id: "sales", th: "เสนอราคาและสั่งขาย", en: "Sales" },
    { id: "billing", th: "ส่งมอบและตั้งหนี้", en: "Delivery & billing" },
    { id: "collection", th: "มัดจำและรับชำระ", en: "Deposits & collections" },
    { id: "adjustment", th: "ปรับปรุงหนี้", en: "Adjustments" },
  ];
  return <section className="document-workflow"><div className="document-workflow-head"><div><p className="eyebrow">DOCUMENT WORKFLOW</p><h2>{tr(module === "AP" ? "งานด้านซื้อ" : "งานด้านขาย", module === "AP" ? "Purchase documents" : "Sales documents")}</h2></div><span>{tr("เลือกประเภทเอกสารตามลำดับงานเพื่อสร้างรายการใหม่", "Choose a document by workflow stage")}</span></div><div className="document-stage-list">{groups.map((group) => { const groupDocuments = documents.filter((document) => document.group === group.id); return <section className="document-stage" key={group.id}><div className="document-stage-title"><strong>{tr(group.th, group.en)}</strong><span>{groupDocuments.length} {tr("ประเภท", "types")}</span></div><div className="document-type-grid">{groupDocuments.map((document) => <button type="button" key={document.code} onClick={() => onCreate(document.type)} disabled={!canCreate}><span className="document-code">{document.code}</span><span><strong>{tr(document.th, document.en)}</strong><small>{records.filter((record) => record.recordType === document.type).length} {tr("รายการ", "documents")}</small></span><Plus /></button>)}</div></section>; })}</div></section>;
}

const blankLine = (first = false): AccountingLineItem => ({ code: "", description: "", unit: "รายการ", quantity: first ? 1 : 0, unitPrice: 0, discount: 0 });

function AccountingDocumentDialog({ open, onOpenChange, moduleKey, initialType, working, mutate, counterparties, existingVendors, settings, record }: {
  open: boolean; onOpenChange: (value: boolean) => void; moduleKey: "AR" | "AP"; initialType: string | null;
  working: boolean; mutate: (payload: Record<string, unknown>, success: string) => Promise<boolean>;
  counterparties: MasterItem[]; existingVendors: string[]; settings: Record<string, string>; record?: RecordItem;
}) {
  const { tr } = useLanguage();
  const definitions = documentsForModule(moduleKey);
  const existingMeta = documentMeta(record?.metadata);
  const [documentType, setDocumentType] = useState(record?.recordType || initialType || definitions[0].type);
  const definition = findAccountingDocument(moduleKey, documentType) || definitions[0];
  const generatedId = useId().replaceAll(":", "").toUpperCase();
  const [counterparty, setCounterparty] = useState(record?.counterparty || "");
  const initialCustomer = counterparties.find((item) => item.name === record?.counterparty);
  const initialCustomerMeta = documentMeta(initialCustomer?.metadata);
  const [counterpartyAddress, setCounterpartyAddress] = useState(existingMeta.counterpartyAddress || initialCustomer?.description || "");
  const [counterpartyTaxId, setCounterpartyTaxId] = useState(existingMeta.counterpartyTaxId || initialCustomerMeta.counterpartyTaxId || String(safeMeta(initialCustomer?.metadata || "{}").taxId || ""));
  const [contactName, setContactName] = useState(existingMeta.contactName || String(safeMeta(initialCustomer?.metadata || "{}").contactName || ""));
  const [taxRate, setTaxRate] = useState(Number(existingMeta.taxRate ?? 7));
  const [whtRate, setWhtRate] = useState(Number(existingMeta.whtRate ?? 0));
  const [items, setItems] = useState<AccountingLineItem[]>(() => {
    const current = (existingMeta.lineItems || []).map((item) => ({ code: item.code || "", description: item.description || "", unit: item.unit || "รายการ", quantity: Number(item.quantity || 0), unitPrice: Number(item.unitPrice || 0), discount: Number(item.discount || 0) }));
    const result = current.length ? current : [blankLine(true)];
    while (result.length < 5) result.push(blankLine());
    return result;
  });
  const issueDate = existingMeta.issueDate || new Date().toISOString().slice(0, 10);
  const documentNo = record?.documentNo || `${definition.prefix}-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-${generatedId.slice(-4) || "NEW"}`;
  const subtotal = items.reduce((sum, item) => sum + Math.max(0, Number(item.quantity) * Number(item.unitPrice) - Number(item.discount)), 0);
  const vat = subtotal * taxRate / 100;
  const withholdingTax = subtotal * whtRate / 100;
  const netTotal = subtotal + vat - withholdingTax;
  const vendorOptions = [...new Set(existingVendors)].sort();
  const brandLogo = settings.brand_logo_key && !settings.brand_logo_key.includes("-365_") ? `/api/branding/logo?v=${encodeURIComponent(settings.brand_logo_key)}` : "/account360-logo.png";
  const referenceGuide: Record<string, [string, string]> = {
    "Purchase Order": ["เลขที่ PR", "PR number"], "Purchase Deposit": ["เลขที่ PO", "PO number"], "Goods Receipt": ["เลขที่ PO", "PO number"],
    "Purchase Invoice": ["เลขที่ PO หรือใบรับของ", "PO or goods receipt number"], "Purchase Billing Receipt": ["เลขที่ใบแจ้งหนี้ซื้อ", "Purchase invoice number"],
    "Purchase Payment": ["เลขที่ใบรับวางบิลหรือใบแจ้งหนี้ซื้อ", "Billing receipt or purchase invoice number"], "Purchase Credit Note": ["เลขที่ใบแจ้งหนี้ซื้อ", "Purchase invoice number"],
    "Purchase Debit Note": ["เลขที่ใบแจ้งหนี้ซื้อ", "Purchase invoice number"], "Sales Order": ["เลขที่ SQ", "SQ number"], "Deposit Receipt": ["เลขที่ SQ หรือ SO", "SQ or SO number"],
    "Delivery Note": ["เลขที่ SO หรือใบแจ้งหนี้ขาย", "SO or sales invoice number"], "Billing Note": ["เลขที่ใบแจ้งหนี้ขาย", "Sales invoice number"],
    Receipt: ["เลขที่ใบแจ้งหนี้ขายหรือใบวางบิล", "Sales invoice or billing note number"], "Credit Note": ["เลขที่ใบแจ้งหนี้ขาย", "Sales invoice number"], "Debit Note": ["เลขที่ใบแจ้งหนี้ขาย", "Sales invoice number"],
  };
  const referencePlaceholder = referenceGuide[definition.type] || ["เลขที่เอกสารต้นทาง", "Source document number"];

  function changeCustomer(name: string) {
    setCounterparty(name);
    const customer = counterparties.find((item) => item.name === name);
    if (!customer) return;
    const meta = safeMeta(customer.metadata);
    setCounterpartyAddress(customer.description || "");
    setCounterpartyTaxId(String(meta.taxId || ""));
    setContactName(String(meta.contactName || ""));
  }

  function updateLine(index: number, field: keyof AccountingLineItem, value: string) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: ["quantity", "unitPrice", "discount"].includes(field) ? Number(value) : value } : item));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const lineItems = items.filter((item) => item.description.trim() && item.quantity > 0).map((item) => ({ ...item, code: item.code.trim().slice(0, 80), description: item.description.trim().slice(0, 200), unit: item.unit.trim().slice(0, 40) || "รายการ" }));
    if (!lineItems.length) { toast.error(tr("กรุณาระบุสินค้า/บริการอย่างน้อย 1 รายการ", "Add at least one product or service.")); return; }
    const referenceDocumentNo = String(form.get("referenceDocumentNo") || "").trim();
    const documentTiming = definition.type === "Goods Receipt" ? "before_invoice" : definition.type === "Delivery Note" ? String(form.get("documentTiming") || "before_invoice") as "before_invoice" | "after_invoice" : undefined;
    const metadata: AccountingDocumentMeta = {
      documentCode: definition.code, issueDate: String(form.get("issueDate") || ""), referenceDocumentNo,
      linkedDocumentNo: referenceDocumentNo, paymentTerms: Number(form.get("paymentTerms") || 0), taxRate, whtRate,
      affectsStock: definition.supportsStockImpact ? form.get("affectsStock") === "true" : false,
      vendorInvoiceNo: definition.type === "Purchase Invoice" ? String(form.get("vendorInvoiceNo") || "").trim() : undefined, documentTiming,
      counterpartyAddress: String(form.get("counterpartyAddress") || "").trim(), counterpartyTaxId: String(form.get("counterpartyTaxId") || "").trim(),
      contactName: String(form.get("contactName") || "").trim(), projectName: String(form.get("projectName") || "").trim(),
      preparedBy: String(form.get("preparedBy") || "").trim(), notes: String(form.get("notes") || "").trim(),
      paymentInstructions: String(form.get("paymentInstructions") || "").trim(), lineItems,
      subtotal: Math.round(subtotal * 100), withholdingTax: Math.round(withholdingTax * 100), total: Math.round((subtotal + vat) * 100), netTotal: Math.round(netTotal * 100),
    };
    const payload = record ? { action: "update_document", id: record.id, counterparty, dueDate: form.get("dueDate"), metadata } : {
      action: "create", module: moduleKey, recordType: definition.type, documentNo: form.get("documentNo"), counterparty,
      description: lineItems.map((item) => item.description).join(", "), amount: subtotal, taxAmount: vat,
      dueDate: form.get("dueDate"), sourceSystem: "KC Account", period: settings.current_period || "2026-09", metadata,
    };
    const ok = await mutate(payload, record ? tr("แก้ไขเอกสารแล้ว", "Document updated") : tr("สร้างเอกสารแล้ว", "Document created"));
    if (ok) onOpenChange(false);
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="standard-document-dialog"><form onSubmit={submit}>
    <DialogHeader className="document-dialog-header"><div><DialogTitle>{record ? tr("แก้ไข", "Edit") : tr("สร้าง", "Create")} {tr(definition.th, definition.en)}</DialogTitle><DialogDescription>{tr("ฟอร์มมาตรฐาน Account 360 · ระบบคำนวณยอด ภาษี และบันทึก Audit Log อัตโนมัติ", "Account 360 standard form · totals, tax, and audit trail are calculated automatically")}</DialogDescription></div><StatusBadge status={record?.status || definition.initialStatus} /></DialogHeader>
    <div className="document-editor-sheet">
      <div className="document-brand-row"><div className="document-company"><Image src={brandLogo} width={2172} height={724} alt="Account 360" unoptimized /><strong>{settings.company_name || "KC Account 360"}</strong><span>{settings.company_address || tr("กรุณากำหนดที่อยู่บริษัท", "Configure company address")}</span><span>{settings.company_website || "—"} · Tax ID {settings.tax_id || "—"}</span></div><div className="document-identity"><h2>{tr(definition.th, definition.en)}</h2><label>{tr("ประเภทเอกสาร", "Document type")}<select value={documentType} onChange={(event) => setDocumentType(event.target.value)} disabled={!!record}>{definitions.map((item) => <option key={item.code} value={item.type}>{item.code} · {tr(item.th, item.en)}</option>)}</select></label><label>{tr("เลขที่", "Document no.")}<Input name="documentNo" key={documentNo} defaultValue={documentNo} readOnly={!!record} required /></label><label>{tr("วันที่", "Issue date")}<Input name="issueDate" type="date" defaultValue={issueDate} required /></label></div></div>
      <div className="document-party-grid"><section><h3>{tr(moduleKey === "AR" ? "ลูกค้า" : "ผู้ขาย / เจ้าหนี้", moduleKey === "AR" ? "Customer" : "Vendor / Payable")}</h3>{moduleKey === "AR" ? <label>{tr("ชื่อบริษัท", "Company name")}<select value={counterparty} onChange={(event) => changeCustomer(event.target.value)} required><option value="" disabled>{counterparties.length ? tr("เลือกลูกค้า", "Select customer") : tr("สร้างลูกค้าในทะเบียนลูกค้าก่อน", "Create a customer first")}</option>{counterparties.map((item) => <option key={item.id} value={item.name}>{item.code} · {item.name}</option>)}</select></label> : <label>{tr("ชื่อบริษัท", "Company name")}<Input value={counterparty} onChange={(event) => setCounterparty(event.target.value)} list="account360-vendors" maxLength={200} required /><datalist id="account360-vendors">{vendorOptions.map((vendor) => <option key={vendor} value={vendor} />)}</datalist></label>}<label>{tr("ที่อยู่", "Address")}<textarea name="counterpartyAddress" value={counterpartyAddress} onChange={(event) => setCounterpartyAddress(event.target.value)} rows={2} maxLength={500} /></label><div className="document-mini-grid"><label>{tr("เลขผู้เสียภาษี", "Tax ID")}<Input name="counterpartyTaxId" value={counterpartyTaxId} onChange={(event) => setCounterpartyTaxId(event.target.value)} maxLength={20} /></label><label>{tr("ผู้ติดต่อ", "Contact")}<Input name="contactName" value={contactName} onChange={(event) => setContactName(event.target.value)} maxLength={120} /></label></div></section><section><h3>{tr("ข้อมูลเอกสาร", "Document information")}</h3><div className="document-mini-grid"><label>{tr("วันครบกำหนด", "Due date")}<Input name="dueDate" type="date" defaultValue={record?.dueDate || ""} /></label><label>{tr("เครดิต (วัน)", "Terms (days)")}<Input name="paymentTerms" type="number" min="0" max="365" defaultValue={existingMeta.paymentTerms ?? 30} /></label></div><label>{tr("เอกสารอ้างอิง", "Source reference")}<Input key={`reference-${definition.type}`} name="referenceDocumentNo" defaultValue={existingMeta.referenceDocumentNo || existingMeta.linkedDocumentNo || ""} placeholder={tr(referencePlaceholder[0], referencePlaceholder[1])} required={definition.referenceRequired} /></label>{definition.type === "Purchase Invoice" && <label>{tr("เลข Invoice ของ Vendor", "Vendor invoice number")}<Input name="vendorInvoiceNo" defaultValue={existingMeta.vendorInvoiceNo || ""} placeholder={tr("เลขที่ตามเอกสารผู้ขาย", "Number shown on vendor invoice")} maxLength={80} required /></label>}{definition.type === "Goods Receipt" && <label>{tr("ลำดับการรับของ", "Receiving sequence")}<Input value={tr("รับของก่อนตั้งหนี้", "Receive before invoice")} readOnly /></label>}{definition.type === "Delivery Note" && <label>{tr("ลำดับการส่งของ", "Delivery sequence")}<select name="documentTiming" defaultValue={existingMeta.documentTiming || "before_invoice"}><option value="before_invoice">{tr("ส่งของก่อนออกใบแจ้งหนี้", "Deliver before invoice")}</option><option value="after_invoice">{tr("ส่งของหลังออกใบแจ้งหนี้", "Deliver after invoice")}</option></select></label>}<label>{tr("ชื่องาน / โครงการ", "Job / project")}<Input name="projectName" defaultValue={existingMeta.projectName || ""} maxLength={200} /></label><label>{tr(moduleKey === "AR" ? "ผู้ขาย" : "ผู้ขอซื้อ / ผู้ซื้อ", moduleKey === "AR" ? "Salesperson" : "Requester / buyer")}<Input name="preparedBy" defaultValue={existingMeta.preparedBy || record?.createdBy || ""} maxLength={120} /></label>{definition.supportsStockImpact && <label>{tr("ผลกระทบต่อสต็อก", "Inventory impact")}<select name="affectsStock" defaultValue={existingMeta.affectsStock ? "true" : "false"}><option value="false">{tr("ไม่ปรับสต็อก", "Do not adjust inventory")}</option><option value="true">{tr("ปรับสต็อก", "Adjust inventory")}</option></select></label>}</section></div>
      <div className="document-lines"><div className="document-line-head"><span>#</span><span>{tr("รหัส", "Code")}</span><span>{tr("รายละเอียด", "Description")}</span><span>{tr("จำนวน", "Qty")}</span><span>{tr("หน่วย", "Unit")}</span><span>{tr("ราคาต่อหน่วย", "Unit price")}</span><span>{tr("ส่วนลด", "Discount")}</span><span>{tr("มูลค่า", "Amount")}</span><span /></div>{items.map((item, index) => <div className="document-line" key={index}><span>{index + 1}</span><Input value={item.code} onChange={(event) => updateLine(index, "code", event.target.value)} aria-label={tr(`รหัสรายการ ${index + 1}`, `Item ${index + 1} code`)} /><Input value={item.description} onChange={(event) => updateLine(index, "description", event.target.value)} aria-label={tr(`รายละเอียดรายการ ${index + 1}`, `Item ${index + 1} description`)} required={index === 0} /><Input type="number" min="0" step="0.01" value={item.quantity} onChange={(event) => updateLine(index, "quantity", event.target.value)} aria-label={tr(`จำนวนรายการ ${index + 1}`, `Item ${index + 1} quantity`)} /><Input value={item.unit} onChange={(event) => updateLine(index, "unit", event.target.value)} aria-label={tr(`หน่วยรายการ ${index + 1}`, `Item ${index + 1} unit`)} /><Input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateLine(index, "unitPrice", event.target.value)} aria-label={tr(`ราคาต่อหน่วยรายการ ${index + 1}`, `Item ${index + 1} unit price`)} /><Input type="number" min="0" step="0.01" value={item.discount} onChange={(event) => updateLine(index, "discount", event.target.value)} aria-label={tr(`ส่วนลดรายการ ${index + 1}`, `Item ${index + 1} discount`)} /><strong>{decimalMoney(Math.max(0, item.quantity * item.unitPrice - item.discount))}</strong><button type="button" onClick={() => setItems((current) => current.length > 1 ? current.filter((_, itemIndex) => itemIndex !== index) : current)} aria-label={tr(`ลบรายการ ${index + 1}`, `Remove item ${index + 1}`)} disabled={items.length === 1}><Trash2 /></button></div>)}<Button type="button" size="sm" variant="outline" className="add-document-line" onClick={() => setItems((current) => current.length < 10 ? [...current, blankLine()] : current)} disabled={items.length >= 10}><Plus />{tr("เพิ่มรายการ", "Add line")}</Button></div>
      <div className="document-bottom"><div className="document-notes"><label>{tr("หมายเหตุ", "Notes")}<textarea name="notes" defaultValue={existingMeta.notes || ""} rows={3} maxLength={1000} /></label><label>{tr("เงื่อนไข / ข้อมูลการชำระเงิน", "Terms / payment instructions")}<textarea name="paymentInstructions" defaultValue={existingMeta.paymentInstructions || ""} rows={3} maxLength={1000} /></label></div><div className="document-totals"><label>{tr("VAT", "VAT")}<select value={taxRate} onChange={(event) => setTaxRate(Number(event.target.value))}><option value="0">0%</option><option value="7">7%</option></select></label><label>{tr("หัก ณ ที่จ่าย", "Withholding tax")}<select value={whtRate} onChange={(event) => setWhtRate(Number(event.target.value))}><option value="0">0%</option><option value="1">1%</option><option value="3">3%</option><option value="5">5%</option></select></label><div><span>{tr("รวมเป็นเงิน", "Subtotal")}</span><strong>{decimalMoney(subtotal)}</strong></div><div><span>VAT {taxRate}%</span><strong>{decimalMoney(vat)}</strong></div><div><span>{tr("หัก ณ ที่จ่าย", "Withholding tax")} {whtRate}%</span><strong>-{decimalMoney(withholdingTax)}</strong></div><div className="net-total"><span>{tr("ยอดชำระ", "Net payable")}</span><strong>{decimalMoney(netTotal)} THB</strong></div></div></div>
      <div className="document-signatures"><div><span>{tr("ผู้จัดทำ", "Prepared by")}</span><i /></div><div><span>{tr("ผู้ตรวจสอบ", "Reviewed by")}</span><i /></div><div><span>{tr("ผู้อนุมัติ", "Approved by")}</span><i /></div></div>
    </div>
    <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{tr("ยกเลิก", "Cancel")}</Button><Button type="submit" disabled={working || !counterparty || (moduleKey === "AR" && !counterparties.length)}>{working && <Loader2 className="spin" />}<Save />{record ? tr("บันทึกการแก้ไข", "Save changes") : tr("บันทึกเอกสาร", "Save document")}</Button></DialogFooter>
  </form></DialogContent></Dialog>;
}

function CreateDialog({ open, onOpenChange, moduleKey, initialType, working, onSubmit, customers }: { open: boolean; onOpenChange: (v: boolean) => void; moduleKey: string; initialType: string | null; working: boolean; onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>; customers: MasterItem[] }) {
  const { language, tr } = useLanguage();
  const defaults = MODULE_DEFAULTS[moduleKey] || MODULE_DEFAULTS.GL;
  const generatedId = useId().replaceAll(":", "").toUpperCase();
  const [salesType, setSalesType] = useState(initialType || "Invoice");
  const [purchaseType, setPurchaseType] = useState(initialType || "Purchase Requisition");
  const salesConfig = SALES_DOCUMENT_TYPES.find((item) => item.value === salesType) || SALES_DOCUMENT_TYPES[3];
  const documentSeed = `${salesConfig.prefix}-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-${generatedId.slice(-4) || "NEW"}`;
  if (moduleKey === "AP") {
    const documents = documentsForModule("AP");
    const selected = findAccountingDocument("AP", purchaseType) || documents[0];
    const purchaseSeed = `${selected.prefix}-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-${generatedId.slice(-4) || "NEW"}`;
    return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="create-dialog"><form onSubmit={onSubmit}><DialogHeader><DialogTitle>{tr(`สร้าง${selected.th}`, `Create ${selected.en}`)}</DialogTitle><DialogDescription>{tr("รองรับการอ้างอิงเอกสารต้นทาง การอนุมัติ และ Audit Log", "Supports source-document references, approval, and audit logging.")}</DialogDescription></DialogHeader><input type="hidden" name="module" value="AP" /><input type="hidden" name="sourceSystem" value="KC Account" /><div className="form-grid"><label className="wide">{tr("ประเภทเอกสาร", "Document type")}<select name="recordType" value={purchaseType} onChange={(event) => setPurchaseType(event.target.value)}>{documents.map((document) => <option key={document.code} value={document.type}>{document.code} · {tr(document.th, document.en)}</option>)}</select></label><label>{tr("เลขที่เอกสาร", "Document number")}<Input key={selected.type} name="documentNo" defaultValue={purchaseSeed} required /></label><label>{tr("อ้างอิงเอกสารต้นทาง", "Source document reference")}<Input name="linkedDocumentNo" placeholder={tr("เช่น PO-2609-001", "e.g. PO-2609-001")} /></label><label className="wide">{tr("รายละเอียด", "Details")}<Input name="description" maxLength={500} required /></label><label className="wide">{tr("ผู้ขาย / เจ้าหนี้", "Vendor / Payable")}<Input name="counterparty" maxLength={200} required /></label><label>{tr("จำนวนเงิน (บาท)", "Amount (THB)")}<Input name="amount" type="number" min="0" step="0.01" defaultValue="0" /></label><label>{tr("ภาษี (บาท)", "Tax (THB)")}<Input name="taxAmount" type="number" min="0" step="0.01" defaultValue="0" /></label><label>{tr("วันครบกำหนด", "Due date")}<Input name="dueDate" type="date" /></label>{selected.supportsStockImpact && <label>{tr("ผลกระทบต่อสต็อก", "Inventory impact")}<select name="affectsStock" defaultValue="false"><option value="false">{tr("ไม่ปรับสต็อก", "Do not adjust inventory")}</option><option value="true">{tr("ปรับสต็อก", "Adjust inventory")}</option></select></label>}</div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{tr("ยกเลิก", "Cancel")}</Button><Button type="submit" disabled={working}>{working && <Loader2 className="spin" />}{tr("บันทึกเอกสาร", "Save document")}</Button></DialogFooter></form></DialogContent></Dialog>;
  }
  if (moduleKey === "AR") return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="create-dialog sales-document-dialog"><form onSubmit={onSubmit}><DialogHeader><DialogTitle>{tr("สร้างเอกสารขาย", "Create sales document")}</DialogTitle><DialogDescription>{tr("รองรับเอกสารขายและเอกสารปรับปรุง พร้อมคำนวณยอดและภาษีจากรายการสินค้า/บริการ", "Create sales and adjustment documents with line-item and tax calculation.")}</DialogDescription></DialogHeader><input type="hidden" name="module" value="AR" /><input type="hidden" name="sourceSystem" value="KC Account" /><div className="form-grid"><label>{tr("ประเภทเอกสาร", "Document type")}<select name="recordType" value={salesType} onChange={(event) => setSalesType(event.target.value)}>{SALES_DOCUMENT_TYPES.map((item) => <option key={item.value} value={item.value}>{language === "th" ? item.th : item.en}</option>)}</select></label><label>{tr("เลขที่เอกสาร", "Document number")}<Input key={documentSeed} name="documentNo" defaultValue={documentSeed} required /></label><label className="wide">{tr("ลูกค้า", "Customer")}<select name="counterparty" required defaultValue=""><option value="" disabled>{customers.length ? tr("เลือกลูกค้า", "Select customer") : tr("กรุณาสร้างลูกค้าในทะเบียนลูกค้าก่อน", "Create a customer in Customer Master first")}</option>{customers.map((customer) => <option key={customer.id} value={customer.name}>{customer.code} · {customer.name}</option>)}</select></label><label>{tr("วันที่เอกสาร", "Issue date")}<Input name="issueDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label><label>{tr("วันครบกำหนด", "Due date")}<Input name="dueDate" type="date" /></label><label>{tr("เลขที่เอกสารอ้างอิง", "Reference document")}<Input name="referenceDocumentNo" placeholder={tr("เช่น INV-...", "e.g. INV-...")} required={salesType === "Credit Note" || salesType === "Debit Note" || salesType === "Receipt"} /></label><label>{tr("เครดิต (วัน)", "Payment terms (days)")}<Input name="paymentTerms" type="number" min="0" max="365" defaultValue="30" /></label>{salesType === "Credit Note" && <label>{tr("ผลกระทบต่อสต็อก", "Inventory impact")}<select name="affectsStock" defaultValue="false"><option value="false">{tr("ไม่ปรับสต็อก", "Do not adjust inventory")}</option><option value="true">{tr("ปรับสต็อก", "Adjust inventory")}</option></select></label>}</div><div className="line-item-editor"><div className="line-item-head"><strong>{tr("รายการสินค้า / บริการ", "Products / services")}</strong><span>{tr("รองรับสูงสุด 3 รายการต่อเอกสาร", "Up to 3 line items per document")}</span></div>{[1, 2, 3].map((index) => <div className="line-item-row" key={index}><span>{index}</span><Input name={`itemDescription${index}`} placeholder={tr("รายละเอียดรายการ", "Item description")} required={index === 1} /><Input name={`quantity${index}`} type="number" min="0" step="0.01" defaultValue={index === 1 ? "1" : "0"} aria-label={tr(`จำนวนรายการที่ ${index}`, `Quantity for item ${index}`)} /><Input name={`unitPrice${index}`} type="number" min="0" step="0.01" defaultValue="0" aria-label={tr(`ราคาต่อหน่วยรายการที่ ${index}`, `Unit price for item ${index}`)} /><Input name={`discount${index}`} type="number" min="0" step="0.01" defaultValue="0" aria-label={tr(`ส่วนลดรายการที่ ${index}`, `Discount for item ${index}`)} /></div>)}</div><div className="form-grid sales-tax-row"><label>{tr("อัตรา VAT", "VAT rate")}<select name="taxRate" defaultValue="7"><option value="7">7%</option><option value="0">0%</option></select></label><p>{tr("ยอดก่อนภาษี ส่วนลด และ VAT จะคำนวณและตรวจสอบอีกครั้งโดยระบบเมื่อบันทึก", "Subtotal, discounts, and VAT are recalculated and validated by the system when saved.")}</p></div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{tr("ยกเลิก", "Cancel")}</Button><Button type="submit" disabled={working || !customers.length}>{working && <Loader2 className="spin" />}{tr("บันทึกเอกสาร", "Save document")}</Button></DialogFooter></form></DialogContent></Dialog>;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="create-dialog"><form onSubmit={onSubmit}><DialogHeader><DialogTitle>{tr("สร้างรายการใหม่", "Create new entry")}</DialogTitle><DialogDescription>{tr("ระบบจะบันทึกผู้สร้าง เวลา และการเปลี่ยนแปลงลง Audit Log อัตโนมัติ", "The creator, timestamp, and changes will be recorded in the audit log automatically.")}</DialogDescription></DialogHeader><div className="form-grid"><label>{tr("โมดูล", "Module")}<select name="module" defaultValue={moduleKey}>{Object.keys(MODULE_DEFAULTS).map((key) => <option value={key} key={key}>{key}</option>)}</select></label><label>{tr("ประเภทรายการ", "Entry type")}<Input name="recordType" defaultValue={defaults.type} required /></label><label>{tr("เลขที่เอกสาร", "Document number")}<Input name="documentNo" defaultValue={`${defaults.prefix}-${generatedId || "NEW"}`} required /></label><label>{tr("แหล่งข้อมูล", "Source system")}<Input name="sourceSystem" defaultValue="KC Account" /></label><label className="wide">{tr("รายละเอียด", "Details")}<Input name="description" placeholder={tr("ระบุรายละเอียดรายการ", "Enter entry details")} required /></label><label className="wide">{tr("คู่ค้า / หน่วยงาน", "Counterparty / Department")}<Input name="counterparty" placeholder={tr("ชื่อบริษัทหรือฝ่ายงาน", "Company or department name")} /></label><label>{tr("จำนวนเงิน (บาท)", "Amount (THB)")}<Input name="amount" type="number" min="0" step="0.01" defaultValue="0" /></label><label>{tr("ภาษี (บาท)", "Tax (THB)")}<Input name="taxAmount" type="number" min="0" step="0.01" defaultValue="0" /></label><label>{tr("วันครบกำหนด", "Due date")}<Input name="dueDate" type="date" /></label></div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{tr("ยกเลิก", "Cancel")}</Button><Button type="submit" disabled={working}>{working && <Loader2 className="spin" />}{tr("บันทึกรายการ", "Save entry")}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function EditRecordDialog({ record, onOpenChange, working, mutate }: { record: RecordItem | null; onOpenChange: (v: boolean) => void; working: boolean; mutate: (p: Record<string, unknown>, s: string) => Promise<boolean> }) {
  const { tr } = useLanguage();
  if (!record) return null;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await mutate({ action: "update_record", id: record?.id, description: form.get("description"), counterparty: form.get("counterparty"), amount: Number(form.get("amount") || 0), taxAmount: Number(form.get("taxAmount") || 0), dueDate: form.get("dueDate") }, tr("แก้ไขรายการแล้ว", "Entry updated"));
    if (ok) onOpenChange(false);
  }
  return <Dialog open={!!record} onOpenChange={onOpenChange}><DialogContent className="create-dialog"><form onSubmit={submit}><DialogHeader><DialogTitle>{tr("แก้ไขรายการ", "Edit entry")} {record.documentNo}</DialogTitle><DialogDescription>{tr("แก้ไขได้เฉพาะรายการที่ยังไม่ลงบัญชีหรือปิดงาน การเปลี่ยนแปลงจะถูกบันทึกใน Audit Log", "Only open entries can be edited. Every change is recorded in the audit log.")}</DialogDescription></DialogHeader><div className="form-grid"><label>{tr("เลขที่เอกสาร", "Document number")}<Input value={record.documentNo} disabled /></label><label>{tr("สถานะ", "Status")}<Input value={record.status} disabled /></label><label className="wide">{tr("รายละเอียด", "Details")}<Input name="description" defaultValue={record.description} maxLength={500} required /></label><label className="wide">{tr("คู่ค้า / หน่วยงาน", "Counterparty / Department")}<Input name="counterparty" defaultValue={record.counterparty} maxLength={200} /></label><label>{tr("จำนวนเงิน (บาท)", "Amount (THB)")}<Input name="amount" type="number" min="0" step="0.01" defaultValue={record.amount / 100} /></label><label>{tr("ภาษี (บาท)", "Tax (THB)")}<Input name="taxAmount" type="number" min="0" step="0.01" defaultValue={record.taxAmount / 100} /></label><label>{tr("วันครบกำหนด", "Due date")}<Input name="dueDate" type="date" defaultValue={record.dueDate || ""} /></label></div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{tr("ยกเลิก", "Cancel")}</Button><Button type="submit" disabled={working}>{working && <Loader2 className="spin" />}{tr("บันทึกการแก้ไข", "Save changes")}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function AuditDialog({ open, onOpenChange, logs }: { open: boolean; onOpenChange: (v: boolean) => void; logs: AuditItem[] }) {
  const { tr } = useLanguage();
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="audit-dialog"><DialogHeader><DialogTitle>Audit Log</DialogTitle><DialogDescription>{tr("ประวัติการดำเนินการล่าสุด 80 รายการ", "The 80 most recent actions")}</DialogDescription></DialogHeader><div className="audit-list">{logs.map((log) => <div key={log.id}><div className="audit-icon"><Activity /></div><div><strong>{log.action.replaceAll("_", " ")}</strong><span>{log.details}</span><small>{log.actorEmail} · {dateText(log.createdAt)}</small></div></div>)}</div></DialogContent></Dialog>;
}

function DocumentPreviewSheet({ record, settings }: { record: RecordItem; settings: Record<string, string> }) {
  const { tr } = useLanguage();
  const meta = documentMeta(record.metadata);
  const definition = findAccountingDocument(record.module, record.recordType);
  const lines = meta.lineItems?.length ? meta.lineItems : [{ code: "", description: record.description, unit: "รายการ", quantity: 1, unitPrice: record.amount / 100, discount: 0 }];
  const subtotal = (meta.subtotal ?? record.amount) / 100; const vat = record.taxAmount / 100;
  const withholding = (meta.withholdingTax ?? 0) / 100; const net = (meta.netTotal ?? record.amount + record.taxAmount) / 100;
  const logoSrc = settings.brand_logo_key && !settings.brand_logo_key.includes("-365_") ? `/api/branding/logo?v=${encodeURIComponent(settings.brand_logo_key)}` : "/account360-logo.png";
  return <article className="document-preview-sheet">
    <header><div className="preview-company"><Image src={logoSrc} width={2172} height={724} alt="Account 360" unoptimized /><strong>{settings.company_name || "KC Account 360"}</strong><span>{settings.company_address || tr("กรุณากำหนดที่อยู่บริษัท", "Configure company address")}</span><span>{settings.company_website || "—"} · Tax ID {settings.tax_id || "—"}</span></div><div className="preview-document-title"><h2>{tr(definition?.th || record.recordType, definition?.en || record.recordType)}</h2><dl><div><dt>{tr("เลขที่", "Document no.")}</dt><dd>{record.documentNo}</dd></div><div><dt>{tr("วันที่", "Issue date")}</dt><dd>{meta.issueDate || dateText(record.createdAt)}</dd></div><div><dt>{tr("ผู้จัดทำ", "Prepared by")}</dt><dd>{meta.preparedBy || record.createdBy}</dd></div></dl></div></header>
    <section className="preview-party"><h3>{tr(record.module === "AR" ? "ลูกค้า" : "ผู้ขาย / เจ้าหนี้", record.module === "AR" ? "Customer" : "Vendor / Payable")}</h3><strong>{record.counterparty || "—"}</strong><span>{meta.counterpartyAddress || "—"}</span><span>Tax ID {meta.counterpartyTaxId || "—"}{meta.contactName ? ` · ${meta.contactName}` : ""}</span><dl><div><dt>{tr("อ้างอิง", "Reference")}</dt><dd>{meta.referenceDocumentNo || meta.linkedDocumentNo || "—"}</dd></div>{record.recordType === "Purchase Invoice" && <div><dt>{tr("Invoice ผู้ขาย", "Vendor invoice")}</dt><dd>{meta.vendorInvoiceNo || "—"}</dd></div>}{["Goods Receipt", "Delivery Note"].includes(record.recordType) && <div><dt>{tr(record.recordType === "Goods Receipt" ? "ลำดับการรับของ" : "ลำดับการส่งของ", record.recordType === "Goods Receipt" ? "Receiving sequence" : "Delivery sequence")}</dt><dd>{meta.documentTiming === "after_invoice" ? tr("หลังออกใบแจ้งหนี้", "After invoice") : tr("ก่อนออกใบแจ้งหนี้", "Before invoice")}</dd></div>}<div><dt>{tr("โครงการ", "Project")}</dt><dd>{meta.projectName || "—"}</dd></div><div><dt>{tr("ครบกำหนด", "Due date")}</dt><dd>{record.dueDate || "—"}</dd></div></dl></section>
    <div className="preview-lines"><div className="preview-line header"><span>#</span><span>{tr("รายละเอียด", "Description")}</span><span>{tr("จำนวน", "Qty")}</span><span>{tr("หน่วย", "Unit")}</span><span>{tr("ราคา/หน่วย", "Unit price")}</span><span>{tr("ส่วนลด", "Discount")}</span><span>{tr("มูลค่า", "Amount")}</span></div>{lines.map((item, index) => <div className="preview-line" key={`${item.description}-${index}`}><span>{index + 1}</span><span><b>{item.code}</b>{item.description}</span><span>{decimalMoney(item.quantity)}</span><span>{item.unit || "รายการ"}</span><span>{decimalMoney(item.unitPrice)}</span><span>{decimalMoney(item.discount)}</span><strong>{decimalMoney(Math.max(0, item.quantity * item.unitPrice - item.discount))}</strong></div>)}</div>
    <div className="preview-summary"><div className="preview-terms"><strong>{tr("หมายเหตุ", "Notes")}</strong><p>{meta.notes || "—"}</p><strong>{tr("เงื่อนไข / ข้อมูลการชำระเงิน", "Terms / payment instructions")}</strong><p>{meta.paymentInstructions || "—"}</p></div><dl><div><dt>{tr("รวมเป็นเงิน", "Subtotal")}</dt><dd>{decimalMoney(subtotal)}</dd></div><div><dt>VAT {meta.taxRate || 0}%</dt><dd>{decimalMoney(vat)}</dd></div><div><dt>{tr("หัก ณ ที่จ่าย", "Withholding tax")} {meta.whtRate || 0}%</dt><dd>-{decimalMoney(withholding)}</dd></div><div className="preview-net"><dt>{tr("ยอดชำระ", "Net payable")}</dt><dd>{decimalMoney(net)} THB</dd></div></dl></div>
    {definition?.supportsStockImpact && <p className="preview-stock-impact">{tr("ผลกระทบต่อสต็อก", "Inventory impact")}: <strong>{meta.affectsStock ? tr("ปรับสต็อก", "Adjust inventory") : tr("ไม่ปรับสต็อก", "Do not adjust inventory")}</strong></p>}
    <footer>{[tr("ผู้จัดทำ", "Prepared by"), tr("ผู้ตรวจสอบ", "Reviewed by"), tr("ผู้อนุมัติ", "Approved by")].map((label) => <div key={label}><i /><span>{label}</span></div>)}</footer>
  </article>;
}

function DetailDialog({ record, onOpenChange, documents, working, mutate, permissions, settings }: { record: RecordItem | null; onOpenChange: (v: boolean) => void; documents: DocumentItem[]; working: boolean; mutate: (p: Record<string, unknown>, s: string) => Promise<boolean>; permissions: string[]; settings: Record<string, string> }) {
  const { tr } = useLanguage();
  if (!record) return null;
  const files = documents.filter((item) => item.recordId === record.id); const isAccountingDocument = ["AR", "AP"].includes(record.module) && !!findAccountingDocument(record.module, record.recordType);
  const canApprove = record.status === "Pending Approval" && permissions.includes("approve");
  const canIssue = record.status === "Draft" && permissions.includes("post");
  const canPost = record.status === "Approved" && permissions.includes("post");
  return <Dialog open={!!record} onOpenChange={onOpenChange}><DialogContent className={isAccountingDocument ? "accounting-document-detail" : undefined}><DialogHeader><div className="detail-title-row"><div><DialogTitle>{record.documentNo}</DialogTitle><DialogDescription>{record.recordType} · {record.module}</DialogDescription></div><StatusBadge status={record.status} /></div></DialogHeader>{isAccountingDocument ? <DocumentPreviewSheet record={record} settings={settings} /> : <div className="detail-grid"><div><span>{tr("รายละเอียด", "Details")}</span><strong>{record.description}</strong></div><div><span>{tr("คู่ค้า / หน่วยงาน", "Counterparty / Department")}</span><strong>{record.counterparty || "—"}</strong></div><div><span>{tr("จำนวนเงิน", "Amount")}</span><strong>{money(record.amount)}</strong></div><div><span>{tr("ภาษี", "Tax")}</span><strong>{money(record.taxAmount)}</strong></div><div><span>{tr("สถานะ", "Status")}</span><StatusBadge status={record.status} /></div><div><span>{tr("งวดบัญชี", "Accounting period")}</span><strong>{record.period}</strong></div><div><span>{tr("สร้างโดย", "Created by")}</span><strong>{record.createdBy}</strong></div><div><span>{tr("ผู้อนุมัติ", "Approver")}</span><strong>{record.approver || "—"}</strong></div></div>}<div className="file-list no-print"><strong>{tr("ไฟล์แนบ", "Attachments")} ({files.length})</strong>{files.map((file) => <div key={file.id}><Paperclip /><a href={`/api/documents/${file.id}`}>{file.name}</a><small>{Math.ceil(file.size / 1024)} KB</small></div>)}{!files.length && <small>{tr("ยังไม่มีไฟล์แนบ", "No attachments yet")}</small>}</div><DialogFooter className="no-print"><Button variant="outline" onClick={() => onOpenChange(false)}>{tr("ปิด", "Close")}</Button>{isAccountingDocument && <Button variant="outline" onClick={() => window.print()}><Printer />{tr("พิมพ์ / บันทึก PDF", "Print / Save PDF")}</Button>}{canIssue && <Button disabled={working} onClick={() => mutate({ action: "issue", id: record.id }, tr("ออกเอกสารแล้ว", "Document issued"))}>{tr("ออกเอกสาร", "Issue document")}</Button>}{canApprove && <><Button variant="outline" disabled={working} onClick={() => mutate({ action: "reject", id: record.id }, tr("ปฏิเสธเอกสารแล้ว", "Document rejected"))}>{tr("ปฏิเสธ", "Reject")}</Button><Button disabled={working} onClick={() => mutate({ action: "approve", id: record.id }, tr("อนุมัติเอกสารแล้ว", "Document approved"))}>{tr("อนุมัติ", "Approve")}</Button></>}{canPost && <Button disabled={working} onClick={() => mutate({ action: "post", id: record.id }, tr("ลงบัญชีแล้ว", "Document posted"))}>{tr("ลงบัญชี", "Post")}</Button>}{permissions.includes("post") && !["Void", "Posted", "Completed", "Received"].includes(record.status) && <Button variant="destructive" disabled={working} onClick={() => mutate({ action: "void", id: record.id }, tr("ยกเลิกรายการแล้ว", "Entry voided"))}>{tr("ยกเลิกรายการ", "Void entry")}</Button>}</DialogFooter></DialogContent></Dialog>;
}
