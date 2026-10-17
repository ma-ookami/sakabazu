/* ---------- want / went lists and ranking ---------- */
const listF={at:'',genre:'',star:0};   // the lists' 時間 / ジャンル / 星 (same pickers as 今日どこ行く?)
async function renderWant(v){
  let arr=shops.filter(inWant);
  filterBar(v,listF,arr,render);
  arr=arr.filter(s=>fMatch(s,listF)).sort((a,b)=>{
    const pa=a.planDate||'', pb=b.planDate||'';
    if (pa&&!pb) return -1; if (pb&&!pa) return 1; if (pa!==pb) return pa<pb?-1:1;
    const wa=wantIds(a).length, wb=wantIds(b).length; if(wa!==wb) return wb-wa;
    return (b.createdAt||0)-(a.createdAt||0);
  });
  const list=el('div','list'); v.appendChild(list);
  if (!arr.length){
    const e=el('div','empty'); e.appendChild(el('span','mincho', fOn(listF)?'条件に合う店がありません':'行きたい店はまだありません'));
    if(!fOn(listF)) e.appendChild(document.createTextNode('右下の「＋」から、気になる店を入れていきましょう。')); list.appendChild(e); return;
  }
  const slots=[];
  for (const s of arr){
    const {c,top,chips}=cardShell(s);
    if (!readOnly && me && !wentBy(s)[me]){ const w=el('button','went-btn live','行った'); w.setAttribute('aria-label',(s.name||'')+'に行った'); w.onclick=()=>wentWhen(s.id); top.appendChild(w); }
    if (!readOnly && me && s.wants && s.wants[me] && !isFriendShop(s)){ const x=el('button','out-btn','外す'); x.type='button'; x.setAttribute('aria-label',(s.name||'')+'をリストから外す');
      x.onclick=e=>{ e.stopPropagation(); removeMine(s.id); }; top.appendChild(x); }
    if (s.planDate) pill(chips,'plan',fmtDate(s.planDate)+' に行く予定');
    hoursPill(chips,s); { const sl=starLine(s); if(sl) chips.appendChild(sl); }
    const ids=wantIds(s).sort((a,b)=>(a===me)-(b===me));   // others first, me last (same as whoText)
    if (groupMode()){
    const foot=el('div','foot');
    const faces=el('div','faces'); const st=el('span','stack'); faces.appendChild(st);
    faces.appendChild(el('span',null, whoText(ids,'行きたい')));
    foot.appendChild(faces); slots.push([st,ids.slice(0,5)]);
    // only for shops the 飲み友 wants and I don't yet (whether I want it already shows in the faces line)
    if (!readOnly && me && groupMode() && !(s.wants&&s.wants[me])){ const wb=el('button','want-btn live', isFriendShop(s)?'＋ 自分のリストに入れる':'私も行きたい'); wb.onclick=()=>toggleWant(s.id); foot.appendChild(wb); }
    c.appendChild(foot); }
    list.appendChild(c);
  }
  fillFaces(slots);
}

let wentView='list';   // 行った: the list, or the calendar of visits
function renderWent(v){
  segBar(v,[['list','リスト'],['cal','カレンダー']],wentView,k=>{ wentView=k; },'subseg');
  if (wentView==='cal'){ const sub=el('div'); v.appendChild(sub); renderCal(sub); return; }
  filterBar(v,listF,shops.filter(inWent),render);
  let arr=shops.filter(inWent).filter(s=>fMatch(s,listF));
  if (!['new','star','price'].includes(sort)) sort='new';
  const key = sort==='price'?'price':null;
  arr.sort((a,b)=>{ if(sort==='star'){ const x=(starAvg(a)||{}).v, y=(starAvg(b)||{}).v; if(x!==y) return (y??-1)-(x??-1); } if(key){ const x=avg(a,key), y=avg(b,key); if(x!==y) return (y??-1)-(x??-1); }
    return lastWent(b).localeCompare(lastWent(a)) || (b.createdAt||0)-(a.createdAt||0); });
  const meta=el('div','meta'); meta.appendChild(el('span',null,`${arr.length} 軒`));
  const lab=el('label',null,'並び順 '); const sel=el('select');
  for (const [val,txt] of [['new','新しい順'],['star','星が高い順'],['price','安い順']]){ const o=el('option',null,txt); o.value=val; o.selected=sort===val; sel.appendChild(o); }
  sel.onchange=()=>{sort=sel.value; render();}; lab.appendChild(sel); meta.appendChild(lab); v.appendChild(meta);
  const list=el('div','list'); v.appendChild(list);
  if (!arr.length){ const e=el('div','empty'); e.appendChild(el('span','mincho', shops.some(inWent)?'条件に合う店がありません':'まだ記録がありません'));
    if(!shops.some(inWent)) e.appendChild(document.createTextNode('行きたいリストの店で「行った」を押すと、ここに溜まっていきます。'));
    list.appendChild(e); return; }
  const slots=[], badgeSlots=[];
  for (const s of arr){
    const {c,top,chips}=cardShell(s);
    if (!readOnly && me && wentBy(s)[me]){
      const bk=el('button','out-btn','↩ 行きたい'); bk.type='button'; bk.setAttribute('aria-label',(s.name||'')+'を行きたいに戻す'); bk.onclick=e=>{ e.stopPropagation(); backToWant(s.id); };
      const x=el('button','out-btn','外す'); x.type='button'; x.setAttribute('aria-label',(s.name||'')+'をリストから外す'); x.onclick=e=>{ e.stopPropagation(); removeMine(s.id); };
      top.append(bk,x); }
    hoursPill(chips,s);
    { const last=visitList(s).find(x=>x.actual>0); if(last) pill(chips,'yen',`1人 ${yen(last.actual)}`); }
    { const sl=starLine(s); if(sl) chips.insertBefore(sl, chips.children[1]||null); }
    const bd=el('div','badges'); c.appendChild(bd); badgeSlots.push([bd,s.id]);
    const ids=recorders(s); if (ids.length || (isFriendShop(s) && !readOnly && me)){ const f=el('div','foot'); const fc=el('div','faces'); const st=el('span','stack'); fc.append(st, el('span',null,ids.length?`${ids.length}人が記録`:'')); f.appendChild(fc);
      if (isFriendShop(s) && !readOnly && me){ const ib=el('button','want-btn live','＋ 自分のリストに入れる'); ib.onclick=()=>importToMine([s.id]); f.appendChild(ib); }
      c.appendChild(f); slots.push([st,ids.slice(0,5)]); }
    list.appendChild(c);
  }
  fillFaces(slots); fillBadges(badgeSlots);
}
async function fillFaces(slots){
  if (!slots.length) return; const ps=await people(slots.flatMap(x=>x[1]));
  for (const [st,ids] of slots){ st.textContent=''; for(const id of ids) st.appendChild(avatar(ps,id)); }
}
async function fillBadges(slots){
  const holders=inScope(Object.keys(rankings)); if(!holders.length) return; const ps=await people(holders);
  for (const [bd,id] of slots){ bd.textContent=''; let n=0;
    for (const u of holders){ const i=rankList(u).indexOf(id); if(i>-1 && i<3 && n<3){ bd.appendChild(el('span','badge',`${nameOf(ps,u)}の${i+1}位`)); n++; } } }
}

async function renderRank(v){
  const holders=Object.keys(rankings).filter(u=>rankList(u).length);
  const ids = groupMode() ? [...new Set([me,...Object.keys(members),...holders.filter(u=>members[u])].filter(Boolean))] : [me].filter(Boolean);
  if (!rankWho || !ids.includes(rankWho)) rankWho = me || ids[0] || null;
  const ps=await people(ids);
  if (tab!=='set' || setSub!=='rank' || !v.isConnected) return;
  v.textContent='';
  if (!ids.length){ const e=el('div','empty'); e.appendChild(el('span','mincho','ランキングはまだありません')); v.appendChild(e); return; }
  const row=el('div','people'); row.setAttribute('role','group'); row.setAttribute('aria-label','誰のランキング');
  for (const id of ids){ const b=el('button','person'); b.setAttribute('aria-pressed',String(id===rankWho)); b.appendChild(avatar(ps,id)); b.appendChild(el('span',null,nameOf(ps,id))); b.onclick=()=>{rankWho=id; render();}; row.appendChild(b); }
  v.appendChild(row);
  const mine = rankWho===me && !readOnly;
  v.appendChild(el('h2','rank-title', rankWho===me ? 'あなたの好きな居酒屋' : `${nameOf(ps,rankWho)}さんの好きな居酒屋`));
  const list=rankList(rankWho);
  if (!list.length){
    v.appendChild(el('p','hint', mine ? '「行った」店から、好きな順に最大10軒まで選べます。' : 'まだ選ばれていません。'));
  } else {
    const ol=el('ol','rank');
    list.forEach((id,i)=>{ const s=shops.find(x=>x.id===id); const li=el('li');
      li.appendChild(el('span','num',KANJI[i]));
      const mid=el('div'); const nm=el('button','nm',s.name||'(名前なし)'); nm.onclick=()=>openDetail(id); mid.appendChild(nm);
      const sub=[s.area, avgMark(avg(s,'again'))?'また行く '+avgMark(avg(s,'again')):''].filter(Boolean).join('   '); if(sub) mid.appendChild(el('div','ar',sub));
      li.appendChild(mid);
      const ctl=el('div','ctl');
      if (mine){
        const up=el('button','ic','▲'); up.setAttribute('aria-label',`${s.name}を上げる`); up.disabled=i===0; up.onclick=()=>moveRank(i,-1);
        const dn=el('button','ic','▼'); dn.setAttribute('aria-label',`${s.name}を下げる`); dn.disabled=i===list.length-1; dn.onclick=()=>moveRank(i,1);
        const rm=el('button','ic','✕'); rm.setAttribute('aria-label',`${s.name}をランキングから外す`); rm.onclick=()=>saveRank(list.filter(x=>x!==id));
        ctl.append(up,dn,rm);
      }
      li.appendChild(ctl); ol.appendChild(li); });
    v.appendChild(ol);
  }
  if (mine && list.length<RANK_MAX){
    const cand=shops.filter(s=>wentBy(s)[me] && !list.includes(s.id)).sort((a,b)=>(avg(b,'again')??-1)-(avg(a,'again')??-1));
    if (cand.length){
      const f=el('div','addrank'); const lab=el('label','sr','ランキングに追加する店'); lab.htmlFor='rankSel';
      const sel=el('select'); sel.id='rankSel'; const o0=el('option',null,`${list.length+1}位に入れる店を選ぶ`); o0.value=''; sel.appendChild(o0);
      for (const s of cand){ const o=el('option',null,s.name+(s.area?`(${s.area})`:'')); o.value=s.id; sel.appendChild(o); }
      const b=el('button','btn btn-ink','入れる'); b.onclick=()=>{ if(sel.value) saveRank([...list, sel.value]); };
      f.append(lab,sel,b); v.appendChild(f);
    } else if (!shops.some(s=>wentBy(s)[me])) v.appendChild(el('p','hint','まずは「行った」店を記録しましょう。'));
  }
}
function moveRank(i,d){ const l=rankList(me); const j=i+d; if(j<0||j>=l.length) return; [l[i],l[j]]=[l[j],l[i]]; saveRank(l); }

async function addManual(raw){
  if (isUrl(raw)){
    const r=await addFromUrl(raw); if (r.added) return true;
    if (r.needName){ openSearch(raw); return true; }   // the search screen asks the name for this link
    toast(r.msg); return false;
  }
  const [name,area='']=raw.split(/[@＠]/).map(x=>x.trim()); if(!name) return false;
  return !!(await addOrBump(name,area));
}


// the list's floating ＋ (search, URL, name: all in the search screen)
function addFab(v){
  if (readOnly) return;
  const b=el('button','fab','＋'); b.type='button'; b.setAttribute('aria-label','お店を追加'); b.onclick=()=>openSearch(''); v.appendChild(b);
}
