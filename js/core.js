/* ---------- constants, state, DOM helpers, people, aggregation ---------- */
const ITEMS = [
  {k:'price', short:'価格', label:'価格',     hint:'◎安い ・ ×高い',      ph:'例: 2人で7,000円くらい'},
  {k:'vibe',  short:'雰囲気', label:'雰囲気', hint:'◎最高 ・ ×いまいち',   ph:'例: カウンター中心で静か'},
  {k:'food',  short:'料理', label:'料理',     hint:'◎絶品 ・ ×いまいち',   ph:'例: 刺身盛りとポテサラが当たり'},
  {k:'nomi',  short:'飲み放題', label:'飲み放題', hint:'◎充実 ・ ×なし',   ph:'例: 2時間2,500円、生ビール込み'},
  {k:'again', short:'また', label:'また行く',  hint:'◎絶対 ・ ×もういい', ph:'例: 次は座敷で予約したい'},
];
const MARKS = ['◎','○','△','×'];
// the marks as drawings (text glyphs sit off-center in some fonts)
const markSvg = m => '<svg class="mk" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
  + ({'◎':'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.2"/>','○':'<circle cx="12" cy="12" r="8.5"/>','△':'<path d="M12 3.8L20.5 19H3.5Z"/>','×':'<path d="M5.5 5.5L18.5 18.5M18.5 5.5L5.5 18.5"/>'}[m]||'') + '</svg>';
const SCORE = {'◎':3,'○':2,'△':1,'×':0};
const KANJI = ['一','二','三','四','五','六','七','八','九','十'];
const RANK_MAX = 10;

let db=null, me=null, mode='loading', readOnly=false;
let shops=[], rankings={}, members={}, isOwner=false, membersLoaded=false;
let tab='home', openId=null, builtStatus=null, editingId=null, listSub='want', recSub='cal';
let filter='all', query='', sort='new', rankWho=null, tagFilter=null;
// 特徴, grouped (c). keys are stored on the shop (tags.<k>), so existing keys never change
const TAG_CATS=['雰囲気','席','お金・会計','たばこ・場所'];
const TAGS=[
  {k:'taishu',l:'大衆居酒屋',c:'雰囲気'},{k:'kojin',l:'個人店',c:'雰囲気'},{k:'date',l:'デート向き',c:'雰囲気'},{k:'solo',l:'一人飲みOK',c:'雰囲気'},{k:'group',l:'大人数OK',c:'雰囲気'},{k:'quiet',l:'落ち着いた',c:'雰囲気'},{k:'lively',l:'にぎやか',c:'雰囲気'},
  {k:'counter',l:'カウンター',c:'席'},{k:'table',l:'テーブル',c:'席'},{k:'zashiki',l:'座敷',c:'席'},{k:'hori',l:'掘りごたつ',c:'席'},{k:'semipriv',l:'半個室',c:'席'},{k:'private',l:'個室あり',c:'席'},{k:'tachinomi',l:'立ち飲み',c:'席'},
  {k:'otoshi',l:'お通しあり',c:'お金・会計'},{k:'nootoshi',l:'お通しなし',c:'お金・会計'},{k:'senbero',l:'せんべろ',c:'お金・会計'},{k:'payseat',l:'会計は席で',c:'お金・会計'},{k:'payregi',l:'会計はレジで',c:'お金・会計'},{k:'card',l:'カード可',c:'お金・会計'},{k:'cashless',l:'電子マネー可',c:'お金・会計'},{k:'cashonly',l:'現金のみ',c:'お金・会計'},
  {k:'nosmoke',l:'禁煙',c:'たばこ・場所'},{k:'smoke',l:'喫煙可',c:'たばこ・場所'},{k:'station',l:'駅近',c:'たばこ・場所'},
];
const tagsOf = s => TAGS.filter(t => s.tags && s.tags[t.k]);
const norm = x => (x||'').normalize('NFKC').toLowerCase().replace(/\s+/g,'');
function tagLine(s){ const ts=tagsOf(s); if(!ts.length) return null; const d=el('div','tags'); ts.forEach(t=>d.appendChild(el('span',null,t.l))); return d; }
const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; };

// whose wants/went count on screen: me, plus the friends I mix in
function SP(){ if(mode!=='db') return null; const P=new Set([me]); for(const f of activeFriends()) P.add(friends[f].mid); return P; }
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
const nameOf = (ps,id) => id===me ? 'あなた' : ((members[id]&&members[id].nick) || (friendByMid(id)||{}).nick || (ps[id]&&ps[id].name) || '飲み友');
// "けん・あなたが行きたい" / "けん・ゆうほか2人が行きたい"
function whoText(ids,what){
  if (!ids.length) return '';
  const ns=[...ids].sort((a,b)=>(a===me)-(b===me)).map(u=>nameOf({},u));
  return (ns.length<=3 ? ns.join('・') : `${ns.slice(0,2).join('・')}ほか${ns.length-2}人`)+'が'+what;
}
// member icons (like ますせん): a color, a shape, and the first letter of the name or an emoji. { c, s, e } on the member doc
const AV_VIVID = { 13:'#e60012', 14:'#0068d9', 15:'#ffd400' };
const AV_ORDER = [0,1,2,3,4,5,6,7,8,9,10,11,13,14,15,12];
const AV_SHAPES = { circle:'まる', squircle:'角丸', hexagon:'六角形', flower:'お花', badge:'バッジ' };
const avBg = i => i===12 ? '#141318' : AV_VIVID[i] || `hsl(${i*30} 55% 44%)`;
const avFg = i => i===15 ? '#2b1d00' : '#fff';
const avDefault = id => { let h=0; for (const ch of String(id||'')) h=(h*31+ch.charCodeAt(0))>>>0; return h%12; };
const iconOf = id => { const m=members[id]||friendByMid(id); return (m && m.ic) || {}; };
function avatar(ps,id,cls){
  const ic=iconOf(id), n=(members[id]&&members[id].nick)||(friendByMid(id)||{}).nick||(ps[id]&&ps[id].name)||'';
  const c=Number.isInteger(ic.c) ? ic.c : avDefault(id);
  const p=el('span',(cls||'ph')+' av'+(ic.s && ic.s!=='circle' ? ' shape-'+ic.s : '')); p.classList.add('ph');
  p.style.setProperty('--avbg',avBg(c)); p.style.setProperty('--avfg',avFg(c));
  p.textContent = [...n][0] || ''; p.title=n; return p;
}

/* ---------- aggregation ---------- */
function avg(s,k){ const r=s.r||{}; const ms=[]; for(const u in r){ const m=r[u]&&r[u][k]&&r[u][k].m; if(m in SCORE) ms.push(SCORE[m]); } return ms.length? ms.reduce((a,b)=>a+b,0)/ms.length : null; }
const avgMark = v => v==null ? null : MARKS[3-Math.round(v)];
const wantIds = s => inScope(wantBy(s));
function recorders(s){ const r=s.r||{}; return Object.keys(r).filter(u => r[u] && Object.values(r[u]).some(x => x && (x.m || (x.t||'').trim()))); }
function rankList(uid){ const ids=(rankings[uid]&&rankings[uid].ids)||[]; return ids.filter(id => shops.some(s => s.id===id && wentBy(s)[uid])); }
