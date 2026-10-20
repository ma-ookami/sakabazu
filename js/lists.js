/* ---------- want / went lists and ranking ---------- */
const listF={at:'',genre:'',star:0,hon:false};   // the lists' 時間 / ジャンル / 星 (same pickers as 今日どこ行く?)
async function renderWant(v){
  listF.tsuke=false;
  let arr=shops.filter(inWant);
  filterBar(v,listF,arr,render);
  arr=arr.filter(s=>fMatch(s,listF)).sort((a,b)=>{
    const ha=isHon(a), hb=isHon(b); if (ha!==hb) return ha?-1:1;
    const pa=a.planDate||'', pb=b.planDate||'';
    if (pa&&!pb) return -1; if (pb&&!pa) return 1; if (pa!==pb) return pa<pb?-1:1;
    const wa=wantIds(a).length, wb=wantIds(b).length; if(wa!==wb) return wb-wa;
    return (b.createdAt||0)-(a.createdAt||0);
  });
  const list=el('div','list'); v.appendChild(list);
  if (!arr.length){
    const e=el('div','empty'); e.appendChild(el('span','mincho', listF.hon&&!shops.some(x=>inWant(x)&&isHon(x)) ? '本命の店はまだありません' : fOn(listF)?'条件に合う店がありません':'行きたい店はまだありません'));
    if (listF.hon&&!shops.some(x=>inWant(x)&&isHon(x))) e.appendChild(document.createTextNode('行きたい店の名前の横の提灯を押すと、灯りがともって本命になります。'));
    if(!fOn(listF)) e.appendChild(document.createTextNode('右下の「＋」から、気になる店を入れていきましょう。')); list.appendChild(e); return;
  }
  const slots=[];
  for (const s of arr){
    const {c,top,chips}=cardShell(s);
    if (!readOnly && me && s.wants && s.wants[me]){ const nm=c.querySelector('.sc-main .name'); if(nm) nm.appendChild(honBtn(s)); }
    if (!readOnly && me && !wentBy(s)[me]){ const w=el('button','went-btn live','行った'); w.setAttribute('aria-label',(s.name||'')+'に行った'); w.onclick=()=>wentWhen(s.id); top.appendChild(w); }
    if (s.planDate) pill(chips,'plan',fmtDate(s.planDate)+' に行く予定');
    hoursPill(chips,s); { const g=genreOf(s); if(g) pill(chips,'genre',g); } { const sl=starLine(s); if(sl) chips.appendChild(sl); }
    // swipe left: 外す (rarely used, so no button)
    list.appendChild(!readOnly && me && s.wants && s.wants[me] && !isFriendShop(s) ? swipeable(c,null,{label:'外す',run:()=>removeMine(s.id)}) : c);
  }
  fillFaces(slots);
}

function renderWent(v){
  listF.hon=false; filterBar(v,listF,shops.filter(inWent),render);
  let arr=shops.filter(inWent).filter(s=>fMatch(s,listF));
  if (!['new','star'].includes(sort)) sort='new';
  arr.sort((a,b)=>{ if(sort==='star'){ const x=(starAvg(a)||{}).v, y=(starAvg(b)||{}).v; if(x!==y) return (y??-1)-(x??-1); }
    return lastWent(b).localeCompare(lastWent(a)) || (b.createdAt||0)-(a.createdAt||0); });
  const meta=el('div','meta'); meta.appendChild(el('span',null,`${arr.length} 軒`));
  const lab=el('label',null,'並び順 '); const sel=el('select');
  for (const [val,txt] of [['new','新しい順'],['star','星が高い順']]){ const o=el('option',null,txt); o.value=val; o.selected=sort===val; sel.appendChild(o); }
  sel.onchange=()=>{sort=sel.value; render();}; lab.appendChild(sel); meta.appendChild(lab); v.appendChild(meta);
  const list=el('div','list'); v.appendChild(list);
  if (!arr.length){ const e=el('div','empty'); const noT=listF.tsuke && !shops.some(x=>inWent(x)&&isTsuke(x)); e.appendChild(el('span','mincho', noT?'定番の店はまだありません':shops.some(inWent)?'条件に合う店がありません':'まだ記録がありません'));
    if (noT) e.appendChild(document.createTextNode('行った店の名前の横のお猪口を押すと、お酒が満ちて定番になります。'));
    if(!shops.some(inWent)) e.appendChild(document.createTextNode('行きたいリストの店で「行った」を押すと、ここに溜まっていきます。'));
    list.appendChild(e); return; }
  const slots=[], badgeSlots=[];
  for (const s of arr){
    const {c,top,chips}=cardShell(s);
    if (!readOnly && me && wentBy(s)[me]){ const nm=c.querySelector('.sc-main .name'); if(nm) nm.appendChild(tsukeBtn(s)); }
    hoursPill(chips,s); { const g=genreOf(s); if(g) pill(chips,'genre',g); }
    { const sl=starLine(s); if(sl) chips.appendChild(sl); }
    { const last=visitList(s).find(x=>x.actual>0); if(last) pill(chips,'yen',`1人 ${yen(last.actual)}`); }
    const bd=el('div','badges'); c.appendChild(bd); badgeSlots.push([bd,s.id]);
    // swipe right: back to 行きたい (rarely needed, so no button)
    list.appendChild(!readOnly && me && wentBy(s)[me] ? swipeable(c,{label:'↩ 行きたい', run:()=>backToWant(s.id)},{label:'外す',run:()=>removeMine(s.id)}) : c);
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

let rankCat='ids';
async function renderRank(v){
  if (tab!=='set' || setSub!=='rank' || !v.isConnected) return;
  v.textContent='';
  if (!me){ const e=el('div','empty'); e.appendChild(el('span','mincho','ランキングはまだありません')); v.appendChild(e); return; }
  // the category: 総合 / 安い・チェーン / デート
  const seg=el('div','seg rank-cats'); seg.setAttribute('role','group'); seg.setAttribute('aria-label','ランキングの種類');
  for (const [k,l2] of RANK_CATS){ const b=el('button',null,l2); b.type='button'; b.setAttribute('aria-pressed',String(rankCat===k)); b.onclick=()=>{ rankCat=k; render(); }; seg.appendChild(b); }
  v.appendChild(seg);
  const [,,title]=RANK_CATS.find(x=>x[0]===rankCat);
  v.appendChild(el('h2','rank-title','あなたの'+title));
  const list=rankList(me,rankCat), mine=!readOnly;
  if (!list.length) v.appendChild(el('p','hint','「行った」店から、好きな順に最大10軒まで選べます。'));
  else {
    const ol=el('ol','rank');
    list.forEach((id,i)=>{ const s=shops.find(x=>x.id===id); const li=el('li');
      li.appendChild(el('span','num',KANJI[i]));
      const mid=el('div'); const nm=el('button','nm',s.name||'(名前なし)'); nm.onclick=()=>openDetail(id); mid.appendChild(nm);
      const sub=[genreOf(s), s.area].filter(Boolean).join('   '); if(sub) mid.appendChild(el('div','ar',sub));
      li.appendChild(mid);
      const ctl=el('div','ctl');
      if (mine){
        const up=el('button','ic','▲'); up.setAttribute('aria-label',`${s.name}を上げる`); up.disabled=i===0; up.onclick=()=>moveRank(i,-1);
        const dn=el('button','ic','▼'); dn.setAttribute('aria-label',`${s.name}を下げる`); dn.disabled=i===list.length-1; dn.onclick=()=>moveRank(i,1);
        const rm=el('button','ic','✕'); rm.setAttribute('aria-label',`${s.name}をランキングから外す`); rm.onclick=()=>saveRank(list.filter(x=>x!==id),rankCat);
        ctl.append(up,dn,rm);
      }
      li.appendChild(ctl); ol.appendChild(li); });
    v.appendChild(ol);
  }
  if (mine && list.length<RANK_MAX){
    const cand=shops.filter(s=>wentBy(s)[me] && !list.includes(s.id)).sort((a,b)=>((starAvg(b)||{}).v??-1)-((starAvg(a)||{}).v??-1));
    if (cand.length){
      const f=el('div','addrank'); const lab=el('label','sr','ランキングに追加する店'); lab.htmlFor='rankSel';
      const sel=el('select'); sel.id='rankSel'; const o0=el('option',null,`${list.length+1}位に入れる店を選ぶ`); o0.value=''; sel.appendChild(o0);
      for (const s of cand){ const o=el('option',null,s.name+(s.area?`(${s.area})`:'')); o.value=s.id; sel.appendChild(o); }
      const b=el('button','btn btn-ink','入れる'); b.onclick=()=>{ if(sel.value) saveRank([...list, sel.value],rankCat); };
      f.append(lab,sel,b); v.appendChild(f);
    } else if (!shops.some(s=>wentBy(s)[me])) v.appendChild(el('p','hint','まずは「行った」店を記録しましょう。'));
  }
}
function moveRank(i,d){ const l=rankList(me,rankCat); const j=i+d; if(j<0||j>=l.length) return; [l[i],l[j]]=[l[j],l[i]]; saveRank(l,rankCat); }

async function addManual(raw){
  if (isUrl(raw)){
    const r=await addFromUrl(raw); if (r.added) return true;
    if (r.needName){ openSearch(raw); return true; }   // the search screen asks the name for this link
    toast(r.msg); return false;
  }
  const [name,area='']=raw.split(/[@＠]/).map(x=>x.trim()); if(!name) return false;
  const id=await addOrBump(name,area);
  // no genre yet: ask it right away (one tap, or later)
  if (id){ const sh=myShops.find(z=>z.id===id); if (sh && !genreOf(sh)) setTimeout(()=>askGenres([sh]),400); }
  return !!id;
}


// the list's floating ＋ (search, URL, name: all in the search screen)
function addFab(v){
  if (readOnly) return;
  const b=el('button','fab','＋'); b.type='button'; b.setAttribute('aria-label','お店を追加'); b.onclick=()=>openSearch(''); v.appendChild(b);
}
