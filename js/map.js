/* ---------- map ---------- */
const SVGNS='http://www.w3.org/2000/svg';
const mapV={c:null,span:1000,fit:true,show:{went:true,want:true},sel:null,here:null,pins:[]};
let mapSvg=null, mapRaf=0;
const DEG_LAT=110540, degLng=lat=>111320*Math.cos(lat*Math.PI/180);
const located=()=>shops.filter(s=>s.loc&&Number.isFinite(s.loc.lat)&&Number.isFinite(s.loc.lng)&&statusOf(s));
const mapVisible=()=>located().filter(s=>mapV.show[statusOf(s)]);
const clampSpan=x=>Math.min(200000,Math.max(80,x));
function niceStep(m){ let r=10; for(const x of [10,20,50,100,200,500,1000,2000,5000,10000,20000,50000]) if(x<=m) r=x; return r; }
const fmtDist=m=>m>=1000?(m/1000)+'km':m+'m';
function mapsUrl(s){ const q=s.loc?`${s.loc.lat},${s.loc.lng}`:[s.name,s.area].filter(Boolean).join(' '); return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q); }
function svgEl(tag,attrs,cls){ const e=document.createElementNS(SVGNS,tag); for(const k in attrs) e.setAttribute(k,attrs[k]); if(cls) e.setAttribute('class',cls); return e; }
function fitMap(){
  const vis=mapVisible(); const pts=vis.length?vis:located(); if(!pts.length) return false;
  let a=Infinity,b=-Infinity,c=Infinity,d=-Infinity;
  for(const s of pts){ a=Math.min(a,s.loc.lat); b=Math.max(b,s.loc.lat); c=Math.min(c,s.loc.lng); d=Math.max(d,s.loc.lng); }
  const lat=(a+b)/2, lng=(c+d)/2; mapV.c={lat,lng};
  const r=mapSvg?mapSvg.getBoundingClientRect():{width:600,height:400}; const asp=(r.width||600)/(r.height||400);
  mapV.span=clampSpan(Math.max((d-c)*degLng(lat)*1.4,(b-a)*DEG_LAT*1.4*asp,500)); return true;
}
function renderMap(v){
  const all=located();
  const lg=el('div','chips'); lg.style.marginTop='18px';
  for (const [k,l] of [['went','行った'],['want','行きたい']]){ const n=all.filter(s=>statusOf(s)===k).length; const b=el('button','chip',`${l} ${n}`); b.setAttribute('aria-pressed',String(mapV.show[k])); b.onclick=()=>{ mapV.show[k]=!mapV.show[k]; render(); }; lg.appendChild(b); }
  v.appendChild(lg);
  const wrap=el('div','mapwrap');
  const svg=svgEl('svg',{role:'img','aria-label':'記録したお店の地図'},'map'); wrap.appendChild(svg);
  wrap.appendChild(el('div','mapnorth','北 ↑'));
  const sc=el('div','mapscale'); sc.id='mapScale'; wrap.appendChild(sc);
  const ctl=el('div','mapctl');
  const zb=(t,lab,fn,cls)=>{ const b=el('button',cls||'',t); b.setAttribute('aria-label',lab); b.onclick=fn; ctl.appendChild(b); };
  zb('＋','拡大',()=>{ mapV.span=clampSpan(mapV.span/1.6); mapV.fit=false; drawMap(); });
  zb('−','縮小',()=>{ mapV.span=clampSpan(mapV.span*1.6); mapV.fit=false; drawMap(); });
  zb('全体','全体を表示',()=>{ mapV.fit=true; fitMap(); drawMap(); },'wide');
  zb('現在地','現在地を表示',showHere,'wide');
  wrap.appendChild(ctl);
  if (!all.length) wrap.appendChild(el('div','mapempty','まだ位置を記録した店がありません。店の詳細の「場所」から記録できます。'));
  const at=el('a','mapattr','地図: 国土地理院'); at.href='https://maps.gsi.go.jp/development/ichiran.html'; at.target='_blank'; at.rel='noopener noreferrer'; wrap.appendChild(at);
  v.appendChild(wrap);
  const info=el('div'); info.id='mapInfo'; v.appendChild(info);
  const un=shops.filter(s=>inWent(s)&&!s.loc);
  if (un.length){ const u=el('div','unloc'); u.appendChild(el('p','hint',`位置が未登録の行った店(${un.length}軒)`)); const c=el('div','chips'); un.forEach(s=>{ const b=el('button','chip',s.name||'(名前なし)'); b.onclick=()=>openDetail(s.id); c.appendChild(b); }); u.appendChild(c); v.appendChild(u); }
  mapSvg=svg; bindMap(svg); renderMapInfo();
  requestAnimationFrame(()=>{ if(mapV.fit||!mapV.c) fitMap(); drawMap(); });
}
function drawMap(){
  const svg=mapSvg; if(!svg||!svg.isConnected) return;
  if(!mapV.c && !fitMap()){ mapV.c={...SAPPORO}; mapV.span=3000; }
  const r=svg.getBoundingClientRect(); const pw=r.width||600, ph=r.height||400;
  const W=mapV.span, k=W/pw, H=ph*k;
  svg.setAttribute('viewBox',`${-W/2} ${-H/2} ${W} ${H}`); svg.textContent='';
  const c=mapV.c, dl=degLng(c.lat);
  const P=(lat,lng)=>[(lng-c.lng)*dl, -(lat-c.lat)*DEG_LAT];
  drawTiles(svg,P,c,W,H,k);
  mapV.pins=[];
  const pts=mapVisible(); const labels=pts.length<=30 || W<3000;
  const sel=pts.find(s=>s.id===mapV.sel);
  const order=pts.filter(s=>s!==sel).sort((a,b)=>(statusOf(a)==='went')-(statusOf(b)==='went')); if(sel) order.push(sel);
  for (const s of order){
    const [x,y]=P(s.loc.lat,s.loc.lng);
    // a teardrop pin whose tip is on the spot. went: filled red / want: white with a red ring
    const g=svgEl('g',{transform:`translate(${x} ${y}) scale(${k*(s===sel?1.25:1)})`});
    const went=statusOf(s)==='went';
    g.appendChild(svgEl('ellipse',{cx:0,cy:0,rx:5,ry:2},'pin-sh'));
    g.appendChild(svgEl('path',{d:'M0 0C-3 -7 -10 -11 -10 -20A10 10 0 1 1 10 -20C10 -11 3 -7 0 0Z'},went?'pin pin-went':'pin pin-want'));
    g.appendChild(svgEl('circle',{cx:0,cy:-20,r:3.8},went?'pin-dot-went':'pin-dot-want'));
    if (labels || s===sel){ const t=svgEl('text',{x:13,y:-16},'plabel'+(s===sel?' sel':'')); t.textContent=s.name||''; g.appendChild(t); }
    svg.appendChild(g);
    mapV.pins.push({id:s.id,sx:(x+W/2)/k,sy:(y+H/2)/k-20});
  }
  if (mapV.here){ const [x,y]=P(mapV.here.lat,mapV.here.lng); const g=svgEl('g',{transform:`translate(${x} ${y}) scale(${k})`}); g.appendChild(svgEl('circle',{r:13},'here-halo')); g.appendChild(svgEl('circle',{r:5},'here')); svg.appendChild(g); }
  const step=niceStep(W/4), sc=$('mapScale');
  if (sc){ sc.textContent=''; const bar=el('i'); bar.style.width=(step/k)+'px'; sc.appendChild(bar); sc.appendChild(document.createTextNode(fmtDist(step))); }
}
// background: 国土地理院の淡色地図, faded to gray in CSS so the pins stand out; each tile placed by its corners so the pins (drawn in local meters) line up
const SAPPORO={lat:43.0607,lng:141.3545};
const tileUrl=(z,x,y)=>`https://cyberjapandata.gsi.go.jp/xyz/pale/${z}/${x}/${y}.png`;
const tileLng=(x,z)=>x/2**z*360-180;
const tileLat=(y,z)=>{ const n=Math.PI-2*Math.PI*y/2**z; return 180/Math.PI*Math.atan(Math.sinh(n)); };
const lngTile=(lng,z)=>Math.floor((lng+180)/360*2**z);
const latTile=(lat,z)=>{ const r=lat*Math.PI/180; return Math.floor((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*2**z); };
const tileImgs=new Map();
// gray and pale (or inverted for the dark theme), as SVG filters so Safari applies them too
const TILE_FADE='<defs><filter id="tfade"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope=".6" intercept=".36"/><feFuncG type="linear" slope=".6" intercept=".36"/><feFuncB type="linear" slope=".6" intercept=".36"/></feComponentTransfer></filter>'  +'<filter id="tfadeD"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope="-.7" intercept=".78"/><feFuncG type="linear" slope="-.7" intercept=".78"/><feFuncB type="linear" slope="-.7" intercept=".78"/></feComponentTransfer></filter></defs>';
function drawTiles(svg,P,c,W,H,k){
  const mpp=k/2;   // one zoom finer than the screen needs: tiles drawn at half size, so the map labels stay small
  const z=Math.max(5,Math.min(18,Math.round(Math.log2(156543.03*Math.cos(c.lat*Math.PI/180)/mpp))));
  const dl=degLng(c.lat);
  const x0=lngTile(c.lng-W/2/dl,z), x1=lngTile(c.lng+W/2/dl,z), y0=latTile(c.lat+H/2/DEG_LAT,z), y1=latTile(c.lat-H/2/DEG_LAT,z);
  if ((x1-x0+1)*(y1-y0+1)>80) return;
  const dark=document.documentElement.dataset.theme==='dark' || (document.documentElement.dataset.theme!=='light' && !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches));
  svg.insertAdjacentHTML('afterbegin', TILE_FADE);
  const g=svgEl('g',{filter:dark?'url(#tfadeD)':'url(#tfade)',opacity:dark?.6:.75},'tiles');
  for (let x=x0;x<=x1;x++) for (let y=y0;y<=y1;y++){
    const key=`${z}/${x}/${y}`; let im=tileImgs.get(key);
    if (!im){ im=svgEl('image',{href:tileUrl(z,x,y),preserveAspectRatio:'none'}); tileImgs.set(key,im); if(tileImgs.size>400) tileImgs.delete(tileImgs.keys().next().value); }
    const [ax,ay]=P(tileLat(y,z),tileLng(x,z)), [bx,by]=P(tileLat(y+1,z),tileLng(x+1,z));
    im.setAttribute('x',ax); im.setAttribute('y',ay); im.setAttribute('width',bx-ax+k*0.5); im.setAttribute('height',by-ay+k*0.5);
    g.appendChild(im);
  }
  svg.appendChild(g);
}
function scheduleMap(){ if(mapRaf) return; mapRaf=requestAnimationFrame(()=>{ mapRaf=0; drawMap(); }); }
function bindMap(svg){
  const pts=new Map(); let moved=0, pinch=null;
  svg.addEventListener('pointerdown',e=>{ try{ svg.setPointerCapture(e.pointerId); }catch{} pts.set(e.pointerId,{x:e.clientX,y:e.clientY}); if(pts.size===1) moved=0;
    if(pts.size===2){ const [a,b]=[...pts.values()]; pinch={d:Math.hypot(a.x-b.x,a.y-b.y)||1,span:mapV.span}; } });
  svg.addEventListener('pointermove',e=>{ const p=pts.get(e.pointerId); if(!p||!mapV.c) return; const dx=e.clientX-p.x, dy=e.clientY-p.y; pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if (pts.size===1){ moved+=Math.abs(dx)+Math.abs(dy); const k=mapV.span/(svg.getBoundingClientRect().width||600);
      mapV.c={lat:mapV.c.lat+dy*k/DEG_LAT, lng:mapV.c.lng-dx*k/degLng(mapV.c.lat)}; }
    else if (pts.size===2 && pinch){ const [a,b]=[...pts.values()]; const d=Math.hypot(a.x-b.x,a.y-b.y); if(d>0) mapV.span=clampSpan(pinch.span*pinch.d/d); moved+=99; }
    mapV.fit=false; scheduleMap(); });
  const end=e=>{ const single=pts.size===1; pts.delete(e.pointerId); if(pts.size<2) pinch=null; if(single && e.type==='pointerup' && moved<6) pickPin(e); };
  svg.addEventListener('pointerup',end); svg.addEventListener('pointercancel',end);
  svg.addEventListener('wheel',e=>{ e.preventDefault(); mapV.span=clampSpan(mapV.span*Math.exp(e.deltaY*0.0015)); mapV.fit=false; scheduleMap(); },{passive:false});
}
function pickPin(e){
  const r=mapSvg.getBoundingClientRect(); const x=e.clientX-r.left, y=e.clientY-r.top;
  let best=null, bd=24; for(const p of mapV.pins){ const d=Math.hypot(p.sx-x,p.sy-y); if(d<bd){ bd=d; best=p.id; } }
  mapV.sel=best; drawMap(); renderMapInfo();
}
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
function showHere(){ getHere(h=>{ if(!h) return; mapV.here=h; mapV.c={lat:h.lat,lng:h.lng}; mapV.span=Math.min(mapV.span,1500); mapV.fit=false; drawMap(); }); }
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
