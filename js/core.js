/* ---------- constants, state, DOM helpers, people, aggregation ---------- */
const ITEMS = [
  {k:'price', short:'価格', label:'価格',     hint:'◎安い ・ ×高い',      ph:'例: 2人で7,000円くらい'},
  {k:'vibe',  short:'雰囲気', label:'雰囲気', hint:'◎最高 ・ ×いまいち',   ph:'例: カウンター中心で静か'},
  {k:'food',  short:'料理', label:'料理',     hint:'◎絶品 ・ ×いまいち',   ph:'例: 刺身盛りとポテサラが当たり'},
  {k:'nomi',  short:'飲み放題', label:'飲み放題', hint:'◎充実 ・ ×なし',   ph:'例: 2時間2,500円、生ビール込み'},
  {k:'again', short:'また', label:'また行く',  hint:'◎絶対 ・ ×もういい', ph:'例: 次は座敷で予約したい'},
];
const MARKS = ['◎','○','△','×'];
const SCORE = {'◎':3,'○':2,'△':1,'×':0};
const KANJI = ['一','二','三','四','五','六','七','八','九','十'];
const RANK_MAX = 10;

let db=null, me=null, mode='loading', readOnly=false;
let shops=[], rankings={}, members={}, isOwner=false, membersLoaded=false;
let tab='home', openId=null, builtStatus=null, editingId=null, listSub='want', recSub='cal';
let filter='all', query='', sort='new', rankWho=null, tagFilter=null;
const TAGS=[{k:'private',l:'個室あり'},{k:'zashiki',l:'座敷'},{k:'counter',l:'カウンター'},{k:'solo',l:'一人飲みOK'},{k:'group',l:'大人数OK'},{k:'reserve',l:'予約必須'},{k:'smoke',l:'喫煙可'},{k:'nosmoke',l:'禁煙'},{k:'late',l:'深夜まで'},{k:'card',l:'カード可'},{k:'station',l:'駅近'}];
const tagsOf = s => TAGS.filter(t => s.tags && s.tags[t.k]);
const norm = x => (x||'').normalize('NFKC').toLowerCase().replace(/\s+/g,'');
function tagLine(s){ const ts=tagsOf(s); if(!ts.length) return null; const d=el('div','tags'); ts.forEach(t=>d.appendChild(el('span',null,t.l))); return d; }
function tagChips(v,st){
  const used=TAGS.filter(t=>shops.some(s=>(st==='want'?inWant(s):inWent(s)) && s.tags && s.tags[t.k]));
  if (tagFilter && !used.some(t=>t.k===tagFilter)) tagFilter=null;
  if (!used.length) return;
  const c=el('div','chips'); c.setAttribute('role','group'); c.setAttribute('aria-label','特徴で絞り込み');
  for (const t of used){ const b=el('button','chip',t.l); b.setAttribute('aria-pressed',String(tagFilter===t.k)); b.onclick=()=>{ tagFilter = tagFilter===t.k ? null : t.k; render(); }; c.appendChild(b); }
  v.appendChild(c);
}
const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; };

// whose wants/went count on screen: me, plus the friends I mix in
function SP(){ if(mode!=='db') return null; const P=new Set([me]); for(const f of mixedFriends()) P.add(friends[f].mid); return P; }
function legacyWent(s){ if(s.status==='want') return {}; const o={}; const d=s.wentDate||true; for(const u of new Set([s.createdBy,...recorders(s)].filter(Boolean))) o[u]=d; return o; }
function wentBy(s){ if(s.went && typeof s.went==='object'){ const o={}; for(const u in s.went) if(s.went[u]) o[u]=s.went[u]; return o; } return legacyWent(s); }
function wantBy(s){ const w=wentBy(s); return Object.keys(s.wants||{}).filter(u=>s.wants[u] && !w[u]); }
function wentPatch(s,u,val){ const base=(s.went && typeof s.went==='object') ? {} : legacyWent(s); base[u]=val; return base; }
const inScope = ids => { const P=SP(); return P ? ids.filter(u=>P.has(u)) : ids; };
const wentIds = s => inScope(Object.keys(wentBy(s)));
const inWant = s => wantIds(s).length>0;
const inWent = s => wentIds(s).length>0;
const statusOf = s => inWent(s) ? 'went' : inWant(s) ? 'want' : null;
const mySt = s => wentBy(s)[me] ? 'went' : (s.wants && s.wants[me]) ? 'want' : null;
function lastWent(s){ let m=''; for(const u of wentIds(s)){ const d=wentBy(s)[u]; if(typeof d==='string' && d>m) m=d; } return m; }
const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
function fmtDate(s){ if(!s) return ''; const [y,m,d]=s.split('-').map(Number); if(!y) return ''; const dt=new Date(y,m-1,d); return `${m}/${d}(${'日月火水木金土'[dt.getDay()]})`; }

/* ---------- people ---------- */
async function people(ids){
  ids=[...new Set(ids.filter(Boolean))];
  const o={}; for(const id of ids) o[id]={id,name:(members[id]&&members[id].nick)||(id===me?'あなた':''),avatarUrl:(members[id]&&members[id].photo)||'',isMe:id===me}; return o;
}
const nameOf = (ps,id) => id===me ? 'あなた' : ((members[id]&&members[id].nick) || (friendByMid(id)||{}).nick || (ps[id]&&ps[id].name) || '友達');
// "けん・あなたが行きたい" / "けん・ゆうほか2人が行きたい"
function whoText(ids,what){
  if (!ids.length) return '';
  const ns=[...ids].sort((a,b)=>(a===me)-(b===me)).map(u=>nameOf({},u));
  return (ns.length<=3 ? ns.join('・') : `${ns.slice(0,2).join('・')}ほか${ns.length-2}人`)+'が'+what;
}
function avatar(ps,id,cls){ const ph=()=>{ const p=el('span',cls||'ph'); p.classList.add('ph'); const n=(members[id]&&members[id].nick)||(friendByMid(id)||{}).nick||(ps[id]&&ps[id].name)||''; p.textContent=[...n][0]||''; p.title=n; return p; };
  const src=ps[id]&&ps[id].avatarUrl; if(!src) return ph();
  const i=el('img',cls); i.alt=''; i.referrerPolicy='no-referrer'; i.onerror=()=>i.replaceWith(ph()); i.src=src; return i; }

/* ---------- aggregation ---------- */
function avg(s,k){ const r=s.r||{}; const ms=[]; for(const u in r){ const m=r[u]&&r[u][k]&&r[u][k].m; if(m in SCORE) ms.push(SCORE[m]); } return ms.length? ms.reduce((a,b)=>a+b,0)/ms.length : null; }
const avgMark = v => v==null ? null : MARKS[3-Math.round(v)];
const wantIds = s => inScope(wantBy(s));
function recorders(s){ const r=s.r||{}; return Object.keys(r).filter(u => r[u] && Object.values(r[u]).some(x => x && (x.m || (x.t||'').trim()))); }
function rankList(uid){ const ids=(rankings[uid]&&rankings[uid].ids)||[]; return ids.filter(id => shops.some(s => s.id===id && wentBy(s)[uid])); }
