/* ---------- だるま: the home screen's mascot (like ますせん's ますくん). wobbles, blinks, naps, cheers when you add a shop ---------- */
// faces are groups switched by the mood class on the button: normal / happy / sleep
function darumaSvg(){
  const ink='#1F1B19';
  return `<svg viewBox="0 0 64 66" aria-hidden="true"><g class="dm-body">
  <ellipse cx="32" cy="62" rx="20" ry="3" fill="#000" opacity=".12"/>
  <path d="M32 4C49 4 58 19 58 36C58 52 47 61 32 61C17 61 6 52 6 36C6 19 15 4 32 4Z" fill="#C8352A"/>
  <path d="M32 4C49 4 58 19 58 36C58 41 57 45 55 49C52 30 44 12 32 10C20 12 12 30 9 49C7 45 6 41 6 36C6 19 15 4 32 4Z" fill="#A92A21" opacity=".55"/>
  <ellipse cx="32" cy="28" rx="16.5" ry="14.5" fill="#FBF3E4"/>
  <path d="M17 44Q32 53 47 44" fill="none" stroke="#E2B04A" stroke-width="2.4" stroke-linecap="round"/>
  <text x="32" y="56.5" text-anchor="middle" font-size="9" font-family="Zen Antique, serif" fill="#E2B04A">福</text>
  <g class="dm-f dm-normal">
    <path d="M18.5 20.5Q23 15.5 28 19.5" fill="none" stroke="${ink}" stroke-width="2.3" stroke-linecap="round"/>
    <path d="M45.5 20.5Q41 15.5 36 19.5" fill="none" stroke="${ink}" stroke-width="2.3" stroke-linecap="round"/>
    <g class="dm-eyes"><circle cx="24.5" cy="26" r="4.2" fill="#fff" stroke="${ink}" stroke-width="1.2"/><circle cx="24.5" cy="26.4" r="2.3" fill="${ink}"/>
      <circle cx="39.5" cy="26" r="4.2" fill="#fff" stroke="${ink}" stroke-width="1.2"/><circle cx="39.5" cy="26.4" r="2.3" fill="${ink}"/></g>
    <path d="M23 34.5Q27.5 31.5 32 34Q36.5 31.5 41 34.5" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M29.5 37.5Q32 39 34.5 37.5" fill="none" stroke="${ink}" stroke-width="1.5" stroke-linecap="round"/>
  </g>
  <g class="dm-f dm-happy">
    <path d="M18.5 19Q23 14 28 18" fill="none" stroke="${ink}" stroke-width="2.3" stroke-linecap="round"/>
    <path d="M45.5 19Q41 14 36 18" fill="none" stroke="${ink}" stroke-width="2.3" stroke-linecap="round"/>
    <path d="M20.5 27.5Q24.5 22.5 28.5 27.5" fill="none" stroke="${ink}" stroke-width="2.3" stroke-linecap="round"/>
    <path d="M35.5 27.5Q39.5 22.5 43.5 27.5" fill="none" stroke="${ink}" stroke-width="2.3" stroke-linecap="round"/>
    <path d="M23 33Q27.5 30 32 32.5Q36.5 30 41 33" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M28 35.5Q32 41 36 35.5Z" fill="#C8352A" stroke="${ink}" stroke-width="1.3" stroke-linejoin="round"/>
    <ellipse cx="19" cy="33" rx="2.6" ry="1.5" fill="#F08A80" opacity=".8"/><ellipse cx="45" cy="33" rx="2.6" ry="1.5" fill="#F08A80" opacity=".8"/>
  </g>
  <g class="dm-f dm-sleep">
    <path d="M18.5 21Q23 17.5 28 20.5" fill="none" stroke="${ink}" stroke-width="2.3" stroke-linecap="round" opacity=".7"/>
    <path d="M45.5 21Q41 17.5 36 20.5" fill="none" stroke="${ink}" stroke-width="2.3" stroke-linecap="round" opacity=".7"/>
    <path d="M20.5 26.5Q24.5 29.5 28.5 26.5" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>
    <path d="M35.5 26.5Q39.5 29.5 43.5 26.5" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>
    <path d="M23 34.5Q27.5 32 32 34Q36.5 32 41 34.5" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>
    <ellipse cx="32" cy="38" rx="1.6" ry="1.2" fill="${ink}" opacity=".7"/>
  </g></g>
  <g class="dm-zzz" fill="currentColor" font-weight="900" font-family="sans-serif"><text x="52" y="12" font-size="7">z</text><text x="56" y="6" font-size="9">z</text></g>
  </svg>`;
}

const DM_TIPS = [
  'お店のURLを貼っても追加できるよ',
  '行った店はカードを右にスワイプで記録できるよ',
  '七転び八起き。でも飲みすぎ注意だるま',
  '地図で近くの行きたい店を見てみよう',
  '友達を招待すると、リストを一緒に作れるよ',
  '会計の前に金額を予想すると、答え合わせできるよ',
];
// what the だるま says when the home screen opens
function darumaLine(){
  const h=new Date().getHours(), nw=shops.filter(inWant).length;
  const td=Object.values(todayDocs||{}).find(d=>d.date===today());
  if (td){ const s=shops.find(x=>x.id===td.shopId); if(s) return `今日は「${s.name}」だね。楽しんで!`; }
  if (!nw) return 'まずは行きたい店を1軒、リストに入れてみよう';
  if (h>=4 && h<11) return 'おはよう。今夜はどこにする?';
  if (h>=11 && h<16) return `行きたい店が${nw}軒あるよ。今日はどこ行く?`;
  if (h>=16 && h<22) return 'そろそろ一杯どう? 今日どこ行くか決めよう';
  return 'もう一軒いく? それとも帰る?';
}
const dmSleepy = () => { const h=new Date().getHours(); return h>=4 && h<9; };

let dmEl=null, dmTipI=Math.floor(Math.random()*DM_TIPS.length), dmTimer=0, dmSay='';
function darumaGreet(v){
  const row=el('div','dm-row');
  const b=el('button','daruma'+(dmSleepy()?' sleep':'')); b.type='button'; b.setAttribute('aria-label','だるま'); b.innerHTML=darumaSvg();
  const bub=el('p','dm-bub',dmSay||darumaLine()); bub.id='dmBub';
  b.onclick=()=>{ b.classList.remove('sleep'); dmSay=DM_TIPS[dmTipI++%DM_TIPS.length]; bub.textContent=dmSay; darumaDo('wobble',true); };
  row.append(b,bub); v.appendChild(row); dmEl=b;
}
// one move; cheer = happy face for a moment
function darumaDo(move,cheer){
  const b=dmEl; if(!b || !b.isConnected || reduceMotion()) return;
  b.classList.remove('wobble','hop','blink'); void b.offsetWidth;
  b.classList.add(move); if(cheer) b.classList.add('happy');
  clearTimeout(b._t); b._t=setTimeout(()=>b.classList.remove(move,'happy'), cheer?1400:900);
}
// added a shop / went somewhere: the だるま is happy (it shows next time you look at home, too)
function darumaCheer(msg){ if(msg) dmSay=msg; darumaDo('hop',true); }
// small idle life: blink often, wobble now and then
setInterval(()=>{ if(!dmEl || !dmEl.isConnected || document.hidden || dmEl.classList.contains('sleep')) return;
  darumaDo(Math.random()<.75?'blink':'wobble'); }, 4200);
