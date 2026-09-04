# KC Account 360 — Gap Analysis

วันที่ประเมิน: 2026-09-04  
ฐานอ้างอิง: Sanitized Production v25 (`main`)

## บทสรุป

ระบบเดิมมี UI, เอกสาร AP/AR 18 ประเภท, Workflow สถานะ, RBAC ระดับพื้นฐาน,
Audit Log, Integration Connector และ Idempotency บางส่วนแล้ว แต่ฐานข้อมูลเดิมเป็น
Cloudflare D1 และใช้ `financial_records` เป็นรายการยอดรวมหนึ่งแถว จึงยังไม่ใช่
Double-entry General Ledger และยังปิดงบการเงินจริงไม่ได้

Phase ที่ต้องเริ่มทันทีคือ **Phase A — Accounting Foundation** ก่อน Integration
และ AI ตาม Acceptance Gate

## Gap Matrix

| Domain | สถานะ | สิ่งที่มีอยู่ | ช่องว่างสำคัญ / การดำเนินการ |
|---|---|---|---|
| UI / CI / Responsive / TH-EN | EXISTS | KC CI, เมนูหลัก, Responsive, TH/EN | รักษาของเดิมและ Extend เท่านั้น |
| AP/AR Document Workflow | PARTIAL | เอกสารซื้อ 9 และขาย 9 ประเภท, line items ใน metadata, อ้างอิงเอกสาร | Normalize header/line/allocation, partial receive/payment, control account |
| Procurement | PARTIAL | PR, PO, GR และ Purchase Invoice อยู่ใน Document Center | เพิ่ม RFQ, comparison, service acceptance, 3-way matching, budget control |
| Company / Branch | PARTIAL | เก็บใน generic `master_data` | แยกตาราง Tenant, Company, Branch พร้อม FK และ isolation |
| Chart of Accounts | PARTIAL | เก็บ Account ใน `master_data` | แยก COA, account group/category, control-account และ statement mapping |
| Fiscal Year / Period | BLOCKER | มีเพียง current/locked period ใน settings | สร้าง fiscal year, period state, subledger close, lock/unlock audit |
| General Ledger | BLOCKER | มี Financial Record และสถานะ Posted | ไม่มี journal header/lines, debit-credit, reverse journal, immutable ledger |
| Posting Engine | MISSING | Integration map สร้าง financial record | สร้าง Accounting Event → Posting Rule → Journal แบบรวมศูนย์ |
| Tax Engine | NEED REFACTOR | VAT/WHT ถูก validate ใน API | สร้าง tax rule/version/effective date; ห้าม hard-code อัตรา |
| Approval Engine | NEED REFACTOR | Role และ status transition ระดับเอกสาร | สร้าง rule/instance/step กลาง, Maker-Checker-Approver, amount/dimension rules |
| Audit Trail | PARTIAL | action, actor, details, timestamp | เพิ่ม tenant/company, old/new value, reason, request/session/IP, immutable policy |
| Vendor / Customer | PARTIAL | Customer และ User ใน `master_data`; Vendor เป็นข้อความ | สร้าง Vendor master + approval/change history; Customer ownership mapping จาก CRM |
| AP / Payment | PARTIAL | Purchase invoice, payment document | เพิ่ม AP open item, schedule, allocation, proposal/request, WHT, reconciliation |
| AR / Receipt | PARTIAL | Invoice, tax invoice, receipt | เพิ่ม AR open item, allocation, partial payment, collection, statement |
| Cash / Bank | PARTIAL | Bank transaction และ reconcile status | เพิ่ม bank account/statement/line/match/closing |
| Fixed Asset Accounting | MISSING | Connector จาก KC EAM | เพิ่ม accounting book/value/depreciation/disposal โดยไม่ซ้ำ Physical Asset master |
| Inventory Accounting | MISSING | Connector จาก KC ToRy | เพิ่ม inventory value, COGS, adjustment และ control reconciliation |
| Closing Engine | BLOCKER | Closing tasks แบบ financial record | เพิ่ม checklist dependency, reconciliation, approvals, close/lock history |
| Financial Statements | BLOCKER | Dashboard/insights เท่านั้น | เพิ่ม trial balance และ mapping-driven statements |
| Integration API | PARTIAL | 4 connectors, bearer key, event log/retry, source+event uniqueness | เพิ่ม `/api/v1/accounting-events`, scopes, tenant/company/branch, correlation/idempotency |
| Authentication | BLOCKER (On-Prem) | ใช้ ChatGPT identity headers | เพิ่ม OIDC reverse proxy สำหรับ On-Prem และ trusted-header boundary |
| File Storage | NEED REFACTOR | Cloudflare R2 | เปลี่ยนเป็น encrypted local/S3-compatible storage abstraction |
| PostgreSQL | MISSING | SQLite/D1 schema | เปลี่ยน Drizzle เป็น PostgreSQL, constraints/indexes/transactions/migrations |
| Tests / CI | PARTIAL | Build และ source-level tests 28 รายการ | เพิ่ม DB, accounting, API, isolation, security และ E2E tests |
| AI | MISSING / NOT READY | ไม่มี AI Production workflow | ห้ามเริ่มจน Phase A–E ผ่าน Acceptance Gate และ Critical Blocker = 0 |

## Critical Blockers

1. ไม่มี Double-entry Journal และข้อบังคับ Debit = Credit
2. Posted Journal ยังไม่มี immutable/reversal model
3. Period lock เป็น setting เดียวและยังไม่มีระดับ Company/Subledger
4. ไม่มี Tenant/Company/Branch isolation ที่ฐานข้อมูล
5. Event processing ยังไม่เชื่อม Central Posting Engine
6. Tax และ Approval logic ยังไม่เป็น configurable central engines
7. On-Prem authentication และ storage ยังไม่พร้อม
8. Trial Balance และ Financial Statements ยังไม่เกิดจาก GL จริง

## ลำดับการพัฒนา

1. PostgreSQL On-Premise, tenant/company/branch, fiscal year/period, COA/dimensions
2. Double-entry journal, immutable posting, reversal, central posting rules
3. Accounting Event API, service account/scopes/idempotency/retry/audit
4. Central Approval Engine และ Segregation of Duties
5. Normalize Procurement/AP/AR/Bank และทำ E2E reconciliation
6. Closing Engine, Trial Balance, Financial Statement Mapping
7. AI Foundation เฉพาะเมื่อ Accounting และ Integration Acceptance Gate ผ่าน

## Phase A Acceptance Gate

- [ ] Posted Journal ทุกใบ Debit = Credit
- [ ] Unbalanced Journal ถูกปฏิเสธ
- [ ] Posted Journal ลบไม่ได้และแก้ไขตรงไม่ได้
- [ ] Reverse → Correct → Repost ทำงานจริง
- [ ] Locked Period ไม่รับ Posting
- [ ] Tenant/Company isolation ผ่านการทดสอบ
- [ ] Permission และ SoD ผ่านการทดสอบ
- [ ] Audit Trail ครบและแก้ไขไม่ได้โดยผู้ใช้ทั่วไป
- [ ] Transaction persist ใน PostgreSQL
- [ ] Unit, Integration, Database และ Accounting tests ผ่าน
- [ ] Critical Accounting Bug = 0
