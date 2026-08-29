/* 从 02-可交互原型.html 生成小程序的数据与样式。
   屏级文字与样式的唯一源仍是原型——这里只抽，不抄。 */
import fs from 'fs';
const SRC='/Users/hujinghan/Desktop/搓点有趣的/退潮/01-Demo-可交互原型.html';
const OUT='/Users/hujinghan/Desktop/搓点有趣的/退潮/04-小程序';
const html=fs.readFileSync(SRC,'utf8');

/* ── 1. 抽 SCREENS 段（词与颜色 → SCREENS 结束） ───────────────── */
const js=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const a=js.indexOf('/* ══════════ 词与颜色');
const b=js.indexOf('/* ══════════ 渲染');
if(a<0||b<0) throw new Error('抽 SCREENS 失败：原型里的分节注释变了');
const seg=js.slice(a,b).trimEnd().replace(/,\s*};\s*$/,'\n};');

fs.writeFileSync(OUT+'/data/screens.js',
`/* 本文件由 .sync-mp/gen.mjs 生成，不要手改。
   源：02-给UI-可交互原型.html */
let CLOCK='night', PICK='说不上来', LAST=null;
${seg}
module.exports={
  SCREENS, HUE, col, colDim, MOOD, RISK, TASTE, ALL, SEED,
  get LOG(){return LOG}, set LOG(v){LOG=v},
  get CLOCK(){return CLOCK}, set CLOCK(v){CLOCK=v},
  get PICK(){return PICK}, set PICK(v){PICK=v},
  get LAST(){return LAST}, set LAST(v){LAST=v},
};
`);

/* ── 2. 视觉 tokens 抽自设计画布（warm-night）。 ────────────────
   文案的唯一源是原型 02，视觉的唯一源是设计画布——两件事两个源。
   屏内块型样式手写在 index.wxss：设计画布只画了 10 屏，其余 26 屏的块型
   要按设计系统推广，那是判断不是转换，不能生成。 */
const DS='/Users/hujinghan/Desktop/搓点有趣的/退潮/_工作过程/设计画布/System.dc.html';
const ds=fs.readFileSync(DS,'utf8');
const tokens=ds.match(/:root\{[\s\S]*?\}/)[0].replace(':root{','page{');
fs.writeFileSync(OUT+'/pages/index/tokens.wxss',
`/* 本文件由 .sync-mp/gen.mjs 生成，不要手改。
   源：设计画布/System.dc.html（视觉唯一源）*/
${tokens}
/* 原型/画布里 body 与 * 那两条全局基础层。少了 color 的症状是"文案不见了"，
   少了 box-sizing 的症状是"边框显示不全"——两个都踩过。 */
page{ background:var(--n1); color:var(--paper); font-family:var(--body);
      -webkit-font-smoothing:antialiased; }
view, text, rich-text, canvas, image{ box-sizing:border-box; }
`);
console.log('tokens 已抽:', tokens.match(/--[a-z0-9]+/g).length, '个');

/* ── 3. 静态检查：块型覆盖 + 死链 ──────────────────────────────── */
globalThis.document={getElementById:()=>({innerHTML:'',scrollTop:0}),createElement:()=>({style:{},setAttribute(){}}),querySelectorAll:()=>[]};
globalThis.matchMedia=()=>({matches:false});
globalThis.requestAnimationFrame=()=>0; globalThis.cancelAnimationFrame=()=>{};
const m=await import('data:text/javascript,'+encodeURIComponent(
  js.replace("go('entry',false);",'')+'\nexport{SCREENS};\nexport function setClock(c){CLOCK=c}\nexport function setPick(p){PICK=p}'));

/* 代码生成的那些屏（七张反应卡、gate 七种建议、two 两支）也要挂上，
   否则指过去的入口会被报成死链。挂载只写在 data/runtime-screens.js。 */
const { createRequire } = await import('module');
createRequire(import.meta.url)(OUT + '/data/runtime-screens.js').patient(m.SCREENS);

const kinds=new Set(), links=[];
for(const [id,s] of Object.entries(m.SCREENS)){
  const states = id==='home' ? ['day','risk','night']
               : id==='eat'  ? ['热乎乎的','冰冰凉的','软的、好咽的','有嚼头的','说不上来'] : [null];
  for(const st of states){
    if(id==='home') m.setClock(st); if(id==='eat') m.setPick(st);
    for(const blk of s.body()){
      kinds.add(blk[0]);
      const t = blk[0]==='q'?blk[2] : blk[0]==='b'?blk[3] : blk[0]==='bbig'?blk[2]
              : blk[0]==='cellsGo'?blk[2] : null;
      if(t) links.push([id,t]);
      if(blk[0]==='pair2'||blk[0]==='foot') blk.slice(1).forEach(x=>links.push([id,x[1]]));
    }
  }
  m.setClock('night'); m.setPick('说不上来');
}
const rd=f=>fs.existsSync(OUT+f)?fs.readFileSync(OUT+f,'utf8'):'';
const wxml=rd('/pages/index/index.wxml')+rd('/pages/index/index.js');
const miss=[...kinds].filter(k=>!wxml.includes(`'${k}'`));
const dead=links.filter(([,t])=>t&&!m.SCREENS[t]);
console.log('屏数',Object.keys(m.SCREENS).length,'／块型',kinds.size,[...kinds].sort().join(' '));
console.log(miss.length?'✗ WXML 未覆盖的块型: '+miss.join(' '):'✓ 块型全覆盖');
console.log(dead.length?'✗ 死链: '+dead.map(x=>x.join('→')).join(', '):'✓ 无死链');
