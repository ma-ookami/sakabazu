/* ---------- structure: mode, home, list, records ---------- */
const groupMode = () => mode==='db' && !!me && !!members[me] && scope==='group';
try{ const sv=localStorage.getItem('nm-scope'); if(sv==='mine'||sv==='group') scope=sv; }catch{}
function renderMode(){
  const m=$('modeSw'); if(!m) return;
  const can = mode==='db' && me && members[me] && Object.keys(members).length>1;
  if (!can){ m.hidden=true; m.textContent=''; return; }
  m.hidden=false; m.textContent='';
  for (const [k,l] of [['mine','ひとり'],['group',`グループ ${Object.keys(members).length}人`]]){
    const b=el('button',null,l); b.setAttribute('aria-pressed',String(scope===k));
    b.onclick=()=>{ if(scope===k) return; scope=k; try{ localStorage.setItem('nm-scope',k); }catch{} buzz(); render(); if(openId){ builtStatus=null; patchDetail(); } if(isOpen('pickSheet')) buildPick(); };
    m.appendChild(b);
  }
}
function segBar(v,items,cur,onPick,cls){
  const seg=el('div','seg topseg'+(cls?' '+cls:'')); seg.setAttribute('role','group');
  for (const [k,l] of items){ const b=el('button',null,l); b.setAttribute('aria-pressed',String(cur===k)); b.onclick=()=>{ if(cur!==k) withTransition(()=>{ onPick(k); render(); window.scrollTo({top:0}); }); }; seg.appendChild(b); }
  v.appendChild(seg);
}
function listSeg(v){ segBar(v,[['want',`行きたい ${shops.filter(inWant).length}`],['went',`行った ${shops.filter(inWent).length}`]],listSub,k=>{ listSub=k; }); }
function recSeg(v){ segBar(v,[['cal','カレンダー'],['rank','ランキング'],['score','予想成績']],recSub,k=>{ recSub=k; }); }
function goAdd(){ listSub='want'; setTab('list'); setTimeout(()=>{ const q=$('quick'); if(q) q.focus(); },60); }
function renderHome(v){
  const g=groupMode();
  todayBlock(v);
  hero(v);
  if (!shops.some(s=>statusOf(s))){
    const e=el('div','welcome'); e.appendChild(el('h2','mincho', g?'みんなのリストはまだ空です':'まずは行きたい店から'));
    e.appendChild(el('p',null,'気になる店をリストに入れていくと、「今日どこ行く?」で迷わずに決められます。'));
    if(!readOnly){ const b=el('button','btn btn-red','＋ 行きたい店を追加'); b.onclick=goAdd; e.appendChild(b); }
    v.appendChild(e); return;
  }
  if (!readOnly){ const a=el('button','addlink','＋ 行きたい店を追加'); a.onclick=goAdd; v.appendChild(a); }
  const rec=calEntries().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
  const box=el('section','recent'); const h=el('div','today-h'); h.appendChild(el('h2','today-t', g?'みんなの最近':'最近行った店'));
  const more=el('button','sbtn','カレンダー'); more.onclick=()=>{ recSub='cal'; setTab('rec'); }; h.appendChild(more); box.appendChild(h);
  if (!rec.length) box.appendChild(el('p','hint','まだ来店の記録がありません。行ったら「行った」を押して記録しましょう。'));
  else { const ul=el('ul','plist'); const slots=[];
    for (const e of rec){ const li=el('li'); const info=el('button','pinfo'); info.onclick=()=>openDetail(e.s.id);
      info.appendChild(el('span','pn',e.s.name||'(名前なし)'));
      info.appendChild(el('span','pm',[fmtDate(e.date), e.s.area, e.actual>0?`1人 ${yen(e.actual)}`:''].filter(Boolean).join('　')));
      if (g){ const f=el('span','faces'); const st=el('span','stack'); f.appendChild(st); info.appendChild(f); slots.push([st,e.ppl.slice(0,6)]); }
      li.appendChild(info); ul.appendChild(li); }
    box.appendChild(ul); fillFaces(slots); }
  v.appendChild(box);
}
async function renderScore(v){
  const g=groupMode(); const P=SP();
  const stats={};
  for (const s of shops){ if(!statusOf(s)) continue; for (const vi of visitList(s)){ if(!(vi.actual>0)||!vi.guesses) continue;
    for (const u in vi.guesses){ const x=Number(vi.guesses[u]); if(!(x>0)) continue; if(P && !P.has(u)) continue;
      const o=stats[u]||(stats[u]={n:0,acc:0,pita:0,bias:0}); const a=accOf(x,vi.actual); o.n++; o.acc+=a; if(a>=95) o.pita++; o.bias+=(x-vi.actual)/vi.actual*100; } } }
  const ids=Object.keys(stats); const ps=await people(ids);
  if (!v.isConnected) return;
  const mine=stats[me];
  const card=el('section','scorecard');
  if (mine){ const avgA=Math.round(mine.acc/mine.n), bias=Math.round(mine.bias/mine.n);
    card.appendChild(el('span','sk','あなたの的中率')); card.appendChild(el('b','sv',`${avgA}%`));
    card.appendChild(el('span','sk',`予想${mine.n}回　ピタリ賞${mine.pita}回`));
    card.appendChild(el('p','sb', Math.abs(bias)<5 ? '金額の感覚はかなり正確です' : bias>0 ? `実際より平均${bias}%高く見積もりがちです` : `実際より平均${-bias}%安く見積もりがちです`)); }
  else { card.appendChild(el('span','sk','あなたの的中率')); card.appendChild(el('b','sv','–')); card.appendChild(el('p','sb','食べ終わったら、会計を見る前に予想してみましょう。来店記録から予想できます。')); }
  v.appendChild(card);
  if (g && ids.length){
    v.appendChild(el('h3','rank-title','予想の得意な人'));
    const ol=el('ol','rank'); ids.sort((a,b)=>stats[b].acc/stats[b].n - stats[a].acc/stats[a].n).forEach((u,i)=>{ const li=el('li'); li.appendChild(el('span','num',KANJI[i]||String(i+1)));
      const mid=el('div'); mid.appendChild(el('div','nm',nameOf(ps,u))); mid.appendChild(el('div','ar',`予想${stats[u].n}回　ピタリ賞${stats[u].pita}回`)); li.appendChild(mid);
      li.appendChild(el('span','yen',`${Math.round(stats[u].acc/stats[u].n)}%`)); ol.appendChild(li); });
    v.appendChild(ol);
  }
  const scored=shops.filter(s=>statusOf(s) && dealScore(s)!=null);
  const block=(title,arr,fmt)=>{ if(!arr.length) return; v.appendChild(el('h3','rank-title',title)); const ul=el('ul','plist');
    arr.forEach(s=>{ const li=el('li'); const info=el('button','pinfo'); info.onclick=()=>openDetail(s.id); info.appendChild(el('span','pn',s.name)); info.appendChild(el('span','pm',fmt(s))); li.appendChild(info); ul.appendChild(li); }); v.appendChild(ul); };
  block('感覚より安い店', scored.filter(s=>dealScore(s)>=5).sort((a,b)=>dealScore(b)-dealScore(a)).slice(0,5), s=>`感覚より平均${dealScore(s)}%安い　一致度${senseScore(s)}%`);
  block('感覚に合う店', scored.slice().sort((a,b)=>senseScore(b)-senseScore(a)).slice(0,5), s=>`一致度${senseScore(s)}%　${dealLabel(dealScore(s))}`);
  if (!scored.length && !mine) v.appendChild(el('p','hint','答え合わせが溜まると、ここに成績や「感覚より安い店」が並びます。'));
}
