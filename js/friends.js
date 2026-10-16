/* ---------- friends: add by 友達コード, and mix their lists into yours ----------
   myShops: my own shops (the only ones I write). shops: what the screens show = mine + the friends I mix in.
   A friend-only shop is read-only (id "f~<fid>~<shopId>"); acting on it first copies it into my list. */
let myShops=[], friends={}, fShops={}, fDenied={}, fSubs={}, myCode='';
let mix = new Set((()=>{ try{ return JSON.parse(localStorage.getItem('nm-mix')||'[]'); }catch{ return []; } })());
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
    friends=o; syncFriendSubs(); rebuildShops(); render();
  },()=>{}));
}
function syncFriendSubs(){
  for (const f of Object.keys(fSubs)) if (!mix.has(f) || !friends[f]){ try{ fSubs[f](); }catch{} delete fSubs[f]; delete fShops[f]; }
  for (const f of mixedFriends()) if (!fSubs[f]){
    const fr=friends[f];
    fSubs[f]=fs.collection(`groups/${fr.gid}/shops`).limit(1000).onSnapshot(snap=>{
      fShops[f]=snap.docs.map(d=>({id:d.id,...JSON.parse(JSON.stringify(d.data()||{}))})); delete fDenied[f]; afterChange();
    },e=>{ console.warn(e); fDenied[f]=true; fShops[f]=[]; afterChange(); });
    // their current name (the friend doc keeps the name from when we became friends)
    fs.doc(`groups/${fr.gid}/members/${fr.mid}`).get().then(d=>{ const n=d.exists&&d.data().nick; if(n && friends[f] && friends[f].nick!==n){ friends[f].nick=n; render(); } }).catch(()=>{});
  }
}
function stopFriendSubs(){ for (const f of Object.keys(fSubs)){ try{ fSubs[f](); }catch{} } fSubs={}; fShops={}; }
function toggleMix(f){ if(mix.has(f)) mix.delete(f); else mix.add(f); saveMix(); syncFriendSubs(); rebuildShops(); buzz(); render(); }

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
  mix.add(v.mid); saveMix();
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
  box.appendChild(el('p','hint','友達にこのコードを伝えて、アプリの「友達を追加」に入れてもらうと、お互いのリストを混ぜて見られます。'));
  ensureCode().then(c=>{ cv.textContent=c?fmtCode(c):'作れませんでした'; cp.disabled=!c; });

  const f=el('form','quick'); f.noValidate=true; f.style.margin='12px 0 6px';
  const i=el('input','field'); i.placeholder='友達のコード(例: K7Q2-M9P)'; i.autocomplete='off'; i.maxLength=12; i.setAttribute('aria-label','友達のコード'); i.autocapitalize='characters';
  const b=el('button','btn btn-red','追加'); b.type='submit'; f.append(i,b);
  f.onsubmit=async e=>{ e.preventDefault(); if(!i.value.trim()){ i.focus(); return; } b.disabled=true;
    const err=await addFriend(i.value); b.disabled=false;
    if (err){ toast(err); i.focus(); return; }
    i.value=''; toast('友達になりました。リストに混ぜて表示します'); };
  box.appendChild(el('h4','fr-h','友達を追加')); box.appendChild(f);

  const ids=Object.keys(friends).sort((a,b)=>friends[a].at-friends[b].at);
  if (ids.length){
    const ul=el('ul','mlist');
    for (const id of ids){ const fr=friends[id]; const li=el('li');
      const av=el('span','ph fr-av',[...fr.nick][0]||'?'); li.appendChild(av);
      const d=el('div'); d.style.flex='1'; d.appendChild(el('div','mn',fr.nick)); d.appendChild(el('div','ms', fDenied[id]?'リストを見られません(外された可能性があります)':'友達')); li.appendChild(d);
      const x=el('button','sbtn','外す'); x.onclick=()=>removeFriend(id); li.appendChild(x);
      ul.appendChild(li); }
    box.appendChild(ul);
  }
}

// the noren's flaps: 自分 (always in; tap = show only mine) / a flap per friend (tap = mix in, the flap lifts) / ＋ (add a friend)
function renderFlaps(){
  const nav=$('flaps'); if(!nav) return; nav.textContent='';
  const live = mode==='db' && !!me && !!members[me];
  const flap=(cls,label,sub)=>{ const b=el('button','flap '+cls); b.type='button'; b.appendChild(document.createTextNode(label)); if(sub) b.appendChild(el('span','fi',sub)); nav.appendChild(b); return b; };
  let n=0;
  if (live){
    const m=flap('me','自分', mixedFriends().length?'':'表示中'); m.setAttribute('aria-pressed','true'); n++;
    m.setAttribute('aria-label', mixedFriends().length ? '自分のリストだけにする' : '自分のリスト');
    m.onclick=()=>{ if(!mix.size) return; mix.clear(); saveMix(); syncFriendSubs(); rebuildShops(); buzz(); render(); };
    for (const f of Object.keys(friends).sort((a,b)=>friends[a].at-friends[b].at)){
      const on=mix.has(f), b=flap('',friends[f].nick, on?'':'混ぜる'); n++;
      b.setAttribute('aria-pressed',String(on)); b.setAttribute('aria-label',`${friends[f].nick}のリストを${on?'外す':'混ぜる'}`);
      b.onclick=()=>toggleMix(f);
    }
    if (!readOnly){ const a=flap('add','＋'); a.setAttribute('aria-label','友達を追加'); a.onclick=openFriends; n++; }
  }
  for (; n<4; n++) nav.appendChild(el('span','flap deco'));   // keep the cloth looking whole
}
function openFriends(){ setTab('set'); setTimeout(()=>{ const s=$('secFriends'); if(s) s.scrollIntoView({block:'start',behavior:'smooth'}); },80); }

// the lantern: a small menu (届いた提案 will live here too)
function toggleLanMenu(open){
  const m=$('lanMenu'), b=$('lanternBtn'); if(!m||!b) return;
  open = open ?? m.hidden;
  if (open){
    m.textContent='';
    const item=(ic,t,fn)=>{ const x=el('button'); x.setAttribute('role','menuitem'); x.append(el('span',null,ic), el('span',null,t)); x.onclick=()=>{ toggleLanMenu(false); fn(); }; m.appendChild(x); return x; };
    item('👥','友達を追加',openFriends);
    item('🎎','だるまを変える',()=>{ setTab('set'); setTimeout(()=>{ const s=$('secDaruma'); if(s) s.scrollIntoView({block:'start',behavior:'smooth'}); },80); });
    m.appendChild(el('div','lm-sep'));
    item('⚙️','設定',()=>setTab('set'));
  }
  m.hidden=!open; b.setAttribute('aria-expanded',String(open));
}
