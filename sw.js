/**
 * สร้าง template "สรุปรายงานประจำสัปดาห์" ใน Google Sheet ไฟล์ใหม่
 * ดึงข้อมูลสดจากไฟล์เดิม (ไฟล์ที่ได้รับข้อมูลจากแอป) ด้วย IMPORTRANGE
 *
 * วิธีใช้: ในไฟล์ใหม่ → Extensions → Apps Script → วางโค้ดนี้ → Save
 *         เลือกฟังก์ชัน buildSummary → Run → อนุญาตสิทธิ์
 *         กลับมาที่ไฟล์ แล้วกด "Allow access" ที่ช่อง #REF! ครั้งแรก 1 ครั้ง
 *
 * เรียกใช้ซ้ำได้ (จะสร้างแท็บรายคนใหม่ทับของเดิม) — ห้ามเก็บข้อมูลอื่นไว้ในแท็บรายคน
 */

// ====== ตั้งค่า ======
const SOURCE_ID = '14BheiMlj1wiv-u3lZfI6GTQi1up7X_UYYcWf0LjeLfs'; // ไฟล์เดิมที่รับข้อมูลจากแอป
const ORG_NAME = 'ຊື່ຫ້ອງການຂອງທ່ານ';                              // แก้ในหน้า "ໜ້າຫຼັກ" ได้ภายหลัง
const USERS = ['ກູ່ຄຳ','ເຂັມຄຳ','ຄຳສອນ','ຄຳປະດິດ','ແກ້ວອຸດອນ','ຄູນ','ບຸນຊູ','ອາລິດສະລາ','ເລ່ເມີ້ນ','ພອນທະວີ'];
const HOME = 'ໜ້າຫຼັກ';
const FONT_NAME = '';                  // ใส่ชื่อฟอนต์ที่ต้องการ (เช่น 'Noto Sans Lao') ถ้าเว้นว่าง = ใช้ฟอนต์เริ่มต้นของชีต แล้วคุณตั้งเองได้
const DATA_FONT_SIZE = 12;             // ขนาดตัวอักษรของข้อมูล (แถว 6 เป็นต้นไป) บังคับเป็น 12 เสมอ
const MAX_ROWS = 3000;                 // ต้องมากกว่าจำนวนแถวของแท็บต้นทาง
const GREEN = '#0f766e', LIGHT = '#d9f0ed';

// key ต้องตรงกับคอลัมน์ "ໝວດ" ที่ Code.gs เขียนไว้ทุกตัวอักษร
const CATS = [
  { key: '1. ຜົນງານສຳເລັດ',   head: '1. ສະຫຼຸບຜົນງານທີ່ເຮັດສຳເລັດ',   detailInC: false },
  { key: '2. ວຽກກຳລັງດຳເນີນ', head: '2. ວຽກທີ່ກຳລັງດຳເນີນ',          detailInC: false },
  { key: '3. ແຜນອາທິດຕໍ່ໄປ',  head: '3. ແຜນການດຳເນີນງານອາທິດຕໍ່ໄປ',  detailInC: false },
  { key: '4. ຈຸດເດັ່ນ',       head: '4. ຈຸດເດັ່ນຂອງການປະຕິບັດວຽກອາທິດນີ້', detailInC: true },
  { key: '5. ບັນຫາ/ອຸປະສັກ',  head: '5. ບັນຫາ ແລະ ອຸປະສັກ',          detailInC: true },
  { key: '6. ຂໍ້ສະເໜີ',       head: '6. ຂໍ້ສະເໜີ',                   detailInC: true }
];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('ສະຫຼຸບລາຍງານ').addItem('ສ້າງ / ສ້າງໃໝ່ທັງໝົດ', 'buildSummary').addToUi();
}

function buildSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const home = buildHome_(ss);
  const links = [];
  USERS.forEach(function (name, i) {
    const old = ss.getSheetByName(name);
    if (old) ss.deleteSheet(old);
    const sh = ss.insertSheet(name, i + 1);
    buildPerson_(sh, name);
    links.push([name, sh.getSheetId()]);
  });
  // ลิงก์สารบัญในหน้าหลัก
  links.forEach(function (l, i) {
    home.getRange(8 + i, 1).setFormula('=HYPERLINK("#gid=' + l[1] + '","' + l[0] + '")');
  });
  // ลบแผ่นว่างเริ่มต้นถ้ามี
  ['Sheet1', 'ແຜ່ນ1', 'ใบงาน1', 'ชีต1'].forEach(function (n) {
    const s = ss.getSheetByName(n);
    if (s && ss.getSheets().length > 1) ss.deleteSheet(s);
  });
  ss.setActiveSheet(home);
}

function buildHome_(ss) {
  let h = ss.getSheetByName(HOME);
  if (!h) h = ss.insertSheet(HOME, 0);
  h.getRange(1, 1, h.getMaxRows(), h.getMaxColumns()).breakApart();
  h.clear();
  h.setHiddenGridlines(true);
  h.setColumnWidth(1, 300); h.setColumnWidth(2, 380); h.setColumnWidth(3, 30);
  h.setColumnWidths(4, 3, 30); h.setColumnWidth(7, 90); h.setColumnWidth(8, 90);

  h.getRange('A1').setValue('ສະຫຼຸບລາຍງານປະຈຳອາທິດ').setFontSize(18).setFontWeight('bold').setFontColor(GREEN);
  h.getRange('A3').setValue('ໄຟລ໌ຕົ້ນທາງ (ໃສ່ URL ຫຼື ID)').setFontWeight('bold');
  h.getRange('B3').setValue(SOURCE_ID);
  h.getRange('A4').setValue('ຊື່ຫ້ອງການ (ສະແດງເປັນຫົວເອກະສານ)').setFontWeight('bold');
  h.getRange('B4').setValue(ORG_NAME);
  h.getRange('B3:B4').setBackground('#fff9c4').setFontColor('#0000ff');
  h.getRange('A5').setValue('ແກ້ໄຂສະເພາະຊ່ອງສີເຫຼືອງ. ເປີດແຖບຂອງແຕ່ລະຄົນແລ້ວເລືອກ ປີ / ເດືອນ / ອາທິດ ເພື່ອເບິ່ງລາຍງານ.')
    .setFontColor('#6b7280').setFontStyle('italic');
  h.getRange('A6').setValue('ທົດສອບການເຊື່ອມຕໍ່ (ຖ້າເຫັນ #REF! ກົດ Allow access)').setFontWeight('bold');
  h.getRange('B6').setFormula('=IMPORTRANGE($B$3,"A1")');
  h.getRange('A7').setValue('ລາຍຊື່ (ກົດເພື່ອເປີດ)').setFontWeight('bold').setBackground(LIGHT);
  h.getRange('B7').setBackground(LIGHT);

  // รายการสำหรับ Dropdown
  h.getRange('G2').setValue('ປີ').setFontColor('#6b7280');
  h.getRange('H2').setValue('ເດືອນ').setFontColor('#6b7280');
  h.getRange('I2').setValue('ອາທິດ').setFontColor('#6b7280');
  h.setColumnWidth(9, 90);
  for (let i = 0; i < 4; i++) h.getRange(3 + i, 9).setValue(i + 1).setFontColor('#6b7280');
  for (let i = 0; i < 12; i++) {
    h.getRange(3 + i, 7).setValue(2024 + i).setFontColor('#6b7280');
    h.getRange(3 + i, 8).setValue(i + 1).setFontColor('#6b7280');
  }
  return h;
}

function buildPerson_(sh, name) {
  const H = "'" + HOME + "'!";
  if (sh.getMaxRows() < MAX_ROWS) sh.insertRowsAfter(sh.getMaxRows(), MAX_ROWS - sh.getMaxRows());
  if (sh.getMaxColumns() < 35) sh.insertColumnsAfter(sh.getMaxColumns(), 35 - sh.getMaxColumns()); // ต้องมีถึงคอลัมน์ AI
  sh.setHiddenGridlines(true);
  sh.setColumnWidth(1, 30);  // A = รหัสชนิดแถว (ซ่อน)
  sh.setColumnWidth(2, 60);  // B = เลขลำดับ
  sh.setColumnWidth(3, 300); // C
  sh.setColumnWidth(4, 380); // D
  sh.setColumnWidth(5, 90);  // E

  // ส่วนหัว
  sh.getRange('B1:E1').merge().setFormula('=' + H + '$B$4&" — ລາຍງານປະຈຳອາທິດ"')
    .setFontSize(16).setFontWeight('bold').setFontColor('#ffffff').setBackground(GREEN)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(1, 40);
  sh.getRange('B2').setValue('ຊື່:').setFontWeight('bold');
  sh.getRange('C2').setValue(name).setFontWeight('bold').setFontSize(13);
  sh.getRange('B3').setValue('ປີ:').setFontWeight('bold');
  sh.getRange('B4').setValue('ເດືອນ:').setFontWeight('bold');
  sh.getRange('C3').setValue(2026);
  sh.getRange('C4').setValue(new Date().getMonth() + 1);
  sh.getRange('C3:C4').setBackground('#fff9c4').setFontColor('#0000ff').setFontWeight('bold').setHorizontalAlignment('left');
  const home = sh.getParent().getSheetByName(HOME);
  sh.getRange('C3').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInRange(home.getRange('G3:G14'), true).setAllowInvalid(false).build());
  sh.getRange('C4').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInRange(home.getRange('H3:H14'), true).setAllowInvalid(false).build());
  // อาทิตย์ (D3) และช่วงวันที่ (D4)
  const now = new Date();
  const wkDefault = Math.min(4, Math.floor((now.getDate() - 1 + new Date(now.getFullYear(), now.getMonth(), 1).getDay()) / 7) + 1);
  sh.getRange('D3').setValue(wkDefault).setNumberFormat('"ອາທິດທີ "0')
    .setBackground('#fff9c4').setFontColor('#0000ff').setFontWeight('bold').setHorizontalAlignment('left')
    .setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInRange(home.getRange('I3:I6'), true).setAllowInvalid(false).build());
  sh.getRange('D4').setFormula(dateRangeFormula_()).setFontWeight('bold').setFontColor('#115e59');
  sh.setFrozenRows(4);

  // ข้อมูลดิบจากไฟล์ต้นทาง (คอลัมน์ Z:AI — ซ่อนไว้)
  sh.getRange('Z1').setFormula('=IMPORTRANGE(' + H + '$B$3,"\'"&$C$2&"\'!A:J")');
  // บรรทัดสถานะการดึงข้อมูล
  sh.getRange('B5:E5').merge().setFormula('=IF(COUNTIF($AD$2:$AD,"?*")=0,"⚠ ຍັງບໍ່ໄດ້ດຶງຂໍ້ມູນ: ກວດການອະນຸຍາດໃນໜ້າຫຼັກ ຫຼື ຄົນນີ້ຍັງບໍ່ເຄີຍສົ່ງລາຍງານ","✓ ດຶງຂໍ້ມູນແລ້ວ "&COUNTIF($AD$2:$AD,"?*")&" ແຖວ")')
    .setFontSize(9).setFontColor('#6b7280').setFontStyle('italic');

  // แถว 6 = หัวอาทิตย์ | แถว 7 = เว้นว่างไว้ให้ผู้ใช้ | ข้อมูลเริ่มที่แถว 8 (สูตร spill จาก A8)
  sh.getRange('A6').setValue(1);
  sh.getRange('C6').setFormula('="ອາທິດທີ "&$D$3');
  sh.getRange('A8').setFormula(documentFormula_());
  sh.getRange('B6:E' + MAX_ROWS).setWrap(true).setVerticalAlignment('top');
  sh.getRange('B6:B' + MAX_ROWS).setHorizontalAlignment('center');
  sh.getRange('E6:E' + MAX_ROWS).setHorizontalAlignment('center');
  // ฟอนต์: ข้อมูลที่ดึงมาเป็นแค่ข้อความ ไม่พาฟอนต์/ขนาดจากไฟล์ต้นทางมา. ที่นี่บังคับขนาด 12 ตั้งแต่แถว 6 ลงไป
  if (FONT_NAME) sh.getRange(1, 1, MAX_ROWS, 35).setFontFamily(FONT_NAME);
  sh.getRange('A6:E' + MAX_ROWS).setFontSize(DATA_FONT_SIZE);

  // จัดรูปแถวตามชนิด: 1=หัวอาทิตย์ (แถว 6) 2=หัวหมวด 3=รายการ 4=ว่าง
  const rng = [sh.getRange('B6:E' + MAX_ROWS)];
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$A6=1')
      .setBackground(GREEN).setFontColor('#ffffff').setBold(true).setRanges(rng).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$A6=2')
      .setBackground(LIGHT).setFontColor('#115e59').setBold(true).setRanges(rng).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$A6=4')
      .setFontColor('#9ca3af').setItalic(true).setRanges(rng).build()
  ]);

  sh.hideColumns(1);
  sh.hideColumns(26, 10);
}

/**
 * ช่วงวันที่ของอาทิตย์ที่เลือก (อาทิตย์เริ่มวันอาทิตย์ จบวันเสาร์)
 * อาทิตย์ที่ 1 = สัปดาห์ที่มีวันที่ 1 ของเดือน (ตัดให้อยู่ในเดือนนั้น) เช่น ต.ค. 2026: อ.1 = 1-3, อ.2 = 4-10, อ.3 = 11-17, อ.4 = 18-24
 */
function dateRangeFormula_() {
  return '=IFERROR(LET(f,DATE($C$3,$C$4,1),' +
    'ws,f-WEEKDAY(f,1)+1+7*($D$3-1),' +
    's,MAX(f,ws),e,MIN(EOMONTH(f,0),ws+6),' +
    '"ວັນທີ "&DAY(s)&"/"&MONTH(s)&"/"&YEAR(s)&" – "&DAY(e)&"/"&MONTH(e)&"/"&YEAR(e)),"")';
}

/** สูตรเอกสารสรุป (เริ่มที่แถว 8): แสดงเฉพาะอาทิตย์ที่เลือกใน D3 × หมวด 1-5 (ทุกส่วนมี 5 คอลัมน์: ชนิด, ลำดับ, C, D, E) */
function documentFormula_() {
  const Y = '$C$3', M = '$C$4', W = '$D$3';
  const cnt = 'COUNTIFS($AA$2:$AA,' + Y + ',$AB$2:$AB,' + M + ',$AC$2:$AC,' + W + ')';
  const cats = CATS.map(function (c) { return catSeg_(W, c, Y, M); });
  const body = '{' + cats.join(';') + '}';
  const none = '{4,"","(ຍັງບໍ່ໄດ້ສົ່ງລາຍງານ)","",""}';
  return '=IF(' + cnt + '=0,' + none + ',' + body + ')';
}

function catSeg_(w, c, Y, M) {
  // คอลัมน์ในข้อมูลดิบ (เรียงจาก Z): 7=ชื่องาน 8=รายละเอียด 9=ความสำคัญ (ว่างยกเว้นหมวด 3)
  const cols = c.detailInC ? 'INDEX(f,0,8),INDEX(f,0,9),INDEX(f,0,9)' : 'INDEX(f,0,7),INDEX(f,0,8),INDEX(f,0,9)';
  const filt = 'FILTER($Z$2:$AI,($AA$2:$AA=' + Y + ')*($AB$2:$AB=' + M + ')*($AC$2:$AC=' + w + ')*($AE$2:$AE="' + c.key + '"))';
  return '{2,"","' + c.head + '","","";' +
    'IFERROR(LET(f,' + filt + ',{SEQUENCE(ROWS(f),1,3,0),SEQUENCE(ROWS(f)),' + cols + '}),' +
    '{4,"","(ບໍ່ມີຂໍ້ມູນ)","",""})}';
}
