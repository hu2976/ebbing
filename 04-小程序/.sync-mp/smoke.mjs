/* 真跑一遍 draw()：mock 掉 wx 与 Page，把每个屏态过一次完整渲染路径。
   为什么需要这个：chk.mjs 是静态检查，它验过"块型全覆盖""无死链""draw 调用的
   函数都有定义"，却放过了一次白屏——applyDaily 内部调的 rich 被删了，
   静态检查只看 draw() 自己的函数体，看不到二层调用。
   而白屏的表现是"整屏只剩返回键"，因为异常发生在 setData 之前。

   跑法：node .sync-mp/smoke.mjs [--care] */
import { createRequire } from 'module';
import path from 'path';
const require = createRequire(import.meta.url);
const R = path.resolve(import.meta.dirname, '..');
const CARE = process.argv.includes('--care');

/* 只 mock 到"能跑通渲染"为止，不做完整的 wx 仿真。
   ⚠️ 存储必须是真能写的：原来 getStorageSync 恒返回 null、set 什么都不做，
   于是 data/log.js 一条记录也存不下，情绪瓶子在这里永远是空的——
   而"整罐倒进去"和"点一颗球"这两条路都要先有球。 */
const MEM = {};
globalThis.wx = {
  getStorageSync: (k) => (k in MEM ? MEM[k] : ''),
  setStorageSync: (k, v) => { MEM[k] = v; },
  setStorage: (o) => { if (o && o.key !== undefined) MEM[o.key] = o.data; },
  getSystemInfoSync: () => ({ statusBarHeight: 54, pixelRatio: 2 }),
  createSelectorQuery: () => ({ in: () => ({ select: () => ({ fields: () => ({ exec: () => {} }) }) }) }),
  pageScrollTo: () => {}, createOffscreenCanvas: () => null,
};
let page = null;
globalThis.Page = (o) => { page = o; };
require(R + '/pages/index/index.js');
if (!page) { console.error('✗ index.js 没有调用 Page()'); process.exit(1); }

const D = require(R + (CARE ? '/data/care.js' : '/data/screens.js'));
const ctx = Object.assign({}, page, {
  data: { seq: 0, blocks: [] },
  setData(o, cb) { Object.assign(this.data, o); if (cb) try { cb(); } catch (e) { /* 回调里是 canvas，跳过 */ } },
  stack: [], cur: 'entry', newball: -1, recolor: -1, mealIdx: null, writeBuf: '',
  care: CARE,
  stopTide() {}, startTide() {}, drawMat() {}, startOnline() {},
});

/* D 是模块级变量，在 onLoad 里按启动参数定一次——所以必须先跑 onLoad，
   否则照护者端的屏 id 会去患者端的 SCREENS 里查，查不到就静默返回、渲染出 0 个块。 */
const bad = [];
try { ctx.onLoad.call(ctx, CARE ? { role: 'care' } : {}); } catch (e) { bad.push(`onLoad() → ${e.message}`); }
let ok = 0;
for (const id of Object.keys(D.SCREENS)) {
  for (const c of (!CARE && id === 'home' ? ['day', 'risk', 'night'] : ['day'])) {
    D.CLOCK = c; ctx.cur = id; ctx.data.blocks = [];
    try {
      ctx.draw.call(ctx);
      /* 空 blocks 也算故障：那正是白屏的样子 */
      if (!ctx.data.blocks.length) bad.push(`${id}·${c} 渲染出 0 个块`);
      else ok += 1;
    } catch (e) { bad.push(`${id}·${c} → ${e.message}`); }
  }
}
/* 交互入口也要能调，不然点了才炸 */
const taps = [['tapCell', { currentTarget: { dataset: { i: 0 } } }],
  ['tapWord', { currentTarget: { dataset: { w: '平静' } } }],
  ['toggleMore', {}], ['toggleSw', { currentTarget: { dataset: { i: 0 } } }],
  ['tapStar', { currentTarget: { dataset: { day: '2026-08-20', label: '凑合' } } }],
  ['back', {}]];
for (const [fn, ev] of taps) {
  if (typeof ctx[fn] !== 'function') { bad.push(`没有 ${fn}`); continue; }
  try { ctx.data.blocks = [{ k: 'sw', t: '声音', on: false }]; ctx[fn].call(ctx, ev); } catch (e) {
    if (!/Cannot read/.test(e.message)) bad.push(`${fn}() → ${e.message}`);
  }
}
/* 同一天，首页那张滋味卡和点进去的完整卡片必须是同一条食物。
   加这条是因为真出过：mergeTaste 先把 ti+food 合并成 taste 块，
   applyDaily 再找 food 就找不到了，于是首页停在原型写死的那条，
   卡片屏走当日那条——首页「烤红薯」，点进去「韭菜盒子」。 */
if (!CARE) {
  const DAILY = require(R + '/data/daily.js');
  const want = DAILY.pick(DAILY.taste);
  D.CLOCK = 'day'; ctx.cur = 'home'; ctx.data.blocks = [];
  try { ctx.draw.call(ctx); } catch (e) { bad.push('home 渲染失败 ' + e.message); }
  const tb = ctx.data.blocks.find((b) => b.k === 'taste');
  ctx.cur = 'taste-card'; ctx.data.blocks = [];
  try { ctx.draw.call(ctx); } catch (e) { bad.push('taste-card 渲染失败 ' + e.message); }
  const cb = ctx.data.blocks.find((b) => b.k === 'card');
  if (!tb || !cb) bad.push('滋味卡块没找到');
  else if (!String(tb.food).includes(want.food) || cb.food !== want.food) {
    bad.push(`滋味卡不一致：今天应是「${want.food}」，首页「${tb.food}」，卡片「${cb.food}」`);
  }
}

/* ── 情绪瓶子 ────────────────────────────────────────────────
   珠子现在画在 canvas 里、位置每帧由物理解算（data/jar.js 的 step），
   startJar 要真的 canvas 节点，在 node 里跑不了。所以分两头验：
   物理直接验解算器，交互验 showDay / toggleSlip / 位置落盘。
   要验的就是她提的那三件：有重力（会落到底并停住）、
   跟着手机晃（换重力方向珠子会挪过去）、位置是存着的（落盘再读回来还在）。 */
if (!CARE) {
  const JARM = require(R + '/data/jar.js');
  const LOGM = require(R + '/data/log.js');
  const j = Object.assign({}, ctx, { showDay: page.showDay, toggleSlip: page.toggleSlip });
  try {
    const R0 = 111, d = JARM.fitD(11, R0), r = d / 2;
    const B = Array.from({ length: 11 }, (_, i) => ({
      x: (JARM.rnd(i, 21) - 0.5) * R0 * 0.5, y: -R0 - d * (1 + i * 0.62), vx: 0, vy: 0 }));
    for (let f = 0; f < 520; f++) JARM.step(B, r, R0, 0, 1500, 1 / 60);
    /* 入罐不许被弹射。她的原话：「情绪玻璃珠清脆的掉进去，不要弹射进去」。
       病根是出生点写在了罐外（y = −R − d）：容器约束第 0 帧就把珠子瞬移到内壁，
       而速度是 (x − px) / dt 回写的，那段瞬移被当成一帧走完 → vy 炸到自由落体的四倍。 */
    const top = -(R0 - r) + 1;
    const one = [{ x: 0, y: top, vx: 0, vy: 0 }];
    JARM.step(one, r, R0, 0, 1500, 1 / 60);
    const free = 1500 / 60;
    if (Math.abs(one[0].vy) > free * 3) {
      bad.push(`珠子入罐被弹射了：第一帧 vy=${one[0].vy.toFixed(0)}，自由落体只该有 ${free.toFixed(0)}`);
    }
    /* 落地不许反弹。玻璃珠是"嗒"一下就停 */
    const drop = [{ x: 0, y: top, vx: 0, vy: 0 }];
    let prevY0 = drop[0].y, ups = 0;
    for (let f = 0; f < 220; f++) {
      JARM.step(drop, r, R0, 0, 1500, 1 / 60);
      if (drop[0].y < prevY0 - 0.3) ups += 1;
      prevY0 = drop[0].y;
    }
    if (ups) bad.push(`珠子落地反弹了 ${ups} 帧，应该落地就停`);

    if (!B.every((b) => Math.hypot(b.x, b.y) <= R0 - r + 0.5)) bad.push('有珠子跑出罐壁了');
    if (!B.every((b) => Math.hypot(b.vx, b.vy) < 6)) bad.push('珠子落定之后还在动（阻尼不够）');
    /* 两两不许穿透 */
    for (let i = 0; i < B.length; i++) {
      for (let k = i + 1; k < B.length; k++) {
        if (Math.hypot(B[i].x - B[k].x, B[i].y - B[k].y) < d - 0.6) { bad.push('两颗珠子叠在一起了'); i = B.length; break; }
      }
    }
    if (!(B.reduce((m, b) => Math.max(m, b.y), -999) > R0 * 0.4)) bad.push('重力方向不对：珠子没落到罐底');
    /* 把手机转 90°：重力朝右，珠子应该挪到右壁 */
    const midY = B.reduce((t, b) => t + b.y, 0) / B.length;
    for (const b of B) { b.vx = 0; b.vy = 0; }
    for (let f = 0; f < 520; f++) JARM.step(B, r, R0, 1500, 0, 1 / 60);
    if (!(B.reduce((m, b) => Math.max(m, b.x), -999) > R0 * 0.4)) bad.push('换重力方向后珠子没跟着挪（晃动无效）');
    if (Math.abs(B.reduce((t, b) => t + b.y, 0) / B.length - midY) < 1) bad.push('换重力方向后 y 没变，物理没在跑');

    /* 位置落盘再读回来 */
    LOGM.setJarPos({ '2026-08-20': [0.5, -0.25] });
    const back = LOGM.jarPos()['2026-08-20'];
    if (!back || back[0] !== 0.5 || back[1] !== -0.25) bad.push('珠子的位置存不住');

    /* 点一颗球那一路 */
    const day = LOGM.balls(D.HUE).slice(-1)[0].day;
    j.showDay(day);
    const pk = j.data.pick;
    if (!pk) bad.push('点一颗球没给出那一天');
    else {
      if (!pk.theme) bad.push('点球没算出主题词');
      if (pk.slots.length !== 6) bad.push(`纸条应该是六行，实际 ${pk.slots.length} 行`);
    }
    j.toggleSlip();
    if (!j.data.slipOpen) bad.push('「展开看看」展不开');
  } catch (e) { bad.push('情绪瓶子 → ' + e.message); }
}

console.log(`${CARE ? '照护者端' : '患者端'}　跑通 ${ok} 个屏态`);
console.log(bad.length ? '✗ ' + bad.join('\n  ') : '✓ 每屏都渲染出内容，交互入口都能调');
process.exit(bad.length ? 1 : 0);
