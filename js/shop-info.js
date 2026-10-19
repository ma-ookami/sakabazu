/* ---------- shop info: hours, links, card look ---------- */
const PAL=['#B7282E','#1F4E79','#3A7D44','#B07A12','#5B3F8C','#B4566E','#2E7D7A','#8A5A2B'];
function crestColor(s){ let h=7; for(const ch of (s.name||'')) h=(h*31+ch.codePointAt(0))>>>0; return PAL[h%PAL.length]; }
function crestOf(s){ const n=(s.name||'').replace(/^(居酒屋|大衆酒場|酒場|立ち飲み|立飲み|立呑み?|炉端焼?き?|炉端|炭火焼?き?|炭火)\s*/,'').trim(); return [...(n||s.name||'？')][0]; }
function cardShell(s){
  const c=el('article','card shop2'); c.style.setProperty('--c',crestColor(s));
  const hit=el('button','card-hit'); hit.setAttribute('aria-label',(s.name||'')+'の詳細'); hit.onclick=()=>openDetailFrom(c,s.id); c.appendChild(hit);
  const top=el('div','sc-top'); const cr=el('span','crest',crestOf(s)); cr.setAttribute('aria-hidden','true'); top.appendChild(cr);
  const main=el('div','sc-main'); main.appendChild(el('h3','name',s.name||'(名前なし)')); if(s.area) main.appendChild(el('div','area',s.area));
  if (isFriendShop(s) && friends[s._friend]) main.appendChild(el('span','fr-own',friends[s._friend].nick+'の店'));
  top.appendChild(main);
  const side=el('div','sc-side'); top.appendChild(side);
  c.appendChild(top);
  const chips=el('div','sc-chips'); main.appendChild(chips);
  return {c,top:side,chips};
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
function hoursText(s){ const h=s.hours||{}; const p=[]; if(h.open&&h.close) p.push(`${h.open}〜${h.close}`); if(Array.isArray(h.closed)&&h.closed.length) p.push('定休日 '+h.closed.slice().sort().map(i=>'日月火水木金土'[i]).join('、')); return p.join('　'); }
function linkLabel(u){ try{ const h=new URL(u).hostname.replace(/^www\./,''); const map=[[/tabelog\./,'食べログ'],[/hotpepper\./,'ホットペッパーグルメ'],[/instagram\./,'Instagram'],[/(^|\.)x\.com$|twitter\./,'X'],[/google\.[^/]+$|goo\.gl|maps\.app/,'Googleマップ'],[/retty\./,'Retty'],[/gnavi\./,'ぐるなび'],[/facebook\./,'Facebook'],[/line\.me/,'LINE']]; for(const [r,l] of map) if(r.test(h)) return l; return h; }catch{ return 'リンク'; } }
function fillInfo(s){
  const d=$('dInfo'); if(!d) return; d.textContent='';
  const hs=hoursStatus(s), ht=hoursText(s);
  const r=el('div','sc-chips d-chips');
  { const g=genreOf(s); if(g) pill(r,'genre',g); } if(hs) pill(r,'h-'+hs.k,hs.t); if(s.area) pill(r,'area',s.area); if(s.hp&&s.hp.budget) pill(r,'yen','予算 '+s.hp.budget);
  if (r.children.length) d.appendChild(r);
  const note=[ht, s.hours&&s.hours.note].filter(Boolean).join('　'); if (note) d.appendChild(el('p','d-hours',note));
  const lr=el('div','d-links');
  if (!readOnly && me && mySt(s)==='want'){ const on=isHon(s); const h=el('button','d-link d-hon',on?'本命':'本命にする'); h.prepend(lanEl()); h.type='button'; h.setAttribute('aria-pressed',String(on)); h.onclick=()=>toggleHon(s.id); lr.appendChild(h); }
  else if (honBy(s).length) honPill(lr,s);
  if (!readOnly && me && mySt(s)==='went'){ const on=isTsuke(s); const h=el('button','d-link d-hon d-tsuke',on?'行きつけ':'行きつけにする'); h.type='button'; h.prepend(chokoEl()); h.setAttribute('aria-pressed',String(on)); h.onclick=()=>toggleTsuke(s.id); lr.appendChild(h); }
  else if (tsukeBy(s).length) tsukePill(lr,s);
  for (const u of (Array.isArray(s.links)?s.links:[]).map(safeUrl).filter(Boolean)){ const a=el('a','d-link',linkLabel(u)+' ↗'); a.href=u; a.target='_blank'; a.rel='noopener noreferrer'; lr.appendChild(a); }
  if (s.hp && /^J\d{9}$/.test(s.hp.id||'') && !(Array.isArray(s.links) && s.links.some(u=>/hotpepper\.jp/.test(u)))){ const a=el('a','d-link','ホットペッパーグルメ ↗'); a.href=`https://www.hotpepper.jp/str${s.hp.id}/`; a.target='_blank'; a.rel='noopener noreferrer'; lr.appendChild(a); }
  { const y=yoyakuUrl(s); if (y){ const a=el('a','d-link d-yoyaku','ネット予約 ↗'); a.href=y; a.target='_blank'; a.rel='noopener noreferrer'; lr.appendChild(a); } }
  if (s.loc || s.name){ const a=el('a','d-link','マップ ↗'); a.href=mapsUrl(s); a.target='_blank'; a.rel='noopener noreferrer'; lr.appendChild(a); }
  if (!readOnly && !hs && !ht && !genreOf(s)){ const b=el('button','d-link d-add','＋ ジャンル・営業時間を入れる'); b.type='button'; b.onclick=()=>openForm(s.id); lr.appendChild(b); }
  d.appendChild(lr);
  // a 飲み友's shop that isn't on my list: put it there right from the details
  if (!readOnly && me && isFriendShop(s) && !mySt(s)) d.appendChild(mineRow(s));
  // shop details that came from ホットペッパー carry its credit
  if (s.hp && /^J\d{9}$/.test(s.hp.id||'')){ const cr=el('p','hp-credit'); const c=el('a',null,'Powered by ホットペッパーグルメ Webサービス'); c.href='https://webservice.recruit.co.jp/'; c.target='_blank'; c.rel='noopener noreferrer'; c.title='ホットペッパーグルメ Webサービス'; cr.appendChild(c); d.appendChild(cr); }
}
setInterval(()=>{ const a=document.activeElement; if(swiping || (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName))) return; if(tab==='list'||tab==='home') render(); if(openId) fillInfo(shops.find(x=>x.id===openId)||{}); },60000);

// ホットペッパー's reservation page for a shop (the free seats are checked there)
const yoyakuUrl = s => s && s.hp && /^J\d{9}$/.test(s.hp.id||'') ? `https://www.hotpepper.jp/str${s.hp.id}/yoyaku/` : '';
