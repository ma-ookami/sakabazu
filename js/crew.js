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
function pinForm(label,onSave){
  const f=el('form','quick'); f.style.margin='0'; f.noValidate=true;
  const i=el('input','field'); i.inputMode='numeric'; i.maxLength=4; i.placeholder='4桁の数字'; i.setAttribute('aria-label','合言葉(4桁の数字)'); i.autocomplete='off';
  i.oninput=()=>{ i.value=i.value.replace(/\D/g,'').slice(0,4); };
  const b=el('button','btn btn-ink',label); b.type='submit'; f.append(i,b);
  f.onsubmit=e=>{ e.preventDefault(); if(!/^\d{4}$/.test(i.value)){ i.focus(); toast('4桁の数字を入れてください'); return; } busyBtn(b,()=>onSave(i.value)); };
  return f;
}
async function buildCrew(body){
  body.textContent='';
  if (mode!=='db'){ body.appendChild(el('p','hint','いまは記録をこの端末だけに保存しています(firebase-config.js が未設定)。メンバー機能を使うには、README の手順で Firebase を設定してください。')); return; }
  const mine=members[me]||{};
  const nk=sec('あなた'); profileSec(nk,mine); body.appendChild(nk);
  const fr=sec('友達','コードで友達になると、その人とのリストが見られます'); fr.id='secFriends'; friendsSec(fr); body.appendChild(fr);
  const dm=sec('だるま','ホームにいるだるまの見た目。この端末に保存されます'); dm.id='secDaruma'; darumaMaker(dm); body.appendChild(dm);
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
    card.appendChild(el('p','hint','行きたい店と行った店を記録して、「今日どこ行く?」をすぐ決められるようにします。あとから友達を招待すると、グループのリストとして合わさります。'));
    card.appendChild(nickForm('はじめる','',n=>createGroup(n)));
  } else {
    card.appendChild(el('h2','gate-t','飲み仲間のグループに招待されています'));
    const ids=Object.keys(g.members||{}).sort((a,b)=>(g.members[a].joinedAt||0)-(g.members[b].joinedAt||0));
    if (ids.length) card.appendChild(el('p','hint','メンバー: '+ids.map(id=>g.members[id].nick).join('、')));
    card.appendChild(el('p','hint','名前はあとから「設定」で変えられます。'));
    const jb=el('button','btn btn-red gate-join','参加する'); jb.onclick=()=>busyBtn(jb,()=>joinGroup(guestName())); card.appendChild(jb);
    if (ids.length){
      const back=el('details','gate-back'); back.appendChild(el('summary',null,'前に参加した人として入る'));
      back.appendChild(el('p','hint','別の端末で参加していた人は、自分の名前を選んでください。合言葉を設定している人は合言葉が必要です。'));
      const list=el('div','gate-members');
      for (const id of ids){ const m=g.members[id]; const b=el('button','chip',m.nick+(m.hasPin?' 🔒':''));
        b.onclick=async()=>{
          list.querySelectorAll('.chip').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
          const slot=back.querySelector('.gate-pin'); if(slot) slot.remove();
          if (!m.hasPin){ if(await ask(`「${m.nick}」として入りますか?`,'入る')) busyBtn(b,()=>claimMember(id,null)); return; }
          const w=el('div','gate-pin'); w.appendChild(el('p','hint',`「${m.nick}」の合言葉`));
          w.appendChild(pinForm('入る',async p=>{ if(!(await claimMember(id,p))) toast('合言葉が違います'); }));
          back.appendChild(w); const pi=w.querySelector('input'); if(pi) pi.focus();
        };
        list.appendChild(b); }
      back.appendChild(list); card.appendChild(back);
    }
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
