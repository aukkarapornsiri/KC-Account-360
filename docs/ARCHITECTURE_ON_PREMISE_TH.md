# KC Account 360 — On-Premise Architecture

## Runtime

```text
User
  -> HTTPS Reverse Proxy / OIDC
  -> KC Account 360 Web + API
  -> Application Services
  -> Central Posting Engine
  -> PostgreSQL

KC KuTo / KC ToRy / KC EAM / KC HR
  -> REST/Webhook API Gateway
  -> Accounting Event Inbox
  -> Idempotency + Validation
  -> Posting Rule Engine
  -> Journal + General Ledger
```

ระบบภายนอกห้ามเขียน General Ledger หรือเชื่อมฐานข้อมูล KC Account โดยตรง
ทุกข้อมูลต้องผ่าน Versioned API, Service Account, Scope, Idempotency Key และ Audit

## Containers

- `web`: Next.js application และ API
- `postgres`: PostgreSQL 17 เก็บข้อมูลบัญชีจริง
- `auth-proxy`: OIDC boundary สำหรับ Microsoft Entra ID หรือผู้ให้บริการ OIDC
- `backup`: งานสำรอง PostgreSQL และไฟล์เอกสารตาม Schedule ขององค์กร

PostgreSQL และ Application storage ไม่เปิดพอร์ตออก Internet โดยตรง

## Data Rules

- จำนวนเงินใน Subledger เดิมเก็บเป็น minor unit (`bigint`) เพื่อความเข้ากันได้
- Journal/GL ใช้ `numeric(20,4)` และห้ามใช้ floating point
- ทุกตารางธุรกิจผูก `tenant_id`, `company_id` และ `branch_id` ตาม Data Scope
- Foreign key ฝั่งลูกมี index
- Posted journal immutable; การแก้ใช้ reversal เท่านั้น
- External event มี unique idempotency constraint ต่อ tenant/source
- Audit ใช้ append-only table และแยกสิทธิ์จาก Application role

## Environment Boundary

Secrets อยู่ใน `.env` หรือ Secret Manager ของ Server เท่านั้นและห้าม Commit GitHub
Repository มีเฉพาะ `.env.example` ที่ไม่มีค่าจริง
