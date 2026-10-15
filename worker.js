/**
 * Cloudflare Worker — ส่งแจ้งเตือน (Web Push) ไปยังมือถือสมาชิก
 *  - POST /subscribe     แอปส่ง {name, subscription} มาลงทะเบียนเครื่อง
 *  - POST /unsubscribe   {endpoint} ยกเลิก
 *  - GET  /send-test?token=ADMIN_TOKEN[&name=ชื่อ]   ทดสอบส่งทันที
 *  - Cron Trigger: ทุกวันศุกร์ 15:30 เวลาลาว/ไทย = 08:30 UTC → cron "30 8 * * 5"
 *
 * ตัวแปรที่ต้องตั้งใน Cloudflare (Settings → Variables and Secrets):
 *   VAPID_PUBLIC_KEY   (Text)    กุญแจสาธารณะ จาก vapid-keygen.html
 *   VAPID_PRIVATE_JWK  (Secret)  กุญแจส่วนตัว (JSON) จาก vapid-keygen.html
 *   VAPID_SUBJECT      (Text)    mailto:อีเมลของคุณ
 *   ADMIN_TOKEN        (Secret)  รหัสลับสำหรับทดสอบ /send-test
 *   ALLOWED_ORIGIN     (Text)    https://ชื่อโปรเจกต์.pages.dev
 *   KV Namespace binding ชื่อ SUBS
 */

const ALLOWED_NAMES = ['ກູ່ຄຳ','ເຂັມຄຳ','ຄຳສອນ','ຄຳປະດິດ','ແກ້ວອຸດອນ','ຄູນ','ບຸນຊູ','ອາລິດສະລາ','ເລ່ເມີ້ນ','ພອນທະວີ'];
const MAX_DEVICES_PER_NAME = 5;
// รับ endpoint เฉพาะบริการ push ของเบราว์เซอร์จริง (กัน Worker ถูกใช้ยิงไปที่อื่น)
const PUSH_HOSTS = [/(^|\.)fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/,
                    /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];
const KV_KEY = 'subs';

const enc = new TextEncoder();

function bytesToB64u(buf) {
  let s = '';
  for (const x of new Uint8Array(buf)) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const strB64u = s => bytesToB64u(enc.encode(s));

function cors(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}
function json(env, obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, cors(env))
  });
}

async function loadSubs(env) {
  const raw = await env.SUBS.get(KV_KEY);
  try { return raw ? JSON.parse(raw) : {}; } catch (e) { return {}; }
}
async function saveSubs(env, subs) { await env.SUBS.put(KV_KEY, JSON.stringify(subs)); }

async function hashEndpoint(endpoint) {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(endpoint));
  return bytesToB64u(d).slice(0, 24);
}
function validEndpoint(ep) {
  try {
    const u = new URL(ep);
    return u.protocol === 'https:' && PUSH_HOSTS.some(re => re.test(u.hostname));
  } catch (e) { return false; }
}

async function importVapidKey(env) {
  const k = JSON.parse(env.VAPID_PRIVATE_JWK);
  return crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: k.x, y: k.y, d: k.d, ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

async function vapidAuth(env, key, endpoint) {
  const aud = new URL(endpoint).origin;
  const head = strB64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = strB64u(JSON.stringify({ aud: aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT }));
  const data = head + '.' + body;
  // WebCrypto ให้ลายเซ็นรูปแบบ r||s (64 ไบต์) ซึ่งตรงกับที่ JWT ES256 ต้องการ
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(data));
  return 'vapid t=' + data + '.' + bytesToB64u(sig) + ', k=' + env.VAPID_PUBLIC_KEY;
}

/** ส่ง push แบบไม่มีข้อความแนบ (เนื้อหาแจ้งเตือนอยู่ใน sw.js) */
async function sendAll(env, onlyName) {
  const subs = await loadSubs(env);
  const key = await importVapidKey(env);
  const ids = Object.keys(subs).filter(id => !onlyName || subs[id].name === onlyName);
  const result = { total: ids.length, sent: 0, failed: 0, removed: 0 };
  await Promise.all(ids.map(async id => {
    const rec = subs[id];
    try {
      const res = await fetch(rec.endpoint, {
        method: 'POST',
        headers: { Authorization: await vapidAuth(env, key, rec.endpoint), TTL: '43200', Urgency: 'high' }
      });
      if (res.status === 404 || res.status === 410) { delete subs[id]; result.removed++; }
      else if (res.ok) result.sent++;
      else result.failed++;
    } catch (e) { result.failed++; }
  }));
  if (result.removed) await saveSubs(env, subs);
  return result;
}

async function handleSubscribe(env, req) {
  let b;
  try { b = await req.json(); } catch (e) { return json(env, { ok: false, error: 'bad json' }, 400); }
  const name = b && b.name;
  const ep = b && b.subscription && b.subscription.endpoint;
  if (ALLOWED_NAMES.indexOf(name) < 0) return json(env, { ok: false, error: 'unknown user' }, 400);
  if (!validEndpoint(ep)) return json(env, { ok: false, error: 'bad endpoint' }, 400);
  const subs = await loadSubs(env);
  const id = await hashEndpoint(ep);
  subs[id] = { name: name, endpoint: ep, ts: Date.now() };
  // จำกัดจำนวนเครื่องต่อคน (ลบเครื่องเก่าสุดก่อน)
  const mine = Object.keys(subs).filter(k => subs[k].name === name).sort((a, c) => subs[a].ts - subs[c].ts);
  while (mine.length > MAX_DEVICES_PER_NAME) delete subs[mine.shift()];
  await saveSubs(env, subs);
  return json(env, { ok: true });
}

async function handleUnsubscribe(env, req) {
  let b;
  try { b = await req.json(); } catch (e) { return json(env, { ok: false, error: 'bad json' }, 400); }
  if (!b || typeof b.endpoint !== 'string') return json(env, { ok: false, error: 'bad endpoint' }, 400);
  const subs = await loadSubs(env);
  delete subs[await hashEndpoint(b.endpoint)];
  await saveSubs(env, subs);
  return json(env, { ok: true });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env) });
    if (req.method === 'POST' && url.pathname === '/subscribe') return handleSubscribe(env, req);
    if (req.method === 'POST' && url.pathname === '/unsubscribe') return handleUnsubscribe(env, req);
    if (req.method === 'GET' && url.pathname === '/send-test') {
      if (!env.ADMIN_TOKEN || url.searchParams.get('token') !== env.ADMIN_TOKEN) return json(env, { ok: false, error: 'forbidden' }, 403);
      return json(env, { ok: true, result: await sendAll(env, url.searchParams.get('name') || '') });
    }
    return json(env, { ok: true, service: 'weekly-report-push' });
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendAll(env, ''));
  }
};
