/* ---------- today ---------- */
let todayDocs={}; const cleaned=new Set();
const pick={src:'all',at:'',genre:'',star:0,near:false,here:null,chosen:null,proposing:null,time:'19:00'};
// 今日どこ行く? narrows by: the time you'd go (open then), the genre, and the stars
const PICK_TIMES=['15:00','17:00','18:00','19:00','21:00','23:00'];
const PICK_STARS=[3,3.5,4];
const genreOf = s => (s.hp && s.hp.genre) || '';
// open at "HH:MM" today? null when the hours are unknown
function openAt(s,t){
  const h=s.hours; if(!h) return null; const o=toMin(h.open), c=toMin(h.close), m=toMin(t), wd=new Date().getDay();
  const closed=Array.isArray(h.closed)?h.closed:[]; if (closed.includes(wd)) return false;
  if (o==null || c==null) return null;
  return c>o ? (m>=o && m<c) : (m>=o || m<c);
}
function todayList(){ const t=today(); const P=SP(); return Object.entries(todayDocs).filter(([,d])=>d.date===t && shops.some(s=>s.id===d.shopId) && (!P || P.has(d.by) || Object.keys(d.votes||{}).some(u=>d.votes[u]&&P.has(u))))
  .map(([id,d])=>({id,...d,yes:Object.keys(d.votes||{}).filter(u=>d.votes[u])}))
  .sort((a,b)=>b.yes.length-a.yes.length || (a.createdAt||0)-(b.createdAt||0)); }
function distM(a,b){ const R=6371000, r=x=>x*Math.PI/180; const dLat=r(b.lat-a.lat), dLng=r(b.lng-a.lng); const h=Math.sin(dLat/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dLng/2)**2; return 2*R*Math.asin(Math.sqrt(h)); }
const fmtWalk=m=> m<1500 ? `徒歩${Math.max(1,Math.round(m/80))}分` : `${(m/1000).toFixed(1)}km`;
function candidates(){
  let arr=shops.filter(s=>pick.src==='all'?statusOf(s):pick.src==='want'?inWant(s):inWent(s));
  if (pick.at) arr=arr.filter(s=>openAt(s,pick.at)!==false);   // unknown hours stay in
  if (pick.genre) arr=arr.filter(s=>genreOf(s)===pick.genre);
  if (pick.star) arr=arr.filter(s=>{ const a=starAvg(s); return a && a.v>=pick.star; });
  const score=s=>(avg(s,'again')??1.2)*2 + wantIds(s).length*0.6 + (statusOf(s)==='want'?0.8:0);
  let out=arr.map(s=>({s,d:(pick.near&&pick.here&&s.loc)?distM(pick.here,s.loc):Infinity}));
  if (pick.near&&pick.here) out.sort((a,b)=>a.d-b.d); else out.sort((a,b)=>score(b.s)-score(a.s));
  return out;
}
function todayBlock(v){
  const list=todayList();
  if (!list.length){
    const b=el('button','todaybtn'); b.onclick=openPick;
    const wf=mixedFriends()[0];   // with a friend's list on: deciding where to go together
    b.append(el('span','tb-t', wf ? `${friends[wf].nick}とどこ行く?` : '今日どこ行く?'), el('span','tb-s', wf ? '2人の行きたい店と行った店から探す' : '行きたい店と行った店から探す'));
    v.appendChild(b); return;
  }
  const box=el('section','today'); const h=el('div','today-h'); h.appendChild(el('h2','today-t','今日の飲み'));
  if (!readOnly){ const a=el('button','sbtn','＋ 候補を足す'); a.onclick=openPick; h.appendChild(a); }
  box.appendChild(h);
  const slots=[];
  list.forEach((d,i)=>{
    const s=shops.find(x=>x.id===d.shopId);
    const c=el('article','tcard'+(i===0&&d.yes.length?' lead':''));
    const top=el('div','row'); const left=el('div');
    const nm=el('button','name tname',s.name||'(名前なし)'); nm.onclick=()=>openDetail(s.id); left.appendChild(nm);
    const sub=[d.time?d.time+'〜':'', s.area||''].filter(Boolean).join('　'); if(sub) left.appendChild(el('div','area',sub));
    top.appendChild(left);
    if (d.by===me && !readOnly){ const x=el('button','ic','✕'); x.setAttribute('aria-label','候補から外す'); x.onclick=()=>removeProposal(d.id); top.appendChild(x); }
    c.appendChild(top);
    const ft=el('div','foot'); const fc=el('div','faces'); const st=el('span','stack');
    fc.append(st, el('span',null, d.yes.length?`${d.yes.length}人が行く`:'まだ誰も')); ft.appendChild(fc); slots.push([st,d.yes.slice(0,6)]);
    const btns=el('div','tbtns');
    const sh=el('button','sbtn','送る'); sh.onclick=()=>shareShop(s,d.time); btns.appendChild(sh);
    if (me && !readOnly && groupMode()){ const mine=!!(d.votes&&d.votes[me]); const g=el('button','sbtn'+(mine?' on':''), mine?'行く ✓':'行く'); g.setAttribute('aria-pressed',String(mine)); g.onclick=()=>vote(d.id,!mine); btns.appendChild(g); }
    ft.appendChild(btns); c.appendChild(ft); box.appendChild(c);
  });
  v.appendChild(box); fillFaces(slots);
}
function propose(shopId,time){
  if(!me||readOnly) return; const id=`${today()}_${shopId}`; const ex=todayDocs[id];
  if (ex && ex.date===today()){ vote(id,true); if(time && ex.by===me) patchToday(id,{time}); return; }
  const data={shopId,date:today(),by:me,time:time||'',createdAt:Date.now(),votes:{[me]:true}};
  todayDocs={...todayDocs,[id]:data}; render();
  if (mode==='db') enqueue('today:'+id,()=>db.doc('today/'+id).set(data)); else saveLocal();
}
function patchToday(id,p){ const d=todayDocs[id]; if(!d) return; todayDocs={...todayDocs,[id]:deepMerge(JSON.parse(JSON.stringify(d)),JSON.parse(JSON.stringify(p)))}; render();
  if (mode==='db') enqueue('today:'+id,()=>db.doc('today/'+id).update(p)); else saveLocal(); }
function vote(id,val){ if(!me) return; buzz(); patchToday(id,{votes:{[me]:val}}); }
async function removeProposal(id){ if(!(await ask('この候補を外しますか?','外す'))) return; const o={...todayDocs}; delete o[id]; todayDocs=o; render();
  if (mode==='db') enqueue('today:'+id,()=>db.doc('today/'+id).delete()); else saveLocal(); }
async function shareShop(s,time){
  const text=`今日ここどう?\n${s.name}${s.area?`(${s.area})`:''}${time?`\n${time}〜`:''}\n${mapsUrl(s)}\n\n酒場図: ${location.origin+location.pathname}`;
  try{ if(navigator.share){ await navigator.share({text}); return; } }catch(e){ if(e&&e.name==='AbortError') return; }
  try{ await navigator.clipboard.writeText(text); toast('メッセージをコピーしました。LINEなどに貼って送れます'); }catch{ toast('コピーできませんでした'); }
}
function openPick(){ pick.chosen=null; pick.proposing=null; const wf=mixedFriends()[0]; $('pTitle').textContent = wf ? `${friends[wf].nick}とどこ行く?` : '今日どこ行く?'; showSheet('pickSheet'); buildPick(); $('pBack').focus({preventScroll:true}); }
function closePick(){ hideSheet('pickSheet'); }
function startPropose(id){ pick.proposing=id; buildPick(); const p=$('pProp'); if(p) requestAnimationFrame(()=>p.scrollIntoView({block:'center',behavior:'smooth'})); }
function omakase(cands){
  if (!cands.length) return;
  const one=()=>cands[Math.floor(Math.random()*cands.length)].s;
  let final=one(); if (cands.length>1) while(final.id===pick.chosen) final=one();
  pick.proposing=null;
  const slot=$('pSlot'); const land=()=>{ pick.chosen=final.id; pick.fresh=true; buzz(); buildPick(); };
  if (reduceMotion() || cands.length<2 || !slot || !slot.animate){ land(); return; }
  // a reel of names that spins down and stops on the final one
  const names=[]; for(let i=0;i<21;i++) names.push(one().name||''); names.push(final.name||'');
  slot.classList.remove('hit','fresh'); slot.textContent='';
  const reel=el('div','reel'); const strip=el('div','reel-s sl-n'); names.forEach(n=>strip.appendChild(el('span',null,n))); reel.appendChild(strip);
  slot.append(el('span','sl-k','どこにしよう…'), reel);
  for (const b of $('pBody').querySelectorAll('.sl-btns button')) b.disabled=true;
  const h=strip.firstChild.getBoundingClientRect().height;
  try{ navigator.vibrate && navigator.vibrate([5,70,5,80,5,95,5,120,5,150,5,200,14]); }catch{}
  strip.animate([{transform:'translateY(0)'},{transform:`translateY(${-h*(names.length-1)}px)`}],{duration:1900,easing:'cubic-bezier(.15,.75,.2,1)',fill:'forwards'})
    .finished.then(()=>{ if(isOpen('pickSheet')) land(); },()=>{});
}
function buildPick(){
  const b=$('pBody'); if(!b) return;
  const ae=document.activeElement; if (ae && b.contains(ae) && ae.tagName==='INPUT') return;
  b.textContent='';
  const seg=el('div','seg'); seg.setAttribute('role','group'); seg.setAttribute('aria-label','探す場所');
  for (const [k,l] of [['all','両方'],['want','行きたい'],['went','行った']]){ const x=el('button',null,l); x.setAttribute('aria-pressed',String(pick.src===k)); x.onclick=()=>{ pick.src=k; pick.chosen=null; buildPick(); }; seg.appendChild(x); }
  b.appendChild(seg);
  // 時間 / ジャンル / 星: three small pickers in one row (the phone's own list opens)
  const fl=el('div','pk-bar');
  const pickSel=(label,items,cur,set)=>{ const w=el('label','pk-sel'+(String(cur)!==String(items[0][0])?' on':''));
    const sel=el('select'); sel.setAttribute('aria-label',label);
    for (const [v,l] of items){ const o=el('option',null,l); o.value=String(v); o.selected=String(cur)===String(v); sel.appendChild(o); }
    sel.onchange=()=>{ set(sel.value); pick.chosen=null; buildPick(); };
    w.appendChild(sel); fl.appendChild(w); };
  pickSel('時間',[['','時間'],...PICK_TIMES.map(t=>[t,(+t.slice(0,2))+'時〜'])],pick.at,v=>{ pick.at=v; });
  const base=shops.filter(s=>pick.src==='all'?statusOf(s):pick.src==='want'?inWant(s):inWent(s));
  const genres=[...new Set(base.map(genreOf).filter(Boolean))].sort();
  if (pick.genre && !genres.includes(pick.genre)) pick.genre='';
  pickSel('ジャンル',[['','ジャンル'],...genres.map(g=>[g,g])],pick.genre,v=>{ pick.genre=v; });
  pickSel('星',[[0,'星'],...PICK_STARS.map(x=>[x,'★'+x+'〜'])],pick.star,v=>{ pick.star=+v; });
  b.appendChild(fl);
  const ch=el('div','chips wrapchips');
  if (located().length){ const x=el('button','chip',pick.near?'近い順 ✓':'近い順'); x.setAttribute('aria-pressed',String(pick.near));
    x.onclick=()=>{ if(pick.near){ pick.near=false; buildPick(); return; } x.textContent='現在地を取得中…'; getHere(h=>{ if(h){ pick.here=h; pick.near=true; } buildPick(); }); }; ch.appendChild(x); }
  b.appendChild(ch);
  const cands=candidates();
  const om=el('div','omakase'); const slot=el('div','slot'); slot.id='pSlot'; slot.setAttribute('aria-live','polite');
  const chosen=pick.chosen && cands.find(x=>x.s.id===pick.chosen);
  if (chosen){ slot.classList.add('hit'); if(pick.fresh){ slot.classList.add('fresh'); pick.fresh=false; } slot.append(el('span','sl-k','今日はここ'), el('span','sl-n',chosen.s.name||''));
    const sub=[chosen.s.area, Number.isFinite(chosen.d)?fmtWalk(chosen.d):''].filter(Boolean).join('　'); if(sub) slot.appendChild(el('span','sl-a',sub)); }
  else slot.append(el('span','sl-k',`${cands.length}軒の中から`), el('span','sl-n','おまかせ'));
  const ob=el('div','sl-btns');
  const spin=el('button','btn btn-ink',chosen?'もう一回':'おまかせで決める'); spin.disabled=!cands.length; spin.onclick=()=>omakase(cands); ob.appendChild(spin);
  if (chosen && !readOnly && me){ const go=el('button','btn btn-red','今日ここにする'); go.onclick=()=>startPropose(chosen.s.id); ob.appendChild(go); }
  slot.appendChild(ob); om.appendChild(slot); b.appendChild(om);
  const ps=pick.proposing && shops.find(x=>x.id===pick.proposing);
  if (ps){
    const pp=el('div','propose'); pp.id='pProp'; pp.appendChild(el('p','pp-t',`「${ps.name}」を今日の候補にする`));
    const row=el('div','pp-row'); const lab=el('label',null,'集合');
    const t=el('input','dateinput'); t.type='time'; t.value=pick.time; t.oninput=()=>{ pick.time=t.value; }; lab.appendChild(t); row.appendChild(lab);
    const ok=el('button','btn btn-red','提案する'); ok.onclick=()=>{ propose(ps.id,pick.time); pick.proposing=null; pick.chosen=null; closePick(); setTab('home'); toast(`「${ps.name}」を今日の候補にしました`,'友達に送る',()=>shareShop(ps,pick.time)); };
    const cx=el('button','btn btn-line','やめる'); cx.onclick=()=>{ pick.proposing=null; buildPick(); };
    row.append(ok,cx); pp.appendChild(row); b.appendChild(pp);
  }
  if (!cands.length){ b.appendChild(el('p','empty', shops.length?'条件に合う店がありません。条件を外してみてください。':'まだ店がありません。行きたい店を追加してみましょう。')); return; }
  const ul=el('ul','plist');
  for (const {s,d} of cands){
    const li=el('li'); const info=el('button','pinfo'); info.onclick=()=>openDetail(s.id);
    info.appendChild(el('span','pn',s.name||'(名前なし)'));
    info.appendChild(el('span','pm',[statusOf(s)==='went'?'行った':'行きたい', genreOf(s), (hoursStatus(s)||{}).t, s.area, Number.isFinite(d)?fmtWalk(d):''].filter(Boolean).join('　')));
    const sl=starLine(s); if(sl) info.appendChild(sl);
    li.appendChild(info);
    if (!readOnly && me){ const g=el('button','sbtn on','今日ここ'); g.onclick=()=>startPropose(s.id); li.appendChild(g); }
    ul.appendChild(li);
  }
  b.appendChild(ul);
}
$('pBack').onclick=closePick;
