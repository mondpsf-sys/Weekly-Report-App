# ລະບົບລາຍງານປະຈຳອາທິດ / Weekly Report App / ระบบรายงานประจำสัปดาห์

ไฟล์ในโฟลเดอร์นี้
- `index.html` — หน้าเว็บทั้งหมด (ขึ้น GitHub + Cloudflare Pages)
- `Code.gs` — สคริปต์ฝั่ง Google Sheet (วางใน Apps Script)
- `weekly-report-template.xlsx` — template Google Sheet (อัปโหลดขึ้น Drive แล้ว Save as Google Sheets)

## ขั้นที่ 1 — ตั้งค่า Google Sheet
1. สร้าง Google Sheet ใหม่ (ตั้งชื่ออะไรก็ได้)
2. เมนู **Extensions → Apps Script** แล้ววางโค้ดจาก `Code.gs` ทั้งหมด → กด Save
3. กด **Deploy → New deployment → ประเภท Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
4. กด Deploy และอนุญาตสิทธิ์ แล้วคัดลอก **Web app URL** (ขึ้นต้นด้วย `https://script.google.com/macros/s/.../exec`)
5. ถ้าแก้ `Code.gs` ภายหลัง ต้อง **Deploy → Manage deployments → แก้ไข → New version** URL จึงจะใช้โค้ดใหม่

## ขั้นที่ 2 — ตั้งค่าหน้าเว็บ
เปิด `index.html` แก้ส่วน `CFG` ด้านบนของ `<script>`
- `SCRIPT_URL` ใส่ URL จากขั้นที่ 1
- `ORG` ใส่ชื่อห้องการ/หน่วยงาน 3 ภาษา
- `USERS` รายชื่อพนักงาน (ต้องตรงกับ `ALLOWED_USERS` ใน `Code.gs` ทุกตัวอักษร)

## ขั้นที่ 3 — ขึ้น GitHub และ Cloudflare Pages
1. สร้าง repository ใหม่บน github.com แล้วอัปโหลดไฟล์ `index.html` (และ `README.md`)
2. ไปที่ dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git** เลือก repository
3. Build command: เว้นว่าง / Build output directory: `/` (หรือเว้นว่าง) แล้วกด Deploy
4. จะได้ลิงก์รูปแบบ `https://ชื่อโปรเจกต์.pages.dev` ส่งให้ทีมเปิดในมือถือได้เลย
5. ผู้ใช้มือถือสามารถกด "Add to Home Screen" เพื่อใช้เหมือนแอปได้

## การเก็บข้อมูลใน Google Sheet
- แต่ละคนมีแท็บของตัวเอง (ชื่อแท็บ = ชื่อพนักงาน) ข้อมูลไม่ปะปนกัน
- **1 รายการ = 1 แถว** เช่น ส่งผลงานสำเร็จ 3 โครงการ + กำลังทำ 1 งาน = 4 แถว
- ทุกแถวมี เวลาส่ง / ปี / เดือน / อาทิตย์ / ชื่อ กำกับเสมอ และมีคอลัมน์ "ໝວດ" บอกว่าเป็นหมวดไหน (ผลงานสำเร็จ, กำลังดำเนิน, แผนอาทิตย์ต่อไป, ปัญหา, ข้อเสนอ)
- ส่งรายงานสัปดาห์ถัดไปหรือส่งเพิ่ม ระบบเขียน **ต่อท้าย** แถวเดิมเสมอ ไม่ลบของเก่า
- ถ้าเครือข่ายหลุดแล้วกดส่งซ้ำโดยไม่แก้ข้อมูล ระบบกันไม่ให้บันทึกซ้ำ (ใช้คอลัมน์ "ລະຫັດການສົ່ງ")
- ใช้ปุ่มกรอง (Filter) ที่หัวตารางเพื่อดูเฉพาะเดือน/อาทิตย์/หมวดที่ต้องการ
- แท็บ "ສະຖານະ" นับจากคอลัมน์ ปี/เดือน/อาทิตย์ ว่าใครส่งแล้ว
