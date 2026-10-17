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
  if (mode==='db') return enqueue(id,()=>db.doc('shops/'+id).update(patch));
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
function markWent(id,stayOpen){
  const s=shops.find(x=>x.id===id); if(!s) return;
  darumaCheer(`「${s.name}」おつかれさま!`);
  { const d=today(); const ev=ensureVisit(s,d); patchShop(id,Object.assign({went:wentPatch(s,me,d), wants:{[me]:false}}, ev.patch)); }
  // from the list: stay there so you can mark several in a row; the toast opens the shop if you want to add more
  if (!stayOpen){ buzz(); toast(`「${s.name}」を行ったに記録しました`,'詳しく',()=>{ const t=myShops.find(x=>x.id===id) || myShops.find(x=>norm(x.name)===norm(s.name)); openDetail(t?t.id:id); }); }
}
// 行った -> back to 行きたい (the visits stay), with undo
function backToWant(id){ const s=shops.find(x=>x.id===id); if(!s||!me) return; const was=wentBy(s)[me]||true;
  patchShop(id,{wants:{[me]:true}, went:wentPatch(s,me,null)});
  toast(`「${s.name}」を行きたいに戻しました`,'元に戻す',()=>{ const cur=shops.find(x=>x.id===id); if(cur) patchShop(id,{wants:{[me]:false}, went:wentPatch(cur,me,was)}); }); }
function markWant(id){ const s=shops.find(x=>x.id===id); if(!s||!me) return; patchShop(id,{wants:{[me]:true}, went:wentPatch(s,me,null)}); }
function removeMine(id){ const s=shops.find(x=>x.id===id); if(!s||!me||isFriendShop(s)) return; const was={want:!!(s.wants&&s.wants[me]), went:wentBy(s)[me]||null};
  patchShop(id,{wants:{[me]:false}, went:wentPatch(s,me,null)});
  toast('あなたのリストから外しました','元に戻す',()=>{ const cur=shops.find(x=>x.id===id); if(cur) patchShop(id,{wants:{[me]:was.want}, went:wentPatch(cur,me,was.went)}); }); }
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
  if (mode==='db') await enqueue(id,()=>db.doc('shops/'+id).delete()); else saveLocal();
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
