/* 生成 data/art.js：30 张滋味插画的两套 data URI。
   跑法：node design-demos/art-gen.mjs

   为什么要有这个脚本：art.js 原来是手工跑出来的，规则只活在注释里。
   现在牌面要米白纸版、首页要深底版，两套都得能重新生成，规则必须落成代码。

   ── 三条规则，都是踩出来的 ──

   1 摘掉 filter="url(#…)" 属性，但不删元素。
     feTurbulence 的 filter 区域是 -10%~120%，SVG 当 background-image 渲染时
     那块区域会被填成一个可见矩形（内联 <svg> 不会，所以预览里看不出来）。
     第一版把整个 <g filter=…> 删掉了，结果连碗一起删了——那层 g 里不只有颗粒。

   2 paper 版要额外删掉最上面那层高光 g。
     card-gen 的最后一层是「把主体用近白色再画一遍，靠 filter 打成颗粒」。
     filter 一摘，它就成了一层实心的近白色覆盖：深底上那是提亮（现在深底版
     好看有它一份），米白纸上那是把整张画洗白。所以 paper 版只能去掉。
     代价是 paper 版没有油墨颗粒，只剩干净色块——纸底本身就有纸纹，够了。

   3 用 encodeURIComponent 不用 base64（SVG 是文本，URI 编码后小三成），
     坐标压到 2 位小数（生成器吐的是 17 位浮点，纯浪费，占三成体积）。 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { draw } from './card-gen.mjs';

const require = createRequire(import.meta.url);
const R = path.resolve(import.meta.dirname, '..');
const D = require(R + '/data/daily.js');

/* 摘 filter 属性：属性形式 filter="url(#x)" 和内联 style 里的 filter:url(#x) 都有。
   顺手把 <defs> 里那条已经没人引用的 filter 定义也清掉——留着既是死重量
   （每张 ~0.5K），也怕哪天渲染器自作主张把它画出来。 */
const stripFilter = (s) => s
  .replace(/\s*filter="url\(#[^)]*\)"/g, '')
  .replace(/\s*style="filter:url\(#[^)]*\)"/g, '')
  .replace(/<filter\b[\s\S]*?<\/filter>/g, '');

/* 删掉最上面那层高光 g：它是 draw() 生成的最后一个顶层 <g …opacity="…">…</g>，
   紧跟在 texture() 后面、</g></svg> 前面。按括号配对从后往前找，不用正则啃嵌套。 */
function dropHighlight(svg) {
  const open = svg.lastIndexOf('<g filter="url(#');
  if (open < 0) return svg;
  let depth = 0, i = open;
  const tag = /<\/?g\b[^>]*>/g;
  tag.lastIndex = open;
  let m;
  while ((m = tag.exec(svg))) {
    depth += m[0][1] === '/' ? -1 : 1;
    if (depth === 0) { i = m.index + m[0].length; break; }
  }
  return svg.slice(0, open) + svg.slice(i);
}

/* 坐标压成 2 位小数。只动纯数字，不碰 #hex、不碰 url(#id) */
const round = (s) => s.replace(/\d+\.\d{3,}/g, (n) => String(Math.round(+n * 100) / 100));

const build = (food, mode) => {
  let svg = draw(food, mode);
  if (mode === 'paper') svg = dropHighlight(svg);
  return 'data:image/svg+xml,' + encodeURIComponent(round(stripFilter(svg)).replace(/\n/g, ''));
};

const foods = D.taste.map((t) => t.food);
const set = (mode) => foods.map((f) => `  ${JSON.stringify(f)}: ${JSON.stringify(build(f, mode))},`).join('\n');

const out = `/* 由 design-demos/art-gen.mjs 生成，不要手改。规则和踩过的坑都写在那个脚本里。

   ART        深底版：首页那张滋味卡、色带。插画直接落在 #171310 上，靠光晕托。
   ART_PAPER  米白纸版：牌面（taste-card 屏）那张纸上印的插画。
              见 design-demos/滋味卡-完整30张.html —— 那是这套画法的原生语境。 */
const ART = {
${set('dark')}
};
const ART_PAPER = {
${set('paper')}
};
module.exports = {
  ART, ART_PAPER,
  of: (food) => ART[food] || '',
  paper: (food) => ART_PAPER[food] || '',
};
`;
fs.writeFileSync(R + '/data/art.js', out);
const k = (n) => (n / 1024).toFixed(0) + 'K';
console.log(`data/art.js  ${foods.length} 张 ×2 套  ${k(Buffer.byteLength(out))}`);
