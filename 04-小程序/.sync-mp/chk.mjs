/* 小程序自检：每个块都有 prep 分支、每个块型都有 WXML 分支、无死链。
   跑法：node .sync-mp/chk.mjs（先跑 gen.mjs） */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const R = path.resolve(import.meta.dirname, '..');
const D = (await import(R + '/data/screens.js')).default
       || require(R + '/data/screens.js');   // CJS 模块
/* 有几组屏是代码生成的（七张反应卡、gate 七种建议、two 两支），静态数据里没有。
   挂载只写在 data/runtime-screens.js，这里调它——抄五遍必漏。 */
require(R + '/data/runtime-screens.js').patient(D.SCREENS);
const src = fs.readFileSync(R + '/pages/index/index.js', 'utf8');
const body = src.match(/prep\(b\) \{[\s\S]*?\n  \},/)[0]
  .replace(/^prep\(b\) \{/, '').replace(/\},$/, '').replace(/this\.cur/g, 'cur');
/* prep 的函数体是抽出来单独跑的，所以它引用的东西必须在作用域里。
   前两版都是"手工／半自动列一份清单"，两次都漏：
     v1 手写一行 LOGD → 加 DAILY 时 ReferenceError
     v2 自动扫 require + 大写对象字面量 → 加 skyLayout（一个 function 声明）时又炸
   清单这条路走不通：index.js 顶层随时会多一个 helper，而漏了的症状是自检报错，
   不是自检漏过——每次都得回来改这里。
   现在不列清单了：把 index.js 从头到 Page({ 之前**整段**当序言求值，
   prep 在那个作用域里定义。以后顶层加什么，prep 都拿得到。
   唯一要动的是相对 require —— 那是相对 index.js 写的，从这里跑要重定位。 */
const head = src.slice(0, src.indexOf('Page({'))
  .replace(/require\('\.\.\/\.\.\//g, "require(RR + '/");
const rich = (t) => String(t).replace(/var\(--cool\)/g, '#7FBDA9');
const prep = new Function('require', 'RR', `
  ${head}
  /* 序言里的 D 是 let（index.js 在 onLoad 里按端切它），所以这里能改写成传进来的那份 */
  return function (_D, cur, b) { D = _D; ${body} };
`)(require, R);

/* prep 故意返回 null 的块型：dim/clockbar 是不渲染，tide 是提成了屏级环境层
   （position:fixed 铺屏底，见 index.js 的 TIDE 与 index.wxss 的 .tide-bg）。 */
const NOFLOW = ['dim', 'clockbar', 'tide'];
let n = 0; const bad = [], dead = [], kinds = new Set();
for (const [id, s] of Object.entries(D.SCREENS)) {
  const states = id === 'home' ? ['day', 'risk', 'night']
    : id === 'eat' ? ['热乎乎的', '冰冰凉的', '软的、好咽的', '有嚼头的', '说不上来'] : [null];
  for (const st of states) {
    if (id === 'home') D.CLOCK = st;
    if (id === 'eat') D.PICK = st;
    D.LAST = '空';
    for (const b of s.body()) {
      n++; kinds.add(b[0]);
      const r = prep.call({ startOnline() {} }, D, id, b);   // prep 里会起在场人数的心跳
      if (!r) { if (!NOFLOW.includes(b[0])) bad.push(id + ':' + b[0]); continue; }
      const tg = [r.go, ...(r.items || []).map((x) => x.go)].filter(Boolean);
      tg.forEach((t) => { if (!D.SCREENS[t]) dead.push(id + '→' + t); });
    }
  }
}
const wxml = fs.readFileSync(R + '/pages/index/index.wxml', 'utf8');
const OFF = ['dim', 'clockbar'];   // 有意不渲染；breath 与 tide 是注入的视觉层，不来自原型
const nocss = [...kinds].filter((k) => !OFF.includes(k) && !wxml.includes(`'${k}'`) && !src.includes(`'${k}'`));
/* 每日轮换内容池的长度约束。home 白天态的余量只够 3 行描述——
   多一行(58rpx)就破版，所以 desc 卡在 60 字。引导词同理，卡在 26 字一行。 */
const DAILY = require(R + '/data/daily.js');
const tooLong = [];
DAILY.taste.forEach((t, i) => {
  if (t.desc && t.desc.length > 60) tooLong.push(`taste[${i}] ${t.food} 描述 ${t.desc.length} 字 > 60`);
  if (t.food && t.food.length > 10) tooLong.push(`taste[${i}] 食物名 ${t.food.length} 字 > 10`);
});
[['mind', DAILY.mind], ['medit', DAILY.medit]].forEach(([n, pool]) => pool.forEach((c, i) => {
  (c.steps || []).forEach((st, k) => {
    if (st.length > 26) tooLong.push(`${n}[${i}].steps[${k}] ${st.length} 字 > 26`);
  });
}));

/* 照护者端：同一个渲染器、另一套数据，所以死链和块型覆盖要单独查一遍。
   另外查两条这一端特有的硬规则。 */
const C = require(R + '/data/care.js');
const cDead = [], cKinds = new Set(), cBad = [];
for (const [id, sc] of Object.entries(C.SCREENS)) {
  for (const b of sc.body()) {
    cKinds.add(b[0]);
    const tg = b[0] === 'q' ? b[2] : b[0] === 'b' ? b[3] : b[0] === 'bbig' ? b[2] : null;
    if (tg && !C.SCREENS[tg]) cDead.push(id + '→' + tg);
    if (b[0] === 'foot') b.slice(1).forEach((x) => { if (!C.SCREENS[x[1]]) cDead.push(id + '→' + x[1]); });
    /* 硬规则一：卡片正文不得出现「你是」——给反应命名，不给人贴标签 */
    if (String(b[1] ?? '').includes('你是')) cBad.push(id + ' 出现「你是」');
  }
}
/* 硬规则二：躯体安全的例外必须走 warn（不折叠）。有 must 的卡都得有一个 warn 块 */
/* 每条课程都要有正文和一个可做的动作——她要的是点进去真的可以看，
   只有标题加一句摘要不算。 */
C.COURSE.forEach((c, i) => {
  if (!c.more) cBad.push(`课程[${i}]「${c.t.slice(0, 12)}」缺正文`);
  if (!c.act) cBad.push(`课程[${i}]「${c.t.slice(0, 12)}」缺可做的动作`);
});
C.CARDS.filter((c) => c.must).forEach((c) => {
  if (!C.SCREENS[c.id].body().some((b) => b[0] === 'warn')) cBad.push(c.id + ' 的「必须动」没走 warn 块');
});
/* 硬规则三：两端硬隔离——照护者端不得引用患者数据 */
const careSrc = fs.readFileSync(R + '/data/care.js', 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');   // 注释里提到不算引用
(careSrc.match(/require\(['"][^'"]+['"]\)/g) || [])
  .filter((r) => /screens|daily/.test(r))
  .forEach((r) => cBad.push('care.js require 了患者端数据 ' + r));
[/\bD\.LOG\b/, /\bHUE\b/, /\bSEED\b/].forEach((re) => {
  if (re.test(careSrc)) cBad.push('care.js 读了患者数据 ' + re.source);
});
const cNoRender = [...cKinds].filter((k) => !OFF.includes(k) && !wxml.includes(`'${k}'`) && !src.includes(`'${k}'`));

/* draw() 里裸调用的函数必须在 index.js 里有定义。
   加这条是因为真出过一次：改 jar.js 时切掉一整段，把 applyDaily 的定义
   连带删了，调用还在、定义没了——语法检查发现不了，只有跑到那一行才炸。 */
const drawM = src.match(/\n  draw\(\) \{[\s\S]*?\n  \},/);
const missFn = [];
if (drawM) {
  const KW = ['if', 'for', 'while', 'return', 'switch', 'typeof', 'require', 'catch', 'function'];
  /* (?<![.\w$]) 挡不住换行后的 `.findIndex(` —— 点在上一行行尾。
     先把所有 `.xxx(` 的成员调用整段抹掉，剩下的才是裸调用。 */
  /* 注释也要先剥掉：draw() 里那句注释写着 `findIndex(k==='food')`，
     结果被当成了一个没定义的裸函数报出来。检查自己的注释——很讽刺但真发生了。 */
  const body2 = drawM[0].slice(drawM[0].indexOf('{'))
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    .replace(/\.\s*[A-Za-z_$][\w$]*\s*\(/g, '.__(');
  [...new Set([...body2.matchAll(/(?<![.\w$])([a-z][A-Za-z0-9_]*)\s*\(/g)].map((m) => m[1]))]
    .filter((fn) => !KW.includes(fn))
    .forEach((fn) => {
      const defined = new RegExp(`(function\\s+${fn}\\b|const\\s+${fn}\\s*=|let\\s+${fn}\\s*=)`).test(src);
      if (!defined) missFn.push(fn);
    });
}

/* shot.mjs 的 RENDER 表必须覆盖所有块型。缺了不会报错——那个块会渲染成
   一句 HTML 注释，于是量出来的高度偏小、截图上那一块是空的。
   星空第一次做完就是这样：产品里有，截图里没有。 */
const shotSrc = fs.readFileSync(R + '/.sync-mp/shot.mjs', 'utf8');
const shotMiss = [...kinds].filter((k) => !OFF.includes(k) && k !== 'tide'
  && !new RegExp(`\\n  ${k}\\s*:`).test(shotSrc));

/* WXML 标签平衡 + block 嵌套。加这条是因为我用"替换一整段"改 wxml 时
   截取范围算少了一层，留下一个孤立的 </view>，开发者工具直接编译失败：
   expect end-tag `block`, near `view`。前面所有静态检查都过了——
   它们看的是块型和跳转，没人看标签。 */
const TAGS = ['view', 'block', 'text', 'rich-text', 'canvas', 'textarea', 'scroll-view', 'image'];
const stack = [], tagBad = [];
for (const m of wxml.matchAll(/<(\/?)([a-z-]+)([^>]*?)(\/?)>/g)) {
  const [, close, tag, attrs, self] = m;
  if (!TAGS.includes(tag)) continue;
  if (self === '/' || /^<!--/.test(m[0])) continue;
  const ln = wxml.slice(0, m.index).split('\n').length;
  if (close) {
    const top = stack.pop();
    if (!top) tagBad.push(`第 ${ln} 行 多出一个 </${tag}>`);
    else if (top.tag !== tag) tagBad.push(`第 ${ln} 行 </${tag}> 对不上第 ${top.ln} 行的 <${top.tag}>`);
  } else stack.push({ tag, ln });
}
stack.forEach((t) => tagBad.push(`第 ${t.ln} 行 <${t.tag}> 没有闭合`));

/* 滋味卡的写作规则（她定的，《01-定稿册》附录 B）：
   汪曾祺六条里能机械检查的两条 —— 不用比喻、不评点；
   加上那份禁用清单 —— 热量／份量／健康与否／该不该吃／「好吃」／「想吃」。
   加这条是因为我自己写的那批 30 条同时犯了比喻和"感觉做主语"，
   而"感觉不做主语"她标了"这是最常犯的"——那一条机器判不了，得人读。 */
const DAILY_T = require(R + '/data/daily.js');
const BAN = [[/像|似的|仿佛|如同|好似/, '用了比喻'], [/好吃|难吃|美味/, '评价词'],
  [/想吃|馋/, '欲望词'], [/热量|卡|大卡/, '热量'], [/健康|不健康|营养/, '健康与否'],
  [/该不该|应该吃|少吃点/, '该不该吃'], [/一小份|半个|两口就够/, '份量']];
const tasteBad = [];
DAILY_T.taste.forEach((t, i) => BAN.forEach(([re, why]) => {
  if (re.test(t.desc) || re.test(t.food)) tasteBad.push(`taste[${i}] ${t.food} ${why}`);
}));

/* 三十张滋味卡之间不该有互相抄的句子。滋味墙是把它们并排摆出来的，
   撞句在墙上一眼就露。查法：两条描述的最长公共子串 ≥ 5 个实字（不算标点）。
   阈值 5 是量出来的：它抓得住真抄（「咬一个小口」5 字、「表面一层薄皮」6 字、
   「黄的，甜，也有点面」8 字，都是人工审出来的那三处），
   又放得过「很烫，要」「一道口子」这种通用说法——那是同一个人的语气，不是重复。 */
const zi = (x) => x.replace(/[，。、！？—…～·「」]/g, '');
const lcs = (a, b) => {
  let best = '';
  for (let i = 0; i < a.length; i++)
    for (let j = i + best.length + 1; j <= a.length; j++) {
      if (b.includes(a.slice(i, j))) best = a.slice(i, j); else break;
    }
  return best;
};
const tasteDup = [];
for (let i = 0; i < DAILY_T.taste.length; i++)
  for (let j = i + 1; j < DAILY_T.taste.length; j++) {
    const seg = lcs(DAILY_T.taste[i].desc, DAILY_T.taste[j].desc);
    if (zi(seg).length >= 5)
      tasteDup.push(`${DAILY_T.taste[i].food} × ${DAILY_T.taste[j].food}「${seg}」`);
  }

/* 同一屏在不同状态下（eat 的五支口味、home 的三个时段）不该出现一模一样的句子。
   加这条是因为 eat 五支里有两支的第三句一字不差、收尾那句五支全同——
   连着看两屏就露了，而静态检查看不见"跨状态的重复"。 */
const dupLines = [];
/* 只查 eat：它那五支的文案是逐支写的，重复就是真重复。
   home 的三个时段共用同一个 taste()／today() 函数，同一句在两个时段出现是设计如此。 */
[['eat', ['热乎乎的', '冰冰凉的', '软的、好咽的', '有嚼头的', '说不上来'], 'PICK']].forEach(([sid, states, key]) => {
  const seen = new Map();
  for (const st of states) {
    D[key] = st;
    for (const b of D.SCREENS[sid].body()) {
      if (!['p', 'box', 's', 'h', 'h2'].includes(b[0])) continue;
      const t = String(b[1] ?? '');
      if (t.length < 8) continue;                 // 太短的（「好。」这类）不算
      if (seen.has(t) && seen.get(t) !== st) dupLines.push(`${sid} 的「${st}」与「${seen.get(t)}」重复：${t.slice(0, 22)}`);
      else seen.set(t, st);
    }
  }
  D[key] = states[states.length - 1];
});

const line = (ok, msg) => console.log((ok ? '✓ ' : '✗ ') + msg);
console.log(`屏 ${Object.keys(D.SCREENS).length}　块 ${n}　块型 ${kinds.size}`);
line(!bad.length, bad.length ? '无 prep 分支: ' + [...new Set(bad)].join(' ') : '每个块都有 prep 分支');
line(!dead.length, dead.length ? '死链: ' + [...new Set(dead)].join(' ') : '无死链');
line(!nocss.length, nocss.length ? '未渲染的块型: ' + nocss.join(' ') : '块型全覆盖');
line(!tooLong.length, tooLong.length ? '每日内容超长（会破版）:\n   ' + tooLong.join('\n   ')
  : `每日内容长度合规（滋味 ${DAILY.taste.length} 条／正念 ${DAILY.mind.length} 条／冥想 ${DAILY.medit.length} 条）`);
line(!dupLines.length, dupLines.length ? '跨状态重复的句子:\n   ' + [...new Set(dupLines)].join('\n   ') : '同屏各状态之间没有重复的句子');
line(!tasteBad.length, tasteBad.length ? '滋味卡违反写作规则: ' + tasteBad.join('；')
  : '滋味卡符合写作规则（无比喻／无评价词／无禁用清单里的词）');
line(!tasteDup.length, tasteDup.length ? '滋味卡互相撞句（滋味墙上会并排看到）:\n   ' + tasteDup.join('\n   ')
  : '三十张滋味卡之间没有互相抄的句子');

/* ── 不把她当病人 ─────────────────────────────────────────────
   她的原话：「什么破文案，你再说用户是病人吗」。
   起因是我把英文那句 "binge eating is a symptom, not a character flaw"
   直译成「这是症状，不是人品。」放进了刚吃完那一屏。
   英文原句是治疗师对病人说的，说话的前提就是"你是我的患者"——
   而这个产品的第一条原则是不预设她是谁、不预设她为什么来（首页连「你来了」都不出现）。

   所以立一条硬规则：临床词不许出现在**用户读得到**的文案里。
   下面 OK 那几条是逐条看过、有理由留的例外：地方的名字她要靠它挂对科，
   照护者那一支（entry 选「为了一个我在意的人」之后）说的是另一个人的事。
   ⚠️ 加新例外之前先想清楚：这一条正是她点名骂过的东西。 */
const CLIN = ['症状', '患者', '病人', '疾病', '障碍', '治疗', '康复', '诊断', '病情', '发病'];
/* 例外：屏 id → 允许的原文片段。片段要写全，不许只写那个词 */
const CLIN_OK = {
  help:    ['有进食障碍专门门诊的医院优先'],                      // 挂号要用的科名
  'g-BC':  ['有进食障碍门诊的医院优先'],
  'g-ABC': ['有进食障碍专门门诊的医院优先'],
  learn:   ['英国最大进食障碍机构', '由患者的母亲写', '症状识别、怎么选治疗提供者'],  // 照护者书单
  'w-jelly': ['她的病让你愤怒'],                                  // 对照护者说她照护的那个人
};
const clin = [];
for (const [id, sc] of Object.entries(D.SCREENS)) {
  let blocks; try { blocks = sc.body(); } catch (e) { continue; }
  for (const b of blocks) {
    if (b[0] === 'dim') continue;                 // 规格注，产品屏上不渲染
    const txt = JSON.stringify(b.slice(1));
    for (const w of CLIN) {
      if (!txt.includes(w)) continue;
      if ((CLIN_OK[id] || []).some((ok) => txt.includes(ok))) continue;
      clin.push(`${id} [${b[0]}] 「${w}」 ${txt.slice(0, 60)}`);
    }
  }
}
/* 每日轮换的池子也要扫——那八条话术就是从池子里出来的 */
const DL2 = require(R + '/data/daily.js');
for (const [nm, pool] of Object.entries({ soothe: DL2.soothe, sipways: DL2.sipways,
  bottleNotes: DL2.bottleNotes, acute: DL2.acute, taste: DL2.taste })) {
  const txt = JSON.stringify(pool);
  for (const w of CLIN) if (txt.includes(w)) clin.push(`池 ${nm} 里有「${w}」`);
}
console.log(clin.length ? '✗ 把用户当病人的词：\n  ' + clin.join('\n  ')
  : '✓ 患者端没有临床词（症状／患者／疾病／治疗…）');
line(!tagBad.length, tagBad.length ? 'WXML 标签不平衡（会编译失败）:\n   ' + tagBad.join('\n   ') : 'WXML 标签平衡');
line(!shotMiss.length, shotMiss.length ? 'shot.mjs 没有渲染映射的块型（截图会缺这块）: ' + shotMiss.join(' ') : 'shot.mjs 渲染映射覆盖全部块型');
line(!missFn.length, missFn.length ? 'draw() 调了没定义的函数: ' + missFn.join(' ') : 'draw() 调用的函数都有定义');
/* ── 「我写的滋味」两条硬断言 ──────────────────────────────
   这两条是这一层的立场，写在这里而不是文档里——
   声明会烂掉，断言不会。 */
const MYT = require(R + '/data/mytaste.js');
const myBad = [];

/* 一、存 ≠ 给别人看。
   门槛只决定进不进公共池，永远不决定她能不能存自己的卡。
   这条塌了，产品就变成了"你不改就别想走"。 */
{
  const e = MYT.add('__chk__', { 色: '白的', 味: '恶心' });
  if (!e) myBad.push('写了判断词就存不下来了——存和给别人看被捆在一起了');
  else if (e.pub !== false) myBad.push('带判断词的卡进了公共池');
  const ok = MYT.add('__chk2__', { 色: '表面结了皮' });
  if (!ok || ok.pub !== true) myBad.push('合格的卡进不了公共池');
  /* 存 / 时间线 / 卡面是三个不同的层。
     卡面只放过了门槛的那条——这张卡她每天会再看到，
     把最难受那句挂在最显眼的地方等于每天提醒她一次。 */
  MYT.add('__chk3__', { 色: '白的' });
  MYT.add('__chk3__', { 味: '恶心' });
  const face = MYT.textFor('__chk3__', '系统那句');
  if (face.includes('恶心')) myBad.push('判断词上了卡面——卡面只该放过了门槛的那条');
  if (!MYT.mine('__chk3__').some((x) => x.text.includes('恶心'))) {
    myBad.push('时间线里没有那条——存下来的东西不能从时间线消失');
  }
  if (MYT.textFor('__chk4__', '系统那句') !== '系统那句') myBad.push('没写过的应该用系统那句');
  MYT.add('__chk4__', { 味: '恶心' });
  if (MYT.textFor('__chk4__', '系统那句') !== '系统那句') {
    myBad.push('一条合格的都没有时，卡面该退回系统那句');
  }
  /* 判断词不加骨架——「喝着恶心」比「恶心」更难看 */
  if (MYT.stitch({ 味: '恶心' }, '热牛奶').includes('喝着')) {
    myBad.push('给判断词加了骨架——骨架是给描述用的');
  }
  /* 门槛必须对称：不偏向好话。「入口即化」和「恶心」同罪。 */
  if (MYT.gate('入口即化') === null) myBad.push('门槛偏向好话了——「入口即化」该和「恶心」一样拦');
  /* 真实的难受感受必须放行，否则就成了正能量过滤器 */
  ['臭', '酸了', '发苦', '黏手', '凉了'].forEach((w) => {
    if (MYT.gate(w) !== null) myBad.push(`「${w}」被拦了——那是真实的感受，不是判断`);
  });
}

/* 二、AI 只判语言，不写内容。
   串联出来的句子里每一段都必须原样来自她的输入。
   模型润色过的（哪怕更好听）一律不算——她要拥有的是自己的形容词。 */
{
  const cells = { 色: '皮上有一块黑的', 质地: '中间那口是化的' };
  if (!MYT.verify(cells, MYT.stitch(cells, '烤红薯'))) myBad.push('stitch 的结果过不了逐词校验');
  if (MYT.verify(cells, '绵密细腻，层次丰富')) myBad.push('润色过的句子居然通过了——AI 在写内容');
  /* 空的那一栏不占一句。她在「声」里写「没有」是常事（热牛奶确实没声音），
     早前一版把「没有。」原样搬上了卡面。 */
  const milk = { 色: '白色', 香: '香甜', 味: '暖呼呼的味道', 声: '没有', 质地: '软软的，流动' };
  const mt = MYT.stitch(milk, '热牛奶');
  if (mt.includes('没有')) myBad.push('「没有」上了卡面——空的那一栏不该占一句');
  if (!mt.includes('闻着香甜')) myBad.push('短形容词没加骨架——五个碎片摆在一起不是话');
  if (MYT.stitch({ 香: '整只手都是那个味' }, '烤红薯').startsWith('闻着')) {
    myBad.push('给已经成句的加了骨架——「闻着整只手都是那个味」读着别扭');
  }
}
line(!myBad.length, myBad.length ? '我写的滋味 · 硬断言:\n   ' + myBad.join('\n   ')
  : '我写的滋味：存≠给别人看 · 门槛对称不偏向好话 · AI 只判语言不写内容');

/* ── 「四个人」的硬断言 ──────────────────────────────────
   这一层最大的风险是变成生成式共情对话（Tessa 的死法）。
   所以断言两件事：屏上的话全在文件里、语料过写作规则。 */
const MENT = require(R + '/data/mentor.js');
const menBad = [];
{
  /* 一、每一类困境 × 每一个人都得有话说，缺一段运行时就是空白 */
  MENT.CASES.forEach((c) => {
    MENT.MENTORS.forEach((m) => {
      if (!c.say[m.id]) menBad.push(`「${c.title}」缺「${m.name}」那段`);
    });
  });
  /* 二、语料过写作规则。和滋味卡同一套尺子，两头都收。
     ⚠️ 「够不够」「多不多」是做产品判断的语言，不是给用户的语言。 */
  const MB = [
    [/应该|建议你|正确做法|你必须|你得去/, '指令词'],
    [/热量|卡路里|大卡|千卡/, '热量'],
    [/够不够|吃太多|吃多了|少吃点|多吃点/, '产品判断的语言'],
    [/健康|不健康|有营养|好吃|难吃/, '评价词'],
    [/像.{0,4}一样|仿佛|如同|似的/, '比喻'],
    [/你做得|已经连续|加油|真棒|很不错/, '夸或进度'],
  ];
  const scan = (t, where) => MB.forEach(([re, why]) => {
    if (re.test(t)) menBad.push(`${where} ${why}`);
  });
  MENT.CASES.forEach((c) => MENT.MENTORS.forEach((m) =>
    scan(c.say[m.id] || '', `「${c.title}」·${m.name}`)));
  MENT.MENTORS.forEach((m) => scan(m.intro, `${m.name} 的介绍`));
  scan(MENT.MISS.say, '接不住那段');
  /* 三、cue 是给模型看的例句，不许上屏——上屏会变成「原来我该这么想」 */
  const wx = fs.readFileSync(R + '/pages/index/index.wxml', 'utf8');
  MENT.CASES.forEach((c) => c.cue.forEach((q) => {
    if (wx.includes(q)) menBad.push(`分诊例句「${q}」出现在屏上了`);
  }));
  /* 四、⚠️ 认不出也必须有话说。
     「接不住」不能出现在正常路径上——对一个刚说出口的人，
     沉默不是中立，她会读成「连这个都接不住」。她试的是「好累」，
     那是最普通的一句话，而产品哑了。 */
  const anyR = MENT.replies(null);
  if (anyR.length !== MENT.MENTORS.length) menBad.push('认不出类别时四个人没都有话说');
  anyR.forEach((r) => {
    /* ⚠️ 下限只挡空，不挡短。「肩膀松一下。」六个字是对的——
       地面本来就该说得最短，四个人长短不一才不会堆成一片文字砖。
       这条断言原来写 <8 字算缺内容，把正确的内容判成了错。 */
    if (!r.t || !r.t.trim()) menBad.push(`通用那组「${r.name}」是空的`);
    scan(r.t || '', `通用·${r.name}`);
  });
  MENT.MENTORS.forEach((m) => {
    if (!MENT.ANY.say[m.id]) menBad.push(`通用那组缺「${m.name}」`);
  });
  if (!MENT.MISS.say || !MENT.MISS.go.length) menBad.push('接不住那段缺内容或缺出口');
  if (MENT.triageLocal('今天天气不错') !== null) menBad.push('分诊太松——无关的话也被认成了某一类');
}
line(!menBad.length, menBad.length ? '四个人 · 硬断言:\n   ' + menBad.join('\n   ')
  : '四个人：话全在文件里 · 语料过写作规则 · 分诊认不出有兜底');

console.log(`照护者端　屏 ${Object.keys(C.SCREENS).length}　块型 ${cKinds.size}　课程 ${C.COURSE.length} 条`);
line(!cDead.length, cDead.length ? '照护者端死链: ' + [...new Set(cDead)].join(' ') : '照护者端无死链');
line(!cNoRender.length, cNoRender.length ? '照护者端未渲染的块型: ' + cNoRender.join(' ') : '照护者端块型全覆盖');
line(!cBad.length, cBad.length ? '照护者端硬规则: ' + cBad.join('；') : '照护者端硬规则通过（无「你是」· 必须动走 warn · 与患者数据隔离）');
process.exit(bad.length + dead.length + nocss.length + tooLong.length + missFn.length + shotMiss.length + tagBad.length + tasteBad.length + tasteDup.length + dupLines.length
  + cDead.length + cNoRender.length + cBad.length + myBad.length + menBad.length ? 1 : 0);
