/* ---------- hotpepper: グルメサーチAPI through our Cloudflare Worker, and mapping a result to a shop ---------- */
// The API key lives in the Worker (worker/hotpepper-proxy.js), never in this page. -> {shops,total,v}
// v: the Worker's version. v1 only knows keyword/lat/lng; v2 also knows area codes, name_any, id and resolve
const hpOn = () => !!window.HOTPEPPER_PROXY;
// where the search looks. kw: added to the keyword / sa: ホットペッパーの小エリア code (at: fallback point for an old Worker) / here: current location
const HP_AREAS = [
  {id:'sapporo', label:'札幌', kw:'札幌市'},
  {id:'eki', label:'札幌駅', sa:'X501', at:{lat:43.0686, lng:141.3508}},
  {id:'odori', label:'大通', sa:'X502', at:{lat:43.0607, lng:141.3545}},
  {id:'susukino', label:'すすきの', sa:'X500', at:{lat:43.0556, lng:141.3536}},
  {id:'kotoni', label:'琴似', sa:'X510', at:{lat:43.0817, lng:141.3065}},
  {id:'maruyama', label:'円山', sa:'XIIC', at:{lat:43.0553, lng:141.3175}},
  {id:'shinsapporo', label:'新札幌', sa:'X508', at:{lat:43.0393, lng:141.4766}},
  {id:'asabu', label:'麻生', sa:'XII6', at:{lat:43.1069, lng:141.3384}},
  {id:'here', label:'現在地', here:true},
  {id:'any', label:'指定なし'},
];
let hpArea_ = (()=>{ try{ return localStorage.getItem('nm-hparea')||'sapporo'; }catch{ return 'sapporo'; } })();
const hpAreaOf = () => HP_AREAS.find(a=>a.id===hpArea_) || HP_AREAS[0];
function setHpArea(id){ hpArea_=id; try{ localStorage.setItem('nm-hparea',id); }catch{} }
let hpVer = 0;   // learned from the first answer
async function hpCall(params){
  const q=new URLSearchParams(params);
  const ctl=new AbortController(), t=setTimeout(()=>ctl.abort(),10000);
  let r; try{ r=await fetch(window.HOTPEPPER_PROXY.replace(/\/?$/,'/')+'?'+q,{signal:ctl.signal}); }finally{ clearTimeout(t); }
  if (!r.ok) throw Object.assign(new Error('proxy '+r.status),{code: r.status===403||r.status===500 ? 'api' : r.status===400 ? 'old' : 'net'});
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
