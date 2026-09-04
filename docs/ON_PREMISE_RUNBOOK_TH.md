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
7. Smoke test Login, AP/AR document, attachment, approval และ export

## Backup

- PostgreSQL: encrypted `pg_dump --format=custom` ทุกวันและ WAL/PITR ตาม RPO ขององค์กร
- Document volume: snapshot พร้อม PostgreSQL backup set เดียวกัน
- เก็บอย่างน้อยหนึ่งสำเนานอกเครื่อง และทดสอบ restore ตามรอบ
- ห้ามนำ dump หรือ attachment Production เข้า Public Repository

## Rollback

- Application: deploy image/tag ก่อนหน้า
- Database: migration เป็น forward-only; ใช้ restore point หรือ corrective migration ที่ review แล้ว
- Posted Journal ห้ามแก้ย้อนหลังด้วย SQL; ใช้ reversal ตาม Workflow

## Observability

- Alert เมื่อ `/api/health` ไม่ใช่ 200, PostgreSQL connection สูง, migration ล้มเหลว, integration event FAILED หรือ disk volume ใกล้เต็ม
- Log ต้องไม่พิมพ์ token, payload เอกสารเต็ม, เลขบัญชีธนาคาร หรือข้อมูลส่วนบุคคลที่ไม่จำเป็น
