/* ---------- detail ---------- */
const memoTimers={}, pendingMemo={};
function openDetail(id,opts){ openId=id; builtStatus=null; showSheet('detail',opts); patchDetail(); $('dBack').focus({preventScroll:true}); }
function closeDetail(){ flushMemos(); openId=null; hideSheet('detail'); render(); }
function myVal(id,k){ const s=shops.find(x=>x.id===id); return (s&&s.r&&me&&s.r[me]&&s.r[me][k])||{}; }
function sec(title,hint){ const box=el('section','sec'); const h=el('div','sec-h'); h.appendChild(el('h3',null,title)); if(hint) h.appendChild(el('small',null,hint)); box.appendChild(h); return box; }
function memoBox(box,k,ph){
  if (!readOnly && me){ const ta=el('textarea','memo'); ta.rows=1; ta.placeholder=ph; ta.maxLength=300; ta.dataset.k=k; ta.setAttribute('aria-label','メモ');
    ta.oninput=()=>queueMemo(openId,k,ta.value); ta.onblur=()=>flushMemos(); box.appendChild(ta); }
  const o=el('div','others'); o.dataset.k=k; box.appendChild(o);
}
function buildDetail(s){
  const st=statusOf(s)||'want'; builtStatus=st+'|'+mySt(s)+'|'+[...mix].join();
  $('dMore').hidden=readOnly||!me;
  $('dSeg').setAttribute('aria-label','あなたの状態');
  for (const b of $('dSeg').children){ b.disabled=readOnly||!me; b.onclick=()=>{ const cur=shops.find(x=>x.id===s.id); if(!cur) return; const m=mySt(cur); if(m===b.dataset.s) return;
    (b.dataset.s==='went'?wentWhen(s.id,true):markWant(s.id)); }; }
  const body=$('dBody'); body.textContent='';
  // on top: 星 and ひとこと (went) or the memo (want), with no headings. below: one line per thing, opened on tap
  const rr=s.r||{}, mine=rr[me]||{};
  const top=el('div','d-main'); body.appendChild(top);
  const rows=el('div','d-rows');
  if (st==='want'){
    memoBox(top,'note','メモ(気になっている理由など)');
    const p=el('div'); const dt=el('input','dateinput'); dt.type='date'; dt.id='dPlan'; dt.disabled=readOnly; dt.setAttribute('aria-label','行く予定日'); dt.onchange=()=>patchShop(s.id,{planDate:dt.value}); p.appendChild(dt);
    rows.appendChild(fold('行く予定日',p,'','📅','dPlanV'));
    rows.appendChild(fold('場所',locSec(s),'','📍','dLocV'));
    if (groupMode()){ const w=el('div'); const wl=el('div','faces'); wl.id='dWants'; w.appendChild(wl);
      if(!readOnly&&me){ const b=el('button','want-btn'); b.id='dWantBtn'; b.style.marginTop='10px'; b.onclick=()=>toggleWant(s.id); w.appendChild(b); }
      rows.appendChild(fold('行きたい人',w,'','👥')); }
    rows.appendChild(fold('特徴',tagSec(s),cnt(tagCount(s)),'🏷'));
    body.appendChild(rows);
    if(!readOnly){ const g=el('button','btn btn-red big-went d-went','行った'); g.onclick=()=>wentWhen(s.id,true); body.appendChild(g); }
  } else {
    const sw=el('div','d-star'); sw.appendChild(starInput(s)); top.appendChild(sw);
    memoBox(top,'note','ひとこと(例: 金曜は要予約)');
    const p=el('div'); const wb=el('div','faces'); wb.id='dWentBy'; if (groupMode()) p.appendChild(wb);
    if (wentBy(s)[me] && !readOnly){ const dt=el('input','dateinput'); dt.type='date'; dt.id='dWent'; dt.max=today(); dt.setAttribute('aria-label','行った日');
      dt.onchange=()=>{ const cur=shops.find(x=>x.id===s.id); if(!cur) return; const from=wentBy(cur)[me]; patchShop(s.id,Object.assign({went:wentPatch(cur,me,dt.value||true)}, moveMyVisit(cur,from,dt.value))); }; p.appendChild(dt); }
    else if (!readOnly && me){ const g=el('button','btn btn-red'); g.textContent='私も行った'; g.onclick=()=>wentWhen(s.id,true); p.appendChild(g); }
    rows.appendChild(fold('行った日',p,'','📅','dWentV'));
    rows.appendChild(fold('場所',locSec(s),'','📍','dLocV'));
    const ms=el('div');
    const grid=el('div','grid');
    for (const it of ITEMS){
      const lb=el('div','lb',it.label); lb.appendChild(el('small',null,it.hint)); grid.appendChild(lb);
      const stp=el('div','stamps'); stp.setAttribute('role','group'); stp.setAttribute('aria-label',it.label+'の評価'); stp.dataset.k=it.k;
      for (const m of MARKS){ const b=el('button','stamp'); b.innerHTML=markSvg(m); b.dataset.m=m; b.disabled=readOnly||!me; b.setAttribute('aria-label',`${it.label} ${m}`);
        b.onclick=()=>{ const cur=myVal(openId,it.k).m; setMark(openId,it.k,cur===m?'':m); }; stp.appendChild(b); }
      grid.appendChild(stp);
    }
    ms.appendChild(el('p','hint','タップで付ける・もう一度で取り消し')); ms.appendChild(grid); const tb=el('div'); tb.id='dTable'; ms.appendChild(tb);
    rows.appendChild(fold('項目ごとの評価',ms,cnt(ITEMS.filter(it=>mine[it.k]&&mine[it.k].m).length),'◎'));
    rows.appendChild(fold('特徴',tagSec(s),cnt(tagCount(s)),'🏷'));
    rows.appendChild(fold('来店記録・会計',visitSec(s),cnt(visitList(s).length),'🧾'));
    const mm=el('div'); for (const it of ITEMS){ const mi=el('div','mi'); mi.appendChild(el('h4',null,it.label)); memoBox(mi,it.k,it.ph); mm.appendChild(mi); }
    rows.appendChild(fold('項目ごとのメモ',mm,cnt(ITEMS.filter(it=>Object.values(rr).some(p=>p&&p[it.k]&&(p[it.k].t||'').trim())).length),'✎'));
    body.appendChild(rows);
  }
}
const cnt = n => n ? n+'件' : '';
// one line of the list: icon, title, a short value on the right; tap to open (remembered while you look at shops)
const foldOpen=new Set();
function fold(title,node,val,icon,vid){
  const d=el('details','fold'); d.open=foldOpen.has(title);
  const sm=el('summary'); if(icon) sm.appendChild(el('span','fd-i',icon)); sm.appendChild(el('span','fd-t',title));
  const v=el('span','fd-v',val||''); if(vid) v.id=vid; sm.appendChild(v);
  d.appendChild(sm); const inner=el('div','fd-body'); inner.appendChild(node); d.appendChild(inner);
  d.ontoggle=()=>{ if(d.open) foldOpen.add(title); else foldOpen.delete(title); };
  return d;
}
const tagCount = s => TAGS.filter(t=>s.tags&&s.tags[t.k]).length;
async function patchDetail(){
  const s=shops.find(x=>x.id===openId); if(!s){ if(openId) closeDetail(); return; }
  if (builtStatus!==(statusOf(s)||'want')+'|'+mySt(s)+'|'+[...mix].join()) buildDetail(s);
  $('dName').textContent=s.name||'(名前なし)';
  for (const b of $('dSeg').children) b.setAttribute('aria-pressed',String(b.dataset.s===mySt(s)));
  { const v=$('dWentV'); if(v){ const w=wentBy(s)[me]; v.textContent = typeof w==='string' ? fmtDate(w) : w ? '日付なし' : ''; } }
  { const v=$('dPlanV'); if(v) v.textContent = s.planDate ? fmtDate(s.planDate) : '未定'; }
  { const v=$('dLocV'); if(v) v.textContent = s.loc ? '記録済み' : '未記録'; }
  const plan=$('dPlan'); if(plan && document.activeElement!==plan) plan.value=s.planDate||'';
  const went=$('dWent'); if(went && document.activeElement!==went){ const v=wentBy(s)[me]; went.value=typeof v==='string'?v:''; }
  const dwb=$('dWentBy'); if(dwb){ const ids=wentIds(s); const pw=await people(ids); if(openId!==s.id) return; dwb.textContent=''; if(ids.length){ const st=el('span','stack'); ids.slice(0,6).forEach(u=>st.appendChild(avatar(pw,u))); dwb.appendChild(st); dwb.appendChild(el('span',null,ids.map(u=>nameOf(pw,u)).join('、'))); } else dwb.appendChild(el('span',null,'まだいません')); }
  const lt=$('dLocTxt'); if(lt) lt.textContent = s.loc ? (s.loc.src==='gps' ? '現在地で記録済み(地図タブに表示)' : 'リンクから記録済み(地図タブに表示)') : 'お店にいるときは「ここを記録」が便利です。';
  const ml=$('dMapLink'); if(ml) ml.href=mapsUrl(s);
  const lc=$('dLocClr'); if(lc) lc.hidden=!s.loc;
  const r=s.r||{}; const others=inScope(Object.keys(r)).filter(u=>u!==me); const wl=wantIds(s);
  const ps=await people([...others,...wl]); if(openId!==s.id) return;
  const dw=$('dWants'); if(dw){ dw.textContent=''; if(wl.length){ const st=el('span','stack'); wl.forEach(u=>st.appendChild(avatar(ps,u))); dw.appendChild(st); dw.appendChild(el('span',null,wl.map(u=>nameOf(ps,u)).join('、'))); } else dw.appendChild(el('span',null,'まだいません')); }
  const wb=$('dWantBtn'); if(wb){ const mine=!!(s.wants&&s.wants[me]); wb.textContent=mine?'行きたい ✓':'私も行きたい'; wb.setAttribute('aria-pressed',String(mine)); }
  for (const stp of document.querySelectorAll('#dBody .stamps')){ const m=myVal(s.id,stp.dataset.k).m; for(const b of stp.children) b.setAttribute('aria-pressed',String(b.dataset.m===m)); }
  for (const b of document.querySelectorAll('#dBody .tg')) b.setAttribute('aria-pressed',String(!!(s.tags&&s.tags[b.dataset.k])));
  const tb=$('dTable'); if(tb){ tb.textContent=''; const raters=others.filter(u=>ITEMS.some(it=>r[u]&&r[u][it.k]&&r[u][it.k].m));
    if (raters.length){ const t=el('table','otable'); const hr=el('tr'); hr.appendChild(el('th',null,'')); ITEMS.forEach(it=>hr.appendChild(el('th',null,it.short))); t.appendChild(hr);
      for (const u of raters){ const tr=el('tr'); const w=el('td','who'); w.appendChild(avatar(ps,u)); w.appendChild(document.createTextNode(nameOf(ps,u))); tr.appendChild(w);
        ITEMS.forEach(it=>tr.appendChild(el('td',null,(r[u][it.k]&&r[u][it.k].m)||'–'))); t.appendChild(tr); }
      tb.appendChild(t); } }
  for (const ta of document.querySelectorAll('#dBody textarea')){ const k=ta.dataset.k; if(document.activeElement!==ta && !memoTimers[s.id+'|'+k]) ta.value=myVal(s.id,k).t||''; }
  for (const o of document.querySelectorAll('#dBody .others')){ const k=o.dataset.k; o.textContent='';
    for (const u of others){ const v=r[u]&&r[u][k]; if(!v||(!v.m&&!(v.t||'').trim())) continue;
      const row=el('div','other'); row.appendChild(avatar(ps,u)); row.appendChild(el('span','om',v.m||''));
      const t=el('span','ot'); t.appendChild(el('strong',null,nameOf(ps,u))); if((v.t||'').trim()) t.appendChild(document.createTextNode(v.t)); row.appendChild(t); o.appendChild(row); } }
  fillInfo(s);
  fillVisits(s); fillGuess(s);
}
