# KC Account 360

Enterprise Accounting & Finance Web Application ของ KAI-COM รองรับวงจรเอกสาร AP/AR, Approval, Audit, Integration และ PostgreSQL แบบ On-Premise

## สถานะสาขา

- `main` — Sanitized Production v25 baseline
- `feat/on-prem-postgresql` — Phase A Accounting Foundation สำหรับตรวจสอบผ่าน Pull Request
- Source สาธารณะไม่มีรายการธุรกรรมจริง เลขผู้เสียภาษี สมุดบัญชีธนาคาร Credential หรือ Production identifier

## Phase A ที่เพิ่มในสาขานี้

- PostgreSQL schema สำหรับ Tenant, Company, Branch, Fiscal Year และ Accounting Period
- Chart of Accounts, Account Group, Currency, Exchange Rate และ Tax Code
- Central Accounting Event API และ Posting Rule แบบ version/effective date
- Double-entry Journal พร้อม database guard ป้องกันรายการไม่สมดุล
- Maker–Checker Approval, Role check, Audit Event และ Posted Journal immutability
- Idempotency ต่อ Tenant + Source System + Key พร้อมตรวจ payload conflict
- Persistent local document storage แทน R2
- OIDC/OAuth2 Proxy สำหรับ On-Premise และยังคงรองรับ ChatGPT Sites headers เดิม
- Docker Compose, Health Check และ automatic database migration
- เก็บตารางเดิมไว้ระหว่างทยอยย้ายแต่ละ Subledger เพื่อไม่ทำลาย UI/Workflow v25

## เริ่มใช้งาน On-Premise

ต้องมี Docker Engine และ Docker Compose รุ่นที่รองรับ health-condition

1. คัดลอก `.env.example` เป็น `.env`
2. กำหนด `POSTGRES_PASSWORD`, OIDC issuer/client/secret และ cookie secret ด้วย Secret Manager ขององค์กร
3. เปิดระบบผ่าน OAuth2 Proxy เท่านั้น ห้าม expose container `app` โดยตรงเมื่อ `AUTH_TRUST_PROXY=true`
4. เริ่มระบบด้วย `docker compose up --build -d`

Migration จะทำงานใน service `migrate` ก่อน Application เริ่ม และ endpoint `/api/health` จะตอบพร้อมใช้งานเมื่อ PostgreSQL เชื่อมต่อสำเร็จ

## Development

```bash
npm ci
cp .env.example .env
npm run db:migrate
npm run dev
```

คำสั่งตรวจ Release:

```bash
npm run lint
npm run build
npm test
```

Cloudflare Sites/Vinext workflow เดิมยังอยู่ใน `dev:sites`, `build:sites` และ `start:sites` เพื่อใช้เปรียบเทียบหรือ rollback ระหว่าง migration

## Integration

ระบบเดิมยังรองรับ `POST /api/integrations/{cuto|tory|eam|hr}` แบบ backward compatible และ Phase A เพิ่ม `POST /api/v1/accounting-events`

Headers ที่จำเป็น:

- `Authorization: Bearer <connector-api-key>`
- `X-KC-Source-System: cuto|tory|eam|hr`
- `Idempotency-Key: <same-as-payload.idempotencyKey>`
- `Content-Type: application/json`

Event จะผ่าน Company/Branch scope, Accounting Period, Posting Rule, Account Mapping และ Balance validation ก่อนสร้าง Journal Draft หรือ Pending Approval ระบบไม่ Auto-post โดยไม่มี Approval

## Security

- ห้าม commit `.env`, database dump, เอกสารบริษัท เอกสารภาษี สมุดบัญชี หรือ customer/vendor production data
- API key แสดงครั้งเดียวและเก็บเฉพาะ SHA-256 hash โดยตรวจแบบ timing-safe
- ไฟล์แนบจำกัดชนิด/ขนาดและ object key ถูกป้องกัน path traversal
- Posted journal แก้ไข/ลบไม่ได้; การแก้ต้องผ่าน controlled reversal workflow ที่จะเพิ่มใน Closing/GL phase
- Theme/menu ที่ซ่อนใน UI ไม่เปลี่ยน backend permission

## เอกสาร

- `docs/GAP_ANALYSIS_TH.md`
- `docs/ARCHITECTURE_ON_PREMISE_TH.md`
- `docs/UX_UI_MODERNIZATION_PHASE_TH.md`

ภาพและแบรนด์ KAI-COM/Account 360 ใน repository นี้เผยแพร่ตามการอนุญาตของเจ้าของโครงการ ส่วนเอกสารบริษัทและข้อมูลการเงินจริงไม่รวมอยู่ใน Source Code
