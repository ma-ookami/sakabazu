/* ---------- search sheet: find new shops on ホットペッパー (area + keyword + filters), tabelog-style ---------- */
const HP_GENRES = ['居酒屋','焼き鳥','海鮮','ジンギスカン','焼肉','スープカレー','ラーメン','寿司','バー','もつ鍋','立ち飲み','日本酒'];
// budget codes of the API (dinner budget)
const HP_BUDGETS = [['','予算 指定なし'],['B001','〜2000円'],['B002','2001〜3000円'],['B003','3001〜4000円'],['B008','4001〜5000円'],['B004','5001〜7000円'],['B005','7001〜10000円']];
const HP_FLAGS = [['free_drink','飲み放題'],['private_room','個室'],['non_smoking','禁煙'],['midnight','23時以降も営業'],['card','カード可']];
const sx = {kw:'', areaText:'', budget:'', flags:{}, near:true, state:'idle', results:[], total:0, mainN:0, msg:'', seq:0, more:false, url:''};

function openSearch(kw){
  if (typeof kw==='string') sx.kw=kw;
  showSheet('searchSheet'); buildSearch();
  if (sx.kw.trim()) runSearch(); else { const k=$('sxKw'); if(k) k.focus({preventScroll:true}); }
}
function closeSearch(){ hideSheet('searchSheet'); }

function buildSearch(){
  const body=$('sBody'); body.textContent='';
  if (!hpOn()){ body.appendChild(el('p','hint','お店検索はまだ設定されていません(firebase-config.js の HOTPEPPER_PROXY)。')); return; }
  // the two boxes: エリア・駅 / キーワード
  const f=el('form','sx-box'); f.noValidate=true;
  const r1=el('label','sx-row'); r1.appendChild(el('span','sx-ic','📍'));
  const ai=el('input','sx-in'); ai.id='sxArea'; ai.placeholder='エリア・駅(例: 狸小路)'; ai.autocomplete='off'; ai.maxLength=30;
  const a=hpAreaOf(); ai.value = sx.areaText || (a.id!=='any' ? a.label : '');
  ai.oninput=()=>{ sx.areaText=ai.value.trim(); const p=HP_AREAS.find(x=>x.label===sx.areaText); setHpArea(p?p.id:'text'); if(p) sx.areaText=''; markAreas(); };
  r1.appendChild(ai); f.appendChild(r1);
  const r2=el('label','sx-row'); r2.appendChild(el('span','sx-ic','🔍'));
  const ki=el('input','sx-in'); ki.id='sxKw'; ki.type='search'; ki.placeholder='店名・料理、またはお店のURL'; ki.autocomplete='off'; ki.maxLength=500; ki.value=sx.kw;
  ki.oninput=()=>{ sx.kw=ki.value; };
  r2.appendChild(ki); f.appendChild(r2);
  const go=el('button','btn btn-red sx-go','検索'); go.type='submit'; f.appendChild(go);
  f.onsubmit=e=>{ e.preventDefault(); ki.blur(); ai.blur(); runSearch(); };
  body.appendChild(f);
  body.appendChild(el('p','sx-help','GoogleマップやホットペッパーのURLを貼ると、そのお店をそのまま追加できます。'));

  body.appendChild(el('h3','sx-h','エリア'));
  const ar=el('div','chips sx-areas'); ar.id='sxAreas'; ar.setAttribute('aria-label','エリア');
  for (const p of HP_AREAS){ const c=el('button','chip',p.label); c.type='button'; c.dataset.id=p.id;
    c.onclick=()=>{ setHpArea(p.id); sx.areaText=''; ai.value=p.id!=='any'?p.label:''; markAreas(); if(sx.state==='done'||sx.state==='error') runSearch(); };
    ar.appendChild(c); }
  body.appendChild(ar); markAreas();

  body.appendChild(el('h3','sx-h','ジャンルから探す'));
  const gs=el('div','sx-genres');
  for (const g of HP_GENRES){ const c=el('button','sx-genre',g); c.type='button'; c.onclick=()=>{ sx.kw=g; ki.value=g; runSearch(); }; gs.appendChild(c); }
  body.appendChild(gs);

  body.appendChild(el('h3','sx-h','こだわり条件'));
  const fl=el('div','chips sx-filters'); fl.setAttribute('aria-label','こだわり条件');
  const bs=el('select','sx-budget'); bs.setAttribute('aria-label','予算(夜)');
  for (const [v,l] of HP_BUDGETS){ const o=el('option',null,l); o.value=v; o.selected=sx.budget===v; bs.appendChild(o); }
  bs.classList.toggle('on',!!sx.budget);
  bs.onchange=()=>{ sx.budget=bs.value; bs.classList.toggle('on',!!sx.budget); if(sx.state==='done') runSearch(); };
  fl.appendChild(bs);
  for (const [k,l] of HP_FLAGS){ const c=el('button','chip',l); c.type='button'; c.setAttribute('aria-pressed',String(!!sx.flags[k]));
    c.onclick=()=>{ sx.flags[k]=!sx.flags[k]; c.setAttribute('aria-pressed',String(sx.flags[k])); if(sx.state==='done') runSearch(); };
    fl.appendChild(c); }
  body.appendChild(fl);

  const res=el('div','sx-res'); res.id='sxRes'; res.setAttribute('aria-live','polite'); body.appendChild(res);
  renderResults();
}
function markAreas(){ const ar=$('sxAreas'); if(!ar) return; const id=hpArea_;
  ar.querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed',String(c.dataset.id===id))); }

// full-width spaces break the API's AND search; everyday words and kana spellings the API doesn't know
const HP_SYN = {'飲み屋':'居酒屋','呑み屋':'居酒屋','飲み屋さん':'居酒屋','のみや':'居酒屋','酒場':'居酒屋','いざかや':'居酒屋',
  'やきとり':'焼き鳥','焼鳥':'焼き鳥','やきにく':'焼肉','すし':'寿司','鮨':'寿司','らーめん':'ラーメン','じんぎすかん':'ジンギスカン',
  'すーぷかれー':'スープカレー','スープカリー':'スープカレー','かいせん':'海鮮','ほるもん':'ホルモン','もつ':'ホルモン','ばー':'バー',
  '立ち呑み':'立ち飲み','たちのみ':'立ち飲み','にほんしゅ':'日本酒','おでん屋':'おでん','焼き鳥屋':'焼き鳥','寿司屋':'寿司'};
const sxWords = s => s.replace(/[\s　]+/g,' ').trim().split(' ').filter(Boolean).map(w=>HP_SYN[w]||w).join(' ');
const isUrl = s => /^https?:\/\/\S+$/i.test(s.trim());

// what we send to the proxy. q: by keyword / nameQ: the same place, but the words matched against shop names
function sxQuery(){
  const a=hpAreaOf(), kw=sxWords(sx.kw), place=sxWords(sx.areaText);
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
  const nameQ = kw ? {...where,...extra,name_any:kw} : null;
  const label=[place||(a.id!=='any'?a.label:''), kw].filter(Boolean).join(' × ');
  return {q,nameQ,label,usedSa};
}
async function runSearch(more){
  if (isUrl(sx.kw)) return runUrl(sx.kw.trim());
  const {q,nameQ,label,usedSa}=sxQuery();
  if (!q.keyword && !q.lat && !q.here && !q.small_area){ sx.state='error'; sx.msg='エリアかキーワードを入れてください。'; renderResults(); return; }
  const seq=++sx.seq;
  if (!more){ sx.state='loading'; sx.results=[]; sx.total=0; sx.mainN=0; sx.label=label; renderResults(); }
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
      (!more && nameQ && hpVer!==1) ? hpSearch({...nameQ,count:'10'}).catch(()=>null) : null,
    ]);
    if (seq!==sx.seq) return;
    if (!main || (usedSa && hpVer===1)) return runSearch(more);   // an old Worker: search by the area's point instead
    const names = (byName && byName.v>=2) ? byName.shops : [];
    for (const r of names) r._name=true;
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
async function runUrl(u){
  const seq=++sx.seq; sx.state='loading'; sx.label='URL'; renderResults();
  const r=await addFromUrl(u); if (seq!==sx.seq) return;
  if (r.added){ sx.kw=''; sx.state='idle'; closeSearch(); listSub='want'; setTab('list'); return; }
  sx.state = r.needName ? 'url' : 'error'; sx.url=u; sx.msg=r.msg||''; renderResults();
  if (r.needName){ const n=$('sxUrlName'); if(n) n.focus(); }
}
const HP_SHORT = /^https:\/\/(maps\.app\.goo\.gl\/|goo\.gl\/maps\/)[A-Za-z0-9_-]+\/?$/;
// -> {added} | {needName} | {msg}
async function addFromUrl(u){
  u=u.trim().replace(/[?&]g_st=\w+$/,'');
  if (HP_SHORT.test(u)){
    const long=await hpResolve(u.replace(/\/$/,''));
    if (!long) return {msg:'短縮リンクを開けませんでした。Googleマップでお店を開き、アドレス欄の長いURLを貼ってください。'};
    u=long;
  }
  if (/google\.[a-z.]+\/maps|maps\.google\./i.test(u)){
    const p=parsePlaceUrl(u);
    if (!p.name) return {msg:'このURLからは店名を読み取れませんでした。Googleマップでお店を開いたときのURLを貼ってください。'};
    const id=await addOrBump(p.name,'',{loc:p.loc}); if(id) toast(`「${p.name}」を追加しました${p.loc?'(位置つき)':''}`);
    return id ? {added:true} : {msg:'追加できませんでした。'};
  }
  const hp=/hotpepper\.jp\/str(J\d{9})/i.exec(u);
  if (hp && hpOn()){
    try{
      const r=await hpSearch({id:hp[1],count:'1'}); const h=r.shops[0];
      if (h){ const id=await addOrBump(h.name,hpArea(h),hpShopExtra(h)); if(id) toast(`「${h.name}」を追加しました`); return id?{added:true}:{msg:'追加できませんでした。'}; }
    }catch(e){ console.warn(e); }
  }
  return {needName:true};
}

const hpYes = v => typeof v==='string' && /^(あり|営業している|全面禁煙|利用可)/.test(v);
function renderResults(){
  const box=$('sxRes'); if(!box) return; box.textContent='';
  if (sx.state==='idle') return;
  if (sx.state==='loading'){ box.appendChild(el('p','smsg', sx.label==='URL' ? 'URLを読み取っています…' : '探しています…')); return; }
  if (sx.state==='error'){ box.appendChild(el('p','smsg',sx.msg)); return; }
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
    const nm=el('a','sx-nm',r.name); if(r.urls&&r.urls.pc){ nm.href=r.urls.pc; nm.target='_blank'; nm.rel='noopener noreferrer'; } tx.appendChild(nm);
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
    const exists=myShops.some(s=>(s.hp&&s.hp.id===r.id) || norm(s.name)===norm(r.name));
    const add=el('button','sbtn'+(exists?'':' on'), exists?'リストにあり':'＋ 行きたい'); add.disabled=exists||readOnly;
    add.onclick=async()=>{ add.disabled=true; const id=await addOrBump(r.name,hpArea(r),hpShopExtra(r)); if(id){ toast(`「${r.name}」を行きたいに追加しました`); add.textContent='リストにあり'; add.classList.remove('on'); render(); } else add.disabled=false; };
    ac.appendChild(add);
    if (r.urls && r.urls.pc){ const a=el('a','sbtn','お店のページ'); a.href=r.urls.pc; a.target='_blank'; a.rel='noopener noreferrer'; ac.appendChild(a); }
    li.appendChild(ac); ul.appendChild(li);
  }
  box.appendChild(ul);
  if (sx.results.length && sx.results.length<sx.total){
    const m=el('button','btn btn-line sx-more', sx.more?'読み込んでいます…':'もっと見る'); m.disabled=sx.more; m.onclick=()=>runSearch(true); box.appendChild(m);
  }
  // not on ホットペッパー: add the name as typed
  const kw=sxWords(sx.kw);
  if (kw && !readOnly){ const m=el('button','btn '+(sx.results.length?'btn-line':'btn-red')+' sx-alt',`「${kw}」をこの名前で行きたいに追加`);
    m.onclick=async()=>{ m.disabled=true; if(await addManual(kw)){ closeSearch(); listSub='want'; setTab('list'); } else m.disabled=false; }; box.appendChild(m); }
  const ft=el('p','caution');
  const c=el('a','credit','Powered by ホットペッパーグルメ Webサービス'); c.href='https://webservice.recruit.co.jp/'; c.target='_blank'; c.rel='noopener noreferrer'; ft.appendChild(c);
  const gq=(sx.label||'札幌').replace(/ × /g,' ')+(/居酒屋|飲み|バー|酒場/.test(sx.label||'')?'':' 居酒屋');
  const g=el('a',null,`Googleマップで「${gq}」を探す`); g.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(gq); g.target='_blank'; g.rel='noopener noreferrer';
  ft.appendChild(g); box.appendChild(ft);
}
