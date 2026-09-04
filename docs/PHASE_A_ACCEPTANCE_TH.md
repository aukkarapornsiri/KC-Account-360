# Phase A Acceptance — Accounting Foundation

## ผลการตรวจ

| Gate | สถานะ | หลักฐาน |
|---|---|---|
| PostgreSQL On-Premise schema/migration | ผ่านระดับ Source | `db/schema.ts`, `drizzle-pg/` |
| Multi-tenant / company / branch scope | ผ่านระดับ Source | FK, index, API scope validation, connector scope |
| Accounting period control | ผ่านระดับ Source | Event/Post ปฏิเสธงวดที่ไม่ OPEN/SOFT_CLOSE |
| Double-entry validation | ผ่านระดับ App + DB | Posting engine และ `journal_must_balance_before_post` trigger |
| Posted journal immutability | ผ่านระดับ DB | `POSTED_JOURNAL_IMMUTABLE` trigger |
| Posting rule version/effective date | ผ่านระดับ Source | Approved rule lookup + conditions + effective dates |
| Multi-currency base amount | ผ่านระดับ Source | Exchange-rate lookup และ fixed-point conversion 4/10 decimals |
| Maker–Checker / Approval | ผ่านระดับ Source | ห้าม Maker อนุมัติเอง, role/user step, reject reason |
| Idempotency / retry / failure queue | ผ่านระดับ Source | Payload hash conflict, duplicate return, failed-event retry |
| Audit | ผ่านระดับ Source | Create/Approve/Reject/Post audit events |
| Legacy UI/API compatibility | ผ่าน Build/Regression | Compatibility tables และ API เดิมยังอยู่ |
| TypeScript / Lint / Build / Tests | ผ่าน | `tsc`, ESLint, Next production build, 33 tests |
| PostgreSQL runtime integration test | รอ Environment | Workspace นี้ไม่มี Docker/PostgreSQL daemon |
| OIDC end-to-end test | รอ Identity Provider | ต้องใช้ issuer/client ของ On-Premise จริง |

## คำตัดสิน

Phase A พร้อมสำหรับ Pull Request และติดตั้งใน Staging On-Premise แต่ยังไม่ถือว่า Production Gate สมบูรณ์จนกว่าจะรัน migration/integration test กับ PostgreSQL จริงและ OIDC ขององค์กร โดยไม่ต้องหยุดงาน UX/UI Audit และ Shared Design Foundation ที่ไม่เปลี่ยน Accounting Logic

## Staging Gate ที่ต้องรัน

1. `docker compose up --build -d`
2. ยืนยัน `GET /api/health` = 200
3. สร้าง Tenant/Company/Branch/Period/COA/Posting Rule/Approval Rule/Connector Scope ชุดทดสอบ
4. ส่ง Event ปกติ, duplicate เดิม, duplicate payload ต่าง, งวดปิด, mapping ขาด, FX ขาด และ journal ไม่สมดุล
5. ทดสอบ Maker อนุมัติตัวเองไม่ได้, Approver ต่างคนอนุมัติได้, Post ก่อนอนุมัติไม่ได้
6. ทดสอบแก้/ลบ Posted Journal ไม่ได้ และ reversal เป็นรายการใหม่
7. ทดสอบ backup/restore และ attachment persistence

เอกสารบริษัท, ภาษี และสมุดบัญชีที่ผู้ใช้แนบไม่ถูกอ่านหรือรวมใน Public Repository
