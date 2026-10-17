/* ---------- だるま: the home screen's mascot (like ますせん's ますくん) ----------
   built from parts you pick in 設定 (saved on this device). wobbles, blinks, naps, cheers when you add a shop.
   faces are groups switched by the mood class on the button: normal / happy / sleep */
const DM_PARTS = {
  body:  { label:'体の色', color:true, opts:{ aka:['#E0453A','#B8322A'], kin:['#E9B949','#C08F22'], shiro:['#F6F1E7','#D8CDB8'], momo:['#F59CB2','#D9758F'],
           ao:['#5B93D3','#3C6FAA'], midori:['#62B072','#438A52'], kuro:['#3A3434','#221E1E'] } },
  gara:  { label:'体の模様', opts:{ nashi:'なし', kumo:'雲', nami:'波', ume:'梅', sakura:'桜', sen:'金の線', ichimatsu:'市松', asanoha:'麻の葉', shippo:'七宝', uroko:'鱗', mizutama:'しぶき', shima:'提灯の縞' } },
  eye:   { label:'目', opts:{ kira:'キラキラ', maru:'まる', ten:'てん', niko:'にっこり', gyoro:'ぎょろ', kata:'片目(願かけ)' } },
  brow:  { label:'まゆ', opts:{ nashi:'なし', hoso:'ほそ', futo:'ふと', tsuru:'いかつい' } },
  hige:  { label:'ひげ', opts:{ nashi:'なし', chobi:'ちょび', kuru:'くるん', kame:'もじゃ' } },
  mouth: { label:'口', opts:{ niko:'にこ', han:'あーん', omega:'ω', pokan:'ぽかん', bero:'べー', puha:'ぷはー', he:'への字' } },
  kaoiro:{ label:'顔色', opts:{ nashi:'ふつう', horo:'ほろ酔い' } },
  hoho:  { label:'ほっぺ', opts:{ nashi:'なし', ari:'あり' } },
  moji:  { label:'お腹の字', opts:{ '':'なし', '福':'福', '酒':'酒', '呑':'呑', '吉':'吉', '勝':'勝', '神':'神', '雅':'雅', '狼':'狼' } },
  head:  { label:'あたま', opts:{ nashi:'なし', neko:'ねこ耳', hachi:'はちまき' } },
  kao:   { label:'顔の小物', opts:{ nashi:'なし', megane:'メガネ', sangura:'サングラス' } },
  item:  { label:'もちもの', opts:{ nashi:'なし', jokki:'ジョッキ', kanpai:'乾杯', highball:'ハイボール', wine:'ワイン', tokkuri:'とっくり', choko:'おちょこ',
           yakitori:'焼き鳥', edamame:'枝豆', chochin:'ちょうちん', uchiwa:'うちわ', maneki:'招き猫の手' } },
  ushiro:{ label:'うしろ', opts:{ nashi:'なし', goko:'後光' } },
};
const DM_DEFAULT = { body:'aka', gara:'nashi', eye:'kira', brow:'hoso', hige:'nashi', mouth:'niko', hoho:'ari', moji:'福', head:'nashi', kao:'nashi', item:'nashi', kaoiro:'nashi', ushiro:'nashi' };
// one tap looks: the cute default, and the classic stern daruma face
const DM_PRESETS = [
  ['かわいい', DM_DEFAULT],
  ['いかつい', { body:'aka', gara:'kumo', eye:'gyoro', brow:'tsuru', hige:'kame', mouth:'he', hoho:'nashi', moji:'福', head:'nashi', kao:'nashi', item:'nashi' }],
  ['ほろ酔い', { body:'aka', gara:'shima', eye:'niko', brow:'hoso', hige:'nashi', mouth:'puha', hoho:'ari', kaoiro:'horo', moji:'酒', head:'hachi', kao:'nashi', item:'jokki' }],
  ['ありがたい', { body:'kin', gara:'shippo', eye:'niko', brow:'futo', hige:'kuru', mouth:'niko', hoho:'ari', moji:'福', head:'nashi', kao:'nashi', item:'nashi', ushiro:'goko' }],
];
const cleanDm = c => {
  const o=Object.fromEntries(Object.entries(DM_PARTS).map(([k,p]) => [k, c && c[k]!=null && c[k] in p.opts ? c[k] : DM_DEFAULT[k]]));
  if (c && c.item==='hachi' && o.head==='nashi') o.head='hachi';   // はちまき used to be a もちもの
  return o;
};
let dmCfg = (()=>{ try{ return cleanDm(JSON.parse(localStorage.getItem('nm-daruma')||'null')); }catch{ return {...DM_DEFAULT}; } })();
function saveDm(c){ dmCfg=cleanDm(c); try{ localStorage.setItem('nm-daruma',JSON.stringify(dmCfg)); }catch{}
  if (typeof mode!=='undefined' && mode==='db' && me && members[me]){ clearTimeout(saveDm.t); saveDm.t=setTimeout(()=>db.doc('members/'+me).update({dm:dmCfg}).catch(()=>{}),800); } }   // quiet: only for showing to 飲み友

let dmSeq=0;   // each drawing gets its own clipPath id
function darumaSvg(c){
  c=cleanDm(c||dmCfg);
  const [B,BD]=DM_PARTS.body.opts[c.body], ink='#2A2220', face='#FFF8EC', cid='dmc'+(++dmSeq);
  const gold = c.body==='kin' ? '#B8322A' : '#F2C14E';
  const ln=(d,w=2.2,o=1,col=ink)=>`<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="${o}"/>`;
  const BODY='M32 5C48.5 5 58 18.5 58 36C58 53.5 47 62 32 62C17 62 6 53.5 6 36C6 18.5 15.5 5 32 5Z';
  const eye = {
    kira:`<ellipse cx="25" cy="30" rx="3.6" ry="4.3" fill="${ink}"/><ellipse cx="39" cy="30" rx="3.6" ry="4.3" fill="${ink}"/>
      <circle cx="26.3" cy="28.4" r="1.4" fill="#fff"/><circle cx="40.3" cy="28.4" r="1.4" fill="#fff"/><circle cx="24" cy="31.6" r=".7" fill="#fff"/><circle cx="38" cy="31.6" r=".7" fill="#fff"/>`,
    maru:`<circle cx="25" cy="30" r="4.4" fill="#fff" stroke="${ink}" stroke-width="1.4"/><circle cx="25" cy="30.4" r="2.3" fill="${ink}"/>
      <circle cx="39" cy="30" r="4.4" fill="#fff" stroke="${ink}" stroke-width="1.4"/><circle cx="39" cy="30.4" r="2.3" fill="${ink}"/>`,
    ten:`<circle cx="25" cy="30.5" r="1.9" fill="${ink}"/><circle cx="39" cy="30.5" r="1.9" fill="${ink}"/>`,
    niko: ln('M21.5 31Q25 27 28.5 31',2.4)+ln('M35.5 31Q39 27 42.5 31',2.4),
    neko:`<path d="M20 30.5Q25 24.5 30 30.5Q25 35.5 20 30.5Z" fill="#F4C84A" stroke="${ink}" stroke-width="1.4" stroke-linejoin="round"/><ellipse cx="25" cy="30.5" rx="1.1" ry="3.4" fill="${ink}"/>
      <path d="M34 30.5Q39 24.5 44 30.5Q39 35.5 34 30.5Z" fill="#F4C84A" stroke="${ink}" stroke-width="1.4" stroke-linejoin="round"/><ellipse cx="39" cy="30.5" rx="1.1" ry="3.4" fill="${ink}"/>
      <circle cx="26.6" cy="28.9" r=".9" fill="#fff"/><circle cx="40.6" cy="28.9" r=".9" fill="#fff"/>`,
    gyoro:`<circle cx="25" cy="30" r="5.4" fill="#fff" stroke="${ink}" stroke-width="1.8"/><circle cx="25.6" cy="30.4" r="1.7" fill="${ink}"/>
      <circle cx="39" cy="30" r="5.4" fill="#fff" stroke="${ink}" stroke-width="1.8"/><circle cx="38.4" cy="30.4" r="1.7" fill="${ink}"/>`,
    kata:`<circle cx="25" cy="30" r="4.4" fill="${ink}"/><circle cx="26.3" cy="28.6" r="1.2" fill="#fff"/><circle cx="39" cy="30" r="4.4" fill="#fff" stroke="${ink}" stroke-width="1.4"/>`,
  }[c.eye];
  const brow = { hoso: ln('M21 22.5Q25 20.5 29 22.5',1.8)+ln('M35 22.5Q39 20.5 43 22.5',1.8),
    futo: ln('M20.5 23Q25 19 29.5 22.5',3.4)+ln('M34.5 22.5Q39 19 43.5 23',3.4),
    tsuru: ln('M18.5 21.5Q20.5 15.5 28.5 17.5',3.8)+ln('M45.5 21.5Q43.5 15.5 35.5 17.5',3.8)+ln('M18.5 21.5Q16.8 21.2 16.8 19.2',1.6)+ln('M45.5 21.5Q47.2 21.2 47.2 19.2',1.6),
    nashi:'' }[c.brow];
  const hige = { nashi:'', chobi: ln('M27.5 36Q32 34 36.5 36',2),
    kuru: ln('M32 35.5Q28 33.5 25 35.5Q23 37 24.5 38.2',2.1)+ln('M32 35.5Q36 33.5 39 35.5Q41 37 39.5 38.2',2.1),
    kame: ln('M32 35.5Q27 32 22.5 35Q20.5 36.8 22 38.5',2.6)+ln('M32 35.5Q37 32 41.5 35Q43.5 36.8 42 38.5',2.6)
      +ln('M22.5 41Q32 48.5 41.5 41',2.2)+ln('M26.5 43.2l-.6 2.4M32 44.6v2.6M37.5 43.2l.6 2.4',1.6) }[c.hige];
  const my = c.hige==='nashi' ? 0 : 1.6;   // mouth sits a little lower under a mustache
  const mouth = { niko: ln(`M29 ${37+my}Q32 ${40+my} 35 ${37+my}`,1.8),
    omega: ln(`M28.5 ${37.5+my}Q30.2 ${40+my} 32 ${37.8+my}Q33.8 ${40+my} 35.5 ${37.5+my}`,1.7),
    pokan:`<ellipse cx="32" cy="${38.6+my}" rx="1.9" ry="2.2" fill="${ink}"/>`,
    bero: ln(`M29 ${37+my}Q32 ${39.5+my} 35 ${37+my}`,1.8)+`<path d="M30.6 ${38.4+my}Q32 ${42.5+my} 33.4 ${38.4+my}Z" fill="#F07A7A"/>`,
    han:`<path d="M28.3 ${36.6+my}H35.7A3.7 3.7 0 0 1 28.3 ${36.6+my}Z" fill="#8E2A22" stroke="${ink}" stroke-width="1.3" stroke-linejoin="round"/><path d="M30 ${39.1+my}Q32 ${37.9+my} 34 ${39.1+my}Q32 ${40.6+my} 30 ${39.1+my}Z" fill="#F07A7A"/>`,
    puha:`<ellipse cx="32" cy="${38.8+my}" rx="3.4" ry="2.6" fill="#8E2A22" stroke="${ink}" stroke-width="1.2"/><path d="M40 ${36+my}q2.5-1 4.5 0M41 ${39.5+my}q3 .3 5 2" fill="none" stroke="${ink}" stroke-width="1.1" stroke-linecap="round" opacity=".55"/>`,
    he: ln(`M28.5 ${39+my}Q32 ${36.5+my} 35.5 ${39+my}`,2) }[c.mouth];
  const hoho = (o=.75) => c.hoho==='ari' ? `<ellipse cx="19.5" cy="35.5" rx="3" ry="1.8" fill="#FF8C8C" opacity="${o}"/><ellipse cx="44.5" cy="35.5" rx="3" ry="1.8" fill="#FF8C8C" opacity="${o}"/>` : '';
  // patterns on the colored part of the body, clipped to the body
  const gl=(d,w=1.6)=>ln(d,w,.95,gold);
  const gara = {
    nashi:'',
    kumo: gl('M8 46q2.5-4 6.5-2q1.5-4.5 6-2.5q3 .5 2.5 4')+gl('M11 52q2-2.5 5-1.5')+gl('M56 46q-2.5-4-6.5-2q-1.5-4.5-6-2.5q-3 .5-2.5 4')+gl('M53 52q-2-2.5-5-1.5'),
    nami: [[9,47],[17,47],[5,53],[13,53],[9,59],[17,59],[55,47],[47,47],[59,53],[51,53],[55,59],[47,59]]
      .map(([x,y])=>gl(`M${x-4} ${y}a4 4 0 0 1 8 0`,1.3)+gl(`M${x-2.2} ${y}a2.2 2.2 0 0 1 4.4 0`,1.1)).join(''),
    ume: [[12,44,1],[52,44,1],[16,54,.8],[48,54,.8],[9,34,.7],[55,34,.7]].map(([x,y,s])=>`<g transform="translate(${x} ${y}) scale(${s})">${[0,72,144,216,288].map(a=>`<circle cx="0" cy="-2.6" r="2" fill="#FFD6DE" transform="rotate(${a})"/>`).join('')}<circle r="1.2" fill="${gold}"/></g>`).join(''),
    sen: gl('M11 28Q9 40 13 51',1.8)+gl('M53 28Q55 40 51 51',1.8)+gl('M14 26Q12.5 40 16.5 50',1)+gl('M50 26Q51.5 40 47.5 50',1),
    sakura: [[11,45,1],[53,45,1],[15,55,.85],[49,55,.85],[8,33,.7],[56,33,.7],[23,59,.7],[41,59,.7]].map(([x,y,k])=>`<g transform="translate(${x} ${y}) scale(${k})">${[0,72,144,216,288].map(a=>`<ellipse cx="0" cy="-2.7" rx="1.5" ry="2.5" fill="#FFC9D6" transform="rotate(${a})"/>`).join('')}<circle r=".9" fill="${gold}"/></g>`).join(''),
    ichimatsu: (()=>{ let o=''; for(let y=40;y<64;y+=6) for(let x=2;x<62;x+=6) if(((x-2)/6+(y-40)/6)%2===0) o+=`<rect x="${x}" y="${y}" width="6" height="6" fill="${gold}" opacity=".38"/>`; return o; })(),
    asanoha: (()=>{ let o=''; for(let y=42,r=0;y<64;y+=7,r++) for(let x=(r%2?6:2);x<64;x+=8) o+=gl(`M${x} ${y-3.5}V${y+3.5}M${x-3} ${y-1.75}L${x+3} ${y+1.75}M${x-3} ${y+1.75}L${x+3} ${y-1.75}`,.9); return o; })(),
    shippo: (()=>{ let o=''; for(let y=40;y<66;y+=8) for(let x=0;x<66;x+=8) o+=`<circle cx="${x}" cy="${y}" r="5.6" fill="none" stroke="${gold}" stroke-width="1" opacity=".85"/>`; return o; })(),
    uroko: (()=>{ let o=''; for(let y=41,r=0;y<64;y+=7,r++) for(let x=(r%2?-2:2);x<64;x+=8) o+=`<path d="M${x} ${y+7}L${x+4} ${y}L${x+8} ${y+7}Z" fill="${gold}" opacity="${(r+x)%3?'.18':'.42'}"/>`; return o; })(),
    mizutama: [[12,40,2.4],[20,48,1.6],[9,52,1.8],[52,40,2.2],[45,49,1.5],[56,53,2],[27,57,1.4],[38,58,2],[16,30,1.2],[49,27,1.4],[33,62,1.2]].map(([x,y,r],i)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${i%3?'#fff':gold}" opacity=".75"/>`).join(''),
    shima: [12,18,24,30,36,42,48,54,60].map(y=>`<path d="M2 ${y}Q32 ${y+5} 62 ${y}" fill="none" stroke="${BD}" stroke-width="1.5" opacity=".55"/>`).join(''),
  }[c.gara];
  const ears = c.head==='neko' ? `<path d="M12 22L12.5 3L27 10Z" fill="${B}"/><path d="M14.4 15.5L14.8 7.4L21.6 10.6Z" fill="#FF9DB0"/>
      <path d="M52 22L51.5 3L37 10Z" fill="${B}"/><path d="M49.6 15.5L49.2 7.4L42.4 10.6Z" fill="#FF9DB0"/>` : '';
  const hachi = c.head==='hachi' ? `<path d="M9.5 19Q32 11 54.5 19L55.5 23Q32 15 8.5 23Z" fill="#fff" stroke="${ink}" stroke-width=".8"/><circle cx="32" cy="16" r="2" fill="#E0453A"/>
      <path d="M55 20.5l6 -3.5M55 21.5l5.5 3.5" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><path d="M55 20.5l6 -3.5M55 21.5l5.5 3.5" stroke="${ink}" stroke-width=".7" stroke-linecap="round" opacity=".5"/>` : '';
  const kao = {
    nashi:'',
    megane: `<circle cx="25" cy="30" r="6.2" fill="#fff" fill-opacity=".15" stroke="${ink}" stroke-width="1.6"/><circle cx="39" cy="30" r="6.2" fill="#fff" fill-opacity=".15" stroke="${ink}" stroke-width="1.6"/>`
      + ln('M31.2 29.5Q32 28.5 32.8 29.5',1.4)+ln('M18.8 29L14.5 27.5',1.4)+ln('M45.2 29L49.5 27.5',1.4),
    sangura: `<path d="M18.5 26.5H30.5Q31 33.5 25 34Q19 33.5 18.5 26.5Z" fill="${ink}"/><path d="M33.5 26.5H45.5Q45 33.5 39 34Q33 33.5 33.5 26.5Z" fill="${ink}"/>`
      + ln('M30.5 27.5H33.5',1.6)+ln('M18.5 27L14.5 26',1.4)+ln('M45.5 27L49.5 26',1.4),
  }[c.kao];
  const item = {
    nashi:'',
    jokki:`<g transform="translate(50 42)"><rect x="0" y="2" width="11" height="15" rx="2" fill="#F4C24C" stroke="${ink}" stroke-width="1"/><path d="M11 6h2.5a2.5 2.5 0 0 1 0 6H11" fill="none" stroke="${ink}" stroke-width="1.4"/>
      <path d="M-.5 3Q1 -1 4 1Q6 -1.5 8.5 1Q11 -.5 11.5 3Z" fill="#fff" stroke="${ink}" stroke-width=".8"/></g>`,
    choko:`<g transform="translate(51 50)"><path d="M0 0H10L8.5 6.5H1.5Z" fill="#fff" stroke="${ink}" stroke-width="1"/><path d="M1 1.6H9" stroke="#5B93D3" stroke-width="1.6"/></g>`,
    chochin:`<g transform="translate(52 30)"><path d="M5 -6V0" stroke="${ink}" stroke-width="1"/><rect x="2" y="0" width="6" height="2" rx=".6" fill="${ink}"/>
      <ellipse cx="5" cy="9" rx="5.5" ry="7.5" fill="#E0453A"/><path d="M0 6.5Q5 8 10 6.5M-.3 10Q5 11.5 10.3 10" stroke="#9A2A22" stroke-width=".6" fill="none"/><rect x="2" y="16" width="6" height="2" rx=".6" fill="${ink}"/></g>`,
    kanpai:`<g transform="translate(50 42)"><rect x="0" y="2" width="11" height="15" rx="2" fill="#F4C24C" stroke="${ink}" stroke-width="1"/><path d="M11 6h2.5a2.5 2.5 0 0 1 0 6H11" fill="none" stroke="${ink}" stroke-width="1.4"/><path d="M-.5 3Q1 -1 4 1Q6 -1.5 8.5 1Q11 -.5 11.5 3Z" fill="#fff" stroke="${ink}" stroke-width=".8"/></g>
      <g transform="translate(14 42) scale(-1 1)"><rect x="0" y="2" width="11" height="15" rx="2" fill="#F4C24C" stroke="${ink}" stroke-width="1"/><path d="M11 6h2.5a2.5 2.5 0 0 1 0 6H11" fill="none" stroke="${ink}" stroke-width="1.4"/><path d="M-.5 3Q1 -1 4 1Q6 -1.5 8.5 1Q11 -.5 11.5 3Z" fill="#fff" stroke="${ink}" stroke-width=".8"/></g>`,
    highball:`<g transform="translate(52 34)"><path d="M0 0H9L8 22H1Z" fill="#F7E3A6" fill-opacity=".9" stroke="${ink}" stroke-width="1"/><rect x="2" y="7" width="4" height="4" rx=".8" fill="#fff" opacity=".9"/><rect x="4" y="12" width="3.5" height="3.5" rx=".8" fill="#fff" opacity=".8"/><circle cx="3" cy="17" r=".7" fill="#fff"/><circle cx="6" cy="4" r=".6" fill="#fff"/><path d="M6.5 -4L5 7" stroke="#E0453A" stroke-width="1.2" stroke-linecap="round"/></g>`,
    wine:`<g transform="translate(51 38)"><path d="M0 0H10Q10 8 5 9Q0 8 0 0Z" fill="#9B2335" stroke="${ink}" stroke-width="1"/><path d="M0 0H10" stroke="${ink}" stroke-width="1"/><path d="M5 9V17M1.5 17.5H8.5" stroke="${ink}" stroke-width="1.2" stroke-linecap="round"/></g>`,
    tokkuri:`<g transform="translate(51 36)"><path d="M4 0H8V4Q13 9 12 17Q11 22 6 22Q1 22 0 17Q-1 9 4 4Z" fill="#fff" stroke="${ink}" stroke-width="1"/><path d="M.4 13.5H11.6" stroke="#5B93D3" stroke-width="2.2"/><text x="6" y="11" text-anchor="middle" font-size="4.5" font-family="serif" fill="${ink}">酒</text></g>`,
    yakitori:`<g transform="translate(48 30) rotate(25)"><path d="M3 -2V26" stroke="#B88A55" stroke-width="1.4" stroke-linecap="round"/><ellipse cx="3" cy="4" rx="3.3" ry="2.9" fill="#A0522D" stroke="${ink}" stroke-width=".6"/><ellipse cx="3" cy="10" rx="3.3" ry="2.9" fill="#B5652E" stroke="${ink}" stroke-width=".6"/><ellipse cx="3" cy="16" rx="3.3" ry="2.9" fill="#A0522D" stroke="${ink}" stroke-width=".6"/><path d="M1 3.5l1 .5M2 9.5l1.5.3M1 15.5l1.4.5" stroke="#5A2C12" stroke-width=".6"/></g>`,
    edamame:`<g transform="translate(49 46) rotate(-20)"><path d="M0 4Q1 -1 6 1Q10 -1 13 2Q17 0 17 4Q16 9 12 7Q8 10 5 7Q1 9 0 4Z" fill="#7BBF4B" stroke="#3E7A23" stroke-width="1"/><circle cx="4" cy="4" r="1.8" fill="#9ED36A"/><circle cx="8.5" cy="4" r="1.8" fill="#9ED36A"/><circle cx="13" cy="4" r="1.8" fill="#9ED36A"/></g>`,
    uchiwa:`<g transform="translate(55 30) rotate(15)"><path d="M0 8V20" stroke="#B88A55" stroke-width="1.6" stroke-linecap="round"/><circle cx="0" cy="0" r="8" fill="#fff" stroke="${ink}" stroke-width="1"/><circle cx="0" cy="0" r="4" fill="#E0453A"/><path d="M-7 3Q0 6 7 3" stroke="#5B93D3" stroke-width="1.2" fill="none"/></g>`,
    maneki:`<g transform="translate(52 12)"><path d="M2 18Q0 10 2 5Q4 0 8 1Q12 2 11 8Q10 14 8 18Z" fill="#fff" stroke="${ink}" stroke-width="1"/><circle cx="5" cy="4" r="1.2" fill="#FF9DB0"/><circle cx="8" cy="3.5" r="1.2" fill="#FF9DB0"/><circle cx="9.6" cy="6" r="1.1" fill="#FF9DB0"/><ellipse cx="7" cy="8.5" rx="2.2" ry="1.8" fill="#FF9DB0"/></g>`,
  }[c.item];
  return `<svg viewBox="0 0 64 66" aria-hidden="true"><defs><clipPath id="${cid}"><path d="${BODY}"/></clipPath></defs><g class="dm-body">
  ${c.ushiro==='goko' ? `<g class="dm-goko"><circle cx="32" cy="33" r="34" fill="#F2C14E" opacity=".16"/>${Array.from({length:16},(_,k)=>`<path d="M32 33L${32+38*Math.cos((k+.5)*Math.PI/8-.08)} ${33+38*Math.sin((k+.5)*Math.PI/8-.08)}L${32+38*Math.cos((k+.5)*Math.PI/8+.08)} ${33+38*Math.sin((k+.5)*Math.PI/8+.08)}Z" fill="#F2C14E" opacity=".55"/>`).join('')}</g>` : ''}
  <ellipse cx="32" cy="62.5" rx="20" ry="2.8" fill="#000" opacity=".12"/>
  ${ears}
  <path d="${BODY}" fill="${B}"/>
  <path d="M10 48C14 57 22 62 32 62C42 62 50 57 54 48C49 53 41 56 32 56C23 56 15 53 10 48Z" fill="${BD}" opacity=".6"/>
  <g clip-path="url(#${cid})">${gara}</g>
  <ellipse cx="22" cy="12.5" rx="6" ry="2.6" fill="#fff" opacity=".28" transform="rotate(-22 22 12.5)"/>
  <ellipse cx="32" cy="31" rx="18" ry="15" fill="${face}" stroke="${gold}" stroke-width="1.6"/>
  ${c.kaoiro==='horo' ? `<ellipse cx="32" cy="32" rx="17" ry="13.5" fill="#FF7A7A" opacity=".16"/><ellipse cx="19.5" cy="35.5" rx="4.2" ry="2.4" fill="#FF6B6B" opacity=".55"/><ellipse cx="44.5" cy="35.5" rx="4.2" ry="2.4" fill="#FF6B6B" opacity=".55"/><path d="M15 29.5l2 .8M14.6 32l2 .4M49 29.5l-2 .8M49.4 32l-2 .4" stroke="#E0453A" stroke-width=".8" stroke-linecap="round" opacity=".7"/>` : ''}
  ${c.moji ? `<text x="32" y="56" text-anchor="middle" font-size="9.5" font-weight="700" font-family="Zen Antique, serif" fill="${gold}" stroke="${B}" stroke-width="2.2" paint-order="stroke">${c.moji}</text>` : ''}
  ${brow}${hige}
  <g class="dm-f dm-normal"><g class="dm-eyes">${eye}</g>${mouth}${hoho()}</g>
  <g class="dm-f dm-happy">${ln('M21.5 31Q25 26.5 28.5 31',2.4)+ln('M35.5 31Q39 26.5 42.5 31',2.4)}
    <path d="M28.5 ${36.5+my}Q32 ${43+my} 35.5 ${36.5+my}Z" fill="#B8322A" stroke="${ink}" stroke-width="1.3" stroke-linejoin="round"/>${hoho(1)}</g>
  <g class="dm-f dm-sleep">${ln('M21.5 30Q25 33 28.5 30',2)+ln('M35.5 30Q39 33 42.5 30',2)}<ellipse cx="32" cy="${38.6+my}" rx="1.5" ry="1.1" fill="${ink}" opacity=".7"/>${hoho(.4)}</g>
  ${kao}${hachi}${item}</g>
  <g class="dm-zzz" fill="currentColor" font-weight="900" font-family="sans-serif"><text x="50" y="10" font-size="7">z</text><text x="55" y="4" font-size="9">z</text></g>
  </svg>`;
}

const DM_TIPS = [
  'お店のURLを貼っても追加できるよ',
  '行った店はカードを右にスワイプで記録できるよ',
  '七転び八起き。でも飲みすぎ注意だるま',
  '地図で近くの行きたい店を見てみよう',
  '飲み友を招待すると、リストを一緒に作れるよ',
  '会計の前に金額を予想すると、答え合わせできるよ',
  '設定でぼくの見た目を変えられるよ',
];
// what the だるま says when the home screen opens
function darumaLine(){
  const h=new Date().getHours(), nw=shops.filter(inWant).length;
  const td=Object.values(todayDocs||{}).find(d=>d.date===today());
  if (td){ const s=shops.find(x=>x.id===td.shopId); if(s) return `今日は「${s.name}」だね。楽しんで!`; }
  const wf=mixedFriends()[0];
  if (wf) return nw ? `${friends[wf].nick}と行きたい店が${nw}軒あるよ。どこにする?` : `${friends[wf].nick}とのリストはまだ空っぽ。行きたい店を入れてみよう`;
  if (!nw) return 'まずは行きたい店を1軒、リストに入れてみよう';
  if (h>=4 && h<11) return 'おはよう。今夜はどこにする?';
  if (h>=11 && h<16) return `行きたい店が${nw}軒あるよ。今日はどこ行く?`;
  if (h>=16 && h<22) return 'そろそろ一杯どう? 今日どこ行くか決めよう';
  return 'もう一軒いく? それとも帰る?';
}
const dmSleepy = () => { const h=new Date().getHours(); return h>=4 && h<9; };

let dmEl=null, dmTipI=Math.floor(Math.random()*DM_TIPS.length), dmSay='';
function darumaGreet(v){
  const row=el('div','dm-row');
  const b=el('button','daruma'+(dmSleepy()?' sleep':'')); b.type='button'; b.setAttribute('aria-label','だるま'); b.innerHTML=darumaSvg();
  const bub=el('p','dm-bub',dmSay||darumaLine()); bub.id='dmBub';
  b.onclick=()=>{ b.classList.remove('sleep'); dmSay=DM_TIPS[dmTipI++%DM_TIPS.length]; bub.textContent=dmSay; darumaDo(b,'wobble',true); };
  row.append(b,bub); v.appendChild(row); dmEl=b;
}
// one move; cheer = happy face for a moment
function darumaDo(b,move,cheer){
  if(!b || !b.isConnected || reduceMotion()) return;
  b.classList.remove('wobble','hop','blink'); void b.offsetWidth;
  b.classList.add(move); if(cheer) b.classList.add('happy');
  clearTimeout(b._t); b._t=setTimeout(()=>b.classList.remove(move,'happy'), cheer?1400:900);
}
// added a shop / went somewhere: the だるま is happy (and says so next time you look at home)
function darumaCheer(msg){ if(msg) dmSay=msg; darumaDo(dmEl,'hop',true); }
// small idle life: blink often, wobble now and then
setInterval(()=>{ if(!dmEl || !dmEl.isConnected || document.hidden || dmEl.classList.contains('sleep')) return;
  darumaDo(dmEl, Math.random()<.75?'blink':'wobble'); }, 4200);

// 設定: build your だるま (like ますせん's キャラ作り). folded at first; every pick is saved right away.
// the preview only hops on a pick (no smile) so you can see what changed
let dmOpen=false;
function darumaMaker(box){
  const pv=el('button','daruma dm-prev'); pv.type='button'; pv.setAttribute('aria-label','プレビュー(押すと揺れます)');
  pv.onclick=()=>darumaDo(pv,'wobble');
  const fold=el('button','dm-fold'); fold.type='button'; fold.setAttribute('aria-expanded',String(dmOpen));
  fold.append(el('span',null,'見た目を変える'), el('span','dm-fi','▾'));
  const top=el('div','dm-mtop'); top.append(pv,fold);
  const body=el('div','dm-mbody'); body.hidden=!dmOpen;
  fold.onclick=()=>{ dmOpen=!dmOpen; body.hidden=!dmOpen; fold.setAttribute('aria-expanded',String(dmOpen)); };
  const pick=c=>{ saveDm(c); draw(); darumaDo(pv,'hop'); };
  const draw=()=>{
    pv.innerHTML=darumaSvg(dmCfg); body.textContent='';
    const pre=el('div','dm-pre');
    for (const [l,c] of DM_PRESETS){ const b=el('button','sbtn',l); b.type='button'; b.onclick=()=>pick({...c}); pre.appendChild(b); }
    const rnd=el('button','sbtn','🎲 おまかせ'); rnd.type='button';
    rnd.onclick=()=>{ const c={}; for(const [k,p] of Object.entries(DM_PARTS)){ const ks=Object.keys(p.opts); c[k]=ks[Math.floor(Math.random()*ks.length)]; } pick(c); };
    pre.appendChild(rnd); body.appendChild(pre);
    const parts=el('div','dm-parts');
    for (const [k,p] of Object.entries(DM_PARTS)){
      const row=el('div','dm-prow'); row.appendChild(el('span','dm-pl',p.label));
      const ch=el('div','chips'+(p.color?' dm-colors':'')); ch.setAttribute('role','radiogroup'); ch.setAttribute('aria-label',p.label);
      for (const [v,o] of Object.entries(p.opts)){
        const on=dmCfg[k]===v;
        const b=el('button', p.color?'dm-sw':'chip', p.color?null:o); b.type='button';
        b.setAttribute('role','radio'); b.setAttribute('aria-checked',String(on)); if(!p.color) b.setAttribute('aria-pressed',String(on));
        if (p.color){ b.style.background=o[0]; b.setAttribute('aria-label',v); }
        b.onclick=()=>pick({...dmCfg,[k]:v});
        ch.appendChild(b); }
      row.appendChild(ch); parts.appendChild(row);
    }
    body.appendChild(parts);
  };
  box.append(top,body); draw();
}

