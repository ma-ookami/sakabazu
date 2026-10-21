/* ---------- render ---------- */
function setTab(t){ withTransition(()=>{ tab=t; rebuildShops(); for(const b of document.querySelectorAll('.tab[data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab===t)); render(); window.scrollTo({top:0}); }); }
document.querySelectorAll('.tab[data-tab]').forEach(b => b.onclick = () => setTab(b.dataset.tab));

function counts(){
  // my own counts (the 決める tab may have a 飲み友's shops mixed in)
  const w=mode==='db'&&me ? myShops.filter(s=>mySt(s)==='want').length : shops.filter(inWant).length, g=mode==='db'&&me ? myShops.filter(s=>mySt(s)==='went').length : shops.filter(inWent).length;
  $('sWant').textContent=w; $('sWent').textContent=g;
  const mb=$('mbStats'); mb.textContent=''; mb.append('行きたい', el('b',null,String(w)), '・行った', el('b',null,String(g)));
}
// Japanese input: while a word is still being composed, rebuilding the screen under the cursor makes the
// keyboard type it again (doubled letters). so wait, and redraw once the word is confirmed
let imeOn=false, renderLater=false;
document.addEventListener('compositionstart',()=>{ imeOn=true; },true);
document.addEventListener('compositionend',()=>{ imeOn=false; if(renderLater){ renderLater=false; setTimeout(render,0); } },true);
function render(){
  if (imeOn && $('view').contains(document.activeElement)){ renderLater=true; return; }
  counts(); meBtn();
  // typing in settings: don't rebuild under the cursor (data updates arrive while you type)
  if (tab==='set' && $('setBody') && $('setBody').contains(document.activeElement) && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && mode==='db') return;
  const ae=document.activeElement; const keep=(ae&&ae.id==='quick')?{s:ae.selectionStart,e:ae.selectionEnd}:null;
  const v=$('view'); v.textContent=''; document.body.classList.toggle('gating', mode==='gate');
  // looking with a 飲み友: the whole screen turns pale blue (with big faint ripples), so it reads as another mode
  document.documentElement.classList.toggle('fmode', mode==='db' && friendMode && tab==='home');
  if (mode==='gate'){ renderGate(v); return; }
  // 決める waits (up to 3s) until shops, today's picks and the 飲み友's come in, so nothing pops in and pushes the screen down
  if (mode==='loading' || (tab==='home' && !homeReady())){ const k=el('div','skel'+(tab==='home'?' skel-home':'')); k.setAttribute('role','status'); k.setAttribute('aria-label','読み込み中'); for(const h of (tab==='home'?(friendMode?[84,42,98,100]:[84,42,52,98,100]):[96,132,132,132])){ const i=el('i'); i.style.setProperty('--h',h+'px'); k.appendChild(i); } v.appendChild(k); return; }
  if (tab==='set'){ v.appendChild(el('h2','pagetitle','自分')); const b=el('div'); b.id='setBody'; v.appendChild(b); buildCrew(b); return; }
  if (tab==='home') renderHome(v);
  else if (tab==='cal') renderCal(v);
  else if (tab==='list'){ addFab(v); if (listSub==='cal') listSub='want'; listSeg(v); if(listSub==='want') renderWant(v); else renderWent(v); }
  else renderMap(v);
  if (keep){ const n=$('quick'); if(n){ n.focus(); try{ n.setSelectionRange(keep.s,keep.e); }catch{} } }
}
function matches(s){ if (tagFilter && !(s.tags && s.tags[tagFilter])) return false; const q=query.trim().toLowerCase(); return !q || (s.name||'').toLowerCase().includes(q) || (s.area||'').toLowerCase().includes(q); }


async function addOrBump(name,area,extra){
  name=tidyText(name).slice(0,60); area=tidyText(area).slice(0,40);
  const hid=extra&&extra.hp&&extra.hp.id;
  const dup=myShops.find(   // only my own list: a friend's shop gets copied in, not bumped
    s=>(hid && s.hp && s.hp.id===hid) || norm(s.name)===norm(name));
  if (dup){
    if (wentBy(dup)[me]) toast(`「${dup.name}」は行った店に記録済みです`, '開く', ()=>openDetail(dup.id));
    else if (dup.wants && dup.wants[me]) toast(`「${dup.name}」はもう行きたいに入っています`);
    else if (me){   // a shop I took out before: back in as 行きたい, with the new details
      const p={wants:{[me]:true}}; if (extra){ for (const k of ['loc','hours','tags','hp']) if (extra[k] && !dup[k]) p[k]=extra[k]; if (Array.isArray(extra.links)) p.links=[...new Set([...(Array.isArray(dup.links)?dup.links:[]), ...extra.links])].slice(0,5); }
      patchShop(dup.id,p); return dup.id; }
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

// the header's right: my icon -> 自分
function meBtn(){
  const b=$('meBtn'); if(!b) return;
  b.textContent=''; b.setAttribute('aria-pressed',String(tab==='set'));
  const nReq=Object.keys(frReqs).length; b.classList.toggle('has-req',nReq>0); b.setAttribute('aria-label', nReq ? `自分(飲み友申請 ${nReq}件)` : '自分(プロフィール・飲み友・設定)');
  if (me && members[me]) b.appendChild(avatar({},me,'me-av'));
  else b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.2" r="3.6"/><path d="M4.8 20.2c.9-3.9 3.7-6 7.2-6s6.3 2.1 7.2 6"/></svg>';
}
$('meBtn').onclick=()=>{ if (Object.keys(frReqs).length) setSub='friends'; setTab('set'); };

// 決める is ready when everything it shows has arrived (or after 3 seconds, whatever is there)
let homeSince=0;
function homeReady(){
  if (mode!=='db') return true;
  if (!homeSince){ homeSince=Date.now(); setTimeout(render,3100); }
  if (Date.now()-homeSince>3000) return true;
  if (!shopsLoaded || !todayLoaded) return false;
  if (friendMode){ if (!friendsLoaded) return false; if (mixedFriends().some(f=>!(f in fToday))) return false; }
  return true;
}
