/* ---------- cloud: Firebase sign-in, group, joining, passcode, Google, data adapter ---------- */
// Every device signs in anonymously. A member id ("me") is the uid of the device that joined.
// Another device becomes the same member with links/<uid> (needs the passcode if one is set),
// or by signing in with Google when that member linked Google to their account.
let shopsLoaded=false, todayLoaded=false;
let fs=null, auth=null, uid=null, gid=null, group=null, cloudSubs=[], gate=null;
const useEmu = () => /[?&]emu\b/.test(location.search) && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const cloudOn = () => !!(window.firebase && (useEmu() || (window.FIREBASE_CONFIG && Object.keys(window.FIREBASE_CONFIG).length)));
const gpath = p => `groups/${gid}/${p}`;
const FV = () => firebase.firestore.FieldValue;

// nulls in a patch mean "remove this field" (as with the old store); merge keeps everything else
function forMerge(o){ const out={}; for (const k in o){ const v=o[k]; out[k] = v===null ? FV().delete() : (v && typeof v==='object' && !Array.isArray(v)) ? forMerge(v) : v; } return out; }
// the same calls the app made before (db.collection / db.doc), scoped to the current group
const groupDb = {
  collection: n => fs.collection(gpath(n)),
  doc: p => { const r=fs.doc(gpath(p)); return { set:d=>r.set(d), update:d=>r.set(forMerge(d),{merge:true}), delete:()=>r.delete() }; },
};

function cloudBoot(){
  const emu = useEmu();
  firebase.initializeApp(emu ? { apiKey:'demo-key', projectId:'demo-sakabazu', authDomain:'localhost' } : window.FIREBASE_CONFIG);
  const siteKey=window.APPCHECK_SITE_KEY;
  if (siteKey && firebase.appCheck && !emu){
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) self.FIREBASE_APPCHECK_DEBUG_TOKEN=true;
    firebase.appCheck().activate(new firebase.appCheck.ReCaptchaEnterpriseProvider(siteKey), true);
  }
  auth=firebase.auth(); fs=firebase.firestore();
  if (emu){
    auth.useEmulator('http://127.0.0.1:9099',{disableWarnings:true}); fs.useEmulator('127.0.0.1',8085);
    // stands in for the Google popup in tests: window.emuSub picks the account
    window.emuGoogle = link => {
      const cred=firebase.auth.GoogleAuthProvider.credential(JSON.stringify({sub:window.emuSub||'g1', email:(window.emuSub||'g1')+'@example.com', email_verified:true, name:'テスト', picture:'https://example.com/p.png'}));
      return link ? auth.currentUser.linkWithCredential(cred).catch(e=>{ e.credential=cred; throw e; }) : auth.signInWithCredential(cred);
    };
  }
  auth.getRedirectResult().then(r=>{ if(r && r.user) afterGoogle(r.user); }).catch(e=>{
    if (e && e.code==='auth/credential-already-in-use' && e.credential) return auth.signInWithCredential(e.credential);
    console.warn(e); toast('Googleでログインできませんでした。もう一度どうぞ');
  });
  let lastUid=null;
  auth.onAuthStateChanged(u=>{
    if (!u){ auth.signInAnonymously().catch(e=>{ console.warn(e); showGate({kind:'error', msg:'サーバーにつながりませんでした。通信状態か、README の手順(匿名ログイン)を確認してください。'}); }); return; }
    if (u.uid===lastUid) return; lastUid=u.uid;   // linking Google keeps the uid; switching accounts starts over
    uid=u.uid; startGroup();
  });
}

async function startGroup(){
  stopSubs(); members={}; myShops=[]; shops=[]; friends={}; myCode=''; rankings={}; todayDocs={}; me=null; mode='loading'; render();
  const hash=/[#&]g=([A-Za-z0-9]{10,40})/.exec(location.hash), invited=hash&&hash[1];
  let mine=null; try{ const u=await fs.doc('users/'+uid).get(); mine=u.exists?u.data():null; }catch(e){ console.warn(e); }
  let saved=null; try{ saved=localStorage.getItem('nm-gid'); }catch{}
  const target = invited || (mine&&mine.gid) || saved || null;
  if (!target){ autoStart(); return; }
  let g=null; try{ g=await fs.doc('groups/'+target).get(); }catch(e){ console.warn(e); }
  if (!g || !g.exists){
    try{ localStorage.removeItem('nm-gid'); }catch{}
    if (invited) showGate({kind:'error', msg:'招待リンクのグループが見つかりませんでした。リンクが正しいか、送ってくれた人に確認してください。'}); else autoStart(); return;
  }
  gid=target; group=g.data();
  const mids=await memberList();
  let mid = mids[uid] ? uid : null;
  if (!mid){ try{ const l=await fs.doc(gpath('links/'+uid)).get(); if(l.exists && mids[l.data().mid]) mid=l.data().mid; }catch(e){ console.warn(e); } }
  // not my list: lists can't be joined any more (飲み友 connect with a code instead)
  if (!mid){ try{ localStorage.removeItem('nm-gid'); }catch{}
    if (invited) showGate({kind:'error', msg:'この招待リンクは使えなくなりました。飲み友とは、右上のアイコン →「飲み友」のコードでつながれます。'}); else autoStart(); return; }
  enterGroup(mid, mine);
}
async function memberList(){
  const o={}; try{ const s=await fs.collection(gpath('members')).get(); s.forEach(d=>{ const v=d.data()||{}; if(typeof v.nick==='string') o[d.id]=v; }); }catch(e){ console.warn(e); }
  return o;
}
function showGate(g){ stopSubs(); gate=g; mode='gate'; me=null; render(); }

function enterGroup(mid, mine){
  gate=null; me=mid; db=groupDb; mode='db'; readOnly=false; isOwner = group.createdBy===mid;
  try{ localStorage.setItem('nm-gid',gid); }catch{}
  if (/[#&]g=/.test(location.hash)) history.replaceState(null,'',location.pathname+location.search);
  if (!mine || mine.gid!==gid) fs.doc('users/'+uid).set({gid, ...(mine&&Array.isArray(mine.owned)?{owned:mine.owned}:{})},{merge:true}).catch(console.warn);
  showNotice(); render();
  const lost=e=>{ console.warn(e); if(e && e.code==='permission-denied'){ toast('このグループに入れなくなりました'); startGroup(); } else toast('共有データとの接続が切れました。ページを開き直してください。'); };
  cloudSubs.push(fs.doc('groups/'+gid).onSnapshot(d=>{ if(d.exists){ group=d.data(); isOwner=group.createdBy===me; } },()=>{}));
  // my shops = the shared part (shops/, 飲み友 can read) + my private part (priv/: memos, ◎○, visits)
  let rawShops=null, privDocs={}, privOk=false; shopsLoaded=false; friendsLoaded=false; todayLoaded=false; homeSince=0;
  const mergeShops=()=>{ if(!rawShops) return; shopsLoaded=true; myShops=rawShops.map(s=>{ const p=privDocs[s.id]; return p ? deepMerge(JSON.parse(JSON.stringify(s)),p) : s; }); afterChange(); if (privOk) movePrivOut(rawShops); };
  cloudSubs.push(db.collection('shops').orderBy('createdAt','desc').limit(1000).onSnapshot(snap=>{
    rawShops=snap.docs.map(d=>({id:d.id,...JSON.parse(JSON.stringify(d.data()||{}))})); mergeShops();
  },lost));
  cloudSubs.push(db.collection('priv').limit(1000).onSnapshot(snap=>{
    const o={}; for (const d of snap.docs) o[d.id]=JSON.parse(JSON.stringify(d.data()||{})); privDocs=o; privOk=true; mergeShops();
  },e=>{ console.warn('priv',e&&e.code); }));
  cloudSubs.push(db.collection('rankings').limit(200).onSnapshot(snap=>{
    const o={}; for(const d of snap.docs){ const v=d.data()||{}; o[d.id]={ids:Array.isArray(v.ids)?[...v.ids]:[]}; } rankings=o; render();
  },()=>{}));
  watchFriends(); watchRequests();
  cloudSubs.push(db.collection('members').limit(200).onSnapshot(snap=>{
    const o={}; for(const d of snap.docs){ const v=d.data()||{}; if(typeof v.nick==='string' && v.nick.trim()) o[d.id]={nick:v.nick.trim().slice(0,20),joinedAt:v.joinedAt||0,hasPin:!!v.hasPin,google:!!v.google,photo:v.photo||'',ic:(v.ic&&typeof v.ic==='object')?v.ic:null,dm:(v.dm&&typeof v.dm==='object')?v.dm:null}; }
    members=o; membersLoaded=true;
    if (o[me] && !o[me].dm) saveDm(dmCfg);   // put my だるま on my member doc once, so 飲み友 can see it
    if (!o[me]){ toast('メンバーから外れました'); startGroup(); return; }
    render(); if(openId) patchDetail();
  },()=>{}));
  cloudSubs.push(db.collection('today').limit(500).onSnapshot(snap=>{
    const o={}; const t=nightKey(), y=lastNightKey();
    for (const d of snap.docs){ const v=JSON.parse(JSON.stringify(d.data()||{})); if(typeof v.shopId!=='string') continue; o[d.id]=v;
      if (v.date && v.date<t && !(v.go && v.date===y) && v.by===me && !cleaned.has(d.id)){ cleaned.add(d.id); enqueue('today:'+d.id,()=>db.doc('today/'+d.id).delete()); } }
    todayDocs=o; todayLoaded=true; afterChange();
  },()=>{}));
}
function stopSubs(){ cloudSubs.forEach(f=>{ try{ f(); }catch{} }); cloudSubs=[]; stopFriendSubs(); }

const newId = (n=20) => { const a='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; const b=crypto.getRandomValues(new Uint8Array(n)); return [...b].map(x=>a[x%a.length]).join(''); };
// a placeholder name until the person changes it in 設定
const guestName = () => 'ゲスト' + (100 + (crypto.getRandomValues(new Uint16Array(1))[0] % 900));
// no group yet: make one right away and go straight to the app
async function autoStart(){
  try{ await createGroup(guestName()); toast('名前とアイコンは右上の丸いアイコンから変えられます'); }
  catch(e){ console.warn(e); showGate({kind:'error', msg:'はじめられませんでした。通信状態を確認して、読み込み直してください。'}); }
}
function memberData(nick){
  const u=auth.currentUser, gp=u && u.providerData.find(p=>p.providerId==='google.com');
  const d={nick:nick.slice(0,20), joinedAt:Date.now(), hasPin:false, google:!!gp};
  if (gp && gp.photoURL) d.photo=gp.photoURL.slice(0,500);
  return d;
}
async function createGroup(nick){
  let mine=null; try{ const u=await fs.doc('users/'+uid).get(); mine=u.exists?u.data():null; }catch{}
  const owned=((mine&&mine.owned)||[]), id=newId();
  if (owned.length>=3) throw new Error('リストは1人3つまでしか作れません');
  const b=fs.batch();
  b.set(fs.doc('groups/'+id),{createdBy:uid, createdAt:Date.now()});
  b.set(fs.doc(`groups/${id}/members/${uid}`),memberData(nick));
  b.set(fs.doc('users/'+uid),{gid:id, owned:[...owned,id]},{merge:true});
  await b.commit();
  gid=id; group={createdBy:uid}; enterGroup(uid,{gid:id,owned:[...owned,id]});
}

// Google: the member's own device links Google to its anonymous account (uid stays the same).
// Elsewhere, signing in with that Google account gives the same uid, so it is the same member.
// Google sign-in is switched off for now (buttons hidden); flip to true to bring it back
const GOOGLE_ON = false;
async function googleSignIn(){
  if (!GOOGLE_ON) return;
  const u=auth.currentUser, p=new firebase.auth.GoogleAuthProvider(); p.setCustomParameters({prompt:'select_account'});
  const canLink = !!(u && u.isAnonymous && me && me===uid);   // only the member's own device links; others switch accounts
  try{
    try{
      if (window.emuGoogle) await window.emuGoogle(canLink);
      else if (canLink) await u.linkWithPopup(p);
      else await auth.signInWithPopup(p);
    }catch(e){
      const cred=e && (e.credential || (firebase.auth.GoogleAuthProvider.credentialFromError && firebase.auth.GoogleAuthProvider.credentialFromError(e)));
      if (!e || e.code!=='auth/credential-already-in-use' || !cred) throw e;
      if (!(await ask('このGoogleアカウントは、別の記録とつながっています。そちらに切り替えますか?(この端末のいまの参加は残ります)','切り替える'))) return;
      await auth.signInWithCredential(cred); return;
    }
    await afterGoogle(auth.currentUser);
  }catch(e){
    const c=e && e.code;
    if (c==='auth/popup-closed-by-user' || c==='auth/cancelled-popup-request') return;
    if (c==='auth/popup-blocked' || c==='auth/operation-not-supported-in-this-environment') return canLink ? u.linkWithRedirect(p) : auth.signInWithRedirect(p);
    console.warn(e); toast('Googleでログインできませんでした');
  }
}
async function afterGoogle(u){
  if (!u || !me || me!==u.uid || !members[me]) return;
  const gp=u.providerData.find(p=>p.providerId==='google.com'); if(!gp) return;
  const patch={google:true}; if(gp.photoURL) patch.photo=gp.photoURL.slice(0,500);
  await groupDb.doc('members/'+me).update(patch).catch(console.warn);
  toast('Googleと連携しました。ほかの端末でもGoogleでログインすれば、同じあなたとして使えます');
}
