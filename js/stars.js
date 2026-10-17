/* ---------- 星の評価: 0.0〜5.0, 0.1 step, one per person (r.<mid>.star). the went list shows the stars ---------- */
const starOf = (s,u) => { const v=s && s.r && s.r[u] && s.r[u].star; return typeof v==='number' && v>=0 && v<=5 ? v : null; };
// the average over the people on screen (me, or me + the friend I'm looking with)
function starAvg(s){
  const P=SP(); const vs=Object.keys((s&&s.r)||{}).filter(u=>!P||P.has(u)).map(u=>starOf(s,u)).filter(v=>v!=null);
  return vs.length ? {v:Math.round(vs.reduce((a,b)=>a+b,0)/vs.length*10)/10, n:vs.length} : null;
}
// five stars filled to v (a star shape is the mask, so part-filled stars look right)
function starsView(v,cls){
  const w=el('span','stars'+(cls?' '+cls:'')); w.style.setProperty('--v',String(v||0)); w.setAttribute('role','img'); w.setAttribute('aria-label',`星${(v||0).toFixed(1)}`); return w;
}
// the card line: ★★★★☆ 3.7 (2人)
function starLine(s){
  const a=starAvg(s); if(!a) return null;
  const d=el('div','starline'); d.append(starsView(a.v), el('b','st-v',a.v.toFixed(1)));
  if (a.n>1) d.appendChild(el('small',null,`${a.n}人`));
  return d;
}
// 詳細: drag or tap across the stars (0.1 step), fine-tune with − / ＋
function starInput(s){
  const box=el('div','starin');
  const mine=()=>starOf(shops.find(x=>x.id===s.id),me);
  let v=mine();
  const view=starsView(v||0,'big'); view.setAttribute('role','slider'); view.tabIndex=0;
  view.setAttribute('aria-valuemin','0'); view.setAttribute('aria-valuemax','5'); view.setAttribute('aria-label','あなたの星');
  const num=el('b','st-num'); const clr=el('button','textbtn','消す'); clr.type='button';
  const show=x=>{ view.style.setProperty('--v',String(x||0)); view.setAttribute('aria-valuenow',String(x||0)); num.textContent = x==null ? '—' : x.toFixed(1); clr.hidden = x==null; };
  const save=x=>{ v=x==null?null:Math.max(0,Math.min(5,Math.round(x*10)/10)); show(v); buzz(); patchShop(s.id,{r:{[me]:{star:v}}}); };
  const at=e=>{ const r=view.getBoundingClientRect(); return Math.max(0,Math.min(5,Math.round((e.clientX-r.left)/r.width*50)/10)); };
  if (!readOnly && me){
    let drag=false;
    view.addEventListener('pointerdown',e=>{ drag=true; try{ view.setPointerCapture(e.pointerId); }catch{} show(at(e)); });
    view.addEventListener('pointermove',e=>{ if(drag) show(at(e)); });
    view.addEventListener('pointerup',e=>{ if(!drag) return; drag=false; save(at(e)); });
    view.addEventListener('pointercancel',()=>{ drag=false; show(v); });
    view.addEventListener('keydown',e=>{ const d={ArrowRight:.1,ArrowUp:.1,ArrowLeft:-.1,ArrowDown:-.1}[e.key]; if(d){ e.preventDefault(); save((v||0)+d); } });
  }
  const step=(t,d)=>{ const b=el('button','st-step',t); b.type='button'; b.setAttribute('aria-label',d>0?'0.1上げる':'0.1下げる'); b.onclick=()=>save((v||0)+d); b.disabled=readOnly||!me; return b; };
  clr.onclick=()=>save(null);
  const row=el('div','st-row'); row.append(view,num);
  const adj=el('div','st-adj'); adj.append(step('−',-.1),step('＋',.1),clr);
  box.append(el('div','st-lab','あなたの星'),row,adj);
  const a=starAvg(s); if (a && groupMode()) box.appendChild(el('p','hint',`2人の平均 ★${a.v.toFixed(1)}(${a.n}人)`));
  show(v); return box;
}
