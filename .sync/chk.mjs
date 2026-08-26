import fs from 'fs';
const h=fs.readFileSync('/Users/hujinghan/Desktop/搓点有趣的/黑客松/02-给UI-可交互原型.html','utf8');
let src=h.match(/<script>([\s\S]*?)<\/script>/)[1].replace("go('entry',false);",'');
const stub={querySelectorAll:()=>[],innerHTML:'',scrollTop:0,textContent:''};
globalThis.document={getElementById:()=>null,createElement:()=>({style:{},setAttribute(){}}),
  querySelectorAll:()=>[]};
globalThis.document.getElementById=id=>id==='view'?{...stub,innerHTML:''}:null;
globalThis.matchMedia=()=>({matches:false});
globalThis.requestAnimationFrame=()=>0; globalThis.cancelAnimationFrame=()=>{};
let mod;
try{ mod=await import('data:text/javascript,'+encodeURIComponent(src+'\nexport{SCREENS,ALL,HUE,pile,fitD};\nexport function setClock(c){CLOCK=c}')); }
catch(e){ console.log('!! JS 语法/运行错误:',e.message); process.exit(1) }
const {SCREENS,ALL,HUE,pile,fitD,setClock}=mod;
const ids=new Set(Object.keys(SCREENS));
const targets=b=>{const o=[];
  if(b[0]==='q')o.push(b[2]); if(b[0]==='b')o.push(b[3]); if(b[0]==='bbig')o.push(b[2]);
  if(b[0]==='cellsGo')o.push(b[2]);
  if(b[0]==='foot')b.slice(1).forEach(x=>o.push(x[1]));
  if(b[0]==='pair2')b.slice(1).forEach(x=>o.push(x[1]));
  if(b[0]==='words')o.push('logged');
  if(b[0]==='pick')o.push('eat');
  return o.filter(Boolean);};
console.log('屏数:',ids.size);
let bad=[];
for(const c of ['day','risk','night']){ setClock(c);
  for(const [k,s] of Object.entries(SCREENS)){
    let bl; try{ bl=s.body() }catch(e){ bad.push('body错 '+k+': '+e.message); continue }
    for(const b of bl) for(const t of targets(b)) if(!ids.has(t)) bad.push(c+' '+k+' → '+t);
  }}
for(const [k,s] of Object.entries(SCREENS)) if(s.back&&!ids.has(s.back)) bad.push(k+' back→'+s.back);
console.log('死链:',bad.length?[...new Set(bad)]:'无');
const reach=new Set(['entry']); let grow=true;
while(grow){ grow=false;
  for(const c of ['day','risk','night']){ setClock(c);
    for(const k of [...reach]) for(const b of SCREENS[k].body()) for(const t of targets(b))
      if(ids.has(t)&&!reach.has(t)){reach.add(t);grow=true} }}
console.log('到不了的屏:',[...ids].filter(x=>!reach.has(x)));
// 块型是否都有渲染分支
const kinds=new Set();
for(const c of ['day','risk','night']){ setClock(c);
  for(const s of Object.values(SCREENS)) for(const b of s.body()) kinds.add(b[0]); }
const rendered=new Set([...h.matchAll(/case '(\w+)':/g)].map(m=>m[1]));
console.log('块型:',[...kinds].sort().join(' '));
console.log('没有渲染分支的块型:',[...kinds].filter(k=>!rendered.has(k)));
