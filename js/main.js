/* ---------- form, misc ---------- */
let formDays=[];
function renderDays(){ const w=$('fDays'); w.textContent=''; [...'日月火水木金土'].forEach((ch,i)=>{ const b=el('button','wd',ch); b.type='button'; b.setAttribute('aria-pressed',String(formDays.includes(i))); b.setAttribute('aria-label',ch+'曜日'); b.onclick=()=>{ formDays=formDays.includes(i)?formDays.filter(x=>x!==i):[...formDays,i]; renderDays(); }; w.appendChild(b); }); }
function addLinkRow(val){ const r=el('div','lrow'); const i=el('input','field'); i.type='url'; i.inputMode='url'; i.autocomplete='off'; i.placeholder='https://（食べログ、Instagram、公式サイトなど）'; i.value=val||''; i.setAttribute('aria-label','お店のリンク');
  const x=el('button','ic','✕'); x.type='button'; x.setAttribute('aria-label','このリンクを消す'); x.onclick=()=>r.remove(); r.append(i,x); $('fLinks').appendChild(r); return i; }
$('fAddLink').onclick=()=>{ if($('fLinks').children.length>=5){ toast('リンクは5つまでです'); return; } addLinkRow('').focus(); };
function openForm(id){ editingId=id; const s=shops.find(x=>x.id===id); if(!s) return; $('fName').value=s.name||''; $('fArea').value=s.area||'';
  const h=s.hours||{}; $('fOpen').value=h.open||''; $('fClose').value=h.close||''; $('fHNote').value=h.note||''; formDays=Array.isArray(h.closed)?h.closed.filter(n=>Number.isInteger(n)&&n>=0&&n<7):[]; renderDays();
  $('fLinks').textContent=''; const ls=Array.isArray(s.links)?s.links:[]; if(ls.length) ls.forEach(u=>addLinkRow(u)); else addLinkRow('');
  showSheet('formSheet'); $('fName').focus({preventScroll:true}); }
function normUrl(u){ u=(u||'').trim(); if(!u) return ''; if(!/^https?:\/\//i.test(u)){ if(/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(u)) u='https://'+u; else return null; } try{ const x=new URL(u); return (x.protocol==='https:'||x.protocol==='http:') ? x.href : null; }catch{ return null; } }
function closeForm(){ hideSheet('formSheet'); }
$('form').onsubmit=e=>{ e.preventDefault(); const name=$('fName').value.trim(), area=$('fArea').value.trim(); if(!name){ $('fName').focus(); toast('店名を入れてください'); return; }
  const links=[]; for (const i of $('fLinks').querySelectorAll('input')){ if(!i.value.trim()) continue; const u=normUrl(i.value); if(!u){ i.focus(); toast('リンクはhttps://から始まるURLを入れてください'); return; } if(!links.includes(u)) links.push(u); }
  const open=$('fOpen').value, close=$('fClose').value;
  if ((open&&!close)||(!open&&close)){ toast('開店と閉店の両方を入れてください'); return; }
  const hours={open,close,closed:formDays.slice().sort(),note:$('fHNote').value.trim()};
  patchShop(editingId,{name,area,hours,links:links.slice(0,5)}); closeForm(); toast('お店の情報を保存しました'); };
$('fBack').onclick=closeForm; $('fCancel').onclick=closeForm;
$('crewBtn').onclick=()=>openCrew(); $('cBack').onclick=closeCrew; $('sBack').onclick=closeSearch;
$('dBack').onclick=closeDetail; $('dEdit').onclick=()=>openForm(openId);
$('dDel').onclick=async()=>{ const s=shops.find(x=>x.id===openId); if(!s) return; if(!(await ask(`「${s.name}」とみんなの記録を削除します。元に戻せません。`,'削除する',true))) return; const id=openId; closeDetail(); await deleteShop(id); toast('削除しました'); };
document.addEventListener('keydown',e=>{ if(e.key==='Escape' && !asking()){ if(isOpen('searchSheet')) closeSearch(); else if(isOpen('crewSheet')) closeCrew(); else if(isOpen('formSheet')) closeForm(); else if(openId) closeDetail(); else if(isOpen('pickSheet')) closePick(); } });
window.addEventListener('pagehide',flushMemos);
window.addEventListener('resize',()=>{ if(tab==='map') scheduleMap(); });

let toastT;
function toast(msg,act,fn){ $('toastMsg').textContent=msg; const a=$('toastAct'); if(act){ a.hidden=false; a.textContent=act; a.onclick=()=>{ $('toast').hidden=true; fn(); }; } else a.hidden=true;
  $('toast').hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>$('toast').hidden=true, act?5000:3200); }
function showNotice(){
  const n=$('notice'); n.textContent=''; let msg='';
  if (mode==='local') msg='いまは記録をこの端末だけに保存しています(Firebase が未設定)。';
  if (msg) n.appendChild(el('p','notice',msg));
}

/* ---------- boot ---------- */
function boot(){
  render();
  if (cloudOn()){ try{ cloudBoot(); return; }catch(e){ console.warn(e); } }
  mode='local'; me='local'; const l=loadLocal(); shops=l.shops; rankings=l.rankings; todayDocs=l.today; showNotice(); afterChange();
}
boot();
