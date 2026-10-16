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
  $('dEdit').hidden=readOnly; $('dDel').hidden=readOnly;
  $('dSeg').setAttribute('aria-label','あなたの状態');
  for (const b of $('dSeg').children){ b.disabled=readOnly||!me; b.onclick=()=>{ const cur=shops.find(x=>x.id===s.id); if(!cur) return; const m=mySt(cur); if(m===b.dataset.s) removeMine(s.id); else (b.dataset.s==='went'?markWent(s.id,true):markWant(s.id)); }; }
  const body=$('dBody'); body.textContent='';
  body.appendChild(infoSec());
  if (st==='want'){
    const p=sec('行く予定日'); const d=el('input','dateinput'); d.type='date'; d.id='dPlan'; d.disabled=readOnly; d.onchange=()=>patchShop(s.id,{planDate:d.value}); p.appendChild(d); body.appendChild(p);
    body.appendChild(tagSec(s));
    body.appendChild(locSec(s));
    const w=sec('行きたい人'); const wl=el('div','faces'); wl.id='dWants'; w.appendChild(wl);
    if(!readOnly&&me){ const b=el('button','want-btn'); b.id='dWantBtn'; b.style.marginTop='10px'; b.onclick=()=>toggleWant(s.id); w.appendChild(b); }
    if (groupMode()) body.appendChild(w);
    const n=sec('気になっている理由・メモ'); memoBox(n,'note','例: 友達のおすすめ、金曜は要予約'); body.appendChild(n);
    if(!readOnly){ const g=el('button','btn btn-red big-went','行った'); g.onclick=()=>markWent(s.id,true); body.appendChild(g); }
  } else {
    const p=sec('行った人'); const wb=el('div','faces'); wb.id='dWentBy'; p.appendChild(wb);
    if (wentBy(s)[me] && !readOnly){ const lab=el('label','loctxt','あなたが行った日 '); lab.style.display='block'; lab.style.margin='12px 0 0'; const d=el('input','dateinput'); d.type='date'; d.id='dWent';
      d.onchange=()=>{ const cur=shops.find(x=>x.id===s.id); if(cur) patchShop(s.id,{went:wentPatch(cur,me,d.value||true)}); }; lab.appendChild(d); p.appendChild(lab); }
    else if (!readOnly && me){ const g=el('button','btn btn-red'); g.textContent='私も行った'; g.style.marginTop='12px'; g.onclick=()=>markWent(s.id,true); p.appendChild(g); }
    body.appendChild(p);
    body.appendChild(visitSec(s));
    body.appendChild(locSec(s));
    const rs=sec('評価', me&&!readOnly ? 'タップで付ける・もう一度で取り消し' : '');
    const grid=el('div','grid');
    for (const it of ITEMS){
      const lb=el('div','lb',it.label); lb.appendChild(el('small',null,it.hint)); grid.appendChild(lb);
      const stp=el('div','stamps'); stp.setAttribute('role','group'); stp.setAttribute('aria-label',it.label+'の評価'); stp.dataset.k=it.k;
      for (const m of MARKS){ const b=el('button','stamp',m); b.dataset.m=m; b.disabled=readOnly||!me; b.setAttribute('aria-label',`${it.label} ${m}`);
        b.onclick=()=>{ const cur=myVal(openId,it.k).m; setMark(openId,it.k,cur===m?'':m); }; stp.appendChild(b); }
      grid.appendChild(stp);
    }
    rs.appendChild(grid); const tb=el('div'); tb.id='dTable'; rs.appendChild(tb); body.appendChild(rs);
    body.appendChild(tagSec(s));
    const dt=el('details','memos sec'); const sm=el('summary',null,'項目ごとのメモ'); dt.appendChild(sm);
    const rr=s.r||{}; dt.open = ITEMS.some(it=>Object.values(rr).some(p=>p&&p[it.k]&&(p[it.k].t||'').trim()));
    for (const it of ITEMS){ const mi=el('div','mi'); mi.appendChild(el('h4',null,it.label)); memoBox(mi,it.k,it.ph); dt.appendChild(mi); }
    body.appendChild(dt);
    const n=sec('ひとこと'); memoBox(n,'note','例: 金曜は混むので予約必須'); body.appendChild(n);
  }
}
async function patchDetail(){
  const s=shops.find(x=>x.id===openId); if(!s){ if(openId) closeDetail(); return; }
  if (builtStatus!==(statusOf(s)||'want')+'|'+mySt(s)+'|'+[...mix].join()) buildDetail(s);
  $('dName').textContent=s.name||'(名前なし)'; $('dArea').textContent=s.area||'';
  for (const b of $('dSeg').children) b.setAttribute('aria-pressed',String(b.dataset.s===mySt(s)));
  const plan=$('dPlan'); if(plan && document.activeElement!==plan) plan.value=s.planDate||'';
  const went=$('dWent'); if(went && document.activeElement!==went){ const v=wentBy(s)[me]; went.value=typeof v==='string'?v:''; }
  const dwb=$('dWentBy'); if(dwb){ const ids=wentIds(s); const pw=await people(ids); if(openId!==s.id) return; dwb.textContent=''; if(ids.length){ const st=el('span','stack'); ids.slice(0,6).forEach(u=>st.appendChild(avatar(pw,u))); dwb.appendChild(st); dwb.appendChild(el('span',null,ids.map(u=>nameOf(pw,u)).join('、'))); } else dwb.appendChild(el('span',null,'まだいません')); }
  const lt=$('dLocTxt'); if(lt) lt.textContent = s.loc ? (s.loc.src==='gps' ? '現在地で位置を記録済み。地図タブに表示されます。' : 'リンクから位置を記録済み。地図タブに表示されます。') : '位置はまだ記録されていません。お店にいるときは「ここを記録」が便利です。';
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
