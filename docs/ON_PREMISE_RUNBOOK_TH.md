# On-Premise Runbook

## Network และ Secret

- เปิด public ingress เฉพาะ OAuth2 Proxy หรือ Reverse Proxy ขององค์กร
- PostgreSQL และ Application อยู่ private network
- เก็บ PostgreSQL password, OIDC client secret, cookie secret และ connector token ใน Secret Manager
- ห้าม commit `.env` หรือใช้ค่าใน `.env.example` กับ Production

## Deploy

1. Checkout commit/tag ที่อนุมัติแล้ว
2. สร้าง `.env` จาก Secret Manager
3. `docker compose build`
4. สำรองฐานข้อมูลก่อน migration ทุกครั้ง
5. `docker compose up -d`
6. ตรวจ `docker compose ps`, migration service exit 0 และ `/api/health`
7. เรียก `npm run db:bootstrap` หนึ่งครั้งด้วยค่าจาก Secret Manager เพื่อสร้าง Tenant, Company, 12 Periods, COA เริ่มต้น และ Admin (คำสั่งเป็น idempotent)
8. Smoke test Login, AP/AR document, attachment, approval, posting, reversal, closing, report, AI review และ export

## Backup

- PostgreSQL: encrypted `pg_dump --format=custom` ทุกวันและ WAL/PITR ตาม RPO ขององค์กร
- Document volume: snapshot พร้อม PostgreSQL backup set เดียวกัน
- เก็บอย่างน้อยหนึ่งสำเนานอกเครื่อง และทดสอบ restore ตามรอบ
- ใช้ `npm run backup` เพื่อสร้าง custom-format dump พร้อม SHA-256 manifest
- ทดสอบด้วย `KC_RESTORE_DATABASE_URL=... scripts/verify-restore.sh /path/to/backup.dump` บนฐานว่างที่แยกจาก Production
- ห้ามนำ dump หรือ attachment Production เข้า Public Repository

## Rollback

- Application: deploy image/tag ก่อนหน้า
- Database: migration เป็น forward-only; ใช้ restore point หรือ corrective migration ที่ review แล้ว
- Posted Journal ห้ามแก้ย้อนหลังด้วย SQL; ใช้ reversal ตาม Workflow

## Observability

- Alert เมื่อ `/api/health` ไม่ใช่ 200, PostgreSQL connection สูง, migration ล้มเหลว, integration event FAILED หรือ disk volume ใกล้เต็ม
- Log ต้องไม่พิมพ์ token, payload เอกสารเต็ม, เลขบัญชีธนาคาร หรือข้อมูลส่วนบุคคลที่ไม่จำเป็น
