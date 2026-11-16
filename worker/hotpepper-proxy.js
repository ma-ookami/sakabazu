// 酒場図 のホットペッパー検索の中継(Cloudflare Workers に貼り付けて使う)。
// - APIキーは Worker の「シークレット」HOTPEPPER_KEY に保存し、ページには載せない
// - ブラウザから呼べるのは ALLOWED に書いたページからだけ(Origin で判断。Origin は偽れるので、本当の確認はトークンで)
// - 渡すのは検索に使う項目だけ。結果は10分キャッシュして、APIの呼び出し回数を減らす
// - ?resolve=<Googleマップ / Google検索の共有URL> は、転送先の長いURLを返す(店名と位置を読み取るため)
// - ?gq=<検索語> は Google のお店検索(Places API)。キーは Worker のシークレット GOOGLE_PLACES_KEY
// - 利用者の確認: アプリと Web 版は Firebase のログイン(ID トークン)を Authorization: Bearer で送る。
//   ここで Google の公開鍵で署名を確かめ、プロジェクト sakabazu のログインだけを通す。
//   変数 REQUIRE_TOKEN を "1" にすると、トークンのない呼び出しを断る(アプリと Web 版を更新してから "1" にする)
// - 1人あたりの回数の上限(1時間): ホットペッパー 300 回、Google 検索 60 回。超えたら 429
const VERSION = 5;
const PROJECT = 'sakabazu';
const LIMIT = { hp: 300, google: 60 };
const ALLOWED = [
  'https://ma-ookami.github.io',
  'https://sakabazu.rokunanabox.com',
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
];
const PARAMS = ['keyword', 'name_any', 'id', 'lat', 'lng', 'range', 'order', 'count', 'start',
  'large_area', 'middle_area', 'small_area',
  'budget', 'genre', 'free_drink', 'free_food', 'private_room', 'non_smoking', 'midnight', 'card'];
const API = 'https://webservice.recruit.co.jp/hotpepper/gourmet/v1/';
const SHORT = /^https:\/\/(maps\.app\.goo\.gl\/|goo\.gl\/maps\/|g\.co\/kgs\/|share\.google\/)[A-Za-z0-9_-]+$/;

const allowed = o => !!o && ALLOWED.some(a => typeof a === 'string' ? a === o : a.test(o));

// ---- Firebase の ID トークンを確かめる(RS256。鍵は Google の公開鍵、1時間キャッシュ) ----
const b64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const jsonOf = s => JSON.parse(new TextDecoder().decode(b64u(s)));
async function googleKeys() {
  const url = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
  const cache = caches.default, key = new Request(url);
  let r = await cache.match(key);
  if (!r) { r = await fetch(url); if (!r.ok) return []; const body = await r.text(); await cache.put(key, new Response(body, { headers: { 'cache-control': 'max-age=3600' } })); r = new Response(body); }
  return ((await r.json()).keys) || [];
}
// 通れば uid、だめなら ''
async function verifyToken(token) {
  try {
    const [h, p, sig] = token.split('.'); if (!h || !p || !sig) return '';
    const head = jsonOf(h), body = jsonOf(p), now = Math.floor(Date.now() / 1000);
    if (head.alg !== 'RS256') return '';
    if (body.aud !== PROJECT || body.iss !== 'https://securetoken.google.com/' + PROJECT) return '';
    if (!(body.exp > now) || !(body.iat <= now + 60) || !body.sub) return '';
    const jwk = (await googleKeys()).find(k => k.kid === head.kid); if (!jwk) return '';
    const k = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', k, b64u(sig), new TextEncoder().encode(h + '.' + p));
    return ok ? String(body.sub) : '';
  } catch { return ''; }
}
// 1人あたりの回数(1時間ごと)。キャッシュで数えるだけの目安(厳密ではない)
async function overLimit(uid, kind) {
  const hour = Math.floor(Date.now() / 3600000), key = new Request(`https://limit.sakabazu/${kind}/${uid}/${hour}`);
  const cache = caches.default, hit = await cache.match(key), n = hit ? +(await hit.text()) || 0 : 0;
  if (n >= LIMIT[kind]) return true;
  await cache.put(key, new Response(String(n + 1), { headers: { 'cache-control': 'max-age=3700' } }));
  return false;
}
const reply = (body, status, origin) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    ...(origin ? { 'access-control-allow-origin': origin, 'vary': 'Origin' } : {}),
  },
});

// follow the short link's redirects (at most 5) without loading the map page itself
async function resolve(u) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(u, { redirect: 'manual' });
    const loc = r.headers.get('location');
    if (!loc) return u;
    u = new URL(loc, u).toString();
    if (/^https:\/\/consent\.google\./.test(u)) { const c = new URL(u).searchParams.get('continue'); if (c) return c; }
    if (/^https:\/\/((www\.)?google\.[a-z.]+\/(maps|search)|maps\.google\.)/.test(u)) return u;
  }
  return u;
}

// Google: only the fields the app shows (each field decides the price tier). results are cached 10 minutes
const G_FIELDS = ['id', 'displayName', 'shortFormattedAddress', 'formattedAddress', 'location', 'rating', 'userRatingCount',
  'priceLevel', 'googleMapsUri', 'primaryTypeDisplayName', 'regularOpeningHours'].map(f => 'places.' + f).join(',') + ',nextPageToken';
async function google(env, inq, gq) {
  const body = { textQuery: gq.slice(0, 120), languageCode: 'ja', regionCode: 'JP', pageSize: 20 };
  const lat = +inq.get('lat'), lng = +inq.get('lng'), r = Math.min(50000, Math.max(200, +inq.get('r') || 1000));
  if (Number.isFinite(lat) && Number.isFinite(lng) && inq.get('lat')) {
    if (inq.get('rect')) {   // only inside this box (the chosen area)
      const dLat = r / 111000, dLng = r / (111000 * Math.cos(lat * Math.PI / 180));
      body.locationRestriction = { rectangle: { low: { latitude: lat - dLat, longitude: lng - dLng }, high: { latitude: lat + dLat, longitude: lng + dLng } } };
    } else body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: r } };
  }
  const pt = inq.get('pt'); if (pt) body.pageToken = pt.slice(0, 1000);
  const key = new Request('https://cache.sakabazu/g?' + encodeURIComponent(JSON.stringify(body)));
  const cache = caches.default, hit = await cache.match(key);
  if (hit) return hit.json();
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': env.GOOGLE_PLACES_KEY, 'X-Goog-FieldMask': G_FIELDS },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: (data.error && data.error.message) || ('google ' + res.status) };
  const out = { places: data.places || [], next: data.nextPageToken || '' };
  await cache.put(key, new Response(JSON.stringify(out), { headers: { 'cache-control': 'max-age=600', 'content-type': 'application/json' } }));
  return out;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    // ブラウザからは、決めたページからだけ。Origin のない呼び出し(アプリ)はトークンで確かめる
    if (origin && !allowed(origin)) return reply({ error: 'forbidden' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
      'access-control-allow-origin': origin || '*', 'access-control-allow-methods': 'GET', 'access-control-allow-headers': 'authorization',
      'access-control-max-age': '86400', 'vary': 'Origin' } });
    if (request.method !== 'GET') return reply({ error: 'method' }, 405, origin);
    const auth = request.headers.get('Authorization') || '';
    const uid = auth.startsWith('Bearer ') ? await verifyToken(auth.slice(7)) : '';
    if (!uid && (env.REQUIRE_TOKEN === '1' || !origin)) return reply({ error: 'login required', _v: VERSION }, 401, origin);

    const inq = new URL(request.url).searchParams;
    const short = inq.get('resolve');
    if (short) {
      if (!SHORT.test(short)) return reply({ error: 'not a short map link', _v: VERSION }, 400, origin);
      try { return reply({ url: await resolve(short), _v: VERSION }, 200, origin); }
      catch { return reply({ error: 'resolve failed', _v: VERSION }, 502, origin); }
    }

    // Google Places (New) text search: ?gq=<words>[&lat&lng&r=<m>][&rect=1][&pt=<page token>]
    const gq = inq.get('gq');
    if (gq) {
      if (uid && await overLimit(uid, 'google')) return reply({ error: 'too many', _v: VERSION }, 429, origin);
      if (!env.GOOGLE_PLACES_KEY) return reply({ error: 'no google key', _v: VERSION }, 501, origin);
      return reply({ ...(await google(env, inq, gq)), _v: VERSION }, 200, origin);
    }

    if (uid && await overLimit(uid, 'hp')) return reply({ error: 'too many', _v: VERSION }, 429, origin);
    if (!env.HOTPEPPER_KEY) return reply({ error: 'no key' }, 500, origin);
    const q = new URLSearchParams();
    for (const k of PARAMS) { const v = inq.get(k); if (v) q.set(k, v.slice(0, 100)); }
    const where = ['keyword', 'name_any', 'id', 'large_area', 'middle_area', 'small_area'].some(k => q.get(k)) || (q.get('lat') && q.get('lng'));
    if (!where) return reply({ error: 'keyword, name_any, id, area or lat/lng' }, 400, origin);
    q.set('count', String(Math.min(20, Math.max(1, +q.get('count') || 12))));
    q.set('format', 'json');
    q.set('key', env.HOTPEPPER_KEY);

    const r = await fetch(API + '?' + q, { cf: { cacheTtl: 600, cacheEverything: true } });
    if (!r.ok) return reply({ error: 'upstream ' + r.status }, 502, origin);
    return reply({ ...(await r.json()), _v: VERSION }, 200, origin);
  },
};
