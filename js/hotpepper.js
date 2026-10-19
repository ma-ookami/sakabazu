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
// what we keep of a ホットペッパー shop: its id and place only (the API terms: no copies in a database,
// caches refreshed within 24h). genre, budget, photo and hours are fetched live (hpLive) and kept 24h on this device
function hpShopExtra(h){
  hpLiveSet(h);
  const extra={hp:{id:h.id}};
  if (h.lat && h.lng) extra.loc={lat:+h.lat, lng:+h.lng, src:'hp'};
  return extra;
}
// ---------- live details of ホットペッパー shops: id -> {at, genre, budget, photo, hours} (this device, 24h) ----------
const HP_TTL=24*36e5;
let hpLive=(()=>{ try{ const o=JSON.parse(localStorage.getItem('nm-hplive')||'{}'); return o&&typeof o==='object'?o:{}; }catch{ return {}; } })();
const hpLiveSave=()=>{ try{ const now=Date.now(); for (const k in hpLive) if (now-hpLive[k].at>HP_TTL*2) delete hpLive[k]; localStorage.setItem('nm-hplive',JSON.stringify(hpLive)); }catch{} };
function hpLiveSet(h){ if(!h||!/^J\d{9}$/.test(h.id||'')) return;
  const hours=hpHours(h);
  hpLive[h.id]={at:Date.now(), name:h.name||'', genre:(h.genre&&h.genre.name)||'', budget:hpBudget(h), photo:hpPhoto(h), hours:(hours.open||hours.closed.length||hours.note)?hours:null};
  hpLiveSave(); }
const hpLiveOf = id => { const v=hpLive[id]; return v && Date.now()-v.at<HP_TTL ? v : null; };
// show the live details on the shops (only where the shop has no value of its own)
function hpOverlay(list){
  for (const s of list){ const id=s.hp&&s.hp.id; if(!id) continue; const v=hpLive[id]; if(!v) continue;
    s.hp={...s.hp}; if (!s.hp.genre && v.genre){ s.hp.genre=v.genre; s._ovGenre=true; } if (v.budget) s.hp.budget=v.budget; if (v.photo) s.hp.photo=v.photo;
    if (!s.hours && v.hours){ s.hours=v.hours; s._ovHours=true; } }
}
// fetch what's missing or older than 24h (9 ids per call: the Worker keeps 100 characters of a parameter)
let hpBusy=false, hpTimer=null;
function hpRefresh(){ clearTimeout(hpTimer); hpTimer=setTimeout(hpFetchStale,400); }
async function hpFetchStale(){
  if (hpBusy || !hpOn()) return;
  const ids=[...new Set(shops.concat(myShops).map(s=>s.hp&&s.hp.id).filter(id=>id && /^J\d{9}$/.test(id) && !hpLiveOf(id)))].slice(0,90);
  if (!ids.length) return;
  hpBusy=true; let got=false;
  try{
    for (let i=0;i<ids.length;i+=9){ const part=ids.slice(i,i+9);
      const r=await hpSearch({id:part.join(','), count:'20'}).catch(()=>null);
      const seen=new Set(); for (const h of (r&&r.shops)||[]){ hpLiveSet(h); seen.add(h.id); got=true; }
      for (const id of part) if (!seen.has(id) && r) hpLive[id]={at:Date.now(), gone:true};   // not on ホットペッパー any more
    }
    hpLiveSave();
  } finally { hpBusy=false; }
  if (got){ hpTidy(); afterChange(); }
}
// shops saved before: drop the ホットペッパー copies (kept only if the user changed them). once per shop
function hpTidy(){
  if (readOnly || !me) return;
  let done={}; try{ done=JSON.parse(localStorage.getItem('nm-hptidy')||'{}'); }catch{}
  for (const s of myShops){ const id=s.hp&&s.hp.id; const v=id&&hpLiveOf(id); if(!v || v.gone || done[s.id]) continue;
    const raw=s; const p={}, hp={};
    if (raw.hp.budget!==undefined) hp.budget=null; if (raw.hp.photo!==undefined) hp.photo=null;
    if (raw.hp.genre && !raw._ovGenre && raw.hp.genre===v.genre) hp.genre=null;
    if (Object.keys(hp).length) p.hp=hp;
    if (raw.hours && !raw._ovHours && v.hours && JSON.stringify(raw.hours)===JSON.stringify(v.hours)) p.hours=null;
    if (Array.isArray(raw.links) && raw.links.some(u=>/hotpepper\.jp\/str/.test(u))) p.links=raw.links.filter(u=>!/hotpepper\.jp\/str/.test(u));
    if (Object.keys(p).length) patchShop(s.id,p);
    done[s.id]=1;
  }
  try{ localStorage.setItem('nm-hptidy',JSON.stringify(done)); }catch{}
}
