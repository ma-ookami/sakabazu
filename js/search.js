/* ---------- search sheet: find new shops on ホットペッパー (area + keyword + filters), tabelog-style ---------- */
const HP_GENRES = ['居酒屋','焼き鳥','海鮮','ジンギスカン','焼肉','スープカレー','ラーメン','寿司','バー','もつ鍋','立ち飲み','日本酒'];
// budget codes of the API (dinner budget)
const HP_BUDGETS = [['','予算 指定なし'],['B001','〜2000円'],['B002','2001〜3000円'],['B003','3001〜4000円'],['B008','4001〜5000円'],['B004','5001〜7000円'],['B005','7001〜10000円']];
const HP_FLAGS = [['free_drink','飲み放題'],['private_room','個室'],['non_smoking','禁煙'],['midnight','23時以降も営業'],['card','カード可']];
const sx = {src:'hp', gres:[], gnext:'',kw:'',   // ホットペッパー first for now (Google needs the Worker key)
   areaText:'', budget:'', flags:{}, near:true, state:'idle', results:[], total:0, mainN:0, msg:'', seq:0, more:false, url:''};

function openSearch(kw){
  if (typeof kw==='string') sx.kw=kw;
  showSheet('searchSheet'); buildSearch();
  if (sx.kw.trim()) runSearch(); else { const k=$('sxKw'); if(k) k.focus({preventScroll:true}); }
}
function closeSearch(){ hideSheet('searchSheet'); sx.mode='find'; sx.editing=false; }

function buildSearch(){
  const body=$('sBody'); body.textContent='';
  if (!hpOn() && (sx.mode||'find')==='find') sx.mode='url';
  const mode=sx.mode||'find';
  // how to add: three ways, side by side
  const ways=el('div','add-ways'); ways.setAttribute('role','tablist'); ways.setAttribute('aria-label','追加のしかた');
  const ICON={find:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>', url:'<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>', name:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'};
  for (const [k,l,sub] of [['find','探す','エリア・料理'],['url','URLを貼る','LINEのリンク'],['name','名前だけ','載っていない店']]){
    const w=el('button','add-way'); w.type='button'; w.setAttribute('role','tab'); w.setAttribute('aria-selected',String(mode===k));
    w.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+ICON[k]+'</svg>';
    w.append(el('b',null,l), el('small',null,sub));
    w.onclick=()=>{ if (sx.mode===k) return; sx.mode=k; buildSearch(); const f=$('sBody').querySelector('input,textarea'); if(f && k!=='find') f.focus({preventScroll:true}); };
    ways.appendChild(w); }
  body.appendChild(ways);
  if (mode==='url'){ urlPane(body); return; }
  if (mode==='name'){ namePane(body); return; }

  if (!HP_AREAS.some(p=>p.id===hpArea_)){ setHpArea(hpAreaOf().id); }
  { const ac=hpAreaOf().city; if (ac && ac!==curCity()) setCity(ac); }
  sx.areaText='';
  const searched = sx.state!=='idle' && sx.state!=='urls' && !sx.editing;
  // after a search: the conditions fold into one line, results right below
  if (searched){
    const sum=el('button','sx-sum'); sum.type='button';
    const on=[hpAreaOf().label, sxWords(sxKwAll()), sx.budget&&(HP_BUDGETS.find(x=>x[0]===sx.budget)||[])[1], ...HP_FLAGS.filter(([k])=>sx.flags[k]).map(x=>x[1])].filter(Boolean);
    sum.append(el('span','sx-sum-ic','🔍'), el('span','sx-sum-t',on.join(' × ')), el('span','sx-sum-e','✎ 条件を変える'));
    sum.onclick=()=>{ sx.editing=true; buildSearch(); const k=$('sxKw'); if(k) k.focus({preventScroll:true}); };
    body.appendChild(sum);
  } else {
    const eh=el('div','sx-eh'); eh.appendChild(el('h3','sx-h sx-h1','エリア'));
    const cs=el('div','seg sx-city'); cs.setAttribute('role','group'); cs.setAttribute('aria-label','都市');
    for (const c of HP_CITIES){ const x=el('button',null,c.label); x.type='button'; x.setAttribute('aria-pressed',String(curCity()===c.id));
      x.onclick=()=>{ if(curCity()===c.id) return; setCity(c.id); setHpArea(c.id); buildSearch(); }; cs.appendChild(x); }
    eh.appendChild(cs); body.appendChild(eh);
    const ar=el('div','chips sx-areas'); ar.id='sxAreas'; ar.setAttribute('aria-label','エリア');
    for (const p of HP_AREAS.filter(p=>!p.city || p.city===curCity())){ const c=el('button','chip',p.label); c.type='button'; c.dataset.id=p.id;
      c.onclick=()=>{ setHpArea(p.id); markAreas(); };
      ar.appendChild(c); }
    body.appendChild(ar); markAreas();
    const f=el('form','sx-box'); f.noValidate=true;
    const r2=el('label','sx-row'); r2.appendChild(el('span','sx-ic','🔍'));
    const ki=el('input','sx-in'); ki.id='sxKw'; ki.type='search'; ki.placeholder='店名・料理'; ki.autocomplete='off'; ki.maxLength=5000; ki.value=sx.kw;
    ki.oninput=()=>{ sx.kw=ki.value; };
    ki.addEventListener('paste',e=>{ const t=clipFromEvent(e); if (!hasUrl(t)) return; e.preventDefault(); ki.value=''; sx.kw=''; runUrls(t); });
    r2.appendChild(ki); f.appendChild(r2);
    f.onsubmit=e=>{ e.preventDefault(); ki.blur(); runSearch(); };
    body.appendChild(f);
    body.appendChild(el('h3','sx-h','ジャンル(1つ選べます)'));
    const gs=el('div','sx-genres');
    for (const g of HP_GENRES){ const c=el('button','sx-genre',g); c.type='button'; c.setAttribute('aria-pressed',String(sx.genre===g));
      c.onclick=()=>{ sx.genre = sx.genre===g ? '' : g; for (const x of gs.children) x.setAttribute('aria-pressed',String(x.textContent===sx.genre)); }; gs.appendChild(c); }
    body.appendChild(gs);
    // where to search, and the conditions (folded behind ⚙)
    const row=el('div','sx-opts');
    const srcSeg=el('div','seg sx-src'); srcSeg.setAttribute('role','group'); srcSeg.setAttribute('aria-label','検索先');
    for (const [k,l] of [['g','Google'],['hp','ホットペッパー']]){ const x=el('button',null,l); x.type='button'; x.setAttribute('aria-pressed',String(sx.src===k));
      x.onclick=()=>{ if(sx.src===k) return; sx.src=k; buildSearch(); }; srcSeg.appendChild(x); }
    row.appendChild(srcSeg);
    if (sx.src==='hp'){ const n=(sx.budget?1:0)+HP_FLAGS.filter(([k])=>sx.flags[k]).length;
      const fb=el('button','chip sx-fb'+(n?' on':''), '⚙ 条件'+(n?' '+n:'')); fb.type='button'; fb.setAttribute('aria-expanded',String(!!sx.fopen));
      fb.onclick=()=>{ sx.fopen=!sx.fopen; buildSearch(); }; row.appendChild(fb); }
    body.appendChild(row);
    if (sx.src==='hp' && sx.fopen){
      const fl=el('div','chips sx-filters'); fl.setAttribute('aria-label','こだわり条件');
      const bs=el('select','sx-budget'); bs.setAttribute('aria-label','予算(夜)');
      for (const [v,l] of HP_BUDGETS){ const o=el('option',null,l); o.value=v; o.selected=sx.budget===v; bs.appendChild(o); }
      bs.classList.toggle('on',!!sx.budget);
      bs.onchange=()=>{ sx.budget=bs.value; bs.classList.toggle('on',!!sx.budget); };
      fl.appendChild(bs);
      for (const [k,l] of HP_FLAGS){ const c=el('button','chip',l); c.type='button'; c.setAttribute('aria-pressed',String(!!sx.flags[k]));
        c.onclick=()=>{ sx.flags[k]=!sx.flags[k]; c.setAttribute('aria-pressed',String(sx.flags[k])); };
        fl.appendChild(c); }
      body.appendChild(fl);
    }
    const go=el('button','btn btn-red sx-go sx-go-big','🔍 この条件で探す'); go.type='button'; go.onclick=()=>{ const k=$('sxKw'); if(k) k.blur(); runSearch(); }; body.appendChild(go);
    body.appendChild(el('p','sx-go-hint','店名を入れなくても、エリアとジャンルだけで探せます'));
  }
  const res=el('div','sx-res'); res.id='sxRes'; res.setAttribute('aria-live','polite'); body.appendChild(res);
  renderResults();
}
// URLを貼る: right here in the add screen
function urlPane(body){
  body.appendChild(el('p','hint','ホットペッパー・Googleマップ・食べログのお店のリンクを貼ってください。LINEの文面ごと、何件まとめてでもOK。'));
  const ta=el('textarea','ua-in'); ta.id='uaIn'; ta.rows=4; ta.placeholder='https://…'; ta.setAttribute('aria-label','お店のURL'); body.appendChild(ta);
  ta.addEventListener('paste',e=>{ const t=clipFromEvent(e), plain=(e.clipboardData&&e.clipboardData.getData('text/plain'))||''; if (t===plain) return;
    e.preventDefault(); const a=ta.selectionStart, b=ta.selectionEnd; ta.value=ta.value.slice(0,a)+t+ta.value.slice(b); });
  const err=el('p','ua-err'); err.setAttribute('aria-live','polite'); body.appendChild(err);
  const row=el('div','ua-row');
  const paste=el('button','btn btn-line','📋 貼り付け'); paste.type='button';
  paste.onclick=async()=>{ try{ const t=await clipRead(); if(t){ ta.value=(ta.value?ta.value+'\n':'')+t; err.textContent=''; } }catch{ err.textContent='貼り付けできませんでした。入力欄を長押しして貼り付けてください。'; ta.focus(); } };
  if (!navigator.clipboard || !navigator.clipboard.readText) paste.hidden=true;
  const ok=el('button','btn btn-red','登録'); ok.type='button';
  ok.onclick=()=>{ const t=ta.value; if (!urlsIn(t).length){ const n=t.trim(); if (n && n.length<=40 && !/\n/.test(n)){ sx.mode='find'; sx.kw=n; buildSearch(); runSearch(); toast('リンクが入っていなかったので、店名で探しました'); return; }
      err.textContent='URLが見つかりません。https:// から始まるリンクを貼ってください。'; return; }
    runUrls(t); };
  row.append(paste,ok); body.appendChild(row);
  const res=el('div','sx-res'); res.id='sxRes'; res.setAttribute('aria-live','polite'); body.appendChild(res);
  if (sx.state==='urls' || (sx.state==='loading' && sx.label==='URL')) renderResults();
}
// 名前だけ: a shop that isn't on any site
function namePane(body){
  body.appendChild(el('p','hint','検索に出てこない個人のお店などは、名前だけで追加できます。あとからジャンルや場所も入れられます。'));
  const f=el('form','quick quickadd ua-name'); f.noValidate=true;
  const i=el('input','field'); i.placeholder='お店の名前'; i.maxLength=60; i.autocomplete='off'; i.setAttribute('aria-label','お店の名前');
  const b=el('button','btn btn-red','追加'); b.type='submit'; f.append(i,b);
  f.onsubmit=async e=>{ e.preventDefault(); const n=i.value.trim(); if(!n){ i.focus(); return; } b.disabled=true;
    if (await addManual(n)){ sx.kw=''; closeSearch(); listSub='want'; setTab('list'); } else b.disabled=false; };
  body.appendChild(f);
}
function markAreas(){ const ar=$('sxAreas'); if(!ar) return; const id=hpArea_;
  ar.querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed',String(c.dataset.id===id))); }

// full-width spaces break the API's AND search; everyday words and kana spellings the API doesn't know
const HP_SYN = {'飲み屋':'居酒屋','呑み屋':'居酒屋','飲み屋さん':'居酒屋','のみや':'居酒屋','酒場':'居酒屋','いざかや':'居酒屋',
  'やきとり':'焼き鳥','焼鳥':'焼き鳥','やきにく':'焼肉','すし':'寿司','鮨':'寿司','らーめん':'ラーメン','じんぎすかん':'ジンギスカン',
  'すーぷかれー':'スープカレー','スープカリー':'スープカレー','かいせん':'海鮮','ほるもん':'ホルモン','もつ':'ホルモン','ばー':'バー',
  '立ち呑み':'立ち飲み','たちのみ':'立ち飲み','にほんしゅ':'日本酒','おでん屋':'おでん','焼き鳥屋':'焼き鳥','寿司屋':'寿司'};
const sxKwAll = () => [sx.kw, sx.genre].filter(x=>x && x.trim()).join(' ');
const sxWords = s => s.replace(/[\s　]+/g,' ').trim().split(' ').filter(Boolean).map(w=>HP_SYN[w]||w).join(' ');
const isUrl = s => /^https?:\/\/\S+$/i.test(s.trim());
const URL_RE = /https?:\/\/[^\s<>"'「」()（）]+/g;
const hasUrl = s => URL_RE.test(s) && !(URL_RE.lastIndex=0);
// each link with a name guess: the words just before it in the pasted text (LINE shares are "店名 URL")
const looksAddr = t => /^〒|^\d{3}-\d{4}|[都道府県].{0,6}[市区町村郡]|丁目|\d+-\d+(-\d+)?$|^[0-9０-９\-‐ー()（）+ ]{8,}$/.test(t);
const looksNoise = t => /google\s*マップ|google\s*maps|^https?:|見る$|共有$|^★|レビュー|クチコミ/i.test(t);
function guessName(seg){
  const lines=seg.split(/\n/).map(x=>x.trim().replace(/^[・\-–—>＞\s]+/,'').replace(/\s*[(（][^)）]*[)）]\s*$/,'')).filter(Boolean);
  for (let i=lines.length-1;i>=0;i--){ const t=lines[i].split(/\s+[·・|｜]\s+/)[0].trim(); if (t && !looksAddr(t) && !looksNoise(t) && t.length<=40) return t; }
  return '';
}
const SHOP_LINK = /^https:\/\/((www\.)?google\.[a-z.]+\/(maps|search)|maps\.google\.|maps\.app\.goo\.gl\/|goo\.gl\/maps\/|g\.co\/kgs\/|share\.google\/|(www\.)?hotpepper\.jp\/)/i;
const TABELOG = /^https?:\/\/(s\.)?tabelog\.com\//i;
function parseTabelog(seg){
  for (const raw of seg.split(/\n/).map(x=>x.trim()).filter(Boolean).reverse()){
    const m=/^(.+?)\s*(?:\(|（|-|－)\s*([^/／()（）]+?)\s*[/／]\s*([^()（）\[\]［］]+?)\s*(?:\)|）)?\s*(?:[-－|｜]\s*食べログ|\[食べログ\]|［食べログ］)\s*$/.exec(raw);
    if (m) return {name:m[1].trim().slice(0,60), area:m[2].trim().slice(0,40), genre:m[3].split(/[、,]/)[0].trim().slice(0,20)};
    const n=/^(.+?)\s*(?:[-－|｜]\s*食べログ|\[食べログ\]|［食べログ］)\s*$/.exec(raw); if (n) return {name:n[1].trim().slice(0,60), area:'', genre:''};
  }
  return null;
}
// all the text in a paste: the plain text, plus any link that came as its own piece (text/uri-list) or inside html
// details for a shop known only by name: the same shop on Google (when its key is set) or ホットペッパー
async function enrichByName(name, loc){
  if (!hpOn()) return {extra:{}};
  // Google first (most shops; needs the Worker's GOOGLE_PLACES_KEY), then ホットペッパー
  try{
    const c=loc||hpAreaOf().at||cityCenter(); const d=await Promise.race([hpCall({gq:name, lat:c.lat, lng:c.lng, r:loc?500:5000}), new Promise(z=>setTimeout(()=>z(null),3000))]);
    const g=d && Array.isArray(d.places) && d.places.find(x=>x.displayName && (norm(x.displayName.text)===norm(name) || norm(x.displayName.text).startsWith(norm(name)) || norm(name).startsWith(norm(x.displayName.text))));
    if (g) return {extra:gExtra(g), area:gArea(g)};
  }catch(e){ /* Google search not set up: fall through */ }
  try{
    const q={name_any:name, count:'10'}; if (loc){ q.lat=String(loc.lat); q.lng=String(loc.lng); q.range='3'; } else { const c=hpAreaOf().at||cityCenter(); q.lat=String(c.lat); q.lng=String(c.lng); q.range='5'; }
    const r=await Promise.race([hpSearch(q), new Promise(z=>setTimeout(()=>z(null),3000))]);
    const h=r && r.shops && r.shops.find(x=>norm(x.name)===norm(name) || norm(x.name).startsWith(norm(name)) || norm(name).startsWith(norm(x.name)));
    if (h) return {extra:hpShopExtra(h), area:hpArea(h)};
  }catch(e){ console.warn(e); }
  return {extra:{}};
}
// in my list now (行きたい or 行った). a shop I took out (外した) is not
const inMine = name => myShops.some(z=>mySt(z) && norm(z.name)===norm(name));
function clipJoin(plain,uriList,html){
  let t=plain||''; const more=[];
  for (const u of String(uriList||'').split(/\r?\n/)) if (/^https?:\/\//i.test(u.trim())) more.push(u.trim());
  if (html){ const re=/href\s*=\s*["']([^"']+)["']/gi; let m; while((m=re.exec(html))) if(/^https?:\/\//i.test(m[1])) more.push(m[1].replace(/&amp;/g,'&')); }
  for (const u of more) if (!t.includes(u)) t += (t?'\n':'') + u;
  return t;
}
const clipFromEvent = e => { const d=e.clipboardData||window.clipboardData; if(!d) return ''; return clipJoin(d.getData('text/plain')||d.getData('text'), d.getData('text/uri-list'), d.getData('text/html')); };
async function clipRead(){
  if (navigator.clipboard && navigator.clipboard.read){
    try{ const items=await navigator.clipboard.read(); let plain='', uri='', html='';
      for (const it of items){ for (const ty of it.types){ const v=await (await it.getType(ty)).text();
        if (ty==='text/plain') plain+=(plain?'\n':'')+v; else if (ty==='text/uri-list') uri+='\n'+v; else if (ty==='text/html') html+=v; } }
      const t=clipJoin(plain,uri,html); if (t) return t; }catch(e){ /* fall back to plain text */ } }
  return navigator.clipboard.readText();
}
// the address in a shared text (Google's share: name / address / link)
function guessAddr(seg){
  for (const raw of seg.split(/\n/).map(x=>x.trim()).filter(Boolean).reverse()){
    for (const part of raw.split(/\s+[·・|｜]\s+/)){ const t=part.replace(/^〒?\s*\d{3}-?\d{4}\s*/,'').trim();
      if (/^(北海道|東京都|大阪府|京都府|.{2,3}県)/.test(t) || /^.{1,6}[市区町村].{1,20}\d/.test(t)) return t.slice(0,80); }
  }
  return '';
}
// address -> place, with 国土地理院's free address search (no key)
async function geocode(addr){
  if (!addr) return null;
  try{ const r=await Promise.race([fetch('https://msearch.gsi.go.jp/address-search/AddressSearch?q='+encodeURIComponent(addr)), new Promise(z=>setTimeout(()=>z(null),4000))]);
    if (!r || !r.ok) return null; const d=await r.json(); const c=d && d[0] && d[0].geometry && d[0].geometry.coordinates;
    if (Array.isArray(c) && okLoc({lat:+c[1], lng:+c[0]})) return {lat:+c[1], lng:+c[0], src:'addr'}; }catch(e){ console.warn('geocode',e); }
  return null;
}
// the nearest named area (すすきの, 札幌駅…) within 1.5km
function areaNear(loc){
  let best=null, bd=1500; for (const a of HP_AREAS){ if(!a.at) continue; const d=distM(loc,a.at); if (d<bd){ bd=d; best=a; } }
  return best ? best.label : '';
}
function urlsIn(text){
  const out=[]; let m, last=0; URL_RE.lastIndex=0;
  while ((m=URL_RE.exec(text))){ const u=m[0].replace(/[。、,.]+$/,''), seg=text.slice(last,m.index); const tb=TABELOG.test(u)?parseTabelog(seg):null;
    out.push({u, hint:(tb?tb.name:guessName(seg)).slice(0,40), tb, addr:guessAddr(seg)}); last=m.index+m[0].length; }
  const seen=new Set(); return out.filter(x=>!seen.has(x.u) && seen.add(x.u));
}

// what we send to the proxy. q: by keyword / nameQ: the same place, but the words matched against shop names
function sxQuery(){
  const a=hpAreaOf(), kw=sxWords(sxKwAll()), place=sxWords(sx.areaText);
  const where={}; let usedSa=false;
  if (place) where.keyword=place;
  else if (a.kw) where.keyword=a.kw;
  else if (a.sa && hpVer!==1){ where.small_area=a.sa; usedSa=true; }
  else if (a.at) Object.assign(where,{lat:a.at.lat,lng:a.at.lng,range:'3'});
  else if (a.here) Object.assign(where,{here:true,range:'3'});
  const extra={};
  if ((where.lat||where.here) && !sx.near) extra.order='4';
  if (sx.budget) extra.budget=sx.budget;
  for (const [k] of HP_FLAGS) if (sx.flags[k]) extra[k]='1';
  const q={...where,...extra}; if (kw) q.keyword=[where.keyword,kw].filter(Boolean).join(' ');
  // shop-name matches: searched around a point (fast, and stays in the area). by area code it is slow and ignores the area
  const pt = a.at ? {lat:a.at.lat,lng:a.at.lng,range:'3'} : (!place && a.kw) ? {lat:(a.center||cityCenter()).lat,lng:(a.center||cityCenter()).lng,range:'5'} : where.here ? {here:true,range:'3'} : where.lat ? {lat:where.lat,lng:where.lng,range:'3'} : null;
  const nk=sxWords(sx.kw||'');   // shop names: only what was typed (not the genre)
  const nameQ = (nk && pt) ? {...pt,...extra,name_any:nk} : null;
  const label=[place||(a.id!=='any'?a.label:''), kw].filter(Boolean).join(' × ');
  return {q,nameQ,label,usedSa};
}
async function runSearch(more){
  if (!more){ sx.editing=false; sx.mode='find'; }
  if (hasUrl(sx.kw)) return runUrls(sx.kw);
  if (sx.src==='g') return runGoogle(more);
  const {q,nameQ,label,usedSa}=sxQuery();
  if (!q.keyword && !q.lat && !q.here && !q.small_area){ sx.state='error'; sx.msg='エリアかキーワードを入れてください。'; renderResults(); return; }
  const seq=++sx.seq;
  if (!more){ sx.state='loading'; sx.results=[]; sx.total=0; sx.mainN=0; sx.label=label; buildSearch(); }
  else { sx.more=true; renderResults(); }
  if (q.here){
    const here=await new Promise(r=>getHere(r)); if (seq!==sx.seq) return;
    if (!here){ sx.state='error'; sx.more=false; sx.msg='現在地を取得できませんでした。エリアを選ぶか、地名や駅名を入れて探してください。'; renderResults(); return; }
    for (const o of [q,nameQ]) if (o){ delete o.here; o.lat=here.lat; o.lng=here.lng; }
  }
  q.count='20'; if (more) q.start=String(sx.mainN+1);
  try{
    // shop-name matches first (they are usually what was meant), then the keyword matches
    const [main,byName]=await Promise.all([
      hpSearch(q).catch(e=>{ if(e.code==='old'){ hpVer=1; return null; } throw e; }),
      (!more && nameQ && hpVer!==1) ? Promise.race([hpSearch({...nameQ,count:'10'}).catch(()=>null), new Promise(r=>setTimeout(()=>r(null),2500))]) : null,   // never wait long for these
    ]);
    if (seq!==sx.seq) return;
    if (!main || (usedSa && hpVer===1)) return runSearch(more);   // an old Worker: search by the area's point instead
    // the API doesn't apply small_area / lat-lng to name_any: keep only name matches inside the chosen area
    const w=nameQ||{};
    const inArea = r => w.small_area ? (r.small_area && r.small_area.code===w.small_area)
      : w.lat ? Math.hypot((+r.lat-w.lat)*111000,(+r.lng-w.lng)*111000*Math.cos(w.lat*Math.PI/180)) <= (w.range==='5'?3200:1500)
      : w.keyword==='札幌市' ? /札幌市/.test(r.address||'') : true;
    const names = (byName && byName.v>=2) ? byName.shops.filter(inArea) : [];
    const genreWord = !sx.kw.trim() || HP_GENRES.includes(sx.kw.trim()) || /^(居酒屋|酒場|飲み屋|バー|立ち?飲み|焼き?鳥|寿司|ラーメン|焼肉|海鮮)$/.test(sx.kw.trim());
    if (!genreWord) for (const r of names) r._name=true;
    const seen=new Set(more ? sx.results.map(r=>r.id) : names.map(r=>r.id));
    const add=main.shops.filter(r=>!seen.has(r.id));
    sx.results = more ? sx.results.concat(add) : names.concat(add);
    sx.mainN += main.shops.length;
    sx.total = Math.max(sx.results.length, main.total + names.filter(r=>!main.shops.some(x=>x.id===r.id)).length);
    sx.state='done';
  }catch(e){
    if (seq!==sx.seq) return;
    sx.state='error'; sx.msg = e&&e.code==='api' ? 'お店検索のキーが正しくないか、使えない状態です。' : 'お店を探せませんでした。通信状態を確認して、もう一度どうぞ。';
  }
  sx.more=false; renderResults();
  if (!more){ const p=panelOf('searchSheet'), r=$('sxRes'); if(p && r && r.offsetTop>p.clientHeight*0.6) p.scrollTo({top:r.offsetTop-70,behavior:'smooth'}); }
}

// a pasted link: Google Maps / ホットペッパー are added right away; any other page asks for the shop's name
async function runUrls(text){
  const list=urlsIn(text); if(!list.length) return;
  const seq=++sx.seq; sx.state='loading'; sx.label='URL'; sx.urlRes=[]; renderResults();
  const show=()=>{ const r=$('sxRes'); if(r) r.scrollIntoView({block:'start',behavior:'smooth'}); }; show();
  for (const [k,x] of list.entries()){
    sx.prog=`${k+1}/${list.length}`; renderResults();
    let r = x.tb ? {needName:true, msg:''} : await addFromUrl(x.u); if (seq!==sx.seq) return;
    if (x.tb){ if (inMine(x.tb.name)) r={msg:`「${x.tb.name}」はもうリストにあります。`};
      else { const id=await addOrBump(x.tb.name, x.tb.area?x.tb.area.replace(/駅$/,'')+'駅':'', {links:[x.u], ...(x.tb.genre?{hp:{genre:x.tb.genre}}:{})}); if (id) r={added:x.tb.name, id}; } }
    // only for shop links (Google / ホットペッパー): any other link keeps asking, so a chat line like 「見て!」 never becomes a shop
    if (r.needName && x.hint && SHOP_LINK.test(x.u)){ const own=inMine(x.hint);
      if (own) r={msg:`「${x.hint}」はもうリストにあります。`}; else { if (!r.loc && x.addr) r.loc=await geocode(x.addr); const ex=await enrichByName(x.hint, r.loc); const id=await addOrBump(x.hint, ex.area||'', {...ex.extra, links:[r.long||x.u, ...((ex.extra&&ex.extra.links)||[])].slice(0,5), ...(r.loc?{loc:r.loc}:{})}); if (id) r={added:x.hint, id}; } }
    if (r.id) await fillAfter(r.id, x);
    sx.urlRes.push({...x,...r});
  }
  sx.prog=''; const ok=sx.urlRes.filter(r=>r.added);
  const noGenre=sx.urlRes.filter(r=>r.id).map(r=>myShops.find(z=>z.id===r.id)).filter(z=>z && !genreOf(z)).slice(0,3);
  if (noGenre.length) setTimeout(()=>askGenres(noGenre),400);
  if (ok.length===list.length){ toast(ok.length===1 ? `「${ok[0].added}」を追加しました` : `${ok.length}軒を追加しました`); sx.kw=''; sx.state='idle'; closeSearch(); listSub='want'; setTab('list'); return; }
  sx.state='urls'; renderResults(); show();
}
// short links: Googleマップの共有 (maps.app.goo.gl / goo.gl/maps) and Google検索の共有 (g.co/kgs, share.google)
const HP_SHORT = /^https:\/\/(maps\.app\.goo\.gl\/|goo\.gl\/maps\/|g\.co\/kgs\/|share\.google\/)[A-Za-z0-9_-]+\/?$/;
const G_URL = /^https:\/\/((www\.)?google\.[a-z.]+\/(maps|search)|maps\.google\.[a-z.]+\/)/i;
// the shop's name in a Google link: /maps/place/<name>, /maps/search/<name>, ?q=<name, address>, ?query=<name>
function gLinkName(u){
  const p=parsePlaceUrl(u); if (p.name) return p.name;
  let s=u; try{ s=decodeURIComponent(u.replace(/\+/g,' ')); }catch{}
  let m=/\/maps\/search\/([^/@?]+)/.exec(s); if (m) return m[1].trim();
  try{ const q=new URL(u).searchParams; const v=(q.get('q')||q.get('query')||'').trim();
    if (v && !/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(v)) return v.split(/[,、，]/)[0].replace(/〒?\d{3}-\d{4}.*/,'').trim(); }catch{}
  return '';
}
// -> {added} | {needName, msg} | {msg}
async function addFromUrl(u){
  u=u.trim();
  const sh=/^(https:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs|share\.google)\/[A-Za-z0-9_-]+)\/?(?:[?#].*)?$/.exec(u);
  if (sh){
    const long=await hpResolve(sh[1]);
    if (!long || long===sh[1] || HP_SHORT.test(long)) return {needName:true, msg:'リンクの行き先を開けませんでした。お店の名前を入れると、そのまま追加できます。'};
    u=long;
  }
  // Google's consent page wraps the real link
  if (/consent\.google\./.test(u)){ try{ const c=new URL(u).searchParams.get('continue'); if(c) u=c; }catch{} }
  if (G_URL.test(u)){
    const name=gLinkName(u), p=parsePlaceUrl(u);
    if (!name) return {needName:true, loc:p.loc, long:u, msg:'このリンクからは店名を読み取れませんでした。お店の名前を入れると、そのまま追加できます。'};
    let extra={loc:p.loc, links:[u]}, area='', nm=name;
    try{ // the same shop on Google (near the link's spot): genre, hours, the proper link
      const q={gq:name}; if (p.loc) Object.assign(q,{lat:p.loc.lat,lng:p.loc.lng,r:300,rect:1});
      const d=await hpCall(q); const ps=(d&&d.places)||[];
      const g=ps.find(x=>x.displayName && norm(x.displayName.text)===norm(name)) || ps.find(x=>x.displayName && (norm(x.displayName.text).includes(norm(name))||norm(name).includes(norm(x.displayName.text)))) || (p.loc ? null : ps[0]);
      if (g){ extra={...gExtra(g), loc:p.loc||gExtra(g).loc}; nm=g.displayName.text; area=gArea(g); }
    }catch(e){ /* Google search not set up yet: name + place only */ }
    if (inMine(nm)) return {msg:`「${nm}」はもうリストにあります。`};
    const id=await addOrBump(nm,area,extra);
    return id ? {added:nm, id} : {msg:'追加できませんでした。通信状態を確認して、もう一度試してください。'};
  }
  const hp=/hotpepper\.jp\/str(J\d{9})/i.exec(u);
  if (hp && hpOn()){
    try{
      const r=await hpSearch({id:hp[1],count:'1'}); const h=r.shops[0];
      if (h){ if (inMine(h.name)) return {msg:`「${h.name}」はもうリストにあります。`};
        const id=await addOrBump(h.name,hpArea(h),hpShopExtra(h)); return id?{added:h.name, id}:{msg:'追加できませんでした。通信状態を確認して、もう一度試してください。'}; }
      return {needName:true, msg:'ホットペッパーでこのお店が見つかりませんでした(閉店したお店かもしれません)。'};
    }catch(e){ console.warn(e); return {needName:true, msg:'ホットペッパーにつながりませんでした。お店の名前を入れると、そのまま追加できます。'}; }
  }
  if (TABELOG.test(u)) return {needName:true, msg:'食べログのリンクだけでは店名が分かりません。お店の名前を入れると、リンク付きで追加できます(食べログの「共有」でコピーした文ごと貼ると、店名も入ります)。'};
  return {needName:true, msg:'GoogleマップとホットペッパーのURL以外は、お店を読み取れません。お店の名前を入れると、リンク付きで追加できます。'};
}

const hpYes = v => typeof v==='string' && /^(あり|営業している|全面禁煙|利用可)/.test(v);
function renderResults(){
  if (sx.src==='g' && sx.state==='done') return renderGoogle();
  const box=$('sxRes'); if(!box) return; box.textContent='';
  if (sx.state==='idle') return;
  if (sx.state==='loading'){ box.appendChild(el('p','smsg', sx.label==='URL' ? 'URLを読み取っています…' : '探しています…')); return; }
  if (sx.state==='error'){ box.appendChild(el('p','smsg',sx.msg)); return; }
  if (sx.state==='loading' && sx.prog){ box.appendChild(el('p','smsg',`URLを読み取っています… ${sx.prog}`)); return; }
  if (sx.state==='urls'){
    const ok=sx.urlRes.filter(r=>r.added).length;
    box.appendChild(el('div','sx-head')).append(el('span','sx-lab','貼ったURL'), el('span','sx-n',`${ok}/${sx.urlRes.length}軒を追加`));
    const ul=el('ul','sx-urls');
    for (const r of sx.urlRes){
      const li=el('li','sx-uitem'); let du=r.u; try{ du=decodeURI(r.u); }catch{} li.appendChild(el('p','sx-urlu',du.length>80?du.slice(0,78)+'…':du));
      if (r.added) li.prepend(el('p','sx-ok','✓ '+r.added));
      else if (r.needName){
        li.prepend(el('p','sx-urlt','このリンクのお店の名前は?')); if (r.msg) li.prepend(el('p','sx-ng',r.msg));
        const f=el('form','quick quickadd'); f.noValidate=true;
        const i=el('input','field'); i.placeholder='お店の名前'; i.maxLength=60; i.autocomplete='off'; i.value=r.hint||''; i.setAttribute('aria-label','お店の名前');
        const b=el('button','btn btn-red','追加'); b.type='submit'; f.append(i,b);
        f.onsubmit=async e=>{ e.preventDefault(); const n=i.value.trim(); if(!n){ i.focus(); return; } b.disabled=true;
          const id=await addOrBump(n,'',{links:[r.u]}); b.disabled=false; if(id){ r.added=n; r.needName=false; { const sh=myShops.find(z=>z.id===id); if (sh && !genreOf(sh)) setTimeout(()=>askGenres([sh]),300); } renderResults(); } };
        li.appendChild(f);
      } else li.prepend(el('p','sx-ng',r.msg||'読み取れませんでした'));
      ul.appendChild(li);
    }
    box.appendChild(ul);
    const done=el('button','btn btn-line sx-alt','リストを見る'); done.onclick=()=>{ sx.kw=''; sx.state='idle'; closeSearch(); listSub='want'; setTab('list'); }; box.appendChild(done);
    return;
  }
  if (sx.state==='url'){
    // a page we can't read (食べログ, Instagram, 公式サイト…): keep the link, ask the name
    const c=el('div','sx-urlcard'); c.appendChild(el('p','sx-urlt','このリンクのお店を追加します'));
    c.appendChild(el('p','sx-urlu',sx.url));
    const f=el('form','quick quickadd'); f.noValidate=true;
    const i=el('input','field'); i.id='sxUrlName'; i.placeholder='お店の名前'; i.maxLength=60; i.autocomplete='off'; i.setAttribute('aria-label','お店の名前');
    const b=el('button','btn btn-red','追加'); b.type='submit'; f.append(i,b);
    f.onsubmit=async e=>{ e.preventDefault(); const n=i.value.trim(); if(!n){ i.focus(); return; } b.disabled=true;
      const id=await addOrBump(n,'',{links:[sx.url]}); b.disabled=false;
      if (id){ toast(`「${n}」を追加しました(リンクつき)`); sx.kw=''; sx.state='idle'; closeSearch(); listSub='want'; setTab('list'); } };
    c.appendChild(f); c.appendChild(el('p','sx-help','リンクはお店の詳細に保存され、あとから開けます。'));
    box.appendChild(c); return;
  }
  const h=el('div','sx-head'); h.appendChild(el('span','sx-lab',sx.label||'検索結果'));
  h.appendChild(el('span','sx-n',`${sx.total.toLocaleString()}件`));
  // ホットペッパーの利用規約: クレジット(Powered by …、公式サイトへのリンク)と、写真を出すときは「画像提供」の表記
  { const cr=el('p','hp-credit'); const c=el('a',null,'Powered by ホットペッパーグルメ Webサービス'); c.href='https://webservice.recruit.co.jp/'; c.target='_blank'; c.rel='noopener noreferrer'; c.title='ホットペッパーグルメ Webサービス'; cr.append(c, document.createTextNode('　【画像提供：ホットペッパー グルメ】')); setTimeout(()=>h.after(cr)); }
  const {q}=sxQuery();
  if (q.lat||q.here){ const s=el('select','sx-sort'); s.setAttribute('aria-label','並び順');
    for (const [v,l] of [['near','近い順'],['rec','おすすめ順']]){ const o=el('option',null,l); o.value=v; o.selected=(v==='near')===sx.near; s.appendChild(o); }
    s.onchange=()=>{ sx.near=s.value==='near'; runSearch(); }; h.appendChild(s); }
  box.appendChild(h);
  if (!sx.results.length){
    box.appendChild(el('p','smsg','見つかりませんでした。ホットペッパーに載っていない店は出てきません。条件を減らすか、言い方を変えてみてください。'));
    const any=Object.values(sx.flags).some(Boolean)||sx.budget;
    if (any){ const c=el('button','btn btn-line sx-alt','こだわり条件を外して探す'); c.onclick=()=>{ sx.flags={}; sx.budget=''; buildSearch(); runSearch(); }; box.appendChild(c); }
  }
  const ul=el('ul','sx-list');
  for (const r of sx.results){
    const li=el('li','sx-card');
    const top=el('div','sx-top');
    const tx=el('div','sx-tx');
    if (r._name) tx.appendChild(el('span','sx-hit','店名が一致'));
    const nm=el('a','sx-nm',r.name); if(r.urls&&safeUrl(r.urls.pc)){ nm.href=safeUrl(r.urls.pc); nm.target='_blank'; nm.rel='noopener noreferrer'; } tx.appendChild(nm);
    const sub=[hpArea(r), r.genre&&r.genre.name].filter(Boolean).join(' / '); if(sub) tx.appendChild(el('span','sx-sub',sub));
    const bd=hpBudget(r); if(bd) tx.appendChild(el('span','sx-bud','🌙 '+bd));
    top.appendChild(tx);
    const ph=hpPhoto(r); if(ph){ const im=el('img','sx-ph'); im.src=ph; im.alt=''; im.loading='lazy'; top.appendChild(im); }
    li.appendChild(top);
    if (r.catch) li.appendChild(el('p','sx-catch',r.catch));
    const tags=el('div','sx-tags');
    for (const [k,l] of [['free_drink','飲み放題'],['private_room','個室'],['midnight','深夜営業'],['non_smoking','禁煙']]) if (hpYes(r[k])) tags.appendChild(el('span','sx-tag',l));
    if (r.mobile_access) tags.appendChild(el('span','sx-acc',r.mobile_access));
    if (tags.childNodes.length) li.appendChild(tags);
    const ac=el('div','sx-ac');
    const own=myShops.find(s=>(s.hp&&s.hp.id===r.id) || norm(s.name)===norm(r.name));
    resultActions(li,ac,r.name,hpArea(r),()=>hpShopExtra(r),own,renderResults);
    if (r.urls && safeUrl(r.urls.pc)){ const a=el('a','sbtn','お店のページ'); a.href=safeUrl(r.urls.pc); a.target='_blank'; a.rel='noopener noreferrer'; ac.appendChild(a); }
    li.appendChild(ac); ul.appendChild(li);
  }
  box.appendChild(ul);
  if (sx.results.length && sx.results.length<sx.total){
    const m=el('button','btn btn-line sx-more', sx.more?'読み込んでいます…':'もっと見る'); m.disabled=sx.more; m.onclick=()=>runSearch(true); box.appendChild(m);
  }
  // not found? paste its link, or add it by name
  const kw=sxWords(sx.kw);
  if (!readOnly){ const nf=el('div','sx-notfound'); nf.appendChild(el('p','sx-nf-t','見つからない?'));
    const row=el('div','sx-nf-row');
    const u=el('button','btn btn-line','🔗 URLを貼る'); u.onclick=()=>{ sx.mode='url'; buildSearch(); const t=$('uaIn'); if(t) t.focus({preventScroll:true}); }; row.appendChild(u);
    const m=el('button','btn '+(sx.results.length?'btn-line':'btn-red'), kw?`「${kw}」を名前だけで追加`:'名前だけで追加');
    m.onclick=async()=>{ if(!kw){ sx.mode='name'; buildSearch(); return; } m.disabled=true; if(await addManual(kw)){ closeSearch(); listSub='want'; setTab('list'); } else m.disabled=false; }; row.appendChild(m);
    nf.appendChild(row); box.appendChild(nf); }
  const ft=el('p','caution');
  const c=el('a','credit','Powered by ホットペッパーグルメ Webサービス'); c.href='https://webservice.recruit.co.jp/'; c.target='_blank'; c.rel='noopener noreferrer'; ft.appendChild(c);
  const gq=(sx.label||'札幌').replace(/ × /g,' ')+(/居酒屋|飲み|バー|酒場/.test(sx.label||'')?'':' 居酒屋');
  const g=el('a',null,`Googleマップで「${gq}」を探す`); g.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(gq); g.target='_blank'; g.rel='noopener noreferrer';
  ft.appendChild(g); box.appendChild(ft);
}

/* ---------- Google (Places API through the same Worker) ---------- */
const G_PRICE={PRICE_LEVEL_INEXPENSIVE:'¥',PRICE_LEVEL_MODERATE:'¥¥',PRICE_LEVEL_EXPENSIVE:'¥¥¥',PRICE_LEVEL_VERY_EXPENSIVE:'¥¥¥¥'};
// where to look: a chosen area as a box (only inside it), a typed place as a nudge toward 札幌, or anywhere
function gQuery(){
  const a=hpAreaOf(), kw=sxWords(sxKwAll()), place=sxWords(sx.areaText);
  const near = place || (a.id!=='any' && !a.here && a.id!=='sapporo' ? a.label : '');
  const q={gq:[near, kw||'居酒屋'].filter(Boolean).join(' ')};
  if (place) Object.assign(q,{lat:cityCenter().lat,lng:cityCenter().lng,r:30000});
  else if (a.center) Object.assign(q,{lat:a.center.lat,lng:a.center.lng,r:a.id==='tokyo'?20000:12000,rect:1});
  else if (a.at) Object.assign(q,{lat:a.at.lat,lng:a.at.lng,r:1000,rect:1});
  else if (a.here) Object.assign(q,{here:1,r:1500,rect:1});
  const label=[place||(a.id!=='any'?a.label:''), kw].filter(Boolean).join(' × ');
  return {q,label};
}
async function runGoogle(more){
  const {q,label}=gQuery(); const seq=++sx.seq;
  if (!more){ sx.state='loading'; sx.gres=[]; sx.gnext=''; sx.label=label; renderResults(); } else { sx.more=true; renderGoogle(); }
  if (q.here){ const here=await new Promise(r=>getHere(r)); if(seq!==sx.seq) return;
    if (!here){ sx.state='error'; sx.more=false; sx.msg='現在地を取得できませんでした。エリアを選ぶか、地名や駅名を入れて探してください。'; renderResults(); return; }
    delete q.here; q.lat=here.lat; q.lng=here.lng; }
  if (more && sx.gnext) q.pt=sx.gnext;
  try{
    const d=await hpCall(q); if(seq!==sx.seq) return;
    if (d.error || !Array.isArray(d.places)) throw Object.assign(new Error(d.error||'bad'),{code: d.error ? 'api' : 'old'});
    sx.gres = more ? sx.gres.concat(d.places) : d.places; sx.gnext=d.next||''; sx.state='done';
  }catch(e){
    if (seq!==sx.seq) return; console.warn(e);
    sx.state='error'; sx.msg = (e.code==='old'||e.code==='nogkey') ? 'Google検索はまだ準備中です(Worker の更新と Google のキーの設定が必要です)。上で「ホットペッパー」に切り替えると探せます。'
      : e.code==='api' ? 'Google検索でエラーが出ました: '+e.message : 'お店を探せませんでした。通信状態を確認して、もう一度どうぞ。';
  }
  sx.more=false; renderResults();
}
// opening hours from Google's periods -> ours: the usual open/close, and the days with no hours as 定休日
function gHours(p){
  const ps=(p.regularOpeningHours&&p.regularOpeningHours.periods)||[]; if(!ps.length) return null;
  const f=t=>t ? String(t.hour).padStart(2,'0')+':'+String(t.minute||0).padStart(2,'0') : '';
  const cnt={}; for (const x of ps){ if(!x.open||!x.close) continue; const k=f(x.open)+'-'+f(x.close); cnt[k]=(cnt[k]||0)+1; }
  const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0]; if(!top) return null;
  const [open,close]=top[0].split('-'); const days=new Set(ps.map(x=>x.open&&x.open.day));
  return {open, close: close==='00:00' ? '24:00' : close, closed:[0,1,2,3,4,5,6].filter(d=>!days.has(d))};
}
function gExtra(p){
  const ex={}; if (p.location) ex.loc={lat:p.location.latitude, lng:p.location.longitude, src:'g'};
  if (p.googleMapsUri) ex.links=[p.googleMapsUri];
  const g=p.primaryTypeDisplayName&&p.primaryTypeDisplayName.text; if (g) ex.hp={genre:g};
  const h=gHours(p); if (h) ex.hours=h;
  return ex;
}
const gArea = p => (p.shortFormattedAddress||'').replace(/^日本、?/,'').replace(/^〒?\d{3}-\d{4}\s*/,'').slice(0,40);
function renderGoogle(){
  const box=$('sxRes'); if(!box) return; box.textContent='';
  const h=el('div','sx-head'); h.appendChild(el('span','sx-lab',sx.label||'検索結果')); h.appendChild(el('span','sx-n',`${sx.gres.length}${sx.gnext?'+':''}件`)); box.appendChild(h);
  if (!sx.gres.length) box.appendChild(el('p','smsg','見つかりませんでした。言い方を変えるか、エリアを広げてみてください。'));
  const ul=el('ul','sx-list'), wd=(new Date().getDay()+6)%7;
  for (const p of sx.gres){
    const name=(p.displayName&&p.displayName.text)||''; if(!name) continue;
    const li=el('li','sx-card'), tx=el('div','sx-tx');
    const nm=el('a','sx-nm',name); if(safeUrl(p.googleMapsUri)){ nm.href=safeUrl(p.googleMapsUri); nm.target='_blank'; nm.rel='noopener noreferrer'; } tx.appendChild(nm);
    const sub=[p.primaryTypeDisplayName&&p.primaryTypeDisplayName.text, gArea(p)].filter(Boolean).join(' / '); if(sub) tx.appendChild(el('span','sx-sub',sub));
    if (p.rating){ const r=el('div','starline'); r.append(starsView(p.rating), el('b','st-v',p.rating.toFixed(1)), el('small',null,`(${(p.userRatingCount||0).toLocaleString()}件)`)); if(G_PRICE[p.priceLevel]) r.appendChild(el('small','g-price',G_PRICE[p.priceLevel])); tx.appendChild(r); }
    const wds=p.regularOpeningHours&&p.regularOpeningHours.weekdayDescriptions; if (wds&&wds[wd]) tx.appendChild(el('span','sx-acc','今日 '+wds[wd].replace(/^[^:：]+[:：]\s*/,'')));
    li.appendChild(tx);
    const ac=el('div','sx-ac');
    const own=myShops.find(s=>norm(s.name)===norm(name) || (Array.isArray(s.links)&&p.googleMapsUri&&s.links.includes(p.googleMapsUri)));
    resultActions(li,ac,name,gArea(p),()=>gExtra(p),own,renderGoogle);
    if (safeUrl(p.googleMapsUri)){ const a=el('a','sbtn','Googleマップ'); a.href=safeUrl(p.googleMapsUri); a.target='_blank'; a.rel='noopener noreferrer'; ac.appendChild(a); }
    li.appendChild(ac); ul.appendChild(li);
  }
  box.appendChild(ul);
  if (sx.gnext){ const m=el('button','btn btn-line sx-more', sx.more?'読み込んでいます…':'もっと見る'); m.disabled=sx.more; m.onclick=()=>runGoogle(true); box.appendChild(m); }
  const kw=sxWords(sx.kw);
  if (kw && !readOnly){ const m=el('button','btn btn-line sx-alt',`「${kw}」をこの名前で行きたいに追加`); m.onclick=async()=>{ m.disabled=true; if(await addManual(kw)){ closeSearch(); listSub='want'; setTab('list'); } else m.disabled=false; }; box.appendChild(m); }
  box.appendChild(el('p','caution','検索: Google マップ'));
}

// a result's buttons: ＋ 行きたい (red) and ✓ 行った (navy). 行った asks when: 今日 / a date / 覚えてない
function resultActions(li,ac,name,area,extra,own,redraw){
  const st = own ? mySt(own) : null;
  const w=el('button','sbtn sx-want', st==='want'?'✓ 行きたい':'＋ 行きたい'); w.disabled=!!st||readOnly;
  w.onclick=async()=>{ w.disabled=true; const id=await addOrBump(name,area,extra()); if(id){ toast(`「${name}」を行きたいに追加しました`); render(); redraw(); } else w.disabled=false; };
  const g=el('button','sbtn sx-went', st==='went'?'✓ 行った済み':'✓ 行った'); g.disabled=st==='went'||readOnly;
  let row=null;
  g.onclick=()=>{
    if (row){ row.remove(); row=null; return; }
    row=el('div','sx-when'); row.appendChild(el('span','sx-wl','いつ行った?'));
    const go=async date=>{ row.querySelectorAll('button,input').forEach(x=>x.disabled=true);
      const id = own ? own.id : await addOrBump(name,area,extra());
      if (!id){ redraw(); return; }
      if (date===today()) markWent(id,true);
      else { const cur=shops.find(x=>x.id===id)||myShops.find(x=>x.id===id); patchShop(id,{went:wentPatch(cur||{},me,date||true), wants:{[me]:false}}); }
      toast(`「${name}」を行ったに記録しました`); render(); redraw(); };
    const t=el('button','sbtn','今日'); t.onclick=()=>go(today());
    const d=el('input','sx-date'); d.type='date'; d.max=today(); d.setAttribute('aria-label','行った日'); d.onchange=()=>{ if(d.value) go(d.value); };
    const dl=el('label','sbtn sx-dl','日付を選ぶ'); dl.appendChild(d);
    const u=el('button','sbtn','覚えてない'); u.onclick=()=>go(null);
    row.append(t,dl,u); li.appendChild(row);
  };
  ac.append(w,g);
}

// URLで登録: paste links (LINE messages and all), then they're read in the search screen
function openUrlAdd(){ sx.mode='url'; sx.state='idle'; sx.kw=''; openSearch(''); setTimeout(()=>{ const t=$('uaIn'); if(t) t.focus({preventScroll:true}); },350); }

// a shop added from a link: its place from the address (if the link didn't give one), and an area name
async function fillAfter(id,x){
  const sh=myShops.find(z=>z.id===id); if(!sh) return;
  const p={}; let loc=sh.loc;
  if (!okLoc(loc) && x.addr){ loc=await geocode(x.addr); if (loc) p.loc=loc; }
  if (!sh.area && okLoc(loc)){ const a=areaNear(loc); if (a) p.area=a; }
  if (Object.keys(p).length) patchShop(id,p);
}
// "ジャンルは?" right after adding, one tap (or later)
async function askGenres(list){ for (const sh of list){ if (!(await askGenre(sh))) break; } }
function askGenre(sh){
  return new Promise(res=>{
    const d=el('dialog','ask genre-ask'); const box=el('div','ask-in');
    box.appendChild(el('p',null,`「${sh.name}」のジャンルは?`));
    const n={}; for (const z of myShops){ const g=genreOf(z); if(g) n[g]=(n[g]||0)+1; }
    const list=[...Object.keys(n).sort((a,b)=>n[b]-n[a]), ...HP_GENRES.filter(g=>!n[g])].slice(0,16);
    const ch=el('div','chips g-chips');
    const done=v=>{ if(!d.isConnected) return; d.close(); d.remove(); res(v); };
    for (const g of list){ const b=el('button','chip',g); b.type='button'; b.onclick=()=>{ patchShop(sh.id,{hp:{genre:g}}); toast(`「${sh.name}」を${g}にしました`); done(true); }; ch.appendChild(b); }
    box.appendChild(ch);
    const a=el('div','actions'); a.style.marginTop='12px'; const later=el('button','btn btn-line','あとで'); later.type='button'; later.onclick=()=>done(false); a.appendChild(later); box.appendChild(a);
    d.appendChild(box); document.body.appendChild(d);
    d.addEventListener('cancel',e=>{ e.preventDefault(); done(false); }); d.addEventListener('click',e=>{ if(e.target===d) done(false); });
    d.showModal(); box.tabIndex=-1; box.focus({preventScroll:true});
  });
}
