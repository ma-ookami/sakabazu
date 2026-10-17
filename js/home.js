/* ---------- structure: mode, home, list, records ---------- */
// mixed view: at least one friend's list is mixed in (then we show who wants what)
const groupMode = () => mode==='db' && !!me && activeFriends().length>0;
function segBar(v,items,cur,onPick,cls){
  const seg=el('div','seg topseg'+(cls?' '+cls:'')); seg.setAttribute('role','group');
  for (const [k,l] of items){ const b=el('button',null,l); b.setAttribute('aria-pressed',String(cur===k)); b.onclick=()=>{ if(cur!==k) withTransition(()=>{ onPick(k); render(); window.scrollTo({top:0}); }); }; seg.appendChild(b); }
  v.appendChild(seg);
}
function listSeg(v){ segBar(v,[['want',`行きたい ${shops.filter(inWant).length}`],['went',`行った ${shops.filter(inWent).length}`]],listSub,k=>{ listSub=k; }); }
function goAdd(){ listSub='want'; setTab('list'); openSearch(''); }
function renderHome(v0){
  const v=el('div','homestack'); v0.appendChild(v);
  darumaGreet(v);
  whoBar(v);
  todayBlock(v);
  if (!readOnly){ const acts=el('div','homeacts'); const b=el('button','hact main'); const t=el('span','tb-t');
    t.innerHTML='<svg class="tb-ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>';
    t.appendChild(document.createTextNode('お店をリストに追加'));
    b.append(t, el('span','tb-s','エリア・料理・URLから探す')); b.onclick=goAdd; acts.appendChild(b); v.appendChild(acts); }
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
