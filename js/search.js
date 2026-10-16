/* ---------- search sheet: find new shops on ホットペッパー (area + keyword + filters), tabelog-style ---------- */
const HP_GENRES = ['居酒屋','焼き鳥','海鮮','ジンギスカン','焼肉','スープカレー','ラーメン','寿司','バー','もつ鍋'];
// budget codes of the API (dinner budget)
const HP_BUDGETS = [['','予算 指定なし'],['B001','〜2000円'],['B002','2001〜3000円'],['B003','3001〜4000円'],['B008','4001〜5000円'],['B004','5001〜7000円'],['B005','7001〜10000円']];
const HP_FLAGS = [['free_drink','飲み放題'],['private_room','個室'],['non_smoking','禁煙'],['midnight','23時以降も営業'],['card','カード可']];
const sx = {kw:'', areaText:'', budget:'', flags:{}, near:true, state:'idle', results:[], total:0, msg:'', seq:0, more:false};

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
  const ai=el('input','sx-in'); ai.id='sxArea'; ai.placeholder='エリア・駅(例: 琴似)'; ai.autocomplete='off'; ai.maxLength=30;
  const a=hpAreaOf(); ai.value = sx.areaText || ((a.kw||a.at||a.here) ? a.label : '');
  ai.oninput=()=>{ sx.areaText=ai.value.trim(); const p=HP_AREAS.find(x=>x.label===sx.areaText); setHpArea(p?p.id:'text'); if(p) sx.areaText=''; markAreas(); };
  r1.appendChild(ai); f.appendChild(r1);
  const r2=el('label','sx-row'); r2.appendChild(el('span','sx-ic','🔍'));
  const ki=el('input','sx-in'); ki.id='sxKw'; ki.type='search'; ki.placeholder='キーワード(ジャンル・店名など)'; ki.autocomplete='off'; ki.maxLength=60; ki.value=sx.kw;
  ki.oninput=()=>{ sx.kw=ki.value; };
  r2.appendChild(ki); f.appendChild(r2);
  const go=el('button','btn btn-red sx-go','検索'); go.type='submit'; f.appendChild(go);
  f.onsubmit=e=>{ e.preventDefault(); ki.blur(); ai.blur(); runSearch(); };
  body.appendChild(f);

  const ar=el('div','chips sx-areas'); ar.id='sxAreas'; ar.setAttribute('aria-label','エリア');
  for (const p of HP_AREAS){ const c=el('button','chip',p.label); c.type='button'; c.dataset.id=p.id;
    c.onclick=()=>{ setHpArea(p.id); sx.areaText=''; ai.value=(p.kw||p.at||p.here)?p.label:''; markAreas(); if(sx.state!=='idle') runSearch(); };
    ar.appendChild(c); }
  body.appendChild(ar); markAreas();

  const gs=el('div','sx-genres');
  for (const g of HP_GENRES){ const c=el('button','sx-genre',g); c.type='button'; c.onclick=()=>{ sx.kw=g; ki.value=g; runSearch(); }; gs.appendChild(c); }
  body.appendChild(gs);

  // filters
  const fl=el('div','chips sx-filters'); fl.setAttribute('aria-label','こだわり条件');
  const bs=el('select','sx-budget'); bs.setAttribute('aria-label','予算(夜)');
  for (const [v,l] of HP_BUDGETS){ const o=el('option',null,l); o.value=v; o.selected=sx.budget===v; bs.appendChild(o); }
  bs.classList.toggle('on',!!sx.budget);
  bs.onchange=()=>{ sx.budget=bs.value; bs.classList.toggle('on',!!sx.budget); if(sx.state!=='idle') runSearch(); };
  fl.appendChild(bs);
  for (const [k,l] of HP_FLAGS){ const c=el('button','chip',l); c.type='button'; c.setAttribute('aria-pressed',String(!!sx.flags[k]));
    c.onclick=()=>{ sx.flags[k]=!sx.flags[k]; c.setAttribute('aria-pressed',String(sx.flags[k])); if(sx.state!=='idle') runSearch(); };
    fl.appendChild(c); }
  body.appendChild(fl);

  const res=el('div','sx-res'); res.id='sxRes'; res.setAttribute('aria-live','polite'); body.appendChild(res);
  renderResults();
}
function markAreas(){ const ar=$('sxAreas'); if(!ar) return; const id=hpArea_;
  ar.querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed',String(c.dataset.id===id && !(id==='text')))); }

// what we send to the proxy, and how the search reads in words
function sxQuery(){
  const a=hpAreaOf(), kw=sx.kw.trim(), place=sx.areaText;
  const q={}; let label=[place||((a.kw||a.at||a.here)?a.label:''), kw].filter(Boolean).join(' ');
  if (place) q.keyword=[place,kw].filter(Boolean).join(' ');
  else if (a.kw) q.keyword=[a.kw,kw].filter(Boolean).join(' ');
  else if (a.at) Object.assign(q,{lat:a.at.lat,lng:a.at.lng,range:'3'},kw?{keyword:kw}:{});
  else if (a.here) Object.assign(q,{here:true,range:'3'},kw?{keyword:kw}:{});
  else if (kw) q.keyword=kw;
  if ((q.lat||q.here) && !sx.near) q.order='4';
  if (sx.budget) q.budget=sx.budget;
  for (const [k] of HP_FLAGS) if (sx.flags[k]) q[k]='1';
  return {q,label};
}
async function runSearch(more){
  const {q,label}=sxQuery();
  if (!q.keyword && !q.lat && !q.here){ sx.state='error'; sx.msg='エリアかキーワードを入れてください。'; renderResults(); return; }
  const seq=++sx.seq;
  if (!more){ sx.state='loading'; sx.results=[]; sx.total=0; sx.label=label; renderResults(); }
  else { sx.more=true; renderResults(); }
  if (q.here){
    const here=await new Promise(r=>getHere(r)); if (seq!==sx.seq) return;
    if (!here){ sx.state='error'; sx.more=false; sx.msg='現在地を取得できませんでした。エリアを選ぶか、地名や駅名を入れて探してください。'; renderResults(); return; }
    delete q.here; q.lat=here.lat; q.lng=here.lng;
  }
  q.count='20'; if (more) q.start=String(sx.results.length+1);
  try{
    const r=await hpSearch(q); if (seq!==sx.seq) return;
    sx.results = more ? sx.results.concat(r.shops) : r.shops; sx.total=r.total; sx.state='done';
  }catch(e){
    if (seq!==sx.seq) return;
    sx.state='error'; sx.msg = e&&e.code==='api' ? 'お店検索のキーが正しくないか、使えない状態です。' : 'お店を探せませんでした。通信状態を確認して、もう一度どうぞ。';
  }
  sx.more=false; renderResults();
  if (!more){ const p=panelOf('searchSheet'), r=$('sxRes'); if(p && r && r.offsetTop>p.clientHeight*0.6) p.scrollTo({top:r.offsetTop-70,behavior:'smooth'}); }
}

const hpYes = v => typeof v==='string' && /^(あり|営業している|全面禁煙|利用可)/.test(v);
function renderResults(){
  const box=$('sxRes'); if(!box) return; box.textContent='';
  if (sx.state==='idle') return;
  if (sx.state==='loading'){ box.appendChild(el('p','smsg','探しています…')); return; }
  if (sx.state==='error'){ box.appendChild(el('p','smsg',sx.msg)); return; }
  const h=el('div','sx-head'); h.appendChild(el('span','sx-lab',sx.label?`「${sx.label}」`:'検索結果'));
  h.appendChild(el('span','sx-n',`${sx.total.toLocaleString()}件`));
  const {q}=sxQuery();
  if (q.lat||q.here){ const s=el('select','sx-sort'); s.setAttribute('aria-label','並び順');
    for (const [v,l] of [['near','近い順'],['rec','おすすめ順']]){ const o=el('option',null,l); o.value=v; o.selected=(v==='near')===sx.near; s.appendChild(o); }
    s.onchange=()=>{ sx.near=s.value==='near'; runSearch(); }; h.appendChild(s); }
  box.appendChild(h);
  if (!sx.results.length){ box.appendChild(el('p','smsg','見つかりませんでした。条件を減らすか、言い方を変えてみてください。')); }
  const ul=el('ul','sx-list');
  for (const r of sx.results){
    const li=el('li','sx-card');
    const top=el('div','sx-top');
    const tx=el('div','sx-tx');
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
    const exists=shops.some(s=>(s.hp&&s.hp.id===r.id) || norm(s.name)===norm(r.name));
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
  const ft=el('p','caution');
  const c=el('a','credit','Powered by ホットペッパーグルメ Webサービス'); c.href='https://webservice.recruit.co.jp/'; c.target='_blank'; c.rel='noopener noreferrer'; ft.appendChild(c);
  const gq=(sx.label||'札幌')+(/居酒屋|飲み|バー|酒場/.test(sx.label||'')?'':' 居酒屋');
  const g=el('a',null,`Googleマップで「${gq}」を探す`); g.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(gq); g.target='_blank'; g.rel='noopener noreferrer';
  ft.appendChild(g); box.appendChild(ft);
}
