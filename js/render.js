/* ---------- render ---------- */
function setTab(t){ withTransition(()=>{ tab=t; for(const b of document.querySelectorAll('.tab')) b.setAttribute('aria-selected', String(b.dataset.tab===t)); render(); window.scrollTo({top:0}); }); }
document.querySelectorAll('.tab').forEach(b => b.onclick = () => setTab(b.dataset.tab));

function counts(){
  const w=shops.filter(inWant).length, g=shops.filter(inWent).length;
  $('sWant').textContent=w; $('sWent').textContent=g; $('tWant').textContent=w||''; $('tWent').textContent=g||'';
  const mb=$('mbStats'); mb.textContent=''; mb.append('行きたい', el('b',null,String(w)), '・行った', el('b',null,String(g)));
}
function render(){
  counts(); renderCrew();
  const ae=document.activeElement; const keep=(ae&&ae.id==='quick')?{s:ae.selectionStart,e:ae.selectionEnd}:null;
  const v=$('view'); v.textContent=''; document.body.classList.toggle('gating', mode==='gate');
  if (mode==='gate'){ renderGate(v); return; }
  if (mode==='loading'){ const k=el('div','skel'); k.setAttribute('role','status'); k.setAttribute('aria-label','読み込み中'); for(const h of [96,132,132,132]){ const i=el('i'); i.style.setProperty('--h',h+'px'); k.appendChild(i); } v.appendChild(k); return; }
  if (tab==='home') renderHome(v);
  else if (tab==='list'){ listSeg(v); if(listSub==='want') renderWant(v); else renderWent(v); }
  else if (tab==='rec'){ recSeg(v); const sub=el('div'); v.appendChild(sub); if(recSub==='cal') renderCal(sub); else if(recSub==='rank') renderRank(sub); else renderScore(sub); }
  else renderMap(v);
  if (keep){ const n=$('quick'); if(n){ n.focus(); try{ n.setSelectionRange(keep.s,keep.e); }catch{} } }
}
function matches(s){ if (tagFilter && !(s.tags && s.tags[tagFilter])) return false; const q=query.trim().toLowerCase(); return !q || (s.name||'').toLowerCase().includes(q) || (s.area||'').toLowerCase().includes(q); }

function searchBox(v){
  const lab=el('label','sr','店名やエリアで探す'); lab.htmlFor='q';
  const q=el('input','field'); q.id='q'; q.type='search'; q.placeholder='店名・エリアで探す'; q.value=query;
  q.oninput=()=>{ query=q.value; const pos=q.selectionStart; render(); const n=$('q'); n.focus(); n.setSelectionRange(pos,pos); };
  v.appendChild(lab); return q;
}

let quickVal='', srch={q:'',state:'idle',results:[],msg:''};
async function addOrBump(name,area,extra){
  const hid=extra&&extra.hp&&extra.hp.id;
  const dup=shops.find(s=>(hid && s.hp && s.hp.id===hid) || norm(s.name)===norm(name));
  if (dup){
    if (wentBy(dup)[me]) toast(`「${dup.name}」は行った店に記録済みです`, '開く', ()=>openDetail(dup.id));
    else if (dup.wants && dup.wants[me]) toast(`「${dup.name}」はもう行きたいに入っています`);
    else if (me){ patchShop(dup.id,{wants:{[me]:true}}); const others=wentIds(dup).filter(u=>u!==me).length; toast(`「${dup.name}」を行きたいに入れました${others?`(${others}人が行ったことあり)`:''}`); }
    return null;
  }
  const id=await addShop(name,area);
  if (id && extra){
    const p={}; for (const k of ['loc','links','hours','tags','hp']) if (extra[k]) p[k]=extra[k];
    if (extra.note && me) p.r={[me]:{note:{t:extra.note}}};
    if (Object.keys(p).length) patchShop(id,p);
  }
  return id;
}
function parsePlaceUrl(u){
  let s=u; try{ s=decodeURIComponent(u); }catch{}
  const m=s.match(/\/maps\/place\/([^/@?]+)/); const name=m?m[1].replace(/\+/g,' ').trim():'';
  const l=parseMapUrl(u);
  return {name, loc:l.err?null:{lat:l.lat,lng:l.lng,src:'link'}, short:/goo\.gl|maps\.app/i.test(u)};
}
// ホットペッパーで探す。q が空なら現在地の近く(1km)
async function doSearch(q){
  const label = q || '現在地の近く';
  if (!hpOn()){ srch={q:label,state:'error',results:[],msg:'お店検索はまだ設定されていません(firebase-config.js の HOTPEPPER_KEY)。下のリンクからGoogleマップで探して、URLを貼って追加できます。'}; render(); return; }
  srch={q:label,state:'loading',results:[],msg:''}; render();
  let params={keyword:q};
  if (!q){
    const here=await new Promise(r=>getHere(r));
    if (!here){ srch={q:label,state:'error',results:[],msg:'現在地を取得できませんでした。地名や駅名を入れて探してください。'}; render(); return; }
    params={lat:here.lat, lng:here.lng, range:'3', order:'4'};
  }
  try{
    const arr=await hpSearch(params);
    if (srch.q!==label) return;
    srch={q:label,state:'done',results:arr,msg:''};
  }catch(e){
    if (srch.q!==label) return;
    srch={q:label,state:'error',results:[],msg: e&&e.code==='api' ? 'お店検索のキーが正しくないか、使えない状態です。' : 'お店を探せませんでした。通信状態を確認して、もう一度どうぞ。'};
  }
  render();
}
function searchPanel(v){
  if (srch.state==='idle') return;
  const p=el('section','spanel'); p.setAttribute('aria-live','polite');
  const h=el('div','spanel-h'); h.appendChild(el('span',null,`「${srch.q}」のお店`));
  const x=el('button','ic','✕'); x.setAttribute('aria-label','候補を閉じる'); x.onclick=()=>{ srch={q:'',state:'idle',results:[],msg:''}; render(); }; h.appendChild(x); p.appendChild(h);
  if (srch.state==='loading') p.appendChild(el('p','smsg','探しています…'));
  else if (srch.state==='error') p.appendChild(el('p','smsg',srch.msg));
  else if (!srch.results.length) p.appendChild(el('p','smsg','見つかりませんでした。言い方を変えるか、Googleマップで探してみてください。'));
  else {
    const ul=el('ul','sres');
    for (const r of srch.results){
      const li=el('li'); const ph=hpPhoto(r);
      if (ph){ const im=el('img','sph'); im.src=ph; im.alt=''; im.loading='lazy'; li.appendChild(im); } else li.appendChild(el('span','sph'));
      const tx=el('div','stx'); tx.appendChild(el('span','nm',r.name));
      const sub=[hpArea(r), r.genre&&r.genre.name].filter(Boolean).join('・'); if(sub) tx.appendChild(el('span','ar',sub));
      const bd=hpBudget(r); if(bd) tx.appendChild(el('span','ar','予算 '+bd));
      if (r.catch) tx.appendChild(el('span','ds',r.catch));
      li.appendChild(tx);
      const ac=el('div','ac');
      const exists=shops.some(s=>(s.hp&&s.hp.id===r.id) || norm(s.name)===norm(r.name));
      const add=el('button','sbtn'+(exists?'':' on'), exists?'リストにあり':'＋ 追加'); add.disabled=exists||readOnly;
      add.onclick=async()=>{ add.disabled=true; const id=await addOrBump(r.name,hpArea(r),hpShopExtra(r)); if(id) toast(`「${r.name}」を追加しました`); render(); };
      ac.appendChild(add);
      if (r.urls && r.urls.pc){ const a=el('a','sbtn','お店のページ'); a.href=r.urls.pc; a.target='_blank'; a.rel='noopener noreferrer'; ac.appendChild(a); }
      li.appendChild(ac); ul.appendChild(li);
    }
    p.appendChild(ul);
  }
  const ft=el('p','caution');
  if (hpOn()){ const c=el('a','credit','Powered by ホットペッパーグルメ Webサービス'); c.href='https://webservice.recruit.co.jp/'; c.target='_blank'; c.rel='noopener noreferrer'; ft.appendChild(c); }
  const gq=srch.q==='現在地の近く' ? '居酒屋' : srch.q+(/居酒屋|飲み|バー|酒場/.test(srch.q)?'':' 居酒屋');
  const g=el('a',null,`Googleマップで「${gq}」を探す`); g.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(gq); g.target='_blank'; g.rel='noopener noreferrer';
  ft.appendChild(g); p.appendChild(ft);
  v.appendChild(p);
}
function hero(v){
  const t=today(); const wants=shops.filter(inWant);
  const next=wants.filter(s=>s.planDate&&s.planDate>=t).sort((a,b)=>a.planDate<b.planDate?-1:1)[0];
  const top=next?null:wants.filter(s=>wantIds(s).length>=2).sort((a,b)=>wantIds(b).length-wantIds(a).length)[0];
  const s=next||top; if(!s) return;
  const c=el('button','ticket'); c.setAttribute('aria-label',(s.name||'')+'の詳細'); c.onclick=()=>openDetail(s.id);
  const l=el('div','tk-l');
  if (next){ const [y,m,d]=s.planDate.split('-').map(Number); const dt=new Date(y,m-1,d); const t0=new Date(); t0.setHours(0,0,0,0);
    const diff=Math.round((dt-t0)/864e5);
    l.append(el('span','tk-k','次の飲み'), el('span','tk-d',`${m}/${d}`), el('span','tk-w', '日月火水木金土'[dt.getDay()]+'曜日'), el('span','tk-w', diff===0?'今日':diff===1?'明日':`あと${diff}日`)); }
  else l.append(el('span','tk-k','いちばん人気'), el('span','tk-d',String(wantIds(s).length)), el('span','tk-w','人が行きたい'));
  const r=el('div','tk-r'); r.appendChild(el('span','tk-n',s.name||'(名前なし)')); if(s.area) r.appendChild(el('span','tk-a',s.area));
  const ids=wantIds(s); if(ids.length){ const st=el('span','stack'); r.appendChild(st); fillFaces([[st,ids.slice(0,6)]]); }
  c.append(l,r); v.appendChild(c);
}
