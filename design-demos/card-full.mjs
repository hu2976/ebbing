// 滋味卡完整状态 · 米白纸牌
// 插画走 paper 主题（减法颗粒＋深色细线），这是这套画法的原生语境
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { draw } from './card-gen.mjs';
const require = createRequire(import.meta.url);
const R = path.resolve(import.meta.dirname, '../04-小程序');
const D = require(R + '/data/daily.js');

const W = 328, H = 460;                        // 5:7
const famOf = (() => {
  const m = {};
  for (const [fam, list] of Object.entries(D.cardTexFam)) for (const f of list) m[f] = fam;
  return f => m[f] || 'soft';
})();
const inner = svg => svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

const cards = D.taste.map((t, i) => {
  const art = draw(t.food, 'paper');           // ← 米白主题
  const [deep, lit] = D.cardHue[t.food] || ['#6F5A3D', '#C4B08A'];
  const mid = '#' + [0, 2, 4].map(k => {
    const x = Math.round((parseInt(deep.substr(1 + k, 2), 16) + parseInt(lit.substr(1 + k, 2), 16)) / 2);
    return x.toString(16).padStart(2, '0');
  }).join('');
  return `
<figure class=card>
  <div class=face>
    <div class=top>
      <div class=chips><i style="background:${lit}"></i><i style="background:${mid}"></i><i style="background:${deep}"></i></div>
      <div class=no>NO. ${String(i + 1).padStart(2, '0')}</div>
    </div>
    <div class=art><svg viewBox="0 0 340 262">${inner(art)}</svg></div>
    <h2>${t.food}</h2>
    <div class=rule></div>
    <p>${t.desc}</p>
    <div class=foot><span>${famOf(t.food)}</span><span>TUICHAO · TASTE</span></div>
  </div>
</figure>`;
}).join('\n');

const html = `<!doctype html><html lang="zh"><meta charset="utf-8">
<title>退潮 · 滋味卡 30 张</title>
<style>
:root{
  --ink:#2E2418;          /* 名字：深褐，不用纯黑 */
  --ink2:#5A5142;         /* 描述 */
  --ink3:#8F8571;         /* 标注 */
  --paper:#F5F1E8;        /* 纸：象牙白，不是纯白 —— 纯白会让颗粒读成脏 */
  --line:#B9AC90;
  --serif:"Songti SC","Noto Serif CJK SC","Source Han Serif SC",serif;
  --sans:-apple-system,"PingFang SC","Source Han Sans SC",sans-serif;
  --mono:"IBM Plex Mono",ui-monospace,Menlo,monospace;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#141210;font-family:var(--sans);color:#E8E0D2;padding:40px 34px 64px;
     -webkit-font-smoothing:antialiased}
header{max-width:1180px;margin:0 auto 32px}
h1{font-size:23px;font-weight:600;margin:0 0 7px;letter-spacing:.02em}
.sub{font-size:13px;color:#8F8571;line-height:1.75;max-width:900px}
.sub b{color:#C9A063;font-weight:500}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(${W}px,1fr));gap:28px;
      max-width:1180px;margin:0 auto;justify-items:center}
.card{margin:0}

/* ══ 牌面：米白纸 ＋ 纸纹。这套插画的原生语境 ══ */
.face{width:${W}px;height:${H}px;border-radius:10px;position:relative;overflow:hidden;
      padding:16px 22px 16px;display:flex;flex-direction:column;
      background-color:var(--paper);
      background-image:radial-gradient(circle,#00000009 .5px,transparent .6px),
                       radial-gradient(circle,#00000006 .5px,transparent .6px);
      background-size:4px 4px,7px 6px;background-position:0 0,2px 3px;
      box-shadow:0 14px 30px #00000075, 0 1px 0 #ffffff30 inset}

.top{display:flex;align-items:flex-start;justify-content:space-between}
/* 色板条：取自这道菜的 cardHue，参考图里的那个小细节 */
.chips{display:flex;flex-direction:column;gap:2px}
.chips i{width:11px;height:11px;display:block}
.no{font-family:var(--mono);font-size:9.5px;letter-spacing:.18em;color:var(--ink3)}

.art{height:206px;margin:0}
.art svg{width:100%;height:100%;display:block}

/* 名字：宋体。米白底上宋体是书卷气；深色底上大号宋体才是悬疑片字幕 */
h2{font-family:var(--serif);font-size:30px;font-weight:600;color:var(--ink);
   text-align:center;letter-spacing:.06em;line-height:1.25;margin:2px 0 0}
.rule{height:8px;margin:12px 30px 13px;opacity:.55;
  background:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='8'><path d='M2 5 C22 2, 40 6.4, 62 4 S104 1.8, 126 4.6 S168 6.8, 190 3.8 S226 2, 238 4.6' fill='none' stroke='%23A8996F' stroke-width='1.2' stroke-linecap='round'/></svg>") no-repeat center/contain}
/* 描述：黑体。衬线配无衬线才是对比，两款宋体挨着是冲突 */
p{font-family:var(--sans);font-size:13.5px;line-height:2;color:var(--ink2);
  text-align:justify;letter-spacing:.008em;flex:1}
.foot{display:flex;justify-content:space-between;align-items:baseline;
      font-family:var(--mono);font-size:8.5px;letter-spacing:.14em;color:var(--ink3);opacity:.72}
</style>

<header>
  <h1>退潮 · 滋味卡 30 张</h1>
  <p class=sub>米白纸牌 · 插画走 <b>paper</b> 主题（减法颗粒：噪点把色块打孔露出纸，这是丝网印的原理；深色底必须反过来用加法）·
  名字宋体、描述黑体，衬线配无衬线 · 色板条取自这道菜的 <b>cardHue</b> ·
  描述逐字取自 <b>daily.js</b> 的 taste</p>
</header>
<div class=grid>
${cards}
</div>
</html>`;

const a = path.resolve(import.meta.dirname, '滋味卡-完整30张.html');
const b = path.resolve(R, '..', '09-设计-滋味卡三十张.html');
fs.writeFileSync(a, html);
fs.writeFileSync(b, html);
console.log('写出:\n  ' + a + '\n  ' + b);
