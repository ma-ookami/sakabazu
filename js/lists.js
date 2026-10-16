/* ---------- want / went lists and ranking ---------- */
async function renderWant(v){
  if (!readOnly){
    const f=el('form','quick quickadd'); f.noValidate=true;
    const lab=el('label','sr','行きたい店を追加'); lab.htmlFor='quick';
    const i=el('input','field'); i.id='quick'; i.placeholder='店名、または「駅前 焼き鳥」など'; i.maxLength=2000; i.autocomplete='off'; i.value=quickVal; i.oninput=()=>{ quickVal=i.value; };
    const sb=el('button','btn btn-line sbtn-circle','探'); sb.type='button'; sb.setAttribute('aria-label','候補を探す');
    sb.onclick=()=>doSearch(i.value.trim());   // empty: shops near here
    const b=el('button','btn btn-red','＋'); b.type='submit'; b.setAttribute('aria-label','追加');
    f.append(lab,i,sb,b);
    f.onsubmit=async e=>{ e.preventDefault(); const raw=i.value.trim(); if(!raw){ i.focus(); return; }
      if (/^https?:\/\//i.test(raw)){
        const p=parsePlaceUrl(raw);
        if (p.short){ toast('短縮リンクからは店名を読み取れません。ブラウザで開いて、アドレス欄の長いURLを貼ってください'); return; }
        if (!p.name){ toast('このURLからは店名を読み取れませんでした。Googleマップでお店を開いたときのURLを貼ってください'); return; }
        i.value=''; quickVal='';
        const id=await addOrBump(p.name,'',{loc:p.loc}); if(id) toast(`「${p.name}」を追加しました${p.loc?'(位置つき)':''}`);
        $('quick') && $('quick').focus(); return;
      }
      const [name,area='']=raw.split(/[@＠]/).map(x=>x.trim()); if(!name){ i.focus(); return; }
      i.value=''; quickVal='';
      await addOrBump(name,area); $('quick') && $('quick').focus(); };
    v.appendChild(f);
    v.appendChild(el('p','hint','店名を入れて＋で追加。「探」を押すと、地名や料理名でお店を探せます(空欄なら現在地の近く)。GoogleマップのURLを貼って＋を押しても追加できます。カードは右にスワイプで「行った」、左で外せます。'));
  }
  searchPanel(v);
  let arr=shops.filter(inWant);
  if (arr.length>5){ const t=el('div','tools'); t.appendChild(searchBox(v)); v.appendChild(t); }
  tagChips(v,'want');
  arr=arr.filter(matches).sort((a,b)=>{
    const pa=a.planDate||'', pb=b.planDate||'';
    if (pa&&!pb) return -1; if (pb&&!pa) return 1; if (pa!==pb) return pa<pb?-1:1;
    const wa=wantIds(a).length, wb=wantIds(b).length; if(wa!==wb) return wb-wa;
    return (b.createdAt||0)-(a.createdAt||0);
  });
  const list=el('div','list'); v.appendChild(list);
  if (!arr.length){
    const e=el('div','empty'); e.appendChild(el('span','mincho', query?'該当する店がありません':'行きたい店はまだありません'));
    if(!query) e.appendChild(document.createTextNode('気になる店を上の欄にポンポン入れていきましょう。')); list.appendChild(e); return;
  }
  const slots=[];
  for (const s of arr){
    const {c,top,chips}=cardShell(s);
    if (!readOnly && me && !wentBy(s)[me]){ const w=el('button','went-btn live','行った'); w.setAttribute('aria-label',(s.name||'')+'に行った'); w.onclick=()=>{ w.classList.add('pop'); setTimeout(()=>markWent(s.id),280); }; top.appendChild(w); }
    if (s.planDate) pill(chips,'plan',fmtDate(s.planDate)+' に行く予定');
    hoursPill(chips,s); tagPills(chips,s,3);
    if (chips.children.length) c.appendChild(chips);
    const ids=wantIds(s);
    if (ids.length || (!readOnly && me && groupMode())){
    const foot=el('div','foot');
    const faces=el('div','faces'); const st=el('span','stack'); faces.appendChild(st);
    faces.appendChild(el('span',null, ids.length? `${ids.length}人が行きたい` : ''));
    foot.appendChild(faces); slots.push([st,ids.slice(0,5)]);
    if (!readOnly && me && groupMode()){ const mine=!!(s.wants&&s.wants[me]); const wb=el('button','want-btn live', mine?'行きたい ✓':'私も行きたい'); wb.setAttribute('aria-pressed',String(mine)); wb.onclick=()=>toggleWant(s.id); foot.appendChild(wb); }
    c.appendChild(foot); }
    if (!readOnly && me){
      const right = !wentBy(s)[me] ? {label:'✓ 行った', run:()=>markWent(s.id)} : null;
      const left = (s.wants&&s.wants[me]) ? {label:'外す', run:()=>removeMine(s.id)} : null;
      list.appendChild(right||left ? swipeable(c,right,left) : c);
    } else list.appendChild(c);
  }
  fillFaces(slots);
}

function renderWent(v){
  const t=el('div','tools'); t.appendChild(searchBox(v)); v.appendChild(t);
  const chips=el('div','chips'); chips.setAttribute('role','group'); chips.setAttribute('aria-label','絞り込み');
  for (const o of [{k:'all',label:'すべて'},...ITEMS.map(i=>({k:i.k,label:i.label+'が◎○'}))]){
    const b=el('button','chip',o.label); b.setAttribute('aria-pressed',String(filter===o.k)); b.onclick=()=>{filter=o.k; render();}; chips.appendChild(b);
  }
  v.appendChild(chips);
  tagChips(v,'went');
  scopeBar(v);
  let arr=shops.filter(inWent).filter(matches);
  if (filter!=='all') arr=arr.filter(s=>{ const x=avg(s,filter); return x!=null && x>=1.5; });
  const key = sort==='again'?'again': sort==='price'?'price':null;
  arr.sort((a,b)=>{ if(sort==='deal'){ const x=dealScore(a), y=dealScore(b); if(x!==y) return (y??-999)-(x??-999); } if(sort==='sense'){ const x=senseScore(a), y=senseScore(b); if(x!==y) return (y??-1)-(x??-1); } if(key){ const x=avg(a,key), y=avg(b,key); if(x!==y) return (y??-1)-(x??-1); }
    return lastWent(b).localeCompare(lastWent(a)) || (b.createdAt||0)-(a.createdAt||0); });
  const meta=el('div','meta'); meta.appendChild(el('span',null,`${arr.length} 軒`));
  const lab=el('label',null,'並び順 '); const sel=el('select');
  for (const [val,txt] of [['new','行った日が新しい順'],['again','また行きたい順'],['price','安い順'],['sense','感覚に合う順'],['deal','感覚より安い順']]){ const o=el('option',null,txt); o.value=val; o.selected=sort===val; sel.appendChild(o); }
  sel.onchange=()=>{sort=sel.value; render();}; lab.appendChild(sel); meta.appendChild(lab); v.appendChild(meta);
  const list=el('div','list'); v.appendChild(list);
  if (!arr.length){ const e=el('div','empty'); e.appendChild(el('span','mincho', shops.some(inWent)?'条件に合う店がありません':'まだ記録がありません'));
    if(!shops.some(inWent)) e.appendChild(document.createTextNode('行きたいリストの店で「行った」を押すと、ここに溜まっていきます。'));
    list.appendChild(e); return; }
  const slots=[], badgeSlots=[];
  for (const s of arr){
    const {c,top,chips}=cardShell(s);
    if (lastWent(s)) top.appendChild(el('span','date',fmtDate(lastWent(s))));
    hoursPill(chips,s);
    { const last=visitList(s).find(x=>x.actual>0); if(last) pill(chips,'yen',`1人 ${yen(last.actual)}`); const sc=senseScore(s); if(sc!=null) pill(chips,'sense',`感覚一致 ${sc}%`); const dl=dealLabel(dealScore(s)); if(dl) pill(chips,dl==='感覚より安い'?'deal':'tag',dl); }
    tagPills(chips,s,2);
    if (chips.children.length) c.appendChild(chips);
    const mk=el('div','mk2');
    for (const it of ITEMS){ const m=avgMark(avg(s,it.k)); if(!m) continue; const d=el('span','mkc'+(m==='◎'?' top':'')); d.appendChild(el('b',null,m)); d.appendChild(el('small',null,it.short)); mk.appendChild(d); }
    if (mk.children.length) c.appendChild(mk); else c.appendChild(el('div','marks','まだ評価がありません'));
    const bd=el('div','badges'); c.appendChild(bd); badgeSlots.push([bd,s.id]);
    const ids=recorders(s); if (ids.length){ const f=el('div','foot'); const fc=el('div','faces'); const st=el('span','stack'); fc.append(st, el('span',null,`${ids.length}人が記録`)); f.appendChild(fc); c.appendChild(f); slots.push([st,ids.slice(0,5)]); }
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
  if (tab!=='rec' || recSub!=='rank' || !v.isConnected) return;
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
