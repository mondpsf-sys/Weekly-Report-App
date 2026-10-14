/**
 * Google Apps Script — รับรายงานประจำสัปดาห์จากเว็บแอป แล้วบันทึกลง Google Sheet
 *
 * รูปแบบข้อมูล: 1 รายการ = 1 แถว
 *  - แต่ละคนมีแท็บของตัวเอง (ชื่อแท็บ = ชื่อพนักงาน)
 *  - ทุกแถวมี เวลาส่ง / ปี / เดือน / อาทิตย์ / ชื่อ กำกับเสมอ
 *  - ส่งรายงานครั้งใหม่ ระบบจะเขียนต่อท้ายแถวเดิม (ไม่ลบของเก่า)
 *  - ถ้าเครือข่ายหลุดแล้วกดส่งซ้ำ รหัสการส่ง (sid) เดียวกันจะไม่ถูกบันทึกซ้ำ
 *
 * วิธีใช้: เปิด Google Sheet → Extensions → Apps Script → วางโค้ดนี้ → Deploy เป็น Web app
 */

const ALLOWED_USERS = ['ກູ່ຄຳ','ເຂັມຄຳ','ຄຳສອນ','ຄຳປະດິດ','ແກ້ວອຸດອນ','ຄູນ','ບຸນຊູ','ອາລິດສະລາ','ເລ່ເມີ້ນ','ພອນທະວີ'];

const HEADERS = [
  'ເວລາສົ່ງ (Timestamp)', 'ປີ (Year)', 'ເດືອນ (Month)', 'ອາທິດທີ (Week)', 'ຊື່ (Name)',
  'ໝວດ (Category)', 'ຊື່ວຽກ / ໂຄງການ', 'ລາຍລະອຽດ / ຄວາມຄືບໜ້າ', 'ລຳດັບຄວາມສຳຄັນ', 'ລະຫັດການສົ່ງ (Submit ID)'
];
const COL_COUNT = HEADERS.length;
const SID_COL = 10;

// key ใน payload → ชื่อหมวด, ฟิลด์ชื่องาน, ฟิลด์รายละเอียด
const CATEGORIES = [
  { key: 'done',      label: '1. ຜົນງານສຳເລັດ',        title: 't', detail: 'd' },
  { key: 'doing',     label: '2. ວຽກກຳລັງດຳເນີນ',      title: 't', detail: 'p' },
  { key: 'next',      label: '3. ແຜນອາທິດຕໍ່ໄປ',       title: 't', detail: 'd', priority: 'pr' },
  { key: 'problems',  label: '4. ບັນຫາ/ອຸປະສັກ',       title: null, detail: 'd' },
  { key: 'proposals', label: '5. ຂໍ້ສະເໜີ',            title: null, detail: 'd' }
];
const PRIORITY_LABEL = { high: 'ສູງ', mid: 'ກາງ', low: 'ຕ່ຳ' };

function doGet() {
  return out_({ ok: true, message: 'Weekly report endpoint is running' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const d = JSON.parse(e.postData.contents);

    if (ALLOWED_USERS.indexOf(d.name) < 0) return out_({ ok: false, error: 'unknown user' });
    const year = Number(d.year), month = Number(d.month), week = Number(d.week);
    if (!(year >= 2000 && year <= 2100 && month >= 1 && month <= 12 && week >= 1 && week <= 4)) {
      return out_({ ok: false, error: 'invalid period' });
    }
    const sid = String(d.sid || '').slice(0, 64);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName(d.name);
    if (!sh) {
      sh = ss.insertSheet(d.name);
      sh.appendRow(HEADERS);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, COL_COUNT).setFontWeight('bold').setBackground('#d9f0ed');
      sh.setColumnWidths(1, 5, 110);
      sh.setColumnWidth(6, 150);
      sh.setColumnWidths(7, 2, 340);
      sh.setColumnWidths(9, 2, 120);
    }

    const last = sh.getLastRow();

    // กันบันทึกซ้ำ: ถ้ารหัสการส่งนี้เคยบันทึกแล้ว ถือว่าสำเร็จ
    if (sid && last > 1) {
      const hit = sh.getRange(2, SID_COL, last - 1, 1).createTextFinder(sid).matchEntireCell(true).findNext();
      if (hit) return out_({ ok: true, duplicate: true });
    }

    const stamp = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
    const rows = [];
    CATEGORIES.forEach(function (cat) {
      const list = Array.isArray(d[cat.key]) ? d[cat.key] : [];
      list.forEach(function (it) {
        const title = cat.title ? String(it[cat.title] || '').trim() : '';
        const detail = String(it[cat.detail] || '').trim();
        if (!title && !detail) return;
        const pr = cat.priority ? (PRIORITY_LABEL[it[cat.priority]] || '') : '';
        rows.push([stamp, year, month, week, d.name, cat.label, title, detail, pr, sid]);
      });
    });
    if (!rows.length) return out_({ ok: false, error: 'no data' });

    const start = last + 1;
    sh.getRange(start, 1, rows.length, COL_COUNT).setValues(rows);
    sh.getRange(start, 1, rows.length, COL_COUNT).setWrap(true).setVerticalAlignment('top');
    return out_({ ok: true, rows: rows.length, start: start });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
