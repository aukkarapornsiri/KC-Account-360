# UX/UI Modernization — Phase 2

## เป้าหมายของชุดงาน

ต่อยอดจาก P1 PostgreSQL Foundation และ P2 User Experience Foundation โดยไม่เปลี่ยน Business Logic, Accounting Status, Permission หรือ Integration Control เดิม

## ฟังก์ชันที่เพิ่ม

1. Global Search และ Command Center
   - เปิดด้วย `Ctrl/Cmd + K`
   - ค้นหาข้ามเมนู เอกสาร คู่ค้า ระบบต้นทาง และสถานะ
   - เปิดเอกสารหรือ Workspace จากผลการค้นหา
   - เก็บคำค้นล่าสุดเฉพาะอุปกรณ์
   - Quick Create แสดงเฉพาะผู้ใช้ที่มีสิทธิ์ `create`

2. Role-based Task Center
   - รวมงานรออนุมัติ เอกสารเกินกำหนด Integration Error รายการรอกระทบยอด และงานปิดงวด
   - คำนวณจากข้อมูลจริงในระบบ ไม่มีตัวเลขจำลอง
   - กด Drill-down ไปยังหน้าที่เกี่ยวข้องได้ทันที

3. Persistent Saved Views
   - บันทึกตัวกรองประเภทเอกสารและสถานะเป็นมุมมองส่วนตัว
   - เก็บใน PostgreSQL `user_saved_views`
   - จำกัดข้อมูลตามผู้ใช้ และบันทึก Audit Log
   - เปิดใช้ซ้ำได้จากทุกอุปกรณ์หลังเข้าสู่ระบบ

4. Enterprise responsive behavior
   - Command Center และ Task Center รองรับ Desktop/Tablet/Mobile
   - Table tools เรียงใหม่บนหน้าจอเล็กโดยไม่ตัดตัวเลือก

## Guardrails

- AI Icon ไม่มีกรอบสี พื้นหลัง Gradient หรือเงารอบ Icon ทุกจุด
- Quick Create ไม่ข้าม Permission
- Saved View ไม่เปลี่ยน Accounting State หรือ Backend Permission
- Global Search ไม่แก้ไขข้อมูลและไม่เปิดเผยข้อมูลนอกชุดที่ API ส่งให้ผู้ใช้

## Verification

- TypeScript, ESLint, Production Build และ Automated Tests ต้องผ่านก่อนเผยแพร่ Preview
- Preview ใช้สำหรับตรวจ UX/UI และไม่แทน Production PostgreSQL Acceptance Gate
