// 酒場図 のホットペッパー検索の中継(Cloudflare Workers に貼り付けて使う)。
// - APIキーは Worker の「シークレット」HOTPEPPER_KEY に保存し、ページには載せない
// - 呼べるのは ALLOWED に書いたページからだけ(ブラウザの Origin で判断)
// - 渡すのは検索に使う項目だけ。結果は10分キャッシュして、APIの呼び出し回数を減らす
const ALLOWED = [
  'https://ma-ookami.github.io',
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
];
const PARAMS = ['keyword', 'lat', 'lng', 'range', 'order', 'count', 'start'];
const API = 'https://webservice.recruit.co.jp/hotpepper/gourmet/v1/';

const allowed = o => !!o && ALLOWED.some(a => typeof a === 'string' ? a === o : a.test(o));
const reply = (body, status, origin) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    ...(origin ? { 'access-control-allow-origin': origin, 'vary': 'Origin' } : {}),
  },
});

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    if (!allowed(origin)) return reply({ error: 'forbidden' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
      'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET', 'access-control-max-age': '86400', 'vary': 'Origin' } });
    if (request.method !== 'GET') return reply({ error: 'method' }, 405, origin);
    if (!env.HOTPEPPER_KEY) return reply({ error: 'no key' }, 500, origin);

    const inq = new URL(request.url).searchParams, q = new URLSearchParams();
    for (const k of PARAMS) { const v = inq.get(k); if (v) q.set(k, v.slice(0, 100)); }
    if (!q.get('keyword') && !(q.get('lat') && q.get('lng'))) return reply({ error: 'keyword or lat/lng' }, 400, origin);
    q.set('count', String(Math.min(20, Math.max(1, +q.get('count') || 12))));
    q.set('format', 'json');
    q.set('key', env.HOTPEPPER_KEY);

    const r = await fetch(API + '?' + q, { cf: { cacheTtl: 600, cacheEverything: true } });
    if (!r.ok) return reply({ error: 'upstream ' + r.status }, 502, origin);
    return reply(await r.json(), 200, origin);
  },
};
