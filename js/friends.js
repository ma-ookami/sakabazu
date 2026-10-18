/* ---------- friends: add by 飲み友コード, and mix their lists into yours ----------
   myShops: my own shops (the only ones I write). shops: what the screens show = mine + the friends I mix in.
   A friend-only shop is read-only (id "f~<fid>~<shopId>"); acting on it first copies it into my list. */
let myShops=[], friends={}, fShops={}, fDenied={}, fSubs={}, myCode='';
// the friend whose list I'm looking at together with mine (one at a time: "けんとのリスト")
let mix = new Set((()=>{ try{ return JSON.parse(localStorage.getItem('nm-mix')||'[]').slice(0,1); }catch{ return []; } })());
const saveMix = () => { try{ localStorage.setItem('nm-mix',JSON.stringify([...mix])); }catch{} };
// on screen only on the 決める tab; lists and map always show just mine
const activeFriends = () => tab==='home' ? mixedFriends() : [];
const mixedFriends = () => [...mix].filter(f=>friends[f]);
const friendByMid = mid => Object.values(friends).find(f=>f.mid===mid);
const isFriendShop = s => !!(s && s._friend);
const CODE_ABC='ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const fmtCode = c => c ? c.slice(0,4)+'-'+c.slice(4) : '';
const cleanCode = s => (s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');

// the list the screens show
function rebuildShops(){
  const fr=activeFriends();
  if (!fr.length){ shops=myShops; return; }
  const key = s => (s.hp&&s.hp.id) ? 'hp:'+s.hp.id : 'n:'+norm(s.name||'');
  const out=myShops.map(s=>({...s, wants:{...(s.wants||{})}, went:(s.went&&typeof s.went==='object')?{...s.went}:wentBy(s), r:{...(s.r||{})}}));
  const byKey=new Map(out.map(s=>[key(s),s]));
  for (const f of fr){
    const fm=friends[f].mid;
    for (const t of fShops[f]||[]){
      const want=!!(t.wants&&t.wants[fm]), went=wentBy(t)[fm];
      if (!want && !went) continue;
      let s=byKey.get(key(t));
      if (!s){
        s={id:`f~${f}~${t.id}`, _friend:f, name:t.name, area:t.area||'', createdBy:fm, createdAt:t.createdAt||0, wants:{}, went:{}, r:{}};
        for (const k of ['loc','hours','tags','links','hp']) if (t[k]) s[k]=JSON.parse(JSON.stringify(t[k]));   // basics only: no visits (prices)
        out.push(s); byKey.set(key(t),s);
      }
      if (want) s.wants[fm]=true;
      if (went) s.went[fm]=went;
      const st=t.r && t.r[fm] && t.r[fm].star; if (typeof st==='number') s.r[fm]={star:st};   // their 星 only: no marks, memos or ひとこと
      if (t.r && t.r[fm] && t.r[fm].hon) s.r[fm]={...(s.r[fm]||{}), hon:true};   // and whether it's their 本命
      if (!s.loc && t.loc) s.loc=t.loc;
    }
  }
  shops=out;
}

// copy a friend's shop into my list (when I tap 行きたい / 行った / edit on it). -> my new shop id
async function importShop(id){
  const s=shops.find(x=>x.id===id); if(!s || !isFriendShop(s)) return id;
  const k0=(s.hp&&s.hp.id)||'', own=myShops.find(x=>(k0 && x.hp && x.hp.id===k0) || norm(x.name)===norm(s.name)); if(own) return own.id;
  const extra={}; for (const k of ['loc','hours','tags','links','hp']) if (s[k]) extra[k]=s[k];
  const nid=await addOrBump(s.name,s.area||"",extra);
  return nid;
}

// subscriptions: my friends, and the shops of each friend I mix in
function watchFriends(){
  cloudSubs.push(db.collection('friends').limit(200).onSnapshot(snap=>{
    const o={}; for (const d of snap.docs){ const v=d.data()||{}; if(typeof v.gid==='string' && typeof v.mid==='string') o[d.id]={gid:v.gid, mid:v.mid, nick:String(v.nick||'飲み友').slice(0,20), at:v.at||0}; }
    for (const f in o){ const was=friends[f]; if (was && was.fetched){ o[f].nick=was.nick; o[f].ic=was.ic; o[f].dm=was.dm; o[f].fetched=true; } }
    friends=o; for (const f in o) if (!o[f].fetched) fetchFriend(f);
    if (!addChecked) setTimeout(checkAddLink,300);
    syncFriendSubs(); rebuildShops(); render();
  },()=>{}));
}
function syncFriendSubs(){
  for (const f of Object.keys(fSubs)) if (!mix.has(f) || !friends[f]){ try{ fSubs[f](); }catch{} delete fSubs[f]; delete fShops[f]; delete fToday[f]; }
  for (const f of mixedFriends()) if (!fSubs[f]){
    const fr=friends[f];
    const u1=fs.collection(`groups/${fr.gid}/shops`).limit(1000).onSnapshot(snap=>{
      fShops[f]=snap.docs.map(d=>({id:d.id,...JSON.parse(JSON.stringify(d.data()||{}))})); delete fDenied[f]; afterChange();
    },e=>{ console.warn(e); fDenied[f]=true; fShops[f]=[]; afterChange(); });
    // their 今日の候補 (today only)
    const u2=fs.collection(`groups/${fr.gid}/today`).where('date','==',nightKey()).limit(100).onSnapshot(snap=>{
      fToday[f]=snap.docs.map(d=>({id:d.id,...JSON.parse(JSON.stringify(d.data()||{}))})).filter(d=>typeof d.shopId==='string'); afterChange();
    },e=>{ console.warn(e); fToday[f]=[]; });
    fSubs[f]=()=>{ u1(); u2(); };
  }
}
// their current name and icon (the friend doc keeps the name from when we became friends)
function fetchFriend(f){
  const fr=friends[f]; if(!fr) return; fr.fetched=true;
  fs.doc(`groups/${fr.gid}/members/${fr.mid}`).get().then(d=>{ if(!d.exists || !friends[f]) return; const v=d.data()||{};
    if (v.nick) friends[f].nick=String(v.nick).slice(0,20); if (v.ic && typeof v.ic==='object') friends[f].ic=v.ic; if (v.dm && typeof v.dm==='object') friends[f].dm=v.dm; render(); }).catch(()=>{});
}
function stopFriendSubs(){ for (const f of Object.keys(fSubs)){ try{ fSubs[f](); }catch{} } fSubs={}; fShops={}; fToday={}; }

// my 飲み友コード: one per device, made the first time it is needed
let codeP=null;
function ensureCode(){ if (myCode) return Promise.resolve(myCode); if (!codeP) codeP=makeCode().finally(()=>{ codeP=null; }); return codeP; }
async function makeCode(){
  if (myCode) return myCode;
  try{ const u=await fs.doc('users/'+uid).get(); const c=u.exists && u.data().code; if(c){ const d=await fs.doc('codes/'+c).get(); if(d.exists && d.data().gid===gid){ myCode=c; return c; } } }catch(e){ console.warn(e); }
  for (let i=0;i<4;i++){
    const b=crypto.getRandomValues(new Uint8Array(7)); const c=[...b].map(x=>CODE_ABC[x%CODE_ABC.length]).join('');
    try{
      await fs.doc('codes/'+c).set({gid, mid:me, nick:(members[me]&&members[me].nick)||'', at:Date.now()});
      await fs.doc('users/'+uid).set({code:c},{merge:true});
      myCode=c; return c;
    }catch(e){ console.warn(e); if(e && e.code!=='permission-denied') break; }
  }
  return '';
}
// keep the name on my code fresh (friends see it when they add me)
function syncCodeNick(nick){ if(myCode) fs.doc('codes/'+myCode).set({gid, mid:me, nick, at:Date.now()}).catch(()=>{}); }

// enter a friend's code: we both become friends (I write my entry into their list and theirs into mine)
async function addFriend(raw){
  const c=cleanCode(raw);
  if (c.length!==7) return '7文字のコードを入れてください';
  let d=null; try{ d=await fs.doc('codes/'+c).get(); }catch(e){ console.warn(e); return '通信できませんでした。もう一度どうぞ'; }
  if (!d.exists) return 'そのコードは見つかりませんでした';
  const v=d.data();
  if (v.gid===gid) return 'それはあなたのコードです';
  const b=fs.batch();
  b.set(fs.doc(`groups/${v.gid}/friends/${uid}`),{gid, mid:me, nick:(members[me]&&members[me].nick)||'', code:c, at:Date.now()});
  b.set(fs.doc(gpath('friends/'+v.mid)),{gid:v.gid, mid:v.mid, nick:String(v.nick||'飲み友').slice(0,20), at:Date.now()});
  try{ await b.commit(); }catch(e){ console.warn(e); return '追加できませんでした('+(e.code||'error')+')'; }
  friendMode=true; lastFriend=v.mid; mix=new Set([v.mid]); saveMix(); saveWho();
  return '';
}
async function removeFriend(f){
  const fr=friends[f]; if(!fr) return;
  if (!(await ask(`「${fr.nick}」を飲み友から外します。お互いのリストが見えなくなります。`,'外す',true))) return;
  mix.delete(f); saveMix();
  await fs.doc(gpath('friends/'+f)).delete().catch(onWriteError);
  await fs.doc(`groups/${fr.gid}/friends/${uid}`).delete().catch(()=>{});   // my entry in their list
}

// 設定 → 飲み友
// 設定 → 飲み友: two blocks, 「飲み友を追加」(my code + enter theirs) and 「飲み友リスト」
function friendsSec(root){
  const box=sec('飲み友を追加','コードを教え合うと、2人のリストが見られます'); box.id='secFriends'; root.appendChild(box);
  const mine=el('div','fr-code'); mine.appendChild(el('span','fr-cl','あなたの飲み友コード'));
  const cv=el('b','fr-cv','…'); mine.appendChild(cv);
  const cp=el('button','sbtn','コピー'); cp.type='button'; cp.disabled=true;
  cp.onclick=async()=>{ try{ await navigator.clipboard.writeText(fmtCode(myCode)); toast('コピーしました'); }catch{ toast(fmtCode(myCode)); } };
  // QR: a small button next to コピー; the code opens big in a window
  const qb=el('button','sbtn fr-qrb','QR'); qb.type='button'; qb.disabled=true; qb.setAttribute('aria-label','QRコードを表示'); qb.onclick=showQr;
  mine.append(qb,cp); box.appendChild(mine);
  box.appendChild(el('p','hint','このコードを相手の「飲み友のコードを入れる」に入れてもらうか、相手のコードを下に入れると飲み友になれます。上の「飲み友と」から、2人の店を合わせたリストが見られます。'));
  const showCode=()=>{ if(myCode){ cv.textContent=fmtCode(myCode); cp.disabled=false; qb.disabled=false; return; } cv.textContent='…';
    ensureCode().then(c=>{ if(c){ cv.textContent=fmtCode(c); cp.disabled=false; qb.disabled=false; return; }
      cv.textContent=''; const r=el('button','sbtn','もう一度'); r.type='button'; r.onclick=showCode; cv.append(el('span','fr-err','作れませんでした '),r); }); };
  showCode();

  // the code goes in 7 boxes (□□□□-□□□), one letter each; small letters turn capital.
  // one real input lies over the boxes, so typing, deleting and pasting all just work
  const f=el('form','codeform'); f.noValidate=true;
  const cb=el('label','codebox'); const i=el('input','code-in'); i.autocomplete='off'; i.autocapitalize='characters'; i.spellcheck=false; i.maxLength=12;
  i.setAttribute('autocorrect','off'); i.inputMode='text';
  i.setAttribute('aria-label','飲み友のコード(7文字)');
  const cells=[]; for (let k=0;k<7;k++){ if(k===4) cb.appendChild(el('span','code-dash','-')); const c=el('span','code-c'); cells.push(c); cb.appendChild(c); }
  cb.appendChild(i);
  const b=el('button','btn btn-red','追加'); b.type='submit'; b.disabled=true;
  // never rewrite what the keyboard typed: phone keyboards keep the word they are typing, and changing the
  // text under them makes them type it again (doubled letters). the boxes just show it in capitals
  const draw=()=>{ const v=cleanCode(i.value).slice(0,7);
    cells.forEach((c,k)=>{ c.textContent=v[k]||''; c.classList.toggle('cur', document.activeElement===i && k===Math.min(v.length,6)); });
    b.disabled=v.length!==7; };
  // a tap on the boxes puts the caret at the end (not while typing: that also upsets phone keyboards)
  const toEnd=()=>{ const n=i.value.length; try{ if(i.selectionStart!==n) i.setSelectionRange(n,n); }catch{} };
  i.oninput=draw; i.onfocus=()=>{ draw(); setTimeout(toEnd,0); }; i.onblur=draw;
  i.addEventListener('click',toEnd);
  f.append(cb,b);
  f.onsubmit=async e=>{ e.preventDefault(); if(cleanCode(i.value).length!==7){ i.focus(); return; } b.disabled=true;
    const err=await addFriend(i.value); b.disabled=false;
    if (err){ toast(err); i.focus(); return; }
    i.value=''; draw(); toast('飲み友になりました。「飲み友と」から2人のリストが見られます'); };
  box.appendChild(el('h4','fr-h','飲み友のコードを入れる')); box.appendChild(f);

  const ids=Object.keys(friends).sort((a,b)=>friends[a].at-friends[b].at);
  const lst=sec('飲み友リスト', ids.length ? ids.length+'人' : ''); root.appendChild(lst);
  if (!ids.length) lst.appendChild(el('p','hint','まだ飲み友がいません。上のコードを教え合うと、ここに並びます。'));
  if (ids.length){
    const ul=el('ul','mlist frlist');
    for (const id of ids){ const fr=friends[id]; const li=el('li');
      li.appendChild(avatar({},fr.mid,'fr-av'));
      const d=el('div'); d.style.flex='1'; d.appendChild(el('div','mn',fr.nick)); d.appendChild(el('div','ms', fDenied[id]?'リストを見られません(外された可能性があります)':'飲み友')); li.appendChild(d);
      // their だるま, as they dressed it
      if (fr.dm){ const dm=el('span','daruma fr-dm'); dm.innerHTML=darumaSvg(fr.dm); dm.title=fr.nick+'のだるま'; li.appendChild(dm); }
      const x=el('button','sbtn','外す'); x.onclick=()=>removeFriend(id); li.appendChild(x);
      ul.appendChild(li); }
    lst.appendChild(ul);
  }
}

// header: 自分のリスト | 飲み友と. picking who happens in the bar under the header (whoBar),
// which is also where you switch friends later. the last friend is remembered
let friendMode = (()=>{ try{ return localStorage.getItem('nm-fmode')==='1'; }catch{ return false; } })();
let lastFriend = (()=>{ try{ return localStorage.getItem('nm-lastf')||''; }catch{ return ''; } })();
let whoOpen=false;
if (!friendMode) mix.clear(); else if (!mix.size && lastFriend) mix.add(lastFriend);   // start the way it was left
const saveWho = () => { try{ localStorage.setItem('nm-fmode',friendMode?'1':''); localStorage.setItem('nm-lastf',lastFriend||''); }catch{} };
function setWho(fm,f){
  friendMode=fm; if (f) lastFriend=f;
  mix = (fm && lastFriend && friends[lastFriend]) ? new Set([lastFriend]) : new Set();
  whoOpen = fm && !mix.size;   // friend mode without a friend yet: show the choices
  saveMix(); saveWho(); syncFriendSubs(); rebuildShops(); buzz(); render();
}
// the bar under the header, on every tab: whose list this is, and (in friend mode) who to look at with
function whoBar(v){
  if (!(mode==='db' && !!me && !!members[me])) return;
  const ids=Object.keys(friends).sort((a,b)=>friends[a].at-friends[b].at), wf=mixedFriends()[0];
  const bar=el('div','wholine');
  const seg=el('div','whoseg wc-seg'); seg.setAttribute('role','group'); seg.setAttribute('aria-label','誰と行く?');
  const one=el('button',null,'1人で'); one.type='button'; one.setAttribute('aria-pressed',String(!friendMode)); one.onclick=()=>{ if(friendMode) setWho(false); };
  const two=el('button'); two.type='button'; two.setAttribute('aria-pressed',String(friendMode));
  if (friendMode && wf) two.append(avatar({},friends[wf].mid,'who-av'), document.createTextNode(friends[wf].nick+'と'), el('span','who-c','▾'));
  else two.textContent='飲み友と';
  two.onclick=()=>{ if(!friendMode) setWho(true); else { whoOpen=!whoOpen; render(); } };
  seg.append(one,two);
  bar.append(el('span','wc-q','誰と行く?'), seg); v.appendChild(bar);
  if (friendMode && (whoOpen || !wf)){
    const ch=el('div','wc-list');
    if (!ids.length) ch.appendChild(el('span','wc-s','まだ飲み友がいません。'));
    for (const id of ids){ const c=el('button','chip wc-f'); c.type='button'; c.setAttribute('aria-pressed',String(id===wf));
      c.append(avatar({},friends[id].mid,'who-av'), el('span',null,friends[id].nick)); c.onclick=()=>{ whoOpen=false; setWho(true,id); }; ch.appendChild(c); }
    const add=el('button','chip wc-add','＋ 飲み友を追加'); add.type='button'; add.onclick=()=>{ whoOpen=false; openFriends(); }; ch.appendChild(add);
    v.appendChild(ch);
  }
  if (friendMode && wf && fDenied[wf]) v.appendChild(el('p','hint','(相手のリストを読めません)'));
}
function openFriends(){ setSub='friends'; setTab('set'); }

// copy 飲み友's shops into my list (as 行きたい). one by one so each gets its details
async function importToMine(ids){
  let n=0; for (const id of ids){ const s=shops.find(x=>x.id===id); if(!s || !isFriendShop(s)) continue; const nid=await importShop(id); if(nid && !String(nid).startsWith('f~')) n++; }
  if (n) toast(n===1 ? '自分のリストに入れました' : `${n}軒を自分のリストに入れました`);
}

// ---------- QR: my code as a link (…#add=CODE). the other phone's camera opens it and we ask "add as 飲み友?" ----------
const addLink = c => location.origin+location.pathname+'#add='+c;
function loadQr(){
  if (window.qrcode) return Promise.resolve();
  if (!loadQr.p) loadQr.p=new Promise((ok,ng)=>{ const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js'; s.onload=ok; s.onerror=()=>{ loadQr.p=null; ng(); }; document.head.appendChild(s); });
  return loadQr.p;
}
function showQr(){
  if (!myCode) return;
  const bg=el('div','qrmodal'); bg.setAttribute('role','dialog'); bg.setAttribute('aria-modal','true'); bg.setAttribute('aria-label','飲み友コードのQR');
  const card=el('div','qr-card'); const q=el('div','qr-img','…');
  card.append(el('p','qr-t','飲み友コード '+fmtCode(myCode)), q, el('p','hint','相手のスマホのカメラで読み取ると、アプリが開いて飲み友に追加できます。'));
  const x=el('button','btn btn-line','閉じる'); x.type='button'; card.appendChild(x);
  const close=()=>{ bg.remove(); document.removeEventListener('keydown',esc); }; const esc=e=>{ if(e.key==='Escape') close(); };
  x.onclick=close; bg.onclick=e=>{ if(e.target===bg) close(); }; document.addEventListener('keydown',esc);
  bg.appendChild(card); document.body.appendChild(bg); x.focus();
  loadQr().then(()=>{ const r=qrcode(0,'M'); r.addData(addLink(myCode)); r.make(); q.innerHTML=r.createSvgTag({cellSize:4,margin:2,scalable:true}); })
    .catch(()=>{ q.textContent='QRを表示できませんでした'; });
}
// opened from a QR / link with #add=CODE: ask, then add
let addChecked=false;
async function checkAddLink(){
  if (addChecked) return; addChecked=true;
  const m=/[#&]add=([A-Za-z0-9-]{7,9})/.exec(location.hash); if (!m) return;
  history.replaceState(null,'',location.pathname+location.search);
  const c=cleanCode(m[1]); let d=null; try{ d=await fs.doc('codes/'+c).get(); }catch(e){ console.warn(e); }
  if (!d || !d.exists){ toast('その飲み友コードは見つかりませんでした'); return; }
  const v=d.data();
  if (v.gid===gid){ toast('これはあなたの飲み友コードです'); return; }
  if (friends[v.mid]){ toast(`「${v.nick||'飲み友'}」はもう飲み友です`); setWho(true,v.mid); return; }
  if (!(await ask(`「${v.nick||'この人'}」を飲み友に追加しますか? お互いのリストが見られるようになります。`,'追加する'))) return;
  const err=await addFriend(c); if (err){ toast(err); return; }
  toast(`「${v.nick||'飲み友'}」と飲み友になりました`); setWho(true,v.mid);
}
