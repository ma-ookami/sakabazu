// 酒場図 のホットペッパー検索の中継(Cloudflare Workers に貼り付けて使う)。
// - APIキーは Worker の「シークレット」HOTPEPPER_KEY に保存し、ページには載せない
// - 呼べるのは ALLOWED に書いたページからだけ(ブラウザの Origin で判断)
// - 渡すのは検索に使う項目だけ。結果は10分キャッシュして、APIの呼び出し回数を減らす
// - ?resolve=<Googleマップの短縮URL> は、転送先の長いURLを返す(店名と位置を読み取るため)
const VERSION = 2;
const ALLOWED = [
  'https://ma-ookami.github.io',
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
];
const PARAMS = ['keyword', 'name_any', 'id', 'lat', 'lng', 'range', 'order', 'count', 'start',
  'large_area', 'middle_area', 'small_area',
  'budget', 'genre', 'free_drink', 'free_food', 'private_room', 'non_smoking', 'midnight', 'card'];
const API = 'https://webservice.recruit.co.jp/hotpepper/gourmet/v1/';
const SHORT = /^https:\/\/(maps\.app\.goo\.gl\/|goo\.gl\/maps\/)[A-Za-z0-9_-]+$/;

const allowed = o => !!o && ALLOWED.some(a => typeof a === 'string' ? a === o : a.test(o));
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
    if (/^https:\/\/(www\.)?google\.[a-z.]+\/maps\//.test(u)) return u;
  }
  return u;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    if (!allowed(origin)) return reply({ error: 'forbidden' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
      'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET', 'access-control-max-age': '86400', 'vary': 'Origin' } });
    if (request.method !== 'GET') return reply({ error: 'method' }, 405, origin);

    const inq = new URL(request.url).searchParams;
    const short = inq.get('resolve');
    if (short) {
      if (!SHORT.test(short)) return reply({ error: 'not a short map link', _v: VERSION }, 400, origin);
      try { return reply({ url: await resolve(short), _v: VERSION }, 200, origin); }
      catch { return reply({ error: 'resolve failed', _v: VERSION }, 502, origin); }
    }

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
