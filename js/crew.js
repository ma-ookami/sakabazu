/* ---------- members, invite, passcode, Google, and the screens before joining ---------- */
async function renderCrew(){
  if (isOpen('crewSheet') && !$('cBody').contains(document.activeElement)) buildCrew();
}
async function saveNick(nick){
  if(!me) return; members={...members,[me]:{...members[me],nick}}; render();
  if (mode==='db') enqueue('member:'+me,()=>db.doc('members/'+me).update({nick}));
}
async function leaveGroup(){
  if (mode!=='db' || !me) return;
  if (!(await ask(me===uid ? 'このグループから抜けます。これまでの評価やメモは残ります。' : 'この端末をグループから外します。あなたの記録はそのまま残ります。','抜ける',true))) return;
  closeCrew(); try{ await leaveCloud(); }catch(e){ onWriteError(e); }
}
async function openCrew(){ showSheet('crewSheet'); await buildCrew(); $('cBack').focus({preventScroll:true}); }
function closeCrew(){ hideSheet('crewSheet'); }
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
async function buildCrew(){
  const body=$('cBody'); body.textContent='';
  if (mode!=='db'){ body.appendChild(el('p','hint','いまは記録をこの端末だけに保存しています(firebase-config.js が未設定)。メンバー機能を使うには、README の手順で Firebase を設定してください。')); return; }
  const ids=Object.keys(members).sort((a,b)=>(members[a].joinedAt||0)-(members[b].joinedAt||0));
  const ps=await people(ids); const mine=members[me]||{};
  const nk=sec('あなたの名前'); nk.appendChild(nickForm('保存する',mine.nick,async n=>{ await saveNick(n); toast('保存しました'); })); body.appendChild(nk);

  const mh=sec('メンバー'); body.appendChild(mh);
  const ul=el('ul','mlist');
  for (const id of ids){ const m=members[id]; const li=el('li'); li.appendChild(avatar(ps,id)); const d=el('div'); d.style.flex='1';
    d.appendChild(el('div','mn', m.nick + (id===me?'(あなた)':'') + (group&&group.createdBy===id?' ・作った人':'')));
    const jd=new Date(m.joinedAt||0); d.appendChild(el('div','ms', [`${jd.getMonth()+1}/${jd.getDate()} に参加`, m.google?'Google連携':'', m.hasPin?'合言葉あり':''].filter(Boolean).join('　'))); li.appendChild(d);
    if (isOwner && id!==me){ const x=el('button','sbtn','外す'); x.onclick=async()=>{ if(await ask(`「${m.nick}」をメンバーから外しますか?記録は残ります。`,'外す',true)) busyBtn(x,()=>removeMember(id)); }; li.appendChild(x); }
    ul.appendChild(li); }
  body.appendChild(ul);


  const inv=sec('友達を招待する');
  inv.appendChild(el('p','hint','このリンクを送ると、開いた人がこのグループに参加できます。リンクを知っている人なら誰でも入れるので、仲間内だけで送ってください。'));
  const lb=el('div','linkbox'); const li=el('input','field'); li.readOnly=true; li.value=inviteUrl(); li.setAttribute('aria-label','招待リンク');
  const cb=el('button','btn btn-line','コピー'); cb.onclick=async()=>{ try{ await navigator.clipboard.writeText(inviteUrl()); toast('招待リンクをコピーしました'); }catch{ li.select(); toast('選択したリンクをコピーしてください'); } };
  lb.append(li,cb);
  if (navigator.share){ const sh=el('button','btn btn-red','送る'); sh.onclick=()=>navigator.share({text:'酒場図で、行きたい店と行った店を一緒に記録しよう',url:inviteUrl()}).catch(()=>{}); lb.appendChild(sh); }
  inv.appendChild(lb); body.appendChild(inv);

  const dev=sec('ほかの端末で使う');
  const ge=GOOGLE_ON ? googleEmail() : '';
  if (!GOOGLE_ON){
    // Google is off for now: passcode only
  } else if (ge){
    dev.appendChild(el('p','hint',`Google(${ge})でログインしています。ほかの端末でもGoogleでログインすれば、同じあなたとして使えます。`));
    const so=el('button','btn btn-line','この端末でログアウト'); so.onclick=async()=>{ if(await ask('この端末でGoogleからログアウトします。もう一度Googleでログインすれば戻れます。','ログアウト')) googleSignOut(); }; dev.appendChild(so);
  } else if (me===uid){
    dev.appendChild(el('p','hint','Googleと連携しておくと、スマホとPC、機種変更のあとでも、Googleでログインするだけで同じあなたとして使えます。'));
    const gb=el('button','btn btn-line','Googleと連携する'); gb.onclick=()=>busyBtn(gb,googleSignIn); dev.appendChild(gb);
  } else {
    dev.appendChild(el('p','hint','この端末は合言葉などで入っています。Googleとの連携は、最初に参加した端末で行えます。'));
  }
  const pn=el('div');
  pn.appendChild(el('h4','gstep', mine.hasPin ? '合言葉(設定済み)' : '合言葉'));
  pn.appendChild(el('p','hint', mine.hasPin ? 'ほかの端末で招待リンクを開き「前に参加した人として入る」から、あなたの名前と合言葉で入れます。' : '設定すると、ほかの端末で招待リンクを開き「前に参加した人として入る」から、あなたとして入れます。設定しないと、リンクを知っている人なら誰でもあなたとして入れてしまいます。'));
  pn.appendChild(pinForm(mine.hasPin?'変える':'設定する',async p=>{ await setPin(p); toast('合言葉を設定しました。忘れないようにしてください'); }));
  if (mine.hasPin){ const cl=el('button','textbtn','合言葉を消す'); cl.onclick=async()=>{ if(await ask('合言葉を消しますか?','消す')) busyBtn(cl,async()=>{ await clearPin(); toast('合言葉を消しました'); }); }; pn.appendChild(cl); }
  dev.appendChild(pn); body.appendChild(dev);

  const lv=el('button','danger', me===uid?'グループから抜ける':'この端末をグループから外す'); lv.onclick=leaveGroup; body.appendChild(lv);
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
