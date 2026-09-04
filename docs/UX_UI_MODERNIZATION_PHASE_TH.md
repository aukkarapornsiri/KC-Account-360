# Phase ถัดไป — UX/UI Modernization & Customizable Experience

เอกสารนี้บันทึกข้อกำหนด Phase ถัดไปที่ได้รับอนุมัติ เพื่อให้เริ่มได้ทันทีหลัง Phase A Foundation ผ่าน Acceptance Gate โดยไม่ลบหรือเปลี่ยน Business Logic, Accounting Logic, API Contract, Database Logic, Permission หรือ Integration Event ที่ถูกต้องอยู่แล้ว

## เป้าหมาย

- Modern Enterprise SaaS + FinTech + Accounting Intelligence
- ใช้ KC Corporate Identity เป็นค่าเริ่มต้น (`#0AADA9`, `#088A87`, `#2DD4BF`)
- Design token กลาง รองรับ Light, Dark และ System theme
- App Shell, Navigation, Page Header, Status, Form และ Enterprise Data Table ใช้มาตรฐานเดียวกัน
- Appearance, Navigation, Dashboard, Document Branding และ User Preferences ปรับจาก Settings และบันทึก PostgreSQL
- Desktop-first แต่รองรับ 1920, 1440, 1366, 1280, 1024, 768 และ Mobile
- Keyboard, focus, contrast, ARIA, screen reader และ reduced-motion ผ่าน Accessibility Gate

## ลำดับทำงาน

1. UX และ Design System Audit จากหน้าปัจจุบัน
2. สร้าง Design Token และ Shared Component Foundation
3. ปรับ Information Architecture โดยคง Route และ Backend Permission เดิม
4. สร้าง Enterprise Data Table, Saved Views, Filters และ Density
5. สร้าง Settings Center และ Persistence ลงฐานข้อมูล
6. ปรับ Dashboard/Workspace ตาม Role และงานจริง
7. ปรับ Core Screens โดย reuse และ improve ของเดิม
8. Responsive, Accessibility, Functional และ Regression Test
9. ตรวจ “Not AI-generated” Quality Gate

## AI UX Guardrail

- ภาพ `kai-com-ai-robot.webp` ใช้เป็น Brand Asset เฉพาะ Ask KC AI, AI empty state หรือ AI onboarding ที่เหมาะสม
- ไม่ใช้ Robot animation/icon กระจายทั่วระบบ
- AI suggestion ต้องแสดง Confidence, Reason, Source และมี Accept/Reject/Edit
- AI ไม่ลงบัญชี อนุมัติ หรือเปลี่ยนข้อมูลสำคัญเองก่อน Accounting/Approval Control ผ่าน Gate

## Acceptance Gate

- Theme หลักไม่มี hard-code กระจาย และ Design System ถูกใช้จริง
- Core screens ใช้ Shared Components และ Navigation สอดคล้องกัน
- Settings เปลี่ยน Logo, Application Name, Theme, Language, Density, Dashboard, Menu และ Document Branding ได้จริง
- Save → PostgreSQL → Refresh แล้วค่ายังอยู่
- Existing Workflow และ API ไม่ถดถอย
- Responsive/Accessibility/Regression ผ่าน และ Critical UX Bug เท่ากับศูนย์

หาก Accounting Core, Integration หรือ Closing ยังไม่ครบหลัง UX/UI Gate จะกลับไปปิด Core Gap ก่อนเริ่ม AI-Native Accounting ตามลำดับ Document AI → GL Coding → Duplicate Detection → Bank Matching → Closing Copilot → Ask KC AI → Anomaly Detection → Cash Flow Forecast
