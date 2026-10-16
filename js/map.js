/* ---------- map: MapLibre with OpenFreeMap's plain style (free, no key), Japanese labels only, our shops as pins ----------
   the library is loaded the first time the map tab opens. one map instance lives on; render() just re-attaches it */
const mapV={fit:true,show:{went:true,want:true},sel:null,here:null};
const SAPPORO={lat:43.0607,lng:141.3545};
const located=()=>shops.filter(s=>s.loc&&Number.isFinite(s.loc.lat)&&Number.isFinite(s.loc.lng)&&statusOf(s));
const mapVisible=()=>located().filter(s=>mapV.show[statusOf(s)]);
function mapsUrl(s){ const q=s.loc?`${s.loc.lat},${s.loc.lng}`:[s.name,s.area].filter(Boolean).join(' '); return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q); }

const ML='https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl';
const MAP_STYLE='https://tiles.openfreemap.org/styles/positron';
let mlMap=null, mlBox=null, mlHere=null;
const mlMarkers=new Map();
function loadMapLib(){
  if (window.maplibregl) return Promise.resolve();
  if (!loadMapLib.p) loadMapLib.p=new Promise((ok,ng)=>{
    const l=document.createElement('link'); l.rel='stylesheet'; l.href=ML+'.css'; document.head.appendChild(l);
    const s=document.createElement('script'); s.src=ML+'.js'; s.onload=ok; s.onerror=()=>{ loadMapLib.p=null; ng(); }; document.head.appendChild(s);
  });
  return loadMapLib.p;
}
// plain like Google Maps: Japanese names only; no shop/facility icons (our pins are the shops), no road number signs,
// no small district names. stations stay (they help to find the way)
function tidyStyle(m){
  for (const l of m.getStyle().layers){
    if (l.type!=='symbol') continue;
    const sl=l['source-layer']||'', id=l.id;
    const hide = (sl==='poi' && !/station|transit|rail/.test(id)) || /shield/.test(id) || sl==='housenumber'
      || (sl==='place' && /neighbourhood|quarter|suburb|hamlet|other/.test(id));
    if (hide){ m.setLayoutProperty(id,'visibility','none'); continue; }
    if (m.getLayoutProperty(id,'text-field')) m.setLayoutProperty(id,'text-field',['coalesce',['get','name:ja'],['get','name']]);
  }
}
function ensureMap(){
  if (mlMap) return;
  mlMap=new maplibregl.Map({container:mlBox, style:MAP_STYLE, center:[SAPPORO.lng,SAPPORO.lat], zoom:13.5,
    attributionControl:false, dragRotate:false, pitchWithRotate:false, touchPitch:false, cooperativeGestures:false});
  mlMap.touchZoomRotate.disableRotation();
  mlMap.on('load',()=>tidyStyle(mlMap));
  mlMap.on('click',()=>{ if(mapV.sel){ mapV.sel=null; syncPins(); renderMapInfo(); } });
  mlMap.on('dragstart',()=>{ mapV.fit=false; });
}

function renderMap(v){
  const all=located();
  const lg=el('div','chips'); lg.style.marginTop='18px';
  for (const [k,l] of [['went','行った'],['want','行きたい']]){ const n=all.filter(s=>statusOf(s)===k).length; const b=el('button','chip',`${l} ${n}`); b.setAttribute('aria-pressed',String(mapV.show[k])); b.onclick=()=>{ mapV.show[k]=!mapV.show[k]; render(); }; lg.appendChild(b); }
  v.appendChild(lg);
  const wrap=el('div','mapwrap');
  if (!mlBox) mlBox=el('div','mlmap');
  wrap.appendChild(mlBox);
  const ctl=el('div','mapctl');
  const zb=(t,lab,fn,cls)=>{ const b=el('button',cls||'',t); b.setAttribute('aria-label',lab); b.onclick=fn; ctl.appendChild(b); };
  zb('＋','拡大',()=>mlMap&&mlMap.zoomIn());
  zb('−','縮小',()=>mlMap&&mlMap.zoomOut());
  zb('全体','記録した店が全部見えるように',()=>{ mapV.fit=true; fitMap(); },'wide');
  zb('現在地','現在地を表示',showHere,'wide');
  wrap.appendChild(ctl);
  if (!all.length) wrap.appendChild(el('div','mapempty','まだ位置を記録した店がありません。店の詳細の「場所」から記録できます。'));
  const at=el('a','mapattr','© OpenFreeMap © OpenStreetMap'); at.href='https://www.openstreetmap.org/copyright'; at.target='_blank'; at.rel='noopener noreferrer'; wrap.appendChild(at);
  v.appendChild(wrap);
  const info=el('div'); info.id='mapInfo'; v.appendChild(info);
  const un=shops.filter(s=>inWent(s)&&!s.loc);
  if (un.length){ const u=el('div','unloc'); u.appendChild(el('p','hint',`位置が未登録の行った店(${un.length}軒)`)); const c=el('div','chips'); un.forEach(s=>{ const b=el('button','chip',s.name||'(名前なし)'); b.onclick=()=>openDetail(s.id); c.appendChild(b); }); u.appendChild(c); v.appendChild(u); }
  renderMapInfo();
  loadMapLib().then(()=>{
    ensureMap();
    requestAnimationFrame(()=>{ if(!mlMap) return; mlMap.resize(); syncPins(); if(mapV.fit) fitMap(); });
  }).catch(()=>{ wrap.appendChild(el('div','mapempty','地図を読み込めませんでした。通信状態を確認して、開き直してください。')); });
}

// a teardrop pin per shop (red = went, white with a red ring = want); the name sits to its right
const PIN_SVG='<svg viewBox="-12 -33 24 35" aria-hidden="true"><ellipse class="pm-sh" cx="0" cy="0" rx="5" ry="2"/><path class="pm-b" d="M0 0C-3 -7 -10 -11 -10 -20A10 10 0 1 1 10 -20C10 -11 3 -7 0 0Z"/><circle class="pm-d" cx="0" cy="-20" r="3.8"/></svg>';
function syncPins(){
  if (!mlMap) return;
  const vis=mapVisible(), ids=new Set(vis.map(s=>s.id)), many=vis.length>30;
  for (const [id,m] of mlMarkers) if (!ids.has(id)){ m.remove(); mlMarkers.delete(id); }
  for (const s of vis){
    let m=mlMarkers.get(s.id);
    if (!m){
      const e=el('button','pinm'); e.type='button'; e.innerHTML=PIN_SVG; e.appendChild(el('span','pl'));
      e.onclick=ev=>{ ev.stopPropagation(); mapV.sel=s.id; syncPins(); renderMapInfo(); };
      m=new maplibregl.Marker({element:e, anchor:'bottom'}).setLngLat([s.loc.lng,s.loc.lat]).addTo(mlMap); mlMarkers.set(s.id,m);
    } else m.setLngLat([s.loc.lng,s.loc.lat]);
    const e=m.getElement(), went=statusOf(s)==='went', sel=s.id===mapV.sel;
    e.classList.toggle('went',went); e.classList.toggle('sel',sel); e.classList.toggle('nolabel',many && !sel);
    e.querySelector('.pl').textContent=s.name||''; e.setAttribute('aria-label',`${s.name||''}(${went?'行った':'行きたい'})`);
    e.style.zIndex = sel ? 3 : went ? 2 : 1;
  }
  if (mapV.here){
    if (!mlHere){ const h=el('div','herem'); mlHere=new maplibregl.Marker({element:h}).setLngLat([mapV.here.lng,mapV.here.lat]).addTo(mlMap); }
    else mlHere.setLngLat([mapV.here.lng,mapV.here.lat]);
  }
}
function fitMap(){
  if (!mlMap) return;
  const vis=mapVisible(), pts=vis.length?vis:located();
  if (!pts.length){ mlMap.jumpTo({center:[SAPPORO.lng,SAPPORO.lat], zoom:13.5}); return; }
  if (pts.length===1){ mlMap.jumpTo({center:[pts[0].loc.lng,pts[0].loc.lat], zoom:16}); return; }
  const b=new maplibregl.LngLatBounds(); for (const s of pts) b.extend([s.loc.lng,s.loc.lat]);
  mlMap.fitBounds(b,{padding:{top:70,bottom:50,left:50,right:90}, maxZoom:16, duration:0});
}
function scheduleMap(){ if (mlMap) mlMap.resize(); }

function renderMapInfo(){
  const box=$('mapInfo'); if(!box) return; box.textContent='';
  const s=shops.find(x=>x.id===mapV.sel && x.loc); if(!s) return;
  const c=el('article','mapcard'); const row=el('div','row'); const left=el('div');
  left.appendChild(el('h3','name',s.name||'(名前なし)')); if(s.area) left.appendChild(el('div','area',s.area));
  row.appendChild(left); row.appendChild(el('span','st',statusOf(s)==='went'?'行った':'行きたい')); c.appendChild(row);
  if (statusOf(s)==='went'){ const mk=el('div','marks'); for(const it of ITEMS){ const m=avgMark(avg(s,it.k)); if(!m) continue; const sp=el('span',null,it.short); sp.appendChild(el('b',m==='◎'?'top':'',m)); mk.appendChild(sp); } if(mk.children.length) c.appendChild(mk); }
  const tl=tagLine(s); if(tl) c.appendChild(tl);
  const acts=el('div','acts'); const d=el('button','btn btn-ink','詳細を見る'); d.onclick=()=>openDetail(s.id);
  const a=el('a','btn btn-line','地図で開く'); a.href=mapsUrl(s); a.target='_blank'; a.rel='noopener noreferrer';
  acts.append(d,a); c.appendChild(acts); box.appendChild(c);
}
function getHere(ok){
  if (!navigator.geolocation){ toast('この環境では位置情報を使えません。GoogleマップのURLを貼る方法を使ってください'); ok(null); return; }
  navigator.geolocation.getCurrentPosition(p=>ok({lat:p.coords.latitude,lng:p.coords.longitude,acc:Math.round(p.coords.accuracy||0)}),
    err=>{ toast(err&&err.code===1?'位置情報が許可されていません。GoogleマップのURLを貼る方法を使ってください':'現在地を取得できませんでした。GoogleマップのURLを貼る方法も使えます'); ok(null); },
    {enableHighAccuracy:true,timeout:12000,maximumAge:60000});
}
function showHere(){ getHere(h=>{ if(!h) return; mapV.here=h; mapV.fit=false; if(!mlMap) return; syncPins(); mlMap.flyTo({center:[h.lng,h.lat], zoom:16}); }); }
function parseMapUrl(u){
  u=(u||'').trim(); if(!u) return {err:'URLを貼ってください'};
  let s=u; try{ s=decodeURIComponent(u); }catch{}
  const num='(-?\\d{1,3}(?:\\.\\d+)?)';
  const pats=[new RegExp('!3d'+num+'!4d'+num), new RegExp('@'+num+','+num), new RegExp('[?&](?:q|query|ll|destination|center|daddr)='+num+',\\s*'+num,'i'), new RegExp('^'+num+'\\s*,\\s*'+num+'$')];
  for (const p of pats){ const m=s.match(p); if(m){ const lat=parseFloat(m[1]), lng=parseFloat(m[2]); if(Math.abs(lat)<=90 && Math.abs(lng)<=180) return {lat,lng}; } }
  if (/goo\.gl|maps\.app/i.test(u)) return {err:'短縮リンクからは位置を読み取れません。ブラウザでリンクを開き、アドレス欄の長いURLを貼ってください'};
  return {err:'このURLからは位置を読み取れませんでした。Googleマップでお店を表示したときのURLを貼ってください'};
}
function locSec(s){
  const box=sec('場所'); const t=el('p','loctxt'); t.id='dLocTxt'; box.appendChild(t);
  const row=el('div','locrow');
  if (!readOnly){ const g=el('button','btn btn-line','ここを記録'); g.onclick=()=>{ g.disabled=true; g.textContent='取得中…'; getHere(h=>{ g.disabled=false; g.textContent='ここを記録'; if(!h) return; patchShop(s.id,{loc:{lat:h.lat,lng:h.lng,src:'gps',acc:h.acc}}); toast(h.acc>200?'現在地を記録しました(誤差が大きめです)':'現在地を記録しました'); }); }; row.appendChild(g); }
  const a=el('a','btn btn-line','地図で開く'); a.id='dMapLink'; a.target='_blank'; a.rel='noopener noreferrer'; row.appendChild(a);
  box.appendChild(row);
  if (!readOnly){
    const f=el('form','quick'); f.style.margin='10px 0 0'; f.noValidate=true;
    const i=el('input','field'); i.placeholder='GoogleマップのURLを貼る'; i.setAttribute('aria-label','GoogleマップのURL'); i.inputMode='url'; i.autocomplete='off';
    const b=el('button','btn btn-ink','取り込む'); b.type='submit'; f.append(i,b);
    f.onsubmit=e=>{ e.preventDefault(); const r=parseMapUrl(i.value); if(r.err){ toast(r.err); return; } patchShop(s.id,{loc:{lat:r.lat,lng:r.lng,src:'link'}}); i.value=''; i.blur(); toast('位置を取り込みました'); };
    box.appendChild(f);
    const clr=el('button','textbtn','記録した位置を消す'); clr.id='dLocClr'; clr.onclick=()=>{ patchShop(s.id,{loc:null}); toast('位置を消しました'); }; box.appendChild(clr);
  }
  return box;
}
