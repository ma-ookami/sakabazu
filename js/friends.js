/* ---------- friends: add by 友達コード, and mix their lists into yours ----------
   myShops: my own shops (the only ones I write). shops: what the screens show = mine + the friends I mix in.
   A friend-only shop is read-only (id "f~<fid>~<shopId>"); acting on it first copies it into my list. */
let myShops=[], friends={}, fShops={}, fDenied={}, fSubs={}, myCode='';
// the friend whose list I'm looking at together with mine (one at a time: "けんとのリスト")
let mix = new Set((()=>{ try{ return JSON.parse(localStorage.getItem('nm-mix')||'[]').slice(0,1); }catch{ return []; } })());
const saveMix = () => { try{ localStorage.setItem('nm-mix',JSON.stringify([...mix])); }catch{} };
const mixedFriends = () => [...mix].filter(f=>friends[f]);
const friendByMid = mid => Object.values(friends).find(f=>f.mid===mid);
const isFriendShop = s => !!(s && s._friend);
const CODE_ABC='ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const fmtCode = c => c ? c.slice(0,4)+'-'+c.slice(4) : '';
const cleanCode = s => (s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');

// the list the screens show
function rebuildShops(){
  const fr=mixedFriends();
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
        for (const k of ['loc','hours','tags','links','hp','visits']) if (t[k]) s[k]=JSON.parse(JSON.stringify(t[k]));
        out.push(s); byKey.set(key(t),s);
      }
      if (want) s.wants[fm]=true;
      if (went) s.went[fm]=went;
      if (t.r && t.r[fm]) s.r[fm]=t.r[fm];
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
    const o={}; for (const d of snap.docs){ const v=d.data()||{}; if(typeof v.gid==='string' && typeof v.mid==='string') o[d.id]={gid:v.gid, mid:v.mid, nick:String(v.nick||'友達').slice(0,20), at:v.at||0}; }
    for (const f in o){ const was=friends[f]; if (was && was.fetched){ o[f].nick=was.nick; o[f].ic=was.ic; o[f].fetched=true; } }
    friends=o; for (const f in o) if (!o[f].fetched) fetchFriend(f);
    syncFriendSubs(); rebuildShops(); render();
  },()=>{}));
}
function syncFriendSubs(){
  for (const f of Object.keys(fSubs)) if (!mix.has(f) || !friends[f]){ try{ fSubs[f](); }catch{} delete fSubs[f]; delete fShops[f]; }
  for (const f of mixedFriends()) if (!fSubs[f]){
    const fr=friends[f];
    fSubs[f]=fs.collection(`groups/${fr.gid}/shops`).limit(1000).onSnapshot(snap=>{
      fShops[f]=snap.docs.map(d=>({id:d.id,...JSON.parse(JSON.stringify(d.data()||{}))})); delete fDenied[f]; afterChange();
    },e=>{ console.warn(e); fDenied[f]=true; fShops[f]=[]; afterChange(); });
  }
}
// their current name and icon (the friend doc keeps the name from when we became friends)
function fetchFriend(f){
  const fr=friends[f]; if(!fr) return; fr.fetched=true;
  fs.doc(`groups/${fr.gid}/members/${fr.mid}`).get().then(d=>{ if(!d.exists || !friends[f]) return; const v=d.data()||{};
    if (v.nick) friends[f].nick=String(v.nick).slice(0,20); if (v.ic && typeof v.ic==='object') friends[f].ic=v.ic; render(); }).catch(()=>{});
}
function stopFriendSubs(){ for (const f of Object.keys(fSubs)){ try{ fSubs[f](); }catch{} } fSubs={}; fShops={}; }

// my 友達コード: one per device, made the first time it is needed
async function ensureCode(){
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
  b.set(fs.doc(gpath('friends/'+v.mid)),{gid:v.gid, mid:v.mid, nick:String(v.nick||'友達').slice(0,20), at:Date.now()});
  try{ await b.commit(); }catch(e){ console.warn(e); return '追加できませんでした('+(e.code||'error')+')'; }
  friendMode=true; lastFriend=v.mid; mix=new Set([v.mid]); saveMix(); saveWho();
  return '';
}
async function removeFriend(f){
  const fr=friends[f]; if(!fr) return;
  if (!(await ask(`「${fr.nick}」を友達から外します。お互いのリストが見えなくなります。`,'外す',true))) return;
  mix.delete(f); saveMix();
  await fs.doc(gpath('friends/'+f)).delete().catch(onWriteError);
  await fs.doc(`groups/${fr.gid}/friends/${uid}`).delete().catch(()=>{});   // my entry in their list
}

// 設定 → 友達
function friendsSec(box){
  const mine=el('div','fr-code'); mine.appendChild(el('span','fr-cl','あなたの友達コード'));
  const cv=el('b','fr-cv','…'); mine.appendChild(cv);
  const cp=el('button','sbtn','コピー'); cp.type='button'; cp.disabled=true;
  cp.onclick=async()=>{ try{ await navigator.clipboard.writeText(fmtCode(myCode)); toast('コピーしました'); }catch{ toast(fmtCode(myCode)); } };
  mine.appendChild(cp); box.appendChild(mine);
  box.appendChild(el('p','hint','友達にこのコードを伝えて、下の「友達を追加」に入れてもらうと友達になれます。上の「友達と」から、その人とのリスト(2人の店を合わせたもの)が見られます。'));
  ensureCode().then(c=>{ cv.textContent=c?fmtCode(c):'作れませんでした'; cp.disabled=!c; });

  // the code goes in 7 boxes (□□□□-□□□), one letter each; small letters turn capital.
  // one real input lies over the boxes, so typing, deleting and pasting all just work
  const f=el('form','codeform'); f.noValidate=true;
  const cb=el('label','codebox'); const i=el('input','code-in'); i.autocomplete='off'; i.autocapitalize='characters'; i.spellcheck=false; i.maxLength=12;
  i.setAttribute('aria-label','友達のコード(7文字)'); i.inputMode='text';
  const cells=[]; for (let k=0;k<7;k++){ if(k===4) cb.appendChild(el('span','code-dash','-')); const c=el('span','code-c'); cells.push(c); cb.appendChild(c); }
  cb.appendChild(i);
  const b=el('button','btn btn-red','追加'); b.type='submit'; b.disabled=true;
  const draw=()=>{ const v=cleanCode(i.value).slice(0,7); if(i.value!==v) i.value=v;
    cells.forEach((c,k)=>{ c.textContent=v[k]||''; c.classList.toggle('cur', document.activeElement===i && k===Math.min(v.length,6)); });
    b.disabled=v.length!==7; };
  i.oninput=draw; i.onfocus=draw; i.onblur=draw;
  f.append(cb,b);
  f.onsubmit=async e=>{ e.preventDefault(); if(cleanCode(i.value).length!==7){ i.focus(); return; } b.disabled=true;
    const err=await addFriend(i.value); b.disabled=false;
    if (err){ toast(err); i.focus(); return; }
    i.value=''; draw(); toast('友達になりました。「友達と」から2人のリストが見られます'); };
  box.appendChild(el('h4','fr-h','友達を追加')); box.appendChild(f);

  const ids=Object.keys(friends).sort((a,b)=>friends[a].at-friends[b].at);
  if (ids.length){
    const ul=el('ul','mlist');
    for (const id of ids){ const fr=friends[id]; const li=el('li');
      li.appendChild(avatar({},fr.mid,'fr-av'));
      const d=el('div'); d.style.flex='1'; d.appendChild(el('div','mn',fr.nick)); d.appendChild(el('div','ms', fDenied[id]?'リストを見られません(外された可能性があります)':'友達')); li.appendChild(d);
      const x=el('button','sbtn','外す'); x.onclick=()=>removeFriend(id); li.appendChild(x);
      ul.appendChild(li); }
    box.appendChild(ul);
  }
}

// header: 自分のリスト | 友達と. picking who happens in the bar under the header (whoBar),
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
function renderFlaps(){
  const nav=$('flaps'); if(!nav) return; nav.textContent='';
  if (!(mode==='db' && !!me && !!members[me])) return;
  const seg=el('div','whoseg'); seg.setAttribute('role','group'); seg.setAttribute('aria-label','見るリスト');
  const mine=el('button',null,'自分のリスト'); mine.type='button'; mine.setAttribute('aria-pressed',String(!friendMode));
  mine.onclick=()=>{ if(friendMode) setWho(false); };
  const fr=el('button',null,'友達と'); fr.type='button'; fr.setAttribute('aria-pressed',String(friendMode));
  fr.onclick=()=>{ if(!friendMode) setWho(true); else { whoOpen=!whoOpen; render(); } };
  seg.append(mine,fr); nav.appendChild(seg);
}
// the bar under the header, on every tab: whose list this is, and (in friend mode) who to look at with
function whoBar(v){
  if (!(mode==='db' && !!me && !!members[me])) return;
  const bar=el('div','withcap'+(friendMode?'':' me'));
  if (!friendMode){
    bar.append(el('span','wc-t','👤 自分のリスト'), el('span','wc-s','あなたの行きたい店・行った店'));
    v.appendChild(bar); return;
  }
  const ids=Object.keys(friends).sort((a,b)=>friends[a].at-friends[b].at), wf=mixedFriends()[0];
  const head=el('div','wc-head');
  if (wf){
    const pick=el('button','wc-pick'); pick.type='button'; pick.setAttribute('aria-expanded',String(whoOpen));
    pick.append(avatar({},friends[wf].mid,'who-av'), el('span',null,friends[wf].nick), el('span','who-c','▾'));
    pick.onclick=()=>{ whoOpen=!whoOpen; render(); };
    head.append(el('span','wc-t','🤝'), pick, el('span','wc-t','とのリスト'));
    head.appendChild(el('span','wc-s', fDenied[wf] ? '(相手のリストを読めません)' : '2人の店を合わせて表示'));
  } else head.appendChild(el('span','wc-t', ids.length ? '🤝 誰とのリストを見る?' : '🤝 友達がまだいません'));
  bar.appendChild(head);
  if (whoOpen || !wf){
    const ch=el('div','wc-list');
    for (const f of ids){ const b=el('button','chip wc-f'); b.type='button'; b.setAttribute('aria-pressed',String(f===wf));
      b.append(avatar({},friends[f].mid,'who-av'), el('span',null,friends[f].nick));
      b.onclick=()=>{ whoOpen=false; setWho(true,f); }; ch.appendChild(b); }
    const add=el('button','chip wc-add','＋ 友達を追加'); add.type='button'; add.onclick=()=>{ whoOpen=false; openFriends(); }; ch.appendChild(add);
    bar.appendChild(ch);
  }
  v.appendChild(bar);
}
function openFriends(){ setSub='friends'; setTab('set'); }
