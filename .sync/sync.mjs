import fs from 'fs';
const P='/Users/hujinghan/Desktop/搓点有趣的/黑客松/02-给UI-可交互原型.html';
let src=fs.readFileSync(P,'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace("go('entry',false);",'');
const stub={querySelectorAll:()=>[],innerHTML:'',scrollTop:0,textContent:''};
globalThis.document={getElementById:id=>id==='view'?{...stub}:null,createElement:()=>({style:{},setAttribute(){}}),querySelectorAll:()=>[]};
globalThis.matchMedia=()=>({matches:false});
globalThis.requestAnimationFrame=()=>0; globalThis.cancelAnimationFrame=()=>{};
const m=await import('data:text/javascript,'+encodeURIComponent(
  src+'\nexport{SCREENS};\nexport function setClock(c){CLOCK=c}\nexport function setPick(p){PICK=p}'));

/* 原型块型 → 定稿册块型。演示控件不进定稿册。 */
const SKIP=new Set(['clockbar']);
function conv(b){
  const [k,...a]=b;
  if(SKIP.has(k)) return null;
  switch(k){
    case 'dim':     return ['spec',a[0]];              // 原型的 dim 是设计注 → 定稿册的 spec
    case 'food':    return ['ti2',a[0]];
    case 'b':       return ['bb',a[0],a[1]];           // 去掉跳转目标
    case 'bbig':    return ['bbig',a[0]];
    case 'q':       return ['q',a[0]];
    case 'cellsGo': return ['cells',a[0]];
    case 'pair2':   return ['pair',a[0][0],a[1][0]];
    case 'foot':    return ['foot',a[0][0],a[1][0]];
    case 'words':   return ['words',...a[0]];
    case 'pick':    return ['pick',...a];
    default:        return [k,...a];
  }
}
const out={};
for(const [key,s] of Object.entries(m.SCREENS)){
  const variants={};
  if(key==='home'){ for(const c of ['day','risk','night']){ m.setClock(c);
      variants[c]=s.body().map(conv).filter(Boolean); } }
  else if(key==='eat'){ for(const p of ['热乎乎的','冰冰凉的','软的、好咽的','有嚼头的','说不上来']){
      m.setPick(p); variants[p]=s.body().map(conv).filter(Boolean); } }
  else { m.setClock('night'); variants['_']=s.body().map(conv).filter(Boolean); }
  out[key]={sid:s.sid,variants};
}
fs.writeFileSync('/private/tmp/claude-501/-Users-hujinghan/305cc15b-a2d4-4ab0-a09b-7203962de40f/scratchpad/screens.json',
  JSON.stringify(out,null,1));
console.log('导出',Object.keys(out).length,'屏');
console.log('块型:',[...new Set(Object.values(out).flatMap(o=>Object.values(o.variants).flat().map(b=>b[0])))].sort().join(' '));
