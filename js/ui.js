/* ---------- motion and touch: sheets, confirm dialog, swipe, view transitions, compact header ---------- */
const reduceMotion = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const canVT = () => typeof document.startViewTransition==='function' && !reduceMotion();

/* bottom sheets: .sheet is the backdrop, .sheet-in the panel. Closing plays an animation before hidden=true. */
const SHEETS = { pickSheet:()=>closePick(), detail:()=>closeDetail(), formSheet:()=>closeForm(), searchSheet:()=>closeSearch() };
const sheetTimers = {};
const panelOf = id => $(id).querySelector('.sheet-in');
const isOpen = id => !$(id).hidden && !$(id).classList.contains('closing');
function syncScrollLock(){ document.body.style.overflow = Object.keys(SHEETS).some(isOpen) ? 'hidden' : ''; }
function showSheet(id,opts){
  const s=$(id), p=panelOf(id); clearTimeout(sheetTimers[id]);
  const wasOpen=isOpen(id);
  s.classList.remove('closing'); p.style.transform=''; p.style.removeProperty('--drag');
  if (!wasOpen){ s.classList.toggle('vt',!!(opts&&opts.vt)); p.scrollTop=0; }
  s.hidden=false; syncScrollLock();
}
function hideSheet(id){
  const s=$(id), p=panelOf(id); if (!isOpen(id)) return;
  const done=()=>{ s.hidden=true; s.classList.remove('closing','vt'); p.style.transform=''; p.style.removeProperty('--drag'); };
  if (reduceMotion()){ done(); syncScrollLock(); return; }
  s.classList.add('closing'); syncScrollLock(); sheetTimers[id]=setTimeout(done,260);
}
function bindSheet(id){
  const s=$(id), p=panelOf(id), h=s.querySelector('.sheet-head');
  s.addEventListener('click',e=>{ if(e.target===s) SHEETS[id](); });   // tap on the dimmed area
  let y0=null, t0=0, dy=0, pid=null;
  h.addEventListener('pointerdown',e=>{
    if (e.button>0 || e.target.closest('button,a,input')) return;
    y0=e.clientY; t0=performance.now(); dy=0; pid=e.pointerId; h.setPointerCapture(pid); p.classList.remove('snap'); p.classList.add('dragging');
  });
  h.addEventListener('pointermove',e=>{ if(y0==null || e.pointerId!==pid) return; dy=Math.max(0,e.clientY-y0); p.style.transform=dy?`translateY(${dy}px)`:''; });
  const end=()=>{
    if (y0==null) return; const v=dy/Math.max(1,performance.now()-t0); y0=null; p.classList.remove('dragging');
    if (dy>120 || (dy>30 && v>0.6)){ p.style.setProperty('--drag',dy+'px'); SHEETS[id](); }
    else if (dy){ p.classList.add('snap'); p.style.transform=''; setTimeout(()=>p.classList.remove('snap'),320); }
  };
  h.addEventListener('pointerup',end); h.addEventListener('pointercancel',end);
}
Object.keys(SHEETS).forEach(bindSheet);

/* confirm dialog that matches the app; resolves true/false */
function ask(msg,ok,danger){
  return new Promise(res=>{
    const d=el('dialog','ask'); const box=el('div','ask-in'); box.appendChild(el('p',null,msg));
    const a=el('div','actions'); const no=el('button','btn btn-line','やめる'); const yes=el('button','btn '+(danger?'btn-danger':'btn-ink'),ok||'OK');
    a.append(no,yes); box.appendChild(a); d.appendChild(box);
    if (typeof d.showModal!=='function'){ res(confirm(msg)); return; }
    document.body.appendChild(d);
    const done=v=>{ if(!d.isConnected) return; d.close(); d.remove(); res(v); };
    no.onclick=()=>done(false); yes.onclick=()=>{ buzz(); done(true); };
    d.addEventListener('cancel',e=>{ e.preventDefault(); done(false); });
    d.addEventListener('click',e=>{ if(e.target===d) done(false); });
    d.showModal(); no.focus();
  });
}
const asking = () => !!document.querySelector('dialog.ask[open]');

/* swipe a card sideways: right / left = {label, run}. Returns the wrapper to insert instead of the card. */
let swiping=false;
function swipeable(card,right,left){
  const w=el('div','swipe'); const act=el('div','swipe-act'); act.setAttribute('aria-hidden','true');
  if (right) act.appendChild(el('span','sa-r',right.label)); if (left) act.appendChild(el('span','sa-l',left.label));
  w.append(act,card);
  const TH=90; let x0=0, y0=0, dx=0, pid=null, tracking=false, moving=false, armed=false, endedAt=0;
  card.addEventListener('pointerdown',e=>{ if((e.pointerType==='mouse'&&e.button>0) || e.target.closest('.live')) return; x0=e.clientX; y0=e.clientY; dx=0; pid=e.pointerId; tracking=true; moving=false; });
  card.addEventListener('pointermove',e=>{
    if (!tracking || e.pointerId!==pid) return; const mx=e.clientX-x0, my=e.clientY-y0;
    if (!moving){
      if (Math.abs(my)>10 && Math.abs(my)>Math.abs(mx)){ tracking=false; return; }
      if (Math.abs(mx)<12) return;
      moving=true; swiping=true; try{ card.setPointerCapture(pid); }catch{} w.classList.add('drag'); card.classList.remove('settle');
    }
    dx = (mx>0&&!right)||(mx<0&&!left) ? mx/6 : mx;
    card.style.transform=`translateX(${dx}px)`;
    w.classList.toggle('r',dx>0&&!!right); w.classList.toggle('l',dx<0&&!!left);
    const a=Math.abs(dx)>TH && !!(dx>0?right:left);
    if (a!==armed){ armed=a; w.classList.toggle('armed',a); if(a) buzz(); }
  });
  const end=()=>{
    if (!tracking) return; tracking=false; if (!moving) return; moving=false; endedAt=Date.now();
    w.classList.remove('drag','armed'); card.classList.add('settle');
    const fire = armed ? (dx>0?right:left) : null; armed=false;
    if (fire){ card.style.transform=`translateX(${dx>0?110:-110}%)`; setTimeout(()=>{ swiping=false; fire.run(); },200); }
    else { card.style.transform=''; setTimeout(()=>{ w.classList.remove('r','l'); swiping=false; },320); }
  };
  card.addEventListener('pointerup',end); card.addEventListener('pointercancel',end);
  card.addEventListener('click',e=>{ if(Date.now()-endedAt<400){ e.stopPropagation(); e.preventDefault(); } },true); // no tap right after a drag
  return w;
}

/* view transitions (progressive: plain update where unsupported or with reduced motion) */
function withTransition(update){ if(!canVT()){ update(); return; } document.startViewTransition(update); }
function openDetailFrom(card,id){
  const nm=card && card.querySelector('.name');
  if (!canVT() || !nm || isOpen('detail')){ openDetail(id); return; }
  const title=$('dName'), panel=panelOf('detail');
  nm.style.viewTransitionName='shopname';
  const t=document.startViewTransition(()=>{ nm.style.viewTransitionName=''; title.style.viewTransitionName='shopname'; panel.style.viewTransitionName='sheet'; openDetail(id,{vt:true}); });
  t.finished.finally(()=>{ title.style.viewTransitionName=''; panel.style.viewTransitionName=''; });
}

/* compact bar once the noren scrolls away */
if ('IntersectionObserver' in window){
  new IntersectionObserver(([e])=>document.body.classList.toggle('scrolled',!e.isIntersecting),{rootMargin:'-56px 0px 0px 0px'}).observe(document.querySelector('.noren'));
}
$('mbTop').onclick=()=>window.scrollTo({top:0,behavior:reduceMotion()?'auto':'smooth'});
