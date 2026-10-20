/* ---------- members, invite, passcode, Google, and the screens before joining ---------- */
async function saveNick(nick){
  if(!me) return; members={...members,[me]:{...members[me],nick}}; render(); syncCodeNick(nick);
  if (mode==='db') enqueue('member:'+me,()=>db.doc('members/'+me).update({nick}));
}
const busyBtn = async (b,fn) => { b.disabled=true; try{ await fn(); }catch(e){ console.warn(e); onWriteError(e); } finally{ if(b.isConnected) b.disabled=false; } };
function nickForm(label,value,onSave){
  const f=el('form','quick'); f.style.margin='0'; f.noValidate=true;
  const i=el('input','field'); i.maxLength=20; i.value=value||''; i.placeholder='ニックネーム'; i.setAttribute('aria-label','ニックネーム'); i.autocomplete='off';
  const b=el('button','btn btn-ink',label); b.type='submit'; f.append(i,b);
  f.onsubmit=e=>{ e.preventDefault(); const n=i.value.trim(); if(!n){ i.focus(); toast('ニックネームを入れてください'); return; } busyBtn(b,()=>onSave(n)); };
  return f;
}
let setSub='me';   // 設定 tab: あなた / 飲み友 / だるま
async function buildCrew(body){
  body.textContent='';
  if (mode!=='db'){ body.appendChild(el('p','hint','いまは記録をこの端末だけに保存しています(firebase-config.js が未設定)。メンバー機能を使うには、README の手順で Firebase を設定してください。')); return; }
  const mine=members[me]||{};
  segBar(body,[['me','あなた'],['friends','飲み友'],['daruma','だるま'],['rank','ランキング']],setSub,k=>{ setSub=k; });
  if (setSub==='rank'){ const sub=el('div'); body.appendChild(sub); renderRank(sub); return; }
  if (setSub==='friends') friendsSec(body);
  else if (setSub==='daruma'){ const dm=sec('だるま','ホームにいるだるまの見た目。この端末に保存されます'); dm.id='secDaruma'; darumaMaker(dm); body.appendChild(dm); }
  else { const nk=sec('あなた'); profileSec(nk,mine); body.appendChild(nk); backupSec(body); }
}

/* the screen before you are in a group: start your own, join by invite, or come back as yourself */
function renderGate(v){
  const g=gate||{kind:'error',msg:''}; const box=el('section','gate');
  if (g.kind==='error'){
    box.appendChild(el('h2','gate-t','つながりませんでした')); box.appendChild(el('p','hint',g.msg));
    const r=el('button','btn btn-ink','読み込み直す'); r.onclick=()=>location.reload(); box.appendChild(r);
    v.appendChild(box); return;
  }
  const card=el('div','gate-card');
  if (g.kind==='welcome'){
    card.appendChild(el('h2','gate-t','酒場図をはじめる'));
    card.appendChild(el('p','hint','行きたい店と行った店を記録して、「今日どこ行く?」をすぐ決められるようにします。あとから飲み友とつながると、2人の店から一緒に選べます。'));
    card.appendChild(nickForm('はじめる','',n=>createGroup(n)));
  }
  box.appendChild(card);
  if (GOOGLE_ON){
  const gg=el('div','gate-google'); gg.appendChild(el('p','hint','Googleと連携していた人は、Googleでログインすると前の記録に戻れます。'));
  const gb=el('button','btn btn-line','Googleでログイン'); gb.onclick=()=>busyBtn(gb,googleSignIn); gg.appendChild(gb);
  box.appendChild(gg);
  }
  v.appendChild(box);
}

// 設定 → あなた: the name, and an icon made of a color, a shape and a letter/emoji (like ますせん). friends see it too
function profileSec(box,mine){
  const head=el('div','prof'); const pv=avatar({},me,'prof-av'); const nm=el('b','prof-n',mine.nick||''); head.append(pv,nm); box.appendChild(head);
  box.appendChild(el('span','dm-pl','名前'));
  box.appendChild(nickForm('保存する',mine.nick,async n=>{ await saveNick(n); toast('保存しました'); }));
  const cur=()=>({...(members[me]&&members[me].ic||{})});
  const set=async patch=>{ const ic={c:avDefault(me), s:'circle', ...cur(), ...patch, e:''}; await saveIcon(ic); };
  const row=(label,node)=>{ const r=el('div','dm-prow'); r.append(el('span','dm-pl',label),node); box.appendChild(r); };
  const ic=cur(), c0=Number.isInteger(ic.c)?ic.c:avDefault(me);
  const sw=el('div','chips dm-colors'); sw.setAttribute('role','radiogroup'); sw.setAttribute('aria-label','アイコンの色');
  for (const i of AV_ORDER){ const b=el('button','dm-sw'); b.type='button'; b.style.background=avBg(i); b.setAttribute('role','radio'); b.setAttribute('aria-checked',String(i===c0)); b.setAttribute('aria-label','色 '+(i+1)); b.onclick=()=>set({c:i}); sw.appendChild(b); }
  row('アイコンの色',sw);
  const sh=el('div','av-shapes'); sh.setAttribute('role','radiogroup'); sh.setAttribute('aria-label','アイコンの形');
  for (const [k,l] of Object.entries(AV_SHAPES)){ const b=el('button','shape-opt'); b.type='button'; b.setAttribute('role','radio'); b.setAttribute('aria-checked',String((ic.s||'circle')===k));
    const a=el('span','ph av'+(k!=='circle'?' shape-'+k:''),[...(mine.nick||'?')][0]); a.style.setProperty('--avbg',avBg(c0)); a.style.setProperty('--avfg',avFg(c0));
    b.append(a,el('span',null,l)); b.onclick=()=>set({s:k}); sh.appendChild(b); }
  row('アイコンの形',sh);
}
async function saveIcon(ic){
  if (!me) return; members={...members,[me]:{...members[me],ic}}; render();
  if (mode==='db') enqueue('member:'+me,()=>db.doc('members/'+me).update({ic}));
}

// ---------- バックアップ (the list lives in this browser; a file keeps it safe when changing phones) ----------
function backupSec(root){
  const box=sec('バックアップ','端末を変えるときや、ブラウザのデータを消す前に'); root.appendChild(box);
  box.appendChild(el('p','hint','あなたのリストは、この端末(ブラウザ)に結びついています。ファイルに保存しておけば、新しい端末で「戻す」と同じ店・星・メモ・来店記録・ランキング・名前とアイコンを取り込めます。飲み友は、相手にもう一度申請が届き、承認されるとつながり直します。'));
  const row=el('div','bk-row');
  const sv=el('button','btn btn-ink','バックアップを保存'); sv.type='button'; sv.onclick=saveBackup;
  const ld=el('label','btn btn-line bk-load','バックアップから戻す'); const fi=el('input'); fi.type='file'; fi.accept='application/json,.json'; fi.hidden=true;
  fi.onchange=()=>{ const f=fi.files&&fi.files[0]; fi.value=''; if(f) loadBackup(f); }; ld.appendChild(fi);
  row.append(sv,ld); box.appendChild(row);
}
// ランキングは店のIDが端末ごとに変わるので、店の名前+場所(shopKey)で保存する
const rankKeys = () => { const o={}; for (const [k] of RANK_CATS) o[k]=rankList(me,k).map(id=>{ const s=myShops.find(x=>x.id===id); return s?shopKey(s):null; }).filter(Boolean); return o; };
function saveBackup(){
  const data={app:'sakabazu', v:1, at:new Date().toISOString(), me, nick:(members[me]&&members[me].nick)||'', ic:(members[me]&&members[me].ic)||null, dm:dmCfg,
    ranks:rankKeys(), friends:Object.values(friends).map(f=>({mid:f.mid, nick:f.nick, code:f.code||''})), nights:nightsAll(), shops:myShops.map(s=>{ const c=JSON.parse(JSON.stringify(s)); if (c.hp&&c.hp.id){ delete c.hp.budget; delete c.hp.photo; if (s._ovGenre) delete c.hp.genre; } if (s._ovHours) delete c.hours; delete c._ovGenre; delete c._ovHours; return c; })};
  const blob=new Blob([JSON.stringify(data,null,1)],{type:'application/json'});
  const a=el('a'); a.href=URL.createObjectURL(blob); a.download=`sakabazu-${today()}.json`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  toast(`${data.shops.length}軒をバックアップしました`);
}
// the old me in the file becomes the me of this device
function remapMe(v,old){
  if (Array.isArray(v)) return v.map(x=>remapMe(x,old));
  if (!v || typeof v!=='object') return v;
  const o={}; for (const k in v) o[k===old?me:k]=remapMe(v[k],old); return o;
}
async function loadBackup(file){
  let d=null; try{ d=JSON.parse(await file.text()); }catch{ toast('ファイルを読めませんでした'); return; }
  if (!d || d.app!=='sakabazu' || !Array.isArray(d.shops)){ toast('酒場図のバックアップではないようです'); return; }
  const have=new Set(myShops.map(shopKey));
  const add=d.shops.filter(s=>s && typeof s.name==='string' && s.name.trim() && !have.has(shopKey(s)));
  const rkNew={}; if (d.ranks && typeof d.ranks==='object'){ const cur=rankKeys(); for (const [k] of RANK_CATS){ const want=Array.isArray(d.ranks[k])?d.ranks[k].filter(x=>typeof x==='string'):[]; const add2=want.filter(x=>!cur[k].includes(x)).slice(0,Math.max(0,RANK_MAX-cur[k].length)); if (add2.length) rkNew[k]=add2; } }
  const rkN=Object.values(rkNew).reduce((a,x)=>a+x.length,0);
  // 名前とアイコン(この端末で別のものを使っていたら、バックアップのものに置き換える)
  const nk=typeof d.nick==='string' ? d.nick.trim().slice(0,20) : '';
  let ic=null; if (d.ic && typeof d.ic==='object'){ ic={}; if (Number.isInteger(d.ic.c) && d.ic.c>=0 && d.ic.c<=15) ic.c=d.ic.c; if (['circle','squircle','hexagon','flower','badge'].includes(d.ic.s)) ic.s=d.ic.s; if (typeof d.ic.e==='string') ic.e=d.ic.e.slice(0,8); if (!Object.keys(ic).length) ic=null; }
  const curM=members[me]||{};
  const nkChg=!!nk && nk!==curM.nick, icChg=!!ic && JSON.stringify(ic)!==JSON.stringify(curM.ic||null);
  const fr0=Array.isArray(d.friends) ? d.friends.filter(x=>x && typeof x.mid==='string' && !friends[x.mid] && !frSent[x.mid]) : [];
  if (!add.length && !fr0.length && !rkN && !nkChg && !icChg && !(d.nights && Object.keys(d.nights).length)){ toast('新しく戻す店はありません(全部リストにあります)'); return; }
  if (!(await ask(`バックアップから${add.length}軒を戻します。すでにリストにある店はそのままです。`+(rkN?`ランキング${rkN}件も戻します。`:'')+((nkChg||icChg)?`${nkChg&&icChg?'名前とアイコン':nkChg?'名前':'アイコン'}もバックアップのものにします。`:'')+(fr0.length&&mode==='db' ? `飲み友${fr0.length}人にも、もう一度申請を送ります(相手が承認すると、また飲み友になります)。` : ''),'戻す'))) return;
  let n=0; const idOf={}; for (const s of myShops) idOf[shopKey(s)]=s.id;
  for (const s0 of add){
    const s=remapMe(s0, typeof d.me==='string' ? d.me : '');
    const keep={}; for (const k of ['name','area','wants','went','r','tags','loc','planDate','hours','links','visits','hp']) if (s[k]!=null) keep[k]=s[k];
    keep.name=String(keep.name).slice(0,60); if (keep.area!=null) keep.area=String(keep.area).slice(0,40);
    if (keep.loc && !okLoc(keep.loc)) delete keep.loc; if (Array.isArray(keep.links)) keep.links=keep.links.filter(u=>typeof u==='string').slice(0,5); else delete keep.links;
    const base={...keep, createdBy:me, createdAt:Number.isInteger(s.createdAt)?s.createdAt:Date.now(), updatedAt:Date.now()};
    try{
      if (mode==='db'){ const ref=db.collection('shops').doc(); idOf[shopKey(base)]=ref.id; const {pub,priv}=splitPriv(base); await fs.doc(gpath('shops/'+ref.id)).set(pub); if (priv) await writeShop(ref.id,priv); }
      else { const nid='l'+Date.now().toString(36)+n; idOf[shopKey(base)]=nid; myShops.push({id:nid, ...base}); saveLocal(); }
      n++;
    }catch(e){ console.warn(e); }
  }
  if (d.dm) saveDm(d.dm);
  if (d.nights && typeof d.nights==='object'){ const have=nightsAll(); for (const [day,k] of Object.entries(d.nights)) if (/^\d{4}-\d{2}-\d{2}$/.test(day) && NIGHTS[k] && !have[day]) setNight(k,day); }
  for (const [k,keys] of Object.entries(rkNew)){ const ids=keys.map(x=>idOf[x]).filter(Boolean); if (ids.length) saveRank([...(rankings[me]&&rankings[me][k]||[]), ...ids.filter(i=>!((rankings[me]&&rankings[me][k])||[]).includes(i))], k); }
  if (nkChg) await saveNick(nk);
  if (icChg) await saveIcon(ic);
  let sentN=0; const noCode=[];
  if (mode==='db') for (const x of fr0){ if (!okCode(x.code)){ noCode.push(x.nick||'飲み友'); continue; } const err=await addFriend(x.code); if (!err) sentN++; else noCode.push(x.nick||'飲み友'); }
  afterChange(); toast(`${n}軒を戻しました`+(sentN?`。飲み友${sentN}人に申請を送りました`:''));
  if (noCode.length) setTimeout(()=>toast(`${noCode.slice(0,3).join('・')}${noCode.length>3?'など':''}は、コードをもう一度入れてください`),2600);
}
