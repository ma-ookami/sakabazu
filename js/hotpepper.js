/* ---------- hotpepper: グルメサーチAPI through our Cloudflare Worker, and mapping a result to a shop ---------- */
// The API key lives in the Worker (worker/hotpepper-proxy.js), never in this page. -> {shops,total,v}
// v: the Worker's version. v1 only knows keyword/lat/lng; v2 also knows area codes, name_any, id and resolve
const hpOn = () => !!window.HOTPEPPER_PROXY;
// where the search looks. kw: added to the keyword / sa: ホットペッパーの小エリア code (at: fallback point for an old Worker) / here: current location
// city: which big area it belongs to (札幌 / 東京). center: the middle of the city (for searches around a point)
const HP_CITIES = [{id:'sapporo', label:'札幌'}, {id:'tokyo', label:'東京'}];
const HP_AREAS = [
  {id:'sapporo', label:'札幌', city:'sapporo', kw:'札幌市', center:{lat:43.0607, lng:141.3545}},
  {id:'eki', label:'札幌駅', city:'sapporo', sa:'X501', at:{lat:43.0686, lng:141.3508}},
  {id:'odori', label:'大通', city:'sapporo', sa:'X502', at:{lat:43.0607, lng:141.3545}},
  {id:'susukino', label:'すすきの', city:'sapporo', sa:'X500', at:{lat:43.0556, lng:141.3536}},
  {id:'kotoni', label:'琴似', city:'sapporo', sa:'X510', at:{lat:43.0817, lng:141.3065}},
  {id:'maruyama', label:'円山', city:'sapporo', sa:'XIIC', at:{lat:43.0553, lng:141.3175}},
  {id:'shinsapporo', label:'新札幌', city:'sapporo', sa:'X508', at:{lat:43.0393, lng:141.4766}},
  {id:'asabu', label:'麻生', city:'sapporo', sa:'XII6', at:{lat:43.1069, lng:141.3384}},
  {id:'tokyo', label:'東京', city:'tokyo', kw:'東京都', center:{lat:35.6812, lng:139.7671}},
  {id:'shinjuku', label:'新宿', city:'tokyo', at:{lat:35.6909, lng:139.7003}},
  {id:'shibuya', label:'渋谷', city:'tokyo', at:{lat:35.6580, lng:139.7016}},
  {id:'ikebukuro', label:'池袋', city:'tokyo', at:{lat:35.7295, lng:139.7109}},
  {id:'shimbashi', label:'新橋', city:'tokyo', at:{lat:35.6662, lng:139.7583}},
  {id:'ginza', label:'銀座・有楽町', city:'tokyo', at:{lat:35.6717, lng:139.7650}},
  {id:'tokyoeki', label:'東京駅', city:'tokyo', at:{lat:35.6812, lng:139.7671}},
  {id:'kanda', label:'神田', city:'tokyo', at:{lat:35.6918, lng:139.7709}},
  {id:'ueno', label:'上野', city:'tokyo', at:{lat:35.7138, lng:139.7773}},
  {id:'asakusa', label:'浅草', city:'tokyo', at:{lat:35.7119, lng:139.7983}},
  {id:'ebisu', label:'恵比寿', city:'tokyo', at:{lat:35.6467, lng:139.7101}},
  {id:'roppongi', label:'六本木', city:'tokyo', at:{lat:35.6628, lng:139.7314}},
  {id:'shinagawa', label:'品川', city:'tokyo', at:{lat:35.6285, lng:139.7388}},
  {id:'nakano', label:'中野', city:'tokyo', at:{lat:35.7056, lng:139.6657}},
  {id:'kichijoji', label:'吉祥寺', city:'tokyo', at:{lat:35.7031, lng:139.5797}},
  {id:'akabane', label:'赤羽', city:'tokyo', at:{lat:35.7779, lng:139.7209}},
  {id:'kitasenju', label:'北千住', city:'tokyo', at:{lat:35.7497, lng:139.8049}},
  {id:'here', label:'現在地', here:true},
  {id:'any', label:'指定なし'},
];
let hpArea_ = (()=>{ try{ return localStorage.getItem('nm-hparea')||'sapporo'; }catch{ return 'sapporo'; } })();
const hpAreaOf = () => HP_AREAS.find(a=>a.id===hpArea_) || HP_AREAS[0];
function setHpArea(id){ hpArea_=id; try{ localStorage.setItem('nm-hparea',id); }catch{} const c=(HP_AREAS.find(x=>x.id===id)||{}).city; if (c) setCity(c); }
// the big area being looked at (札幌 / 東京), and its middle
let city_ = (()=>{ try{ return localStorage.getItem('nm-city')||''; }catch{ return ''; } })() || (HP_AREAS.find(a=>a.id===hpArea_)||{}).city || 'sapporo';
function setCity(c){ city_=c; try{ localStorage.setItem('nm-city',c); }catch{} }
const curCity = () => city_;
const cityCenter = () => (HP_AREAS.find(a=>a.city===city_ && a.center)||HP_AREAS[0]).center;
let hpVer = 0;   // learned from the first answer
async function hpCall(params){
  const q=new URLSearchParams(params);
  const ctl=new AbortController(), t=setTimeout(()=>ctl.abort(),10000);
  let r; try{ r=await fetch(window.HOTPEPPER_PROXY.replace(/\/?$/,'/')+'?'+q,{signal:ctl.signal}); }finally{ clearTimeout(t); }
  if (!r.ok) throw Object.assign(new Error('proxy '+r.status),{code: r.status===403||r.status===500 ? 'api' : r.status===400 ? 'old' : r.status===501 ? 'nogkey' : 'net'});
  const d=await r.json(); hpVer = (d && d._v) || 1; return d;
}
async function hpSearch(params){
  const d=await hpCall({count:'12', ...params}), res=d&&d.results;
  if (!res) throw new Error('bad');
  if (res.error) throw Object.assign(new Error((res.error[0]||{}).message||'api'),{code:'api'});
  return {shops:Array.isArray(res.shop)?res.shop:[], total:+res.results_available||0, v:hpVer};
}
// a short Google Maps link (maps.app.goo.gl) -> the long one, through the Worker. '' when it can't
async function hpResolve(u){ try{ const d=await hpCall({resolve:u}); return (d&&d.url)||''; }catch{ return ''; } }
const hpPhoto = h => (h.photo && h.photo.pc && (h.photo.pc.m || h.photo.pc.s)) || '';
const hpBudget = h => (h.budget && (h.budget.average || h.budget.name)) || '';
const hpArea = h => h.station_name ? h.station_name.replace(/駅$/,'')+'駅' : ((h.small_area&&h.small_area.name) || '');
// "月～金、祝前日: 17:00～翌0:00 （料理L.O. 23:00）" -> first open/close pair. 翌 needs nothing: close < open means past midnight
function hpHours(h){
  const out={open:'',close:'',closed:[],note:''};
  const m=/(\d{1,2}):(\d{2})\s*[～〜~-]\s*(?:翌)?(\d{1,2}):(\d{2})/.exec(h.open||'');
  if (m){ const pad=(a,b)=>`${String(+a%24).padStart(2,'0')}:${b}`; out.open=pad(m[1],m[2]); out.close=pad(m[3],m[4]); }
  const days=new Set(); for (const x of (h.close||'').matchAll(/([日月火水木金土])曜/g)) days.add('日月火水木金土'.indexOf(x[1]));
  out.closed=[...days].sort();
  out.note=[(h.open||'').replace(/\s+/g,' ').trim(), h.close?`定休日: ${h.close}`:''].filter(Boolean).join(' / ').slice(0,60);
  return out;
}
function hpTags(h){
  const t={};
  if (/^あり/.test(h.private_room||'')) t.private=true;
  if (h.non_smoking==='全面禁煙') t.nosmoke=true;
  if (h.non_smoking==='禁煙席なし') t.smoke=true;
  if (h.card==='利用可') t.card=true;
  if (+h.capacity>=40) t.group=true;
  return t;
}
// everything we can fill in for a shop from one result
function hpShopExtra(h){
  const extra={hp:{id:h.id, genre:(h.genre&&h.genre.name)||'', budget:hpBudget(h), photo:hpPhoto(h)}};
  if (h.lat && h.lng) extra.loc={lat:+h.lat, lng:+h.lng, src:'hp'};
  if (h.urls && h.urls.pc) extra.links=[h.urls.pc];
  const hours=hpHours(h); if (hours.open || hours.closed.length || hours.note) extra.hours=hours;
  const tags=hpTags(h); if (Object.keys(tags).length) extra.tags=tags;
  return extra;
}
