/* ---------- hotpepper: グルメサーチAPI (JSONP) and mapping a result to a shop ---------- */
const HP_URL = 'https://webservice.recruit.co.jp/hotpepper/gourmet/v1/';
const hpOn = () => !!window.HOTPEPPER_KEY;
// The API answers JSONP, which works from a static page without a server. params: keyword or lat/lng/range
function hpSearch(params){
  return new Promise((res,rej)=>{
    const cb='nmhp'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
    const s=document.createElement('script');
    const done=()=>{ clearTimeout(t); delete window[cb]; s.remove(); };
    const t=setTimeout(()=>{ done(); rej(new Error('timeout')); },10000);
    window[cb]=d=>{ done(); const r=d&&d.results; if(!r) return rej(new Error('bad')); if(r.error) return rej(Object.assign(new Error((r.error[0]||{}).message||'api'),{code:'api'})); res(Array.isArray(r.shop)?r.shop:[]); };
    const q=new URLSearchParams({key:window.HOTPEPPER_KEY, format:'jsonp', callback:cb, count:'12', ...params});
    s.src=HP_URL+'?'+q; s.onerror=()=>{ done(); rej(new Error('network')); };
    document.head.appendChild(s);
  });
}
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
  if (h.midnight==='営業している') t.late=true;
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
