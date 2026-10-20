/* ---------- today ---------- */
let todayDocs={}; const cleaned=new Set();
// tonight: the day changes at 5 a.m., so picks made at 1 a.m. still belong to last night
const ymd = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const nightKey = () => ymd(new Date(Date.now()-5*36e5));
const lastNightKey = () => ymd(new Date(Date.now()-29*36e5));
const pick={q:'',want:true,went:true,fopen:false,src:'find',at:'',genre:'',star:0,near:false,here:null,chosen:null,proposing:null,time:'19:00'};
// 今日どこ行く? narrows by: the time you'd go (open then), the genre, and the stars
const PICK_TIMES=['15:00','17:00','18:00','19:00','21:00','23:00'];
const PICK_STARS=[3,3.5,4];
const genreOf = s => (s.hp && s.hp.genre) || '';
// open at "HH:MM" today? null when the hours are unknown
// the same 3 pickers (時間 / ジャンル / 星) on 今日どこ行く? and on the lists. st: {at, genre, star}
const fOn = st => !!(st.q || st.at || st.genre || st.star || st.hon || st.tsuke || st.fresh1);
const qNorm = x => String(x||'').normalize('NFKC').toLowerCase().replace(/s+/g,'');
function fMatch(s,st){
  if (st.q && !qNorm((s.name||'')+(s.area||'')+(genreOf(s)||'')+(s.addr||'')).includes(qNorm(st.q))) return false;
  if (st.hon && !honBy(s).length) return false;
  if (st.fresh1 && wentIds(s).length) return false;   // はじめての店: nobody in this group has been
  if (st.tsuke && !tsukeBy(s).length) return false;
  if (st.at && openAt(s,st.at)===false) return false;   // unknown hours stay in
  if (st.genre && genreOf(s)!==st.genre) return false;
  if (st.star){ const a=starAvg(s); if(!a || a.v<st.star) return false; }
  return true;
}
function filterBar(box,st,base,redraw){
  if (st===pick){ const q=el('input','pk-q'); q.type='search'; q.value=st.q||''; q.placeholder='店名・エリア・ジャンルで探す'; q.setAttribute('aria-label','店を検索'); q.autocomplete='off'; q.enterKeyHint='search';
    let tm=0, comp=false; const go=()=>{ clearTimeout(tm); tm=setTimeout(()=>{ if(comp) return; st.q=q.value.trim(); pick.chosen=null; redraw(); const n=document.querySelector('#pBody .pk-q'); if(n){ n.focus(); const l=n.value.length; try{ n.setSelectionRange(l,l); }catch{} } },250); };
    q.addEventListener('compositionstart',()=>{ comp=true; }); q.addEventListener('compositionend',()=>{ comp=false; go(); }); q.addEventListener('input',go);
    q.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); q.blur(); } });
    box.appendChild(q); }
  const fl=el('div','pk-bar');
  if (false){ const n=el('button','pk-hon pk-new','初めての店'); n.type='button'; n.setAttribute('aria-pressed',String(!!st.fresh1)); n.setAttribute('aria-label', activeFriends().length?'選んだメンバーの誰も行っていない店だけ':'まだ行っていない店だけ');
    n.onclick=()=>{ st.fresh1=!st.fresh1; pick.chosen=null; redraw(); }; fl.appendChild(n); }
  if (st!==pick && !(st===listF && listSub==='went') && (st.hon || base.some(s=>honBy(s).length) || (st===listF && tab==='list' && listSub==='want'))){ const h=el('button','pk-hon','本命'); h.prepend(lanEl()); h.type='button'; h.setAttribute('aria-pressed',String(!!st.hon)); h.setAttribute('aria-label','本命だけ');
    h.onclick=()=>{ st.hon=!st.hon; if(st===pick) pick.chosen=null; redraw(); }; fl.appendChild(h); }
  if (st!==pick && !(st===listF && listSub==='want') && (st.tsuke || base.some(s=>tsukeBy(s).length) || (st===listF && tab==='list' && listSub==='went'))){ const h=el('button','pk-hon pk-tsuke','定番'); h.prepend(chokoEl()); h.type='button'; h.setAttribute('aria-pressed',String(!!st.tsuke)); h.setAttribute('aria-label','定番だけ');
    h.onclick=()=>{ st.tsuke=!st.tsuke; if(st===pick) pick.chosen=null; redraw(); }; fl.appendChild(h); }
  const sel=(label,items,cur,set)=>{ const w=el('label','pk-sel'+(String(cur)!==String(items[0][0])?' on':''));
    const s=el('select'); s.setAttribute('aria-label',label);
    for (const [v,l] of items){ const o=el('option',null,l); o.value=String(v); o.selected=String(cur)===String(v); s.appendChild(o); }
    s.onchange=()=>{ set(s.value); if(st===pick) pick.chosen=null; redraw(); };
    w.appendChild(s); fl.appendChild(w); };
  sel('時間',[['','時間'],...PICK_TIMES.map(t=>[t,(+t.slice(0,2))+'時〜'])],st.at,v=>{ st.at=v; });
  const genres=[...new Set(base.map(genreOf).filter(Boolean))].sort();
  if (st.genre && !genres.includes(st.genre)) st.genre='';
  sel('ジャンル',[['','ジャンル'],...genres.map(g=>[g,g])],st.genre,v=>{ st.genre=v; });
  sel('星',[[0,'星'],...PICK_STARS.map(x=>[x,'★'+x+'〜'])],st.star,v=>{ st.star=+v; });
  box.appendChild(fl);
}
function openAt(s,t){
  const h=s.hours; if(!h) return null; const o=toMin(h.open), c=toMin(h.close), m=toMin(t), wd=new Date().getDay();
  const closed=Array.isArray(h.closed)?h.closed:[]; if (closed.includes(wd)) return false;
  if (o==null || c==null) return null;
  return c>o ? (m>=o && m<c) : (m>=o || m<c);
}
function candidates(){
  let arr=shops.filter(s=>(pick.want&&inWant(s)) || (pick.went&&inWent(s)));
  arr=arr.filter(s=>fMatch(s,pick));
  const score=s=>honBy(s).length*4 + tsukeBy(s).length*3 + (avg(s,'again')??1.2)*2 + wantIds(s).length*0.6 + (statusOf(s)==='want'?0.8:0);
  const out=arr.map(s=>({s,d:Infinity})); out.sort((a,b)=>score(b.s)-score(a.s));
  return out;
}
/* 今日の候補: each person adds shops they'd be happy with today (stored in their own today/ docs);
   with a 飲み友's list on, both sides' picks are merged, and shops both picked are "🍻 2人ともOK" */
// how many of us picked it: "🍻 2人ともOK" / "🍻 全員OK" / "3人中2人OK"
const okLabel = c => { const n=1+activeFriends().length, k=c.by.size; if (k<2) return ''; return k>=n ? (n===2?'🍻 2人ともOK':'🍻 全員OK') : `${n}人中${k}人OK`; };
const allOk = c => c.by.size>1 && c.by.size>=1+activeFriends().length;
const shopKey = s => (s && s.hp && s.hp.id) ? 'hp:'+s.hp.id : 'n:'+norm((s&&s.name)||'');
let fToday={};   // 飲み友 -> their picks for today
function myPickDocs(){ const t=nightKey(); return Object.entries(todayDocs).filter(([,d])=>d.date===t && d.by===me).map(([id,d])=>({...d,_id:id})); }
function docKey(d){ if (d.key) return d.key; const s=shops.find(x=>x.id===d.shopId); return s ? shopKey(s) : 'id:'+d.shopId; }
function todayCands(){
  const map=new Map(), t=nightKey();
  const add=(d,who)=>{ if(d.date!==t) return; const k=docKey(d); let c=map.get(k);
    if (!c){ c={key:k, name:d.name||'', by:new Set(), time:''}; map.set(k,c); }
    c.by.add(who); if (who===me) c.mine=d; if (!c.name && d.name) c.name=d.name; if (d.time && !c.time) c.time=d.time; };
  for (const d of myPickDocs()) add(d,me);
  for (const wf of activeFriends()) for (const d of fToday[wf]||[]) add(d,wf);
  for (const c of map.values()){ c.shop=shops.find(s=>shopKey(s)===c.key) || shops.find(s=>c.mine && s.id===c.mine.shopId) || null; if(!c.name && c.shop) c.name=c.shop.name; }
  return [...map.values()].sort((a,b)=>b.by.size-a.by.size || (b.by.has(me)-a.by.has(me)));
}
const isPicked = s => myPickDocs().some(d=>docKey(d)===shopKey(s));
// add / remove a shop from my picks for today
function togglePick(s, c){
  if (!me || readOnly) return;
  const key = s ? shopKey(s) : c.key, mine=myPickDocs().find(d=>docKey(d)===key);
  buzz();
  if (mine){ const o={...todayDocs}; delete o[mine._id]; todayDocs=o; afterChange();
    if (mode==='db') enqueue('today:'+mine._id,()=>db.doc('today/'+mine._id).delete()); else saveLocal();
    // the shop stays in the lists; only today's 候補 changes. say so, and let it be undone
    const back={...mine}; delete back._id;
    toast(`「${back.name||'この店'}」を今日の候補から外しました`,'元に戻す',()=>{ todayDocs={...todayDocs,[mine._id]:back}; afterChange();
      if (mode==='db') enqueue('today:'+mine._id,()=>db.doc('today/'+mine._id).set(back)); else saveLocal(); });
    return; }
  const shopId = s ? s.id : ('k:'+key).slice(0,60), id=`${nightKey()}_${shopId}`;
  const data={shopId, date:nightKey(), by:me, time:'', createdAt:Date.now(), votes:{}, name:((s&&s.name)||c.name||'').slice(0,60), key:key.slice(0,80)};
  todayDocs={...todayDocs,[id]:data}; afterChange();
  if (mode==='db') enqueue('today:'+id,()=>db.doc('today/'+id).set(data)); else saveLocal();
}
function pickBtn(s){
  const on=isPicked(s), b=el('button','sbtn'+(on?'':' on'), on?'✓ 候補':'＋ 候補'); b.setAttribute('aria-pressed',String(on));
  b.setAttribute('aria-label',(s.name||'')+(on?'を今日の候補から外す':'を今日の候補に入れる'));
  b.onclick=e=>{ e.stopPropagation(); togglePick(s); }; return b;
}
function todayBlock(v){
  const wf=activeFriends()[0], cs=todayCands();
  const b=el('button','todaybtn'); b.onclick=()=>openPick(cs.length?'today':'find');
  b.append(el('span','tb-t', wf ? '飲み友とどこ行く?' : '今日どこ行く?'));
  if (cs.length){
    const both=cs.filter(allOk);
    b.appendChild(el('span','tb-s', both.length ? `${okLabel(both[0])}: ${both.map(c=>c.name).slice(0,2).join('・')}${both.length>2?' ほか':''}` : `今日の候補 ${cs.length}軒`));
  } else b.appendChild(el('span','tb-s', wf ? `${whoNames()}と候補を出し合って、みんながいい店を探す` : '行きたい店と行った店から探す'));
  v.appendChild(b);
}
async function shareShop(s,time){
  const text=`今日ここどう?\n${s.name}${s.area?`(${s.area})`:''}${time?`\n${time}〜`:''}\n${mapsUrl(s)}\n\n酒場図: ${location.origin+location.pathname}`;
  try{ if(navigator.share){ await navigator.share({text}); return; } }catch(e){ if(e&&e.name==='AbortError') return; }
  try{ await navigator.clipboard.writeText(text); toast('メッセージをコピーしました。LINEなどに貼って送れます'); }catch{ toast('コピーできませんでした'); }
}
// 今日どこ行く?: a sheet over 決める (探す | 今日の候補)
function openPick(src){
  if (tab!=='home') setTab('home');
  pick.cheers=true; pick.whoNames=false; pick.chosen=null; pick.proposing=null; if (src) pick.src = src==='today' ? 'today' : 'find';
  const wf=activeFriends()[0]; $('pTitle').textContent = wf ? '飲み友とどこ行く?' : '今日どこ行く?';
  showSheet('pickSheet'); buildPick(); focusIn('pickSheet');
}
function closePick(){ hideSheet('pickSheet'); }
function omakase(cands){
  if (!cands.length) return;
  const bag=cands.flatMap(x=>Array(x.w ?? 1+honBy(x.s).length*2+tsukeBy(x.s).length*2).fill(x));   // 本命 comes up about 3x as often
  const one=()=>bag[Math.floor(Math.random()*bag.length)].s;
  let final=one(); if (cands.length>1) while(final.id===pick.chosen) final=one();
  pick.proposing=null;
  const slot=$('pSlot'); const land=()=>{ pick.chosen=final.id; pick.fresh=true; buzz(); buildPick(); };
  if (reduceMotion() || !slot || !slot.animate){ land(); return; }
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
// who is in on this: あなた + the chosen 飲み友, as icon chips under the title
function whoRow(){
  const w=$('pWho'), hd=w&&w.parentNode; if(!w) return; w.textContent='';
  hd.querySelectorAll('.p-cheers').forEach(x=>x.remove());
  const fr=activeFriends(); w.hidden=!fr.length; hd.classList.toggle('with-friends',!!fr.length); if(!fr.length) return;
  // up to 4 people: icon + name together. 5+: icons only, and a button that shows icon + name while it's on
  const many=fr.length+1>=5, named=!many || pick.whoNames;
  const people=[[me,'あなた'],...fr.map(u=>[(friends[u]||{}).mid,(friends[u]||{}).nick||'飲み友'])];
  for (const [mid,n] of people){
    if (named){ const c=el('span','hint-who'); c.append(avatar({},mid,'pl-av'), n); w.append(c); }
    else { const a=avatar({},mid,'pl-av'); a.title=n; w.append(a); }
  }
  if (many){ const b=el('button','p-nb'+(pick.whoNames?' on':''),'名前'); b.type='button'; b.setAttribute('aria-pressed',String(!!pick.whoNames)); b.setAttribute('aria-label','参加者の名前を'+(pick.whoNames?'隠す':'表示'));
    b.append(' ',el('span','dc-ar'+(pick.whoNames?' open':''),'▾')); b.onclick=()=>{ pick.whoNames=!pick.whoNames; whoRow(); }; w.append(b); }
  const ch=el('span','p-cheers'+(pick.cheers?' go':''),'🍻'); pick.cheers=false; hd.insertBefore(ch,$('pTitle'));
}
function buildPick(){
  const b=$('pBody'); if(!b || !isOpen('pickSheet')) return;
  const ae=document.activeElement; if (ae && b.contains(ae) && ae.tagName==='INPUT' && !ae.classList.contains('pk-q')) return;
  b.textContent='';
  whoRow();
  const seg=el('div','seg pk-seg'); seg.setAttribute('role','group'); seg.setAttribute('aria-label','表示');
  const nc=todayCands().length;
  for (const [k,l] of [['find','探す'],['today',nc?`今日の候補 ${nc}`:'今日の候補']]){ const x=el('button',null,l); x.setAttribute('aria-pressed',String(pick.src===k)); x.onclick=()=>{ pick.src=k; pick.chosen=null; buildPick(); }; seg.appendChild(x); }
  b.appendChild(seg);
  if (pick.src==='today'){ todayTab(b); return; }
  // 行きたい / 行った and a ⚙ that opens the filters
  const tg=el('div','dc-tg');
  pick.want=true; pick.went=true;   // always both: who wanted / who went shows on each card
  { const base=shops.filter(statusOf);
    if (pick.fresh1 && pick.tsuke) pick.tsuke=false;
    const cnt=k=>base.filter(s=>fMatch(s,{...pick,[k]:true})).length;   // how many shops this chip would leave
    const tog=(k,l,ic,cls,label,off)=>{ const x=el('button','chip pk-t '+cls,l); x.append(' ',el('span','pk-n',String(cnt(k)))); x.type='button'; if(ic) x.prepend(ic); if(off){ x.disabled=true; x.title='初めての店と定番は一緒に選べません'; } x.setAttribute('aria-pressed',String(!!pick[k])); x.setAttribute('aria-label',label); x.onclick=()=>{ pick[k]=!pick[k]; pick.chosen=null; buildPick(); }; tg.appendChild(x); };
    tog('fresh1','初めての店',null,'pk-new', activeFriends().length?'選んだメンバーの誰も行っていない店だけ':'まだ行っていない店だけ', !!pick.tsuke);
    if (pick.hon || base.some(s=>honBy(s).length)) tog('hon','本命',lanEl(),'pk-honc','本命の店だけ');
    if (pick.tsuke || base.some(s=>tsukeBy(s).length)) tog('tsuke','定番',chokoEl(),'pk-tsukec','定番の店だけ', !!pick.fresh1); }
  const on=[pick.q&&'「'+pick.q+'」', pick.at&&(+pick.at.slice(0,2))+'時〜', pick.genre, pick.star&&'★'+pick.star+'〜'].filter(Boolean);
  const fb=el('button','chip dc-fb'+(on.length?' on':''), '絞り込み'+(on.length?' '+on.length:'')); fb.append(' ',el('span','dc-ar'+(pick.fopen?' open':''),'▾')); fb.type='button'; fb.setAttribute('aria-label','検索・絞り込み(時間・ジャンル・星)'+(on.length?'：'+on.join('・'):'')); fb.title='検索・時間・ジャンル・星で絞り込み'; fb.setAttribute('aria-expanded',String(pick.fopen));
  fb.onclick=()=>{ pick.fopen=!pick.fopen; buildPick(); }; tg.appendChild(fb);
  b.appendChild(tg);
  if (pick.fopen) filterBar(b,pick,shops.filter(s=>(pick.want&&inWant(s))||(pick.went&&inWent(s))),buildPick);
  const cands=candidates();
  if (!cands.length){ b.appendChild(el('p','empty', shops.length?'条件に合う店がありません。条件を外してみてください。':'まだ店がありません。リストの「＋」から行きたい店を入れてみましょう。')); return; }
  const ul=el('ul','plist');
  for (const {s} of cands){
    const li=el('li'); const info=el('button','pinfo'); info.onclick=()=>openDetail(s.id);
    info.appendChild(el('span','pn',s.name||'(名前なし)'));
    info.appendChild(pickChips(s,true));
    if (!readOnly && me && !mySt(s)){ const wrap=el('div','pk-main'); wrap.append(info, mineRow(s)); li.appendChild(wrap); } else li.appendChild(info);
    { const side=el('div','pk-side'); const mk=tierMarks(s); if(mk){ li.classList.add('has-tier'); li.appendChild(mk); } if (!readOnly && me) side.appendChild(pickBtn(s)); if (side.children.length) li.appendChild(side); }
    ul.appendChild(li);
  }
  b.appendChild(ul);
}
// a 飲み友's shop: put it in my list too ("そういえば行った" / "行きたかった")
function mineRow(s){
  const r=el('span','mine-row'); r.appendChild(el('span','mine-l','自分も'));
  const w=el('button','mine-b','＋ 行きたい'); w.type='button'; w.onclick=e=>{ e.stopPropagation(); patchShop(s.id,{wants:{[me]:true}}); toast(`「${s.name}」を自分の行きたいに入れました`); };
  const g=el('button','mine-b','✓ 行った'); g.type='button'; g.onclick=e=>{ e.stopPropagation(); wentWhen(s.id); };
  r.append(w,g); r.onclick=e=>e.stopPropagation(); return r;
}
// the 今日の候補 tab: mine and the 飲み友's picks together; shops both picked come first, marked 🍻
// the ルーレット over 今日の候補 only (a narrowed-down set picks better than the whole list)
function roulette(b,cs){
  const items=cs.map(c=>({s:{id:c.key,name:c.name}, c, w:c.shop?1+honBy(c.shop).length*2+tsukeBy(c.shop).length*2:1}));
  const chosen=pick.chosen && items.find(x=>x.s.id===pick.chosen);
  const om=el('div','omakase'); const slot=el('div','slot'); slot.id='pSlot'; slot.setAttribute('aria-live','polite');
  if (chosen){ slot.classList.add('hit'); if(pick.fresh){ slot.classList.add('fresh'); pick.fresh=false; } slot.append(el('span','sl-k','🎲 ここはどう?'), el('span','sl-n',chosen.c.name||''));
    const sub=chosen.c.shop ? [genreOf(chosen.c.shop), chosen.c.shop.area].filter(Boolean).join('　') : ''; if(sub) slot.appendChild(el('span','sl-a',sub)); }
  else slot.append(el('span','sl-k',`${items.length}軒の中から`), el('span','sl-n','迷ったら、おまかせ'));
  const ob=el('div','sl-btns');
  const spin=el('button','btn btn-ink',chosen?'もう一回':'🎲 おまかせ'); spin.onclick=()=>omakase(items); ob.appendChild(spin);
  if (chosen && !readOnly && me){ const here=el('button','btn btn-line','ここにする'); here.onclick=()=>{ decide(chosen.c.shop,chosen.c); closePick(); }; ob.appendChild(here); }
  if (chosen){ const x=el('button','sl-x','×'); x.type='button'; x.setAttribute('aria-label','結果を閉じて回す前に戻す'); x.onclick=()=>{ pick.chosen=null; buildPick(); }; slot.appendChild(x); }
  slot.appendChild(ob); om.appendChild(slot); b.appendChild(om);
}
function todayTab(b){
  const wf=activeFriends()[0], cs=todayCands();
  b.appendChild(el('p','hint', wf ? 'みんなが出した今日の候補。いいと思ったら「＋ 私も」。選んだ人数が多い店から並びます。'
    : '今日の候補。「飲み友と」に切り替えると、相手の候補と合わせて見られます。'));
  if (cs.length) roulette(b,cs);
  if (!cs.length){ b.appendChild(el('p','empty','まだ候補がありません。「探す」で「＋ 候補」を押して入れてください。')); return; }
  const ul=el('ul','plist cands');
  for (const c of cs){
    const both=allOk(c), li=el('li', both?'both':'');
    const info=el('button','pinfo'); if (c.shop) info.onclick=()=>openDetail(c.shop.id);
    { const ol=okLabel(c); if (ol) info.appendChild(el('span','both-b'+(both?'':' some'),ol)); }
    info.appendChild(el('span','pn',c.name||'(名前なし)'));
    if (c.shop) info.appendChild(pickChips(c.shop,false));
    const who=el('span','who-l'); for (const u of c.by){ const mid=u===me?me:(friends[u]||{}).mid, nm=u===me?'あなた':(friends[u]||{}).nick||'飲み友'; const t=el('span','who-t'+(u===me?' me':''),'✓'); t.prepend(avatar({},mid,'pl-av')); t.title=t.ariaLabel=nm+' ✓'; who.appendChild(t); } info.appendChild(who);
    if (!readOnly && me && c.shop && !mySt(c.shop)){ const wrap=el('div','pk-main'); wrap.append(info, mineRow(c.shop)); li.appendChild(wrap); } else li.appendChild(info);
    if (!readOnly && me){ const side=el('div','cand-side'); { const mk=c.shop&&tierMarks(c.shop); if(mk){ li.classList.add('has-tier'); li.appendChild(mk); } } const dc=decided(); const isGo=dc && dc.key===c.key;
      if (isGo){ li.classList.add('go'); side.appendChild(el('span','go-b','✓ ここに決定')); }
      else { const go=el('button','sbtn go-btn'+(both?' on':''),'ここにする'); go.onclick=()=>decide(c.shop,c); side.appendChild(go); }
      const on=c.by.has(me); const g=el('button','sbtn sm'+(on?'':''), on?'候補から外す':'＋ 私も'); g.onclick=()=>togglePick(c.shop,c); side.appendChild(g); li.appendChild(side); }
    ul.appendChild(li);
  }
  b.appendChild(ul);
}
$('pBack').onclick=()=>{ buzz(); closePick(); };


// the same little labels as the list cards: 行った/行きたい, 営業時間, ジャンル, 星
// a shop's lines in 今日どこ行く?: the shop in one line of text (営業中 〜24:00 ・ 居酒屋 ・ ★4.0),
// then (with 飲み友) who: icons ringed red (行きたい) / navy (行った), with a small 提灯 / お猪口 for 本命 / 定番
// a shop in 今日どこ行く?: 営業時間・ジャンル・★ on one line, then 行きたい / 行った (with whose icons)
function pickChips(s,withStatus){
  const box=el('div','pk-lines'), fr=activeFriends();
  const top=el('div','pk-top');
  hoursPill(top,s);
  { const g=genreOf(s); if(g) top.appendChild(el('span','pk-g',g)); }
  { const st=starAvg(s); if(st) top.appendChild(el('span','pk-star','★'+st.v.toFixed(1))); }
  if (top.children.length) box.appendChild(top);
  if (withStatus){
    const row=el('div','sc-chips pk-chips');
    if (fr.length){
      const who=[[me,'あなた'], ...fr.map(f=>[friends[f].mid, friends[f].nick||'飲み友'])];
      for (const st of ['want','went']){ const ppl=who.filter(([u])=> st==='went' ? !!wentBy(s)[u] : !wentBy(s)[u] && !!(s.wants&&s.wants[u])); if(!ppl.length) continue;
        pill(row,'st-'+st+' st-who', st==='went'?'行った':'行きたい'); const p=row.lastChild; const stk=el('span','pl-stack');
        for (const [u] of ppl) stk.appendChild(avatar({},u,'pl-av'));
        p.prepend(stk); p.title=p.ariaLabel=ppl.map(x=>x[1]).join('・')+' '+(st==='went'?'行った':'行きたい'); }
    } else { const w=statusOf(s)==='went'; pill(row, w?'st-went':'st-want', w?'行った':'行きたい'); }
    if (row.children.length) box.appendChild(row);
  }
  return box;
}

// ---------- 決定: one of tonight's picks becomes "今日はここ" (go:true on my pick for it) ----------
function decided(){
  const mine=myPickDocs().find(d=>d.go);
  let theirs=null, wf=null; for (const f of activeFriends()){ const t=(fToday[f]||[]).find(d=>d.go && d.date===nightKey()); if (t){ theirs=t; wf=f; break; } }
  const d=mine||theirs; if(!d) return null;
  const key=docKey(d), shop=shops.find(s=>shopKey(s)===key) || shops.find(s=>s.id===d.shopId) || null;
  return {key, name:d.name||(shop&&shop.name)||'', shop, by: mine ? me : wf, mine:!!mine, time:d.time||''};
}
function writePick(id,data){ todayDocs={...todayDocs,[id]:data}; if (mode==='db') enqueue('today:'+id,()=>db.doc('today/'+id).set(data)); }
function decide(s,c){
  if (!me || readOnly) return;
  const key = s ? shopKey(s) : c.key;
  if (!myPickDocs().some(d=>docKey(d)===key)){   // not one of mine yet: pick it first
    const shopId = s ? s.id : ('k:'+key).slice(0,60), id=`${nightKey()}_${shopId}`;
    todayDocs={...todayDocs,[id]:{shopId, date:nightKey(), by:me, time:'', createdAt:Date.now(), votes:{}, name:((s&&s.name)||(c&&c.name)||'').slice(0,60), key:key.slice(0,80)}};
  }
  for (const d of myPickDocs()){ const go=docKey(d)===key; if (!!d.go===go && !(go && !d.createdAt)) continue; const {_id,...data}=d; writePick(_id,{...data,go}); }
  if (mode!=='db') saveLocal();
  buzz(); afterChange();
  const name=(s&&s.name)||(c&&c.name)||'';
  darumaCheer(`今日は「${name}」に決まり! 楽しんで`);
  toast(`今日は「${name}」に決定!`,'取り消す',()=>undecide());
}
function undecide(){
  for (const d of myPickDocs()){ if(!d.go) continue; const {_id,...data}=d; writePick(_id,{...data,go:false}); }
  if (mode!=='db') saveLocal(); afterChange();
}
// 決める: the decided shop on top
function goCard(v){
  const dc=decided(); if(!dc) return;
  const c=el('section','gocard');
  c.appendChild(el('span','gc-k', dc.mine ? '今日はここ!' : `${(friends[dc.by]||{}).nick||'飲み友'}が決めました`));
  const n=el('button','gc-n',dc.name||'(名前なし)'); if (dc.shop) n.onclick=()=>openDetail(dc.shop.id); c.appendChild(n);
  if (dc.shop){ const ch=pickChips(dc.shop,false); c.appendChild(ch); }
  const acts=el('div','gc-acts');
  const target=dc.shop||{name:dc.name};
  const m=el('a','sbtn','マップ ↗'); m.href=mapsUrl(target); m.target='_blank'; m.rel='noopener noreferrer'; acts.appendChild(m);
  const sh=el('button','sbtn','LINEで送る'); sh.onclick=()=>shareShop(target,dc.time); acts.appendChild(sh);
  if (!readOnly && me){
    if (dc.mine){ const x=el('button','sbtn gc-x','やめる'); x.onclick=()=>undecide(); acts.appendChild(x); }
    else { const ok=el('button','sbtn on','ここにする'); ok.onclick=()=>decide(dc.shop,{key:dc.key,name:dc.name}); acts.appendChild(ok); }
  }
  c.appendChild(acts); v.appendChild(c);
}
// the morning after: "昨日の◯◯、行った?"
function lastNightCard(v){
  if (!me || readOnly) return;
  const y=lastNightKey(); const e=Object.entries(todayDocs).find(([,d])=>d.go && d.by===me && d.date===y); if(!e) return;
  const [id,d]=e;
  const c=el('section','gocard ln');
  c.appendChild(el('span','gc-k','ゆうべのお店'));
  c.appendChild(el('p','gc-q',`昨日の「${d.name||'お店'}」、行った?`));
  const done=()=>{ const o={...todayDocs}; delete o[id]; todayDocs=o; if (mode==='db') enqueue('today:'+id,()=>db.doc('today/'+id).delete()); else saveLocal(); afterChange(); };
  const acts=el('div','gc-acts');
  const yes=el('button','sbtn on','行った'); yes.onclick=async()=>{ yes.disabled=true;
    let s=myShops.find(x=>x.id===d.shopId) || myShops.find(x=>shopKey(x)===d.key);
    let sid=s&&s.id; if (!sid) sid=await addOrBump(d.name||'お店','',{});
    if (sid){ markWent(sid,true,d.date); toast(`「${d.name}」を${fmtDate(d.date)}に行ったと記録しました`); }
    done(); };
  const no=el('button','sbtn','行かなかった'); no.onclick=done;
  acts.append(yes,no); c.appendChild(acts); v.appendChild(c);
}

// ---------- 1人のとき: 今夜は 家飲み / 休肝日 (kept on this device until 5 a.m.) ----------
const NIGHTS = { home:{ic:'🏠', l:'家飲み', on:'今日は家飲み', say:'今日は家飲みだね。のんびり乾杯!'}, rest:{ic:'🍵', l:'休肝日', on:'今日は休肝日', say:'休肝日えらい! 明日においしく飲もう'} };
let nightsDb={};   // from Firestore: date -> 'home' | 'rest'
const nightsLocal = () => { try{ const o=JSON.parse(localStorage.getItem('nm-nights')||'{}'); return o&&typeof o==='object'?o:{}; }catch{ return {}; } };
// every 家飲み / 休肝日 night I've marked: date -> kind
function nightsAll(){ const o={...nightsLocal(), ...nightsDb}; for (const k in o) if (!NIGHTS[o[k]]) delete o[k]; return o; }
function nightOf(){ return nightsAll()[nightKey()] || ''; }
function setNight(k,date){
  const d=date||nightKey();
  try{ const o=nightsLocal(); if (k) o[d]=k; else delete o[d]; localStorage.setItem('nm-nights',JSON.stringify(o)); }catch{}
  if (k) nightsDb={...nightsDb,[d]:k}; else { const o={...nightsDb}; delete o[d]; nightsDb=o; }
  if (mode==='db') (k ? db.doc('nights/'+d).set({kind:k, at:Date.now()}) : db.doc('nights/'+d).delete()).catch(e=>console.warn('nights',e&&e.code));
  if (k && !date){ buzz(); darumaCheer(NIGHTS[k].say); toast(`今日を「${NIGHTS[k].l}」としてカレンダーに記録しました`,'カレンダー',()=>{ listSub='cal'; setTab('list'); }); }
  else if (!k && !date) toast('今日の記録を取り消しました');
  render();
}
function nightBtns(v){
  const cur=nightOf(), row=el('div','night-row');
  for (const [k,n] of Object.entries(NIGHTS)){ const b=el('button','night-b'+(cur===k?' on':'')); b.type='button'; b.setAttribute('aria-pressed',String(cur===k));
    b.append(el('span','nb-ic',n.ic), el('span','nb-t', cur===k ? n.on : n.l));
    b.onclick=()=>setNight(cur===k ? '' : k); row.appendChild(b); }
  v.appendChild(row);
}

// 決める: the shops on my lists that are open now (or open within the hour), to scroll through
let nowGenre='';
function openNowStrip(v){
  const now=new Date();
  const rank=s=>{ const h=hoursStatus(s,now); if(!h) return null; if(h.k==='open') return 0; if(h.k==='soon' && /分で開店/.test(h.t)) return 1; return null; };
  const open=shops.filter(s=>statusOf(s) && rank(s)!=null);
  const genres=[...new Set(open.map(genreOf).filter(Boolean))].sort();
  if (nowGenre && !genres.includes(nowGenre)) nowGenre='';
  const list=open.filter(s=>!nowGenre || genreOf(s)===nowGenre)
    .sort((a,b)=> rank(a)-rank(b) || (honBy(b).length+tsukeBy(b).length)-(honBy(a).length+tsukeBy(a).length) || ((starAvg(b)||{}).v||0)-((starAvg(a)||{}).v||0))
    ;
  const more=Math.max(0,list.length-12); list.length=Math.min(list.length,12);
  if (!open.length) return;
  const sec=el('section','now-sec');
  const hd=el('div','now-h'); hd.append(el('h3','now-t','営業中の店'), el('span','now-n',(list.length+more)+'軒'));
  if (genres.length>1){ const w=el('label','pk-sel now-g'+(nowGenre?' on':'')); const sel=el('select'); sel.setAttribute('aria-label','ジャンルで絞る');
    for (const [v,l] of [['','ジャンル'],...genres.map(g=>[g,g])]){ const o=el('option',null,l); o.value=v; o.selected=v===nowGenre; sel.appendChild(o); }
    sel.onchange=()=>{ nowGenre=sel.value; render(); }; w.appendChild(sel); hd.appendChild(w); }
  sec.appendChild(hd);
  const row=el('div','now-row');
  for (const s of list){
    const c=el('article','now-card'); c.style.setProperty('--c',crestColor(s));
    const top=el('button','now-top'); top.type='button'; top.onclick=()=>openDetail(s.id);
    top.append(el('span','crest now-crest',crestOf(s)), el('b','now-name',s.name||''));
    c.appendChild(top);
    const ch=el('div','sc-chips now-chips'); hoursPill(ch,s); { const g=genreOf(s); if(g) pill(ch,'genre',g); } c.appendChild(ch);
    const acts=el('div','now-acts');
    const y=yoyakuUrl(s); if (y){ const a=el('a','sbtn now-yoyaku','ネット予約 ↗'); a.href=y; a.target='_blank'; a.rel='noopener noreferrer'; acts.appendChild(a); }
    if (!readOnly && me) acts.appendChild(pickBtn(s));
    c.appendChild(acts); row.appendChild(c);
  }
  if (more){ const m=el('button','now-more'); m.type='button'; m.append(el('b',null,`ほか${more}軒`), el('span',null,'一覧で見る ›')); m.onclick=()=>{ pick.want=true; pick.went=true; pick.genre=nowGenre||''; pick.at=''; openPick('find'); }; row.appendChild(m); }
  sec.appendChild(row); sec.appendChild(el('p','now-note','営業時間内の店です。空席はお店で確認してください')); v.appendChild(sec);
}

// someone's 本命 / 定番: a lantern / an お猪口 above the ＋候補 (who: in the title)
function tierMarks(s){
  const hb=honBy(s), tb=tsukeBy(s); if(!hb.length && !tb.length) return null;
  const nm=u=>u===me?'あなた':(friendByMid(u)||{}).nick||'飲み友';
  const w=el('span','tier-marks');
  if (hb.length){ const m=el('span','tm hon'); m.appendChild(lanEl()); m.title=m.ariaLabel=hb.map(nm).join('・')+'の本命'; w.appendChild(m); }
  if (tb.length){ const m=el('span','tm tsuke'); m.appendChild(chokoEl()); m.title=m.ariaLabel=tb.map(nm).join('・')+'の定番'; w.appendChild(m); }
  return w;
}
