/* ---------- shop info: hours, links, card look ---------- */
const PAL=['#B7282E','#1F4E79','#3A7D44','#B07A12','#5B3F8C','#B4566E','#2E7D7A','#8A5A2B'];
function crestColor(s){ let h=7; for(const ch of (s.name||'')) h=(h*31+ch.codePointAt(0))>>>0; return PAL[h%PAL.length]; }
function crestOf(s){ const n=(s.name||'').replace(/^(居酒屋|大衆酒場|酒場|立ち飲み|立飲み|立呑み?|炉端焼?き?|炉端|炭火焼?き?|炭火)\s*/,'').trim(); return [...(n||s.name||'？')][0]; }
function cardShell(s){
  const c=el('article','card shop2'); c.style.setProperty('--c',crestColor(s));
  const hit=el('button','card-hit'); hit.setAttribute('aria-label',(s.name||'')+'の詳細'); hit.onclick=()=>openDetailFrom(c,s.id); c.appendChild(hit);
  const top=el('div','sc-top'); const cr=el('span','crest',crestOf(s)); cr.setAttribute('aria-hidden','true'); top.appendChild(cr);
  const main=el('div','sc-main'); main.appendChild(el('h3','name',s.name||'(名前なし)')); if(s.area) main.appendChild(el('div','area',s.area)); top.appendChild(main);
  c.appendChild(top);
  return {c,top,chips:el('div','sc-chips')};
}
function pill(chips,cls,t){ chips.appendChild(el('span','pill '+cls,t)); }
const toMin=t=>{ const m=/^(\d{1,2}):(\d{2})$/.exec(t||''); return m ? (+m[1])*60+(+m[2]) : null; };
function hoursStatus(s,now){
  const h=s.hours; if(!h) return null; now=now||new Date();
  const o=toMin(h.open), c=toMin(h.close), closed=Array.isArray(h.closed)?h.closed:[];
  const wd=now.getDay(), mins=now.getHours()*60+now.getMinutes(), yd=(wd+6)%7;
  if (o==null || c==null) return closed.includes(wd) ? {k:'off',t:'今日は定休日'} : null;
  const over=c<=o;
  if (over && !closed.includes(yd) && mins<c) return {k:'open',t:`営業中 〜${h.close}`};
  if (closed.includes(wd)) return {k:'off',t:'今日は定休日'};
  if (mins<o){ const d=o-mins; return {k:'soon',t: d<=60 ? `あと${d}分で開店` : `${h.open}から`}; }
  if (over || mins<c) return {k:'open',t:`営業中 〜${h.close}`};
  return {k:'done',t:'本日の営業は終了'};
}
function hoursPill(chips,s){ const h=hoursStatus(s); if(h) pill(chips,'h-'+h.k,h.t); }
function tagPills(chips,s,n){ tagsOf(s).slice(0,n).forEach(t=>pill(chips,'tag',t.l)); }
function hoursText(s){ const h=s.hours||{}; const p=[]; if(h.open&&h.close) p.push(`${h.open}〜${h.close}`); if(Array.isArray(h.closed)&&h.closed.length) p.push('定休日 '+h.closed.slice().sort().map(i=>'日月火水木金土'[i]).join('、')); return p.join('　'); }
function linkLabel(u){ try{ const h=new URL(u).hostname.replace(/^www\./,''); const map=[[/tabelog\./,'食べログ'],[/hotpepper\./,'ホットペッパー'],[/instagram\./,'Instagram'],[/(^|\.)x\.com$|twitter\./,'X'],[/google\.[^/]+$|goo\.gl|maps\.app/,'Googleマップ'],[/retty\./,'Retty'],[/gnavi\./,'ぐるなび'],[/facebook\./,'Facebook'],[/line\.me/,'LINE']]; for(const [r,l] of map) if(r.test(h)) return l; return h; }catch{ return 'リンク'; } }
function infoSec(){ const box=sec('お店の情報'); const d=el('div'); d.id='dInfo'; box.appendChild(d); return box; }
function fillInfo(s){
  const d=$('dInfo'); if(!d) return; d.textContent='';
  const hs=hoursStatus(s); const ht=hoursText(s);
  if (hs || ht){ const r=el('div','sc-chips'); r.style.marginTop='0'; if(hs) pill(r,'h-'+hs.k,hs.t); if(ht) r.appendChild(el('span','htext',ht)); d.appendChild(r); }
  if (s.hp && (s.hp.genre || s.hp.budget)){ const r=el('div','sc-chips'); r.style.marginTop='0'; r.style.marginBottom='8px'; if(s.hp.genre) pill(r,'tag',s.hp.genre); if(s.hp.budget) pill(r,'yen','予算 '+s.hp.budget); d.prepend(r); }
  if (s.hours && s.hours.note) d.appendChild(el('p','loctxt',s.hours.note));
  const ls=Array.isArray(s.links)?s.links:[];
  if (ls.length){ const r=el('div','links'); for(const u of ls){ const a=el('a','btn btn-line linkbtn',linkLabel(u)+' ↗'); a.href=u; a.target='_blank'; a.rel='noopener noreferrer'; r.appendChild(a); } d.appendChild(r); }
  if (!hs && !ht && !ls.length && !(s.hours&&s.hours.note) && !s.hp){ const p=el('p','loctxt','営業時間やお店のリンクはまだありません。'); d.appendChild(p);
    if(!readOnly){ const b=el('button','sbtn','＋ 情報を入れる'); b.onclick=()=>openForm(s.id); d.appendChild(b); } }
}
setInterval(()=>{ const a=document.activeElement; if(swiping || (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName))) return; if(tab==='list'||tab==='home') render(); if(openId) fillInfo(shops.find(x=>x.id===openId)||{}); },60000);
