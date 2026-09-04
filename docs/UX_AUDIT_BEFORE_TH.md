# UX Audit Before — KC Account 360 v25

## สิ่งที่ทำได้ดีและต้องรักษา

- KC teal identity, IBM Plex Sans Thai/English และ token พื้นฐานมีอยู่แล้ว
- AP/AR แสดง Document Workflow 18 ประเภทและใช้ฟอร์มเอกสารมาตรฐานร่วมกัน
- Sidebar จัดกลุ่ม Accounting, Finance Operations และ System Control ไม่เกินสองระดับ
- Settings มี Logo, CI color, Live Preview และ Contrast check ที่ใช้งานจริง
- Desktop table, mobile horizontal flow, keyboard focus และ reduced-motion มีฐานรองรับ
- Business action ตรวจ Permission ที่ Server และมี Audit Log

## ช่องว่างสำคัญ

| Area | สถานะก่อน Phase | สิ่งที่ต้องเพิ่ม |
|---|---|---|
| User preference | เก็บภาษาใน Local Storage | PostgreSQL persistence สำหรับ theme/language/density/layout |
| Dark/System theme | Light-only | semantic dark tokens และตรวจทุก component |
| Data table | Search/filter/pagination บางหน้า | column config, resize/reorder, saved views, bulk/group/subtotal |
| Navigation | กลุ่มหลักชัด | company/branch selector, user-state persistence, role defaults |
| Global search | ค้นเฉพาะหน้าปัจจุบัน | cross-module search + category + recent search |
| Command palette | ไม่มี | Cmd/Ctrl+K + permission-aware quick create |
| Dashboard | KPI และ operational panel | role-based priority, exceptions, tasks และ drill-down |
| Detail page | Dialog/long content | standard header + tabs + related/activity/audit |
| Settings IA | หน้า System Control เดียว | searchable settings center แยก domain |
| Appearance | Logo + 2 colors | full safe tokens, light/dark logo, favicon, report/document branding |
| Accessibility | มี focus/label บางส่วน | automated contrast/ARIA/dialog/keyboard matrix |
| Responsive | breakpoint หลักมีแล้ว | viewport regression 1920–mobile และ priority columns |

## การตัดสินใจเชิงออกแบบ

1. Refactor แบบ incremental ไม่ rewrite monolith/route ทั้งระบบ
2. Theme และ Preference ห้ามเปลี่ยน Permission หรือ Accounting state
3. AI Robot ใช้เฉพาะ AI entry/context ไม่กระจายเป็น decoration
4. Table และ Settings เป็น shared foundation ก่อน modernize รายหน้า
5. ทุก capability ต้อง persist และมี function จริง ไม่แสดง placeholder/fake insight

## Foundation ที่เริ่มในสาขานี้

- PostgreSQL: `user_preferences`, `user_saved_views`, `user_dashboard_layouts`, `company_experience_settings`
- Preference API validation + audit
- TH/EN, Light/Dark/System, Comfortable/Compact, Full/Contained และ date format
- UI apply theme/density/page width จากค่าฐานข้อมูล และยังเก็บ Local Storage เป็น cache fallback เท่านั้น
