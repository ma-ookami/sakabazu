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
  lastNightCard(v);
  whoBar(v);
  goCard(v);
  if (!friendMode && !decided()) nightBtns(v);
  todayBlock(v);
  if (!readOnly){ const acts=el('div','homeacts'); const b=el('button','hact main'); const t=el('span','tb-t');
    t.innerHTML='<svg class="tb-ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>';
    t.appendChild(document.createTextNode('お店をリストに追加'));
    b.append(t, el('span','tb-s','エリア・料理から探す')); b.onclick=goAdd; if (!myShops.length) b.classList.add('nudge'); acts.appendChild(b);
    const u=el('button','hact url'); u.append(el('span','ha-ic','🔗'), el('span','ha-t','URLで登録'), el('span','ha-s','LINEで送られたリンクなど')); u.onclick=openUrlAdd; acts.appendChild(u);
    v.appendChild(acts); }
}
