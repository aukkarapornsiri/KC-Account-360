# KC Account 360 — All Phases Delivery

เอกสารนี้กำหนด Release Train ที่ต่อยอดของเดิมโดยไม่ลบ Workflow, Permission, API หรือข้อมูลเดิม

## Phase A — Accounting Foundation

- PostgreSQL On-Premise, Tenant/Company/Branch, Fiscal Period และ COA
- Authorized Context API สำหรับเลือก Tenant/Company/Branch/Period โดยไม่ต้องเดา UUID
- Double-entry Journal, Posting Rule, Idempotency, Approval และ Immutable Audit
- Reversal สร้าง Journal ใหม่และไม่แก้ Posted Journal เดิม

## Phase B — Operational Accounting

- Normalize Customer/Vendor, AP/AR Document Header/Line, Open Item และ Allocation
- Bank Account, Statement, Matching และ Human Review
- External Subledger Reconciliation สำหรับ KC CuTo, KC ToRy, KC EAM และ KC HR
- Trial Balance, Balance Sheet และ Profit & Loss จาก Posted GL เท่านั้น

## Phase C — Financial Closing

- Closing Run และ Checklist แบบมี Dependency
- ตรวจ Unposted Journal, Subledger, Bank และ Trial Balance
- Maker–Checker Approval ก่อน Lock Period

## Phase D — Enterprise UX

- Global Search, Quick Create, Role Task Center และ Saved Views
- Advanced Saved View: Search, Sort, Page Size, Columns, Shared และ Role Default
- User Dashboard Layout และ Company Experience/Document Branding persistence
- Theme, Density, Page Width, Responsive และ Accessibility

## Phase E — Integration

- Scoped API Key ต่อ Tenant/Company
- Payload limit, HTTPS allowlist, Idempotency conflict และ Retry Queue
- Accounting Event เข้า Central Posting Engine
- Connector permission แยกจาก System Settings

## Phase F — AI-Native Accounting

- Evidence-based Integration Exception, Bank Matching, Cash-flow Forecast และ Closing Copilot
- รองรับ Document Extraction, GL Coding และ Duplicate Detection ผ่าน Recommendation Contract
- ทุกคำแนะนำมี Confidence, Reason, Source Evidence และ Proposed Action
- Accept/Reject/Edit/Apply ต้องผ่านผู้ใช้ที่มีสิทธิ์ และ Apply ไม่แก้ Ledger อัตโนมัติ

## Phase G — Production Gate

Source ต้องผ่าน TypeScript, ESLint, Build, Automated Tests และ Secret Scan ก่อน Merge ส่วน Environment Gate ต้องทดสอบ PostgreSQL/OIDC/Connector/Backup-Restore บน Staging จริงก่อน Cutover Production

ข้อมูล Preview ไม่ใช่ Production Data และห้ามใช้ทดแทน Environment Gate
