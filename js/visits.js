/* ---------- visits, price game, calendar ---------- */
const yen = n => '¥' + Number(n).toLocaleString('ja-JP');
function visitList(s){ return Object.entries(s.visits||{}).filter(([,v])=>v&&typeof v.date==='string').map(([vid,v])=>({vid,...v})).sort((a,b)=>b.date.localeCompare(a.date)); }
function ensureVisit(s,date){
  const ex=visitList(s).find(v=>v.date===date);
  if (ex) return {vid:ex.vid, patch:{visits:{[ex.vid]:{people:{[me]:true}}}}};
  const vid='v'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  return {vid, patch:{visits:{[vid]:{date,by:me,people:{[me]:true},createdAt:Date.now()}}}};
}
function guessPairs(s){ const out=[]; for(const v of visitList(s)) if(v.actual>0 && v.guesses) for(const u in v.guesses){ const g=Number(v.guesses[u]); if(g>0) out.push({u,g,a:v.actual}); } return out; }
const accOf=(g,a)=>Math.max(0,Math.round(100-Math.abs(g-a)/a*100));
function senseScore(s){ const p=guessPairs(s); return p.length ? Math.round(p.reduce((x,y)=>x+accOf(y.g,y.a),0)/p.length) : null; }
function visitSec(s){ const box=sec('来店記録と料金予想','食べ終わったら、会計の前に予想'); box.id='dVisitSec'; const d=el('div'); d.id='dVisits'; box.appendChild(d); return box; }
const busy = d => d && d.contains(document.activeElement) && document.activeElement.tagName==='INPUT';
async function fillGuess(s){
  const d=$('dGuess'); if(!d || busy(d)) return;
  const g=s.guess||{}; const others=Object.keys(g).filter(u=>u!==me && Number(g[u])>0);
  const ps=await people(others); if(openId!==s.id || busy(d)) return; d.textContent='';
  const sc=senseScore(s);
  if (sc!=null){ const p=el('div','sense'); p.appendChild(el('b',null,`${sc}%`)); p.appendChild(el('span',null,`このお店との感覚一致度(予想${guessPairs(s).length}件から)`)); d.appendChild(p); }
  if (me && !readOnly){
    const mine=Number(g[me])>0;
    const f=el('form','guessrow'); f.noValidate=true;
    const i=el('input','field'); i.type='number'; i.inputMode='numeric'; i.min='0'; i.step='100'; i.placeholder='例: 4000'; i.setAttribute('aria-label','予想金額(1人あたり)'); if(mine) i.value=g[me];
    const b=el('button','btn btn-ink',mine?'変更':'予想する'); b.type='submit';
    f.append(i,el('span','unit','円'),b);
    f.onsubmit=e=>{ e.preventDefault(); const n=Math.round(Number(i.value)); if(!(n>0)){ toast('金額を入れてください'); return; } i.blur(); patchShop(s.id,{guess:{[me]:n}}); toast(`${yen(n)}で予想しました`); };
    d.appendChild(f);
  }
  d.appendChild(el('p','hint', others.length ? `${others.map(u=>nameOf(ps,u)).join('、')}が予想済み。金額は答え合わせまで秘密です。` : 'それぞれ予想しておき、行ったあと「来店記録」に実際の金額を入れると答え合わせできます。'));
}
function recordActual(id,vid,n){
  const s=shops.find(x=>x.id===id); if(!s) return; const v=(s.visits||{})[vid]||{};
  patchShop(id,{visits:{[vid]:{actual:n}}}); buzz();
  const g=Object.values(v.guesses||{}).map(Number).filter(x=>x>0);
  if (!g.length){ toast('実際の金額を記録しました'); return; }
  const ag=g.reduce((a,b)=>a+b,0)/g.length, df=Math.round(ag-n);
  toast(Math.abs(df)/n<0.05 ? '答え合わせ: 感覚どおりでした' : df>0 ? `答え合わせ: 感覚より${yen(df)}安い!` : `答え合わせ: 感覚より${yen(-df)}高かった`);
}
function dealScore(s){ const xs=[]; for(const v of visitList(s)){ if(!(v.actual>0)||!v.guesses) continue; const g=Object.values(v.guesses).map(Number).filter(x=>x>0); if(!g.length) continue; const ag=g.reduce((a,b)=>a+b,0)/g.length; xs.push((ag-v.actual)/ag*100); } return xs.length ? Math.round(xs.reduce((a,b)=>a+b,0)/xs.length) : null; }
const dealLabel = d => d==null ? '' : d>=5 ? '感覚より安い' : d<=-5 ? '感覚より高い' : '感覚どおり';
function addVisit(id,date){
  const s=shops.find(x=>x.id===id); if(!s||!me||!date) return; const ev=ensureVisit(s,date); const wb=wentBy(s)[me];
  const nd=(typeof wb==='string' && wb>date)?wb:date;
  patchShop(id,Object.assign({went:wentPatch(s,me,nd), wants:{[me]:false}}, ev.patch)); toast('来店を記録しました');
}
async function fillVisits(s){
  const d=$('dVisits'); if(!d || busy(d)) return;
  const vs=visitList(s).filter(v=>groupMode() || mode!=='db' || (v.people&&v.people[me])); const ids=[...new Set(vs.flatMap(v=>[...Object.keys(v.people||{}),...Object.keys(v.guesses||{})]))];
  const ps=await people(ids); if(openId!==s.id || busy(d)) return; d.textContent='';
  { const sc=senseScore(s); if(sc!=null){ const p=el('div','sense'); p.appendChild(el('b',null,`${sc}%`)); p.appendChild(el('span',null,`感覚一致度。平均すると${dealLabel(dealScore(s))}お店です`)); d.appendChild(p); } }
  if (!vs.length) d.appendChild(el('p','hint','まだ来店記録がありません。'));
  const thisYear=today().slice(0,4);
  for (const v of vs){
    const it=el('div','vitem'); const h=el('div','vh');
    h.appendChild(el('span','vd',(v.date.slice(0,4)!==thisYear?v.date.slice(0,4)+'年 ':'')+fmtDate(v.date)));
    if (v.actual>0) h.appendChild(el('span','yen',`1人 ${yen(v.actual)}`));
    if (v.by===me && !readOnly){ const x=el('button','ic','✕'); x.setAttribute('aria-label','この来店記録を削除'); x.onclick=async()=>{ if(await ask('この来店記録を削除しますか?','削除する',true)) patchShop(s.id,{visits:{[v.vid]:null}}); }; h.appendChild(x); }
    it.appendChild(h);
    const ppl=Object.keys(v.people||{}).filter(u=>v.people[u]);
    const pr=el('div','vp'); pr.textContent=ppl.length?ppl.map(u=>nameOf(ps,u)).join('、'):''; it.appendChild(pr);
    if (me && !readOnly && !(v.people&&v.people[me])){ const j=el('button','sbtn','私もいた'); j.onclick=()=>{ const cur=shops.find(x=>x.id===s.id); if(!cur) return; const wb=wentBy(cur)[me]; const nd=(typeof wb==='string'&&wb>v.date)?wb:v.date; patchShop(s.id,{visits:{[v.vid]:{people:{[me]:true}}}, went:wentPatch(cur,me,nd), wants:{[me]:false}}); }; it.appendChild(j); }
    if (v.actual>0){
      const gs=Object.keys(v.guesses||{}).map(u=>({u,g:Number(v.guesses[u])})).filter(x=>x.g>0).sort((a,b)=>Math.abs(a.g-v.actual)-Math.abs(b.g-v.actual));
      if (gs.length){ const r=el('div','res');
        { const ag=gs.reduce((a,x)=>a+x.g,0)/gs.length, df=Math.round(ag-v.actual), even=Math.abs(df)/v.actual<0.05;
          it.appendChild(el('div','verdict'+(even?' even':df>0?' cheap':' pricey'), even?'感覚どおり':df>0?`感覚より ${yen(df)} 安い!`:`感覚より ${yen(-df)} 高かった`)); }
        gs.forEach((x,i)=>{ const a=accOf(x.g,v.actual); const row=el('div','rrow'+(i===0?' best':''));
          const nm=el('span','rn',nameOf(ps,x.u)); if(i===0 && a>=95) nm.appendChild(el('span','pita','ピタリ賞')); row.appendChild(nm);
          row.appendChild(el('span','rg',yen(x.g)));
          const df=x.g-v.actual; row.appendChild(el('span','rd', df===0?'ぴったり':(df>0?'+':'−')+Math.abs(df).toLocaleString('ja-JP')+'円'));
          row.appendChild(el('span','ra',a+'%')); r.appendChild(row); });
        it.appendChild(r); }
    } else {
      const gv=v.guesses||{}; const gid=Object.keys(gv).filter(u=>Number(gv[u])>0); const gb=el('div','gbox');
      if (me && !readOnly){
        const mine=Number(gv[me])>0;
        gb.appendChild(el('p','gstep','① 会計を見る前に、1人いくらだったか予想'));
        const gf=el('form','guessrow'); gf.noValidate=true;
        const gi=el('input','field'); gi.type='number'; gi.inputMode='numeric'; gi.min='0'; gi.step='100'; gi.placeholder='例: 3500'; gi.setAttribute('aria-label','予想金額(1人あたり)'); if(mine) gi.value=gv[me];
        const gbt=el('button','btn btn-ink',mine?'変更':'予想'); gbt.type='submit'; gf.append(gi,el('span','unit','円'),gbt);
        gf.onsubmit=e=>{ e.preventDefault(); const n=Math.round(Number(gi.value)); if(!(n>0)){ toast('金額を入れてください'); return; } gi.blur(); patchShop(s.id,{visits:{[v.vid]:{guesses:{[me]:n}}}}); toast(`${yen(n)}と予想しました`); };
        gb.appendChild(gf);
      }
      const og=gid.filter(u=>u!==me);
      gb.appendChild(el('p','hint', og.length ? `${og.map(u=>nameOf(ps,u)).join('、')}が予想済み。金額は答え合わせまで秘密です。` : (gid.length ? '全員の予想がそろったら、会計を確かめましょう。' : 'まだ誰も予想していません。')));
      if (me && !readOnly){
      gb.appendChild(el('p','gstep','② 会計を見たら、実際の金額を記録'));
      const f=el('form','guessrow'); f.noValidate=true;
      const i=el('input','field'); i.type='number'; i.inputMode='numeric'; i.min='0'; i.step='100'; i.placeholder='実際の1人あたり'; i.setAttribute('aria-label','実際の金額(1人あたり)');
      const b=el('button','btn btn-red','記録'); b.type='submit'; f.append(i,el('span','unit','円'),b);
      f.onsubmit=e=>{ e.preventDefault(); const n=Math.round(Number(i.value)); if(!(n>0)){ toast('金額を入れてください'); return; } i.blur(); recordActual(s.id,v.vid,n); };
      gb.appendChild(f); }
      it.appendChild(gb);
    }
    d.appendChild(it);
  }
  if (me && !readOnly){
    const f=el('form','guessrow addvisit'); f.noValidate=true;
    const i=el('input','dateinput'); i.type='date'; i.value=today(); i.setAttribute('aria-label','来店した日');
    const b=el('button','btn btn-line','＋ 来店を追加'); b.type='submit'; f.append(i,b);
    f.onsubmit=e=>{ e.preventDefault(); if(!i.value) return; i.blur(); addVisit(s.id,i.value); };
    d.appendChild(f);
  }
}
function calEntries(){
  const P=SP(); const out=[];
  for (const s of shops){
    const seen=new Set();
    const wbAll=wentBy(s);
    for (const v of visitList(s)){ const ppl=Object.keys(v.people||{}).filter(u=>v.people[u] && wbAll[u] && (!P||P.has(u))); if(!ppl.length) continue; out.push({date:v.date,s,ppl,actual:v.actual,vid:v.vid}); seen.add(v.date); }
    const wb=wentBy(s); const byD={};
    for (const u of wentIds(s)){ const d=wb[u]; if(typeof d==='string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !seen.has(d)) (byD[d]=byD[d]||[]).push(u); }
    for (const d in byD) out.push({date:d,s,ppl:byD[d],actual:null});
  }
  return out;
}
const cal={y:null,m:null,sel:null};
function renderCal(v){
  const now=new Date(); if(cal.y==null){ cal.y=now.getFullYear(); cal.m=now.getMonth(); }
  const by={}; for(const e of calEntries()) (by[e.date]=by[e.date]||[]).push(e);
  const ym=`${cal.y}-${String(cal.m+1).padStart(2,'0')}`; const td=today();
  const monthDays=Object.keys(by).filter(d=>d.startsWith(ym)).sort();
  const head=el('div','calhead');
  const pv=el('button','calnav','‹'); pv.setAttribute('aria-label','前の月'); pv.onclick=()=>{ cal.m--; if(cal.m<0){ cal.m=11; cal.y--; } cal.sel=null; render(); };
  const nx=el('button','calnav','›'); nx.setAttribute('aria-label','次の月'); nx.onclick=()=>{ cal.m++; if(cal.m>11){ cal.m=0; cal.y++; } cal.sel=null; render(); };
  head.append(pv, el('h2',null,`${cal.y}年 ${cal.m+1}月`), nx); v.appendChild(head);
  const nShops=new Set(monthDays.flatMap(d=>by[d].map(e=>e.s.id))).size;
  const spent=monthDays.flatMap(d=>by[d]).filter(e=>e.actual>0).reduce((a,e)=>a+e.actual,0);
  v.appendChild(el('p','calstat', monthDays.length ? `${monthDays.length}日飲んで、${nShops}軒に行きました${spent?`(記録した金額の合計 1人 ${yen(spent)})`:''}` : 'この月の記録はまだありません'));
  const g=el('div','calgrid');
  ['日','月','火','水','木','金','土'].forEach((w,i)=>g.appendChild(el('div','calwd'+(i===0?' sun':i===6?' sat':''),w)));
  const first=new Date(cal.y,cal.m,1).getDay(), days=new Date(cal.y,cal.m+1,0).getDate();
  for (let i=0;i<first;i++) g.appendChild(el('div','day out'));
  if (!cal.sel) cal.sel = td.startsWith(ym) ? td : (monthDays[monthDays.length-1]||null);
  for (let d=1; d<=days; d++){
    const ds=`${ym}-${String(d).padStart(2,'0')}`; const es=by[ds]||[]; const wd=(first+d-1)%7;
    const b=el('button','day'+(es.length?' has':'')+(ds===td?' today':'')+(wd===0?' sun':wd===6?' sat':''));
    b.setAttribute('aria-pressed',String(cal.sel===ds)); b.setAttribute('aria-label',`${cal.m+1}月${d}日${es.length?`、${es.length}軒`:''}`);
    b.appendChild(el('span','dn',String(d)));
    if (es.length){ const dots=el('span','dots'); es.slice(0,3).forEach(()=>dots.appendChild(el('i','dot'))); b.appendChild(dots); b.appendChild(el('span','dname',es[0].s.name||'')); }
    b.onclick=()=>{ cal.sel=ds; render(); };
    g.appendChild(b);
  }
  v.appendChild(g);
  if (cal.sel && cal.sel.startsWith(ym)){
    const es=by[cal.sel]||[]; const box=el('section','daylist'); box.appendChild(el('h3','dl-h',fmtDate(cal.sel)));
    if (!es.length) box.appendChild(el('p','hint','この日の記録はありません。'));
    else { const ul=el('ul','plist'); const slots=[];
      for (const e of es){ const li=el('li'); const info=el('button','pinfo'); info.onclick=()=>openDetail(e.s.id);
        info.appendChild(el('span','pn',e.s.name||'(名前なし)'));
        const meta=[e.s.area, e.actual>0?`1人 ${yen(e.actual)}`:''].filter(Boolean).join('　'); if(meta) info.appendChild(el('span','pm',meta));
        const f=el('span','faces'); const st=el('span','stack'); f.appendChild(st); info.appendChild(f); slots.push([st,e.ppl.slice(0,6)]);
        li.appendChild(info);
        if (!readOnly && me && e.ppl.includes(me) && !isFriendShop(e.s)){ const x=el('button','sbtn cal-del','消す'); x.setAttribute('aria-label',`${e.s.name}の${fmtDate(cal.sel)}の記録を消す`); x.onclick=()=>unvisit(e.s.id,cal.sel,e.vid); li.appendChild(x); }
        ul.appendChild(li); }
      box.appendChild(ul); fillFaces(slots); }
    v.appendChild(box);
  }
}
