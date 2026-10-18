/* ---------- writes ---------- */
const queues={};
function enqueue(id,fn){ const p=(queues[id]||Promise.resolve()).then(fn).catch(onWriteError); queues[id]=p; return p; }
function onWriteError(e){
  const code=e&&e.code;
  if (code==='permission-denied') toast('保存できませんでした。グループから外れているか、保存できない内容です。');
  else if (code==='resource-exhausted') toast('今日の保存できる回数の上限に達しました。明日また試してください。');
  else if (code==='unavailable') toast('通信できないため、つながったら保存します。');
  else toast('保存できませんでした。通信状態を確認してください。');
}
function deepMerge(t,s){ for(const k in s){ if(s[k]&&typeof s[k]==='object'&&!Array.isArray(s[k])){ if(!t[k]||typeof t[k]!=='object') t[k]={}; deepMerge(t[k],s[k]); } else t[k]=s[k]; } return t; }
function patchShop(id,patch){
  if (readOnly) return Promise.resolve();
  // a friend's shop: copy it into my list first, then apply the change there
  if (id.startsWith('f~')){ importShop(id).then(nid=>{ if(nid && !nid.startsWith('f~')) patchShop(nid,patch); }); return Promise.resolve(); }
  patch.updatedAt=Date.now();
  const s=myShops.find(x=>x.id===id); if(s) deepMerge(s,JSON.parse(JSON.stringify(patch)));
  afterChange();
  if (mode==='db') return enqueue(id,()=>writeShop(id,patch));
  saveLocal(); return Promise.resolve();
}
const buzz=()=>{ try{ navigator.vibrate && navigator.vibrate(8); }catch{} };
function setMark(id,k,m){ if(!me) return; buzz(); patchShop(id,{r:{[me]:{[k]:{m}}}}); }
function toggleWant(id){ const s=shops.find(x=>x.id===id); if(!s||!me) return; patchShop(id,{wants:{[me]:!(s.wants&&s.wants[me])}}); }
function tagSec(s){
  const box=sec('特徴', readOnly?'':'当てはまるものをタップ');
  for (const c of TAG_CATS){
    box.appendChild(el('h4','tg-cat',c)); const ts=el('div','tagset');
    for (const t of TAGS.filter(x=>x.c===c)){ const b=el('button','tg',t.l); b.dataset.k=t.k; b.disabled=readOnly; b.setAttribute('aria-pressed',String(!!(s.tags&&s.tags[t.k])));
      b.onclick=()=>{ const cur=shops.find(x=>x.id===s.id); patchShop(s.id,{tags:{[t.k]:!(cur&&cur.tags&&cur.tags[t.k])}}); }; ts.appendChild(b); }
    box.appendChild(ts);
  }
  return box;
}
function markWent(id,stayOpen,date){
  const s=shops.find(x=>x.id===id); if(!s) return;
  const d = date===undefined ? today() : date;
  if (d===today()) darumaCheer(`「${s.name}」おつかれさま!`);
  if (d){ const ev=ensureVisit(s,d); patchShop(id,Object.assign({went:wentPatch(s,me,d), wants:{[me]:false}}, ev.patch)); }
  else patchShop(id,{went:wentPatch(s,me,true), wants:{[me]:false}});
  // from the list: stay there so you can mark several in a row; the toast opens the shop if you want to add more
  if (!stayOpen){ buzz(); toast(`「${s.name}」を行ったに記録しました`,'詳しく',()=>{ const t=myShops.find(x=>x.id===id) || myShops.find(x=>norm(x.name)===norm(s.name)); openDetail(t?t.id:id); }); }
}
// 行った -> back to 行きたい (the visits stay), with undo
// 行った from a list or the detail: ask when first (today / a day / don't remember)
function wentWhen(id,stayOpen,onCancel){
  const s=shops.find(x=>x.id===id); if(!s) return;
  actionSheet(`「${s.name||'このお店'}」にいつ行った?`,[
    {label:'今日', run:()=>markWent(id,stayOpen,today())},
    {label:'日付を選ぶ', run:async()=>{ const d=await askDate('行った日'); if(d) markWent(id,stayOpen,d); else if(onCancel) onCancel(); }},
    {label:'覚えてない(カレンダーには入れない)', run:()=>markWent(id,stayOpen,null)},
  ], onCancel);
}
function backToWant(id){ const s=shops.find(x=>x.id===id); if(!s||!me) return; const was=wentBy(s)[me]||true;
  const mine=visitList(s).filter(v=>v.people&&v.people[me]).map(v=>v.vid);
  const vis=on=>Object.fromEntries(mine.map(vid=>[vid,{people:{[me]:on}}]));
  patchShop(id,{wants:{[me]:true}, went:wentPatch(s,me,null), ...(mine.length?{visits:vis(false)}:{})});
  toast(`「${s.name}」を行きたいに戻しました`,'元に戻す',()=>{ const cur=shops.find(x=>x.id===id); if(cur) patchShop(id,{wants:{[me]:false}, went:wentPatch(cur,me,was), ...(mine.length?{visits:vis(true)}:{})}); }); }
// カレンダーから1日の記録を消す. if it was your only visit, the shop goes back to 行きたい
function unvisit(id,date,vid){ const s=shops.find(x=>x.id===id); if(!s||!me) return;
  const wd=wentBy(s)[me], wasWant=!!(s.wants&&s.wants[me]);
  const rest=visitList(s).filter(v=>v.vid!==vid && v.date!==date && v.people&&v.people[me]).map(v=>v.date);
  const p={}; if (vid) p.visits={[vid]:{people:{[me]:false}}};
  if (wd){ if (rest.length){ if (wd===date || wd===true) p.went=wentPatch(s,me,rest[0]); } else { p.went=wentPatch(s,me,null); p.wants={[me]:true}; } }
  patchShop(id,p);
  toast(rest.length||!wd ? `${fmtDate(date)}の「${s.name}」を消しました` : `「${s.name}」を消して、行きたいに戻しました`,'元に戻す',()=>{ const cur=shops.find(x=>x.id===id); if(!cur) return;
    const u={}; if (vid) u.visits={[vid]:{people:{[me]:true}}}; if (wd){ u.went=wentPatch(cur,me,wd); u.wants={[me]:wasWant}; } patchShop(id,u); }); }
function markWant(id){ const s=shops.find(x=>x.id===id); if(!s||!me) return; patchShop(id,{wants:{[me]:true}, went:wentPatch(s,me,null)}); }
function removeMine(id){ const s=shops.find(x=>x.id===id); if(!s||!me||isFriendShop(s)) return; const was={want:!!(s.wants&&s.wants[me]), went:wentBy(s)[me]||null};
  const mine=visitList(s).filter(v=>v.people&&v.people[me]).map(v=>v.vid);
  const vis=on=>mine.length?{visits:Object.fromEntries(mine.map(vid=>[vid,{people:{[me]:on}}]))}:{};
  patchShop(id,{wants:{[me]:false}, went:wentPatch(s,me,null), ...vis(false)});
  toast('あなたのリストから外しました','元に戻す',()=>{ const cur=shops.find(x=>x.id===id); if(cur) patchShop(id,{wants:{[me]:was.want}, went:wentPatch(cur,me,was.went), ...vis(true)}); }); }
// 行った日 changed in the detail: the visit on the old day moves to the new one (only mine moves if others were there too)
function moveMyVisit(s,from,to){
  if (!to) return {};
  const v=typeof from==='string' && visitList(s).find(x=>x.date===from && x.people&&x.people[me]);
  if (!v) return ensureVisit(s,to).patch;
  if (visitList(s).some(x=>x.vid!==v.vid && x.date===to && x.people&&x.people[me])) return {visits:{[v.vid]:{people:{[me]:false}}}};
  const others=Object.keys(v.people).filter(u=>u!==me && v.people[u]);
  if (!others.length) return {visits:{[v.vid]:{date:to}}};
  const nv=ensureVisit(s,to).patch; nv.visits[v.vid]={people:{[me]:false}}; return nv;
}
function queueMemo(id,k,t){ const key=id+'|'+k; pendingMemo[key]={id,k,t}; clearTimeout(memoTimers[key]); memoTimers[key]=setTimeout(()=>flushOne(key),700); }
function flushOne(key){ clearTimeout(memoTimers[key]); delete memoTimers[key]; const p=pendingMemo[key]; if(!p) return; delete pendingMemo[key]; patchShop(p.id,{r:{[me]:{[p.k]:{t:p.t}}}}); }
function flushMemos(){ for(const key of Object.keys(pendingMemo)) flushOne(key); }
async function addShop(name,area){
  const data={name,area,wants:me?{[me]:true}:{},went:{},createdBy:me,createdAt:Date.now(),updatedAt:Date.now(),r:{}};
  if (mode==='db'){
    const ref=db.collection('shops').doc();
    myShops.push({id:ref.id,...JSON.parse(JSON.stringify(data))}); afterChange();
    try{ await ref.set(data); }catch(e){ myShops=myShops.filter(s=>s.id!==ref.id); afterChange(); onWriteError(e); }
    return ref.id;
  }
  const id='l'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  myShops.push({id,...data}); saveLocal(); afterChange(); return id;
}
async function deleteShop(id){
  if (id.startsWith('f~')) return;
  myShops=myShops.filter(s=>s.id!==id); afterChange();
  if (mode==='db'){ await enqueue(id,()=>db.doc('shops/'+id).delete()); db.doc('priv/'+id).delete().catch(()=>{}); } else saveLocal();
  if (me && rankList(me).includes(id)) saveRank(rankList(me).filter(x=>x!==id));
}
function saveRank(ids){
  if (!me || readOnly) return;
  ids=ids.slice(0,RANK_MAX); rankings[me]={ids}; render();
  if (mode==='db') enqueue('rank:'+me,()=>db.doc('rankings/'+me).set({ids,updatedAt:Date.now()})); else saveLocal();
}

/* ---------- local fallback ---------- */
const LKEY='nomiya-memo-v2';
function loadLocal(){ try{ const v=JSON.parse(localStorage.getItem(LKEY)||'{}'); return {shops:Array.isArray(v.shops)?v.shops:[], rankings:v.rankings||{}, today:v.today||{}}; }catch{ return {shops:[],rankings:{},today:{}}; } }
function saveLocal(){ if(mode!=='local') return; try{ localStorage.setItem(LKEY,JSON.stringify({shops:myShops,rankings,today:todayDocs})); }catch{} }
function afterChange(){ rebuildShops(); render(); if(openId) patchDetail(); if(isOpen('pickSheet')) buildPick(); }

// 本命 (the shops you most want to go to): r[uid].hon. shown as a 提灯 that lights up
const LANTERN='<svg class="lan" viewBox="0 0 20 28" aria-hidden="true"><rect class="lan-cap" x="6" y="2" width="8" height="3" rx="1"/><ellipse class="lan-body" cx="10" cy="14" rx="7.2" ry="9"/><path class="lan-rib" d="M3.6 10.5Q10 12.5 16.4 10.5M3 14.5Q10 16.5 17 14.5M3.6 18.5Q10 20.5 16.4 18.5"/><rect class="lan-cap" x="6" y="22.5" width="8" height="3" rx="1"/><path class="lan-tas" d="M10 25.5v2.3"/></svg>';
const lanEl = () => { const t=document.createElement('template'); t.innerHTML=LANTERN; return t.content.firstChild; };
// 本命 is for shops still wanted: once you've been there it no longer counts (行きつけ takes over)
const isHon = (s,u=me) => !!(s && s.r && s.r[u] && s.r[u].hon) && !wentBy(s)[u];
const honBy = s => inScope(Object.keys((s&&s.r)||{}).filter(u=>isHon(s,u)));
function toggleHon(id){ const s=shops.find(x=>x.id===id); if(!s||!me||readOnly) return; const on=!isHon(s); buzz();
  patchShop(id,{r:{[me]:{hon:on}}}); if (on) toast(`「${s.name}」を本命にしました`); }
function honBtn(s){
  const on=isHon(s); const b=el('button','hon-btn'); b.appendChild(lanEl()); b.type='button'; b.setAttribute('aria-pressed',String(on));
  b.setAttribute('aria-label',(s.name||'')+(on?'の本命を外す':'を本命にする')); b.title=on?'本命':'本命にする';
  b.onclick=e=>{ e.stopPropagation(); toggleHon(s.id); }; return b;
}
// a label: 本命 / <nick>の本命 / 2人とも本命
function honPill(ch,s){ const by=honBy(s); if(!by.length) return;
  const t = by.length>1 ? '2人とも本命' : by[0]===me ? '本命' : `${(friendByMid(by[0])||{}).nick||'飲み友'}の本命`;
  pill(ch,'hon',t); ch.lastChild.prepend(lanEl()); }

// ---------- private part of a shop (groups/{gid}/priv/{shopId}, readable only by me) ----------
const PUBLIC_R = ['star','hon','tsuke'];
function splitPriv(p){
  const pub={}, priv={};
  for (const k in p){
    if (k==='visits'){ priv.visits=p.visits; continue; }
    if (k==='r' && p.r && typeof p.r==='object'){
      for (const u in p.r){ const v=p.r[u];
        if (!v || typeof v!=='object'){ (pub.r=pub.r||{})[u]=v; continue; }
        for (const f in v){ const box = PUBLIC_R.includes(f) ? (pub.r=pub.r||{}) : (priv.r=priv.r||{}); (box[u]=box[u]||{})[f]=v[f]; } }
      continue; }
    pub[k]=p[k];
  }
  return {pub, priv: Object.keys(priv).length ? priv : null};
}
// write both halves. until the rules know priv/, the private half goes in the shop as before
function writeShop(id,patch){
  const {pub,priv}=splitPriv(patch);
  return Promise.all([
    Object.keys(pub).length ? db.doc('shops/'+id).update(pub) : null,
    priv ? db.doc('priv/'+id).update(priv).catch(e=>{ if(e && e.code==='permission-denied') return db.doc('shops/'+id).update(priv); throw e; }) : null,
  ]);
}
// shops written before: move their private part out of the shop (once, quietly). only after priv/ accepts writes
let privMoved=new Set();
function movePrivOut(raw){
  for (const s of raw){
    if (privMoved.has(s.id)) continue;
    const r=s.r||{}, rp={}; let any=false;
    for (const u in r){ const v=r[u]; if(!v||typeof v!=='object') continue; for (const f in v) if(!PUBLIC_R.includes(f)){ (rp[u]=rp[u]||{})[f]=v[f]; any=true; } }
    const hasVisits = s.visits && typeof s.visits==='object' && Object.keys(s.visits).length;
    if (!any && !hasVisits) continue;
    privMoved.add(s.id);
    const priv={}; if (any) priv.r=rp; if (hasVisits) priv.visits=s.visits;
    const del={}; if (hasVisits) del.visits=null; if (any){ del.r={}; for (const u in rp){ del.r[u]={}; for (const f in rp[u]) del.r[u][f]=null; } }
    enqueue(s.id,()=>db.doc('priv/'+s.id).update(JSON.parse(JSON.stringify(priv))).then(()=>db.doc('shops/'+s.id).update(del)).catch(e=>console.warn('priv move',e&&e.code)));
  }
}

// 行きつけ (shops I keep going back to): r[uid].tsuke. shown as a お猪口 that fills with sake
const CHOKO='<svg class="choko" viewBox="0 0 24 22" aria-hidden="true"><path class="ck-body" d="M3.5 6.5h17l-2.3 10.2a2.4 2.4 0 0 1-2.3 1.8H8.1a2.4 2.4 0 0 1-2.3-1.8z"/><path class="ck-sake" d="M5.3 9.6h13.4l-1.6 6.6a1.5 1.5 0 0 1-1.4 1.1H8.3a1.5 1.5 0 0 1-1.4-1.1z"/><ellipse class="ck-ring" cx="12" cy="13.2" rx="3.1" ry="1.5"/><ellipse class="ck-dot" cx="12" cy="13.2" rx="1.2" ry=".55"/><path class="ck-foot" d="M9 18.5h6v1.6H9z"/><path class="ck-rim" d="M3.5 6.5h17"/></svg>';
const chokoEl = () => { const t=document.createElement('template'); t.innerHTML=CHOKO; return t.content.firstChild; };
const isTsuke = (s,u=me) => !!(s && s.r && s.r[u] && s.r[u].tsuke);
const tsukeBy = s => inScope(Object.keys((s&&s.r)||{}).filter(u=>isTsuke(s,u)));
function toggleTsuke(id){ const s=shops.find(x=>x.id===id); if(!s||!me||readOnly) return; const on=!isTsuke(s); buzz();
  patchShop(id,{r:{[me]:{tsuke:on}}}); if (on) toast(`「${s.name}」を行きつけにしました`); }
function tsukeBtn(s){
  const on=isTsuke(s); const b=el('button','tsuke-btn'); b.appendChild(chokoEl()); b.type='button'; b.setAttribute('aria-pressed',String(on));
  b.setAttribute('aria-label',(s.name||'')+(on?'の行きつけを外す':'を行きつけにする')); b.title=on?'行きつけ':'行きつけにする';
  b.onclick=e=>{ e.stopPropagation(); toggleTsuke(s.id); }; return b;
}
// a label: 行きつけ / <nick>の行きつけ / 2人の行きつけ
function tsukePill(ch,s){ const by=tsukeBy(s); if(!by.length) return;
  const t = by.length>1 ? '2人の行きつけ' : by[0]===me ? '行きつけ' : `${(friendByMid(by[0])||{}).nick||'飲み友'}の行きつけ`;
  pill(ch,'tsuke',t); ch.lastChild.prepend(chokoEl()); }
