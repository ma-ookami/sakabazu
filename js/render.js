/* ---------- render ---------- */
function setTab(t){ withTransition(()=>{ tab=t; rebuildShops(); for(const b of document.querySelectorAll('.tab[data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab===t)); render(); window.scrollTo({top:0}); }); }
document.querySelectorAll('.tab[data-tab]').forEach(b => b.onclick = () => setTab(b.dataset.tab));

function counts(){
  // my own counts (the 決める tab may have a 飲み友's shops mixed in)
  const w=mode==='db'&&me ? myShops.filter(s=>mySt(s)==='want').length : shops.filter(inWant).length, g=mode==='db'&&me ? myShops.filter(s=>mySt(s)==='went').length : shops.filter(inWent).length;
  $('sWant').textContent=w; $('sWent').textContent=g; $('tWant').textContent=w||''; $('tWent').textContent=g||'';
  const mb=$('mbStats'); mb.textContent=''; mb.append('行きたい', el('b',null,String(w)), '・行った', el('b',null,String(g)));
}
// Japanese input: while a word is still being composed, rebuilding the screen under the cursor makes the
// keyboard type it again (doubled letters). so wait, and redraw once the word is confirmed
let imeOn=false, renderLater=false;
document.addEventListener('compositionstart',()=>{ imeOn=true; },true);
document.addEventListener('compositionend',()=>{ imeOn=false; if(renderLater){ renderLater=false; setTimeout(render,0); } },true);
function render(){
  if (imeOn && $('view').contains(document.activeElement)){ renderLater=true; return; }
  counts(); { const n=$('flaps'); if(n) n.textContent=''; }   // the header no longer switches lists
  // typing in settings: don't rebuild under the cursor (data updates arrive while you type)
  if (tab==='set' && $('setBody') && $('setBody').contains(document.activeElement) && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && mode==='db') return;
  const ae=document.activeElement; const keep=(ae&&ae.id==='quick')?{s:ae.selectionStart,e:ae.selectionEnd}:null;
  const v=$('view'); v.textContent=''; document.body.classList.toggle('gating', mode==='gate');
  // looking with a 飲み友: the whole screen turns pale blue (with big faint ripples), so it reads as another mode
  document.documentElement.classList.toggle('fmode', mode==='db' && friendMode && tab==='home');
  if (mode==='gate'){ renderGate(v); return; }
  if (mode==='loading'){ const k=el('div','skel'); k.setAttribute('role','status'); k.setAttribute('aria-label','読み込み中'); for(const h of [96,132,132,132]){ const i=el('i'); i.style.setProperty('--h',h+'px'); k.appendChild(i); } v.appendChild(k); return; }
  if (tab==='set'){ v.appendChild(el('h2','pagetitle','自分')); const b=el('div'); b.id='setBody'; v.appendChild(b); buildCrew(b); return; }
  if (tab==='home') renderHome(v);
  else if (tab==='list'){ addFab(v); listSeg(v); if(listSub==='want') renderWant(v); else renderWent(v); }
  else renderMap(v);
  if (keep){ const n=$('quick'); if(n){ n.focus(); try{ n.setSelectionRange(keep.s,keep.e); }catch{} } }
}
function matches(s){ if (tagFilter && !(s.tags && s.tags[tagFilter])) return false; const q=query.trim().toLowerCase(); return !q || (s.name||'').toLowerCase().includes(q) || (s.area||'').toLowerCase().includes(q); }

function searchBox(v){
  const lab=el('label','sr','店名やエリアで探す'); lab.htmlFor='q';
  const q=el('input','field'); q.id='q'; q.type='search'; q.placeholder='リストの中から絞り込む'; q.value=query;
  const apply=()=>{ query=q.value; const pos=q.selectionStart; render(); const n=$('q'); if(n){ n.focus(); try{ n.setSelectionRange(pos,pos); }catch{} } };
  q.oninput=e=>{ if (e.isComposing || imeOn) return; apply(); };   // while composing: wait for the word
  q.addEventListener('compositionend',()=>setTimeout(apply,0));
  v.appendChild(lab); return q;
}
// nothing in my lists matched: offer to look for new shops with the same words
function searchInstead(box){
  const w=query.trim(); if(!w || !hpOn() || readOnly) return;
  const b=el('button','btn btn-line',`「${w}」を新しいお店から探す`); b.style.marginTop='12px';
  b.onclick=()=>{ query=''; render(); openSearch(w); };
  box.appendChild(b);
}

let quickVal='';
async function addOrBump(name,area,extra){
  const hid=extra&&extra.hp&&extra.hp.id;
  const dup=myShops.find(   // only my own list: a friend's shop gets copied in, not bumped
    s=>(hid && s.hp && s.hp.id===hid) || norm(s.name)===norm(name));
  if (dup){
    if (wentBy(dup)[me]) toast(`「${dup.name}」は行った店に記録済みです`, '開く', ()=>openDetail(dup.id));
    else if (dup.wants && dup.wants[me]) toast(`「${dup.name}」はもう行きたいに入っています`);
    else if (me){ patchShop(dup.id,{wants:{[me]:true}}); const others=wentIds(dup).filter(u=>u!==me).length; toast(`「${dup.name}」を行きたいに入れました${others?`(${others}人が行ったことあり)`:''}`); }
    return null;
  }
  const id=await addShop(name,area);
  if (id) darumaCheer(`「${name}」、いいね!行けるといいね`);
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
