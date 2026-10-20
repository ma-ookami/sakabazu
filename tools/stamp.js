// sakabazu.html の css/js の ?v= を、各ファイルの中身のハッシュにそろえる。
// 変えたファイルだけ印が変わるので、ほかのファイルはキャッシュがそのまま効く。
// 使い方: node tools/stamp.js   (コミットの前に実行)
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.join(__dirname,'..'), file=path.join(root,'sakabazu.html');
let n=0;
const out=fs.readFileSync(file,'utf8').replace(/((?:src|href)=")((?:css\/|js\/)?[\w.\-\/]+\.(?:js|css))\?v=[\w]+(")/g,(m,a,u,c)=>{
  const p=path.join(root,u); if(!fs.existsSync(p)) return m;
  const h=crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex').slice(0,8); n++;
  return `${a}${u}?v=${h}${c}`; });
fs.writeFileSync(file,out); console.log('stamped',n,'files');
