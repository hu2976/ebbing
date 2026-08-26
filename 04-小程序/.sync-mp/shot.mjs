/* 把某一屏用真实 WXSS 渲进 Chrome，截图并报「一屏装不装下」。
   小程序开发者工具不给自动化截图，而「不用滑就能看全」是硬指标，估算不可靠——
   所以把 rpx 折成 px、块型照 index.wxml 的对应关系铺成 HTML，交给 headless Chrome 量。

   跑法：node .sync-mp/shot.mjs [屏id] [时段]
     node .sync-mp/shot.mjs                → home day
     node .sync-mp/shot.mjs home night
     node .sync-mp/shot.mjs during
   产物：.sync-mp/out/<屏id>-<时段>.png（陶土色横线＝视口底，线以下就是要滑才看得到的）

   ⚠️ 截图会堆到 13M 以上，而它们在工程目录里 —— 微信开发者工具的"代码质量"
   会把整个工程算进主包，于是报"主包尺寸应小于 1.5M 未通过"、
   "图片和音频资源应不超过 200K 未通过"。
   project.config.json 的 packOptions.ignore 已经排除了整个 .sync-mp 目录，
   所以打包和上传都不会带上它们。真正的代码只有 268K。*/
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const R = path.resolve(import.meta.dirname, '..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
/* iPhone 15：390×844pt。顶部留白必须和 index.js 的 topPad 一致：
   `(statusBarHeight || 20) + 40`，iPhone 15 的 statusBarHeight 是 54 → 94pt。
   一开始按 47 算，把可用高度多算了 47px，一批屏测出来装下其实在真机上是超的。 */
const W = 390, H = 844, TOP = 94;
const K = W / 750;                       // 1rpx 折成多少 px

/* --care：量照护者端（data/care.js）。两端共用这个工具，和运行时一样 */
const CARE = process.argv.includes('--care');
const ALL = process.argv.includes('--all');
const id = (process.argv[2] && !process.argv[2].startsWith('--')) ? process.argv[2] : (CARE ? 'care' : 'home');
const clock = (process.argv[3] && !process.argv[3].startsWith('--')) ? process.argv[3] : 'day';

const D = require(R + (CARE ? '/data/care.js' : '/data/screens.js'));
const JARM = require(R + '/data/jar.js');   // 与 index.js 同一份几何和样式
const LOGM = require(R + '/data/log.js');   // 一颗球 = 一天，和运行时同一套聚合
const MEN = require(R + '/data/mentor.js');  // 四个人的说法，截图用最长那一类量高度
/* 与运行时一致：代码生成的那些屏挂进患者端（见 data/runtime-screens.js） */
if (!CARE) require(R + '/data/runtime-screens.js').patient(D.SCREENS);
/* 种子要在顶部就写一次：原来只在渲染罐子时才 seed，于是星空屏和卡片墙
   （它们不含 machine 块）拿到的是空数据，框在、内容没有。 */
try { LOGM.seedIfEmpty(require(R + '/data/screens.js').HUE || {}); } catch (e) { /* 照护者端没有 HUE */ }
D.CLOCK = clock;
if (!ALL && !D.SCREENS[id]) { console.error('没有这一屏：' + id); process.exit(1); }

const rpx2px = (css) => css.replace(/([0-9.]+)rpx/g, (_, n) => (n * K).toFixed(3) + 'px');
const tokens = rpx2px(fs.readFileSync(R + '/pages/index/tokens.wxss', 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ''));
const wxss = rpx2px(fs.readFileSync(R + '/pages/index/index.wxss', 'utf8')
  .replace(/@import[^;]+;/g, ''));
/* page{} 是小程序的根，第一条当 :root 收变量，其余当 body。
   ⚠️ 正则必须带前边界：不带的话 `.page{` 里的 page{ 也会被换成 `.body{`，
   于是 index.wxss 里所有 .page 规则在截图里静默失效 —— 量出来的和真机不是
   同一件事，而这个工具正是"一屏装不装下"唯一的验证手段。 */
/* ⚠️ tokens.wxss 那条 box-sizing 是元素选择器（view/text/rich-text/…），
   而这里把块渲成 div —— 匹配不上，于是截图里全是 content-box，
   真机是 border-box。凡是带 padding 又量高度的块都会算大：
   entry 的 .page 有 padding-top:56rpx，测出来就凭空多 29px。 */
let css = '*{box-sizing:border-box}' + tokens + wxss;
css = css.replace('page{', ':root{').replace(/(^|[^.\w-])page\{/gm, '$1body{');

let seenLongS = 0;   // 同屏多条长 s 只出一个入口，与 draw() 的 lead 规则一致
const esc = (t) => String(t ?? '').replace(/<br\s*\/?>/g, '<br>');
/* 与 index.wxml 的分支一一对应。新加块型要同步这里，否则截图会漏 */
const RENDER = {
  h:    (b) => `<div class="s-h">${esc(b[1])}</div>`,
  h2:   (b) => `<div class="s-h2">${esc(b[1])}</div>`,
  p:    (b) => `<div class="s-p">${esc(b[1])}</div>`,
  /* 与 index.js 的 prep 同一条规则：20 字以上默认收起（见那里的注释） */
  s:    (b) => (String(b[1]).replace(/<[^>]+>/g, '').length > 20
          ? (seenLongS++ ? '' : `<div class="swrap"><div class="sbtn">为什么<span class="chev">›</span></div></div>`)
          : `<div class="s-s">${esc(b[1])}</div>`),
  ti:   (b) => `<div class="s-ti">${b[1]}</div>`,
  /* 带第二个参数时是入口（点食物名进完整卡片），要带上 › 才和真机一致 */
  food: (b) => (b[2]
    ? `<div class="s-food fgo"><span>${esc(b[1])}</span><span class="chev">›</span></div>`
    : `<div class="s-food">${esc(b[1])}</div>`),

  /* 首页那张滋味卡。真机上 index.js 的 mergeTaste() 会把 ti+food(+p+s)
     合成一个 taste 块，这里以前没有对应实现，于是截图里首页永远是散着的
     ti 和 food —— 这张卡长什么样一直没法验证。b = ['taste', ti, food, go] */
  taste:(b) => {
    const D2 = require(R + '/data/daily.js');
    const t = D2.pick(D2.taste) || { food: b[2] };
    const [deep, lit] = D2.cardColor(t.food);
    return `<div class="tcard"><div class="tbody tx-${D2.cardTex(t.food)}`
      + `${b[3] ? ' go' : ''}" style="--deep:${deep};--lit:${lit}">`
      + '<div class="pgrain"></div>'
      + (b[1] ? `<div class="s-ti">${b[1]}</div>` : '')
      + `<div class="tline"><div class="s-food">${esc(t.food)}</div>`
      + (b[3] ? '<span class="chev">›</span>' : '') + '</div></div></div>';
  },
  box:  (b) => `<div class="s-box">${esc(b[1])}</div>`,
  num:  (b) => `<div class="s-num">${esc(b[1])}</div>`,
  /* 五个角度。截图里量的是空栏的高度——那才是她第一次进来看到的样子。 */
  aspects:(b) => '<div class="asp">' + (b[1] || [
    ['色','什么颜色，什么样子'],['香','闻起来'],['味','嘴里是什么'],
    ['声','有没有声音'],['质地','牙齿和手的感觉'],
  ]).map((x) => {
    const [k, hint] = Array.isArray(x) ? x : [x.k, x.hint];
    return `<div class="asp-row"><span class="asp-k">${esc(k)}</span>`
      + `<span class="asp-in asp-ph">${esc(hint)}</span></div>`;
  }).join('') + '<div class="asp-ok">存下来</div></div>',
  /* 以前写过的一条 */
  pastline:(b) => `<div class="past"><span class="past-at">${esc(b[1])}</span>`
    + `<span class="past-t">${esc(b[2])}</span></div>`,
  /* 四个人。量的是四张并列——这一屏最容易超，因为多了「他会怎么说」。 */
  mentors:() => '<div class="mens">' + MEN.MENTORS.map((m) =>
    `<div class="men"><div class="men-h"><span class="men-n">${esc(m.name)}</span>`
    + `<span class="men-g">${esc(m.tag)}</span></div>`
    + `<span class="men-i">${esc(m.intro)}</span>`
    + `<span class="men-l">${esc(m.lead)}</span></div>`).join('') + '</div>',
  /* 输入框。量空的状态——那才是她第一次进来看到的。 */
  mentorin:() => '<div class="mif"><div class="mif-in mif-ph">'
    + '今天发生了什么，或者心里那句话</div>'
    + '<div class="asp-ok">说给他们听</div></div>',
  /* 聊。⚠️ 按最坏情况量：她一句 + 四个人各一段（进屏时的样子）。
     输入框是 fixed 不占文档流，但要把它的高度算进去。 */
  chat:() => {
    const c = MEN.CASES.reduce((a, x) =>
      MEN.replies(x.key).reduce((n, r) => n + r.t.length, 0)
        > MEN.replies(a.key).reduce((n, r) => n + r.t.length, 0) ? x : a, MEN.CASES[0]);
    return '<div class="chat">'
      + '<div class="msg mine"><div class="msg-t">今天又没忍住，吃完特别难受</div></div>'
      + MEN.replies(c.key).map((r) =>
        `<div class="msg"><div class="msg-w"><span class="msg-n">${esc(r.name)}</span>`
        + `<span class="msg-g">${esc(r.tag)}</span></div>`
        + `<div class="msg-t">${esc(r.t).replace(/\n/g, '<br>')}</div></div>`).join('')
      /* ⚠️ 「想单独跟谁说」只在四个都说完之后出现，
         所以量高度时它算在里面——那是最高的状态。 */
      + '<div class="chat-pick"><span class="chat-pl">想单独跟谁说</span>'
      + '<div class="chat-ps">' + MEN.MENTORS.map((m) =>
        `<div class="chat-p">${esc(m.name)}</div>`).join('') + '</div></div>'
      + '<div class="chat-foot">把这段复制走</div></div>';
  },
  /* 以前说过的。空态是她第一次进来看到的，就量空态。 */
  talks:() => '<div class="oth"><div class="oth-row">'
    + '<span class="oth-t">还没有。</span></div></div>',
  /* 别人写的。截图按两条量——种子里大多数食物是一到两条。 */
  others:(b) => '<div class="oth">' + (b[1] || [
    ['3 月 12 日','皮上有一块黑的。中间那口是化的。'],
    ['8 月 2 日','整只手都是那个味。靠皮的地方最甜。'],
  ]).map((x) => {
    const [at, t] = Array.isArray(x) ? x : [x.at, x.t];
    return `<div class="oth-row"><span class="oth-at">${esc(at)}</span>`
      + `<span class="oth-t">${esc(t)}</span></div>`;
  }).join('') + '</div>',
  row:  (b) => `<div class="s-row"><span class="rk">${b[1]}</span><span class="rv">${b[2]}</span></div>`,
  hr:   () => '<div class="s-hr"></div>',
  checks:(b) => '<div class="checks">' + b[1].map((t) =>
    `<div class="chk"><div class="cbox"><div class="cmark"></div></div><span class="ctext">${t}</span></div>`).join('') + '</div>',
  gatego:(b) => `<div class="s-b big gatego">${b[1]}</div>`,
  cards3:(b) => '<div class="c3">' + b.slice(1).map((x) =>
    `<div class="c3card"><div class="c3dot"></div><span class="c3t">${x[0]}</span><div class="c3p">${esc(x[1])}</div></div>`).join('') + '</div>',
  foodband:(b) => {
    const A = require(R + '/data/daily.js');
    const [deep, lit] = A.pickColor(b[1]);
    return `<div class="fband" style="--deep:${deep};--lit:${lit}"><div class="fgrain"></div>`
      + `<span class="ftext">${b[1]}</span></div>`;
  },
  two2: () => {
    const A = require(R + '/data/advice.js');
    return '<div class="twoway">' + [A.TWO.say, A.TWO.quiet].map((x) =>
      `<div class="tw"><span class="twt">${x.nav}</span><span class="twh">${x.hint}</span><span class="chev">›</span></div>`).join('') + '</div>';
  },
  gap:  () => '<div class="s-gap"></div>',
  remind:(b) => `<div class="s-b remind">${b[1]}</div>`,
  animals:(b) => '<div class="beasts">' + b.slice(1).map((x) => {
    const CLS = { 犀牛:'rhino', 梗犬:'terrier', 鸵鸟:'ostrich', 袋鼠:'kangaroo', 水母:'jelly', 海豚:'dolphin', 圣伯纳犬:'stbernard' };
    return `<div class="bcard a-${CLS[x[2]]} ${x[3] ? 'ideal' : ''}">`
      + '<div class="bart"><div class="bl1"></div><div class="bl2"></div><div class="bl3"></div></div>'
      + `<span class="bt">${x[0]}</span><span class="ba">「${x[2]}」</span></div>`;
  }).join('') + '</div>',
  beast:(b) => {
    const CLS = { 犀牛:'rhino', 梗犬:'terrier', 鸵鸟:'ostrich', 袋鼠:'kangaroo', 水母:'jelly', 海豚:'dolphin', 圣伯纳犬:'stbernard' };
    return `<div class="bhead a-${CLS[b[1]]} ${b[2] ? 'ideal' : ''}"><div class="bart big">`
      + '<div class="bl1"></div><div class="bl2"></div><div class="bl3"></div></div></div>';
  },
  online:(b) => `<div class="online">此刻 ${b[1] || 23} 人在</div>`,
  card: (b) => {
    const D2 = require(R + '/data/daily.js');
    const t = D2.pick(D2.taste) || { food: b[1], desc: b[2] };
    const [deep, lit] = D2.cardColor(t.food);
    /* tx-* 是这样食物的质感族（烙／蒸／汤／粒／冰／糕）。少了它 30 张牌的纹理全一样，
       而每张牌对应那样食物的质感正是要在截图里看的东西。 */
    return `<div class="deck"><div class="pcard tx-${D2.cardTex(t.food)}" style="--deep:${deep};--lit:${lit}">`
      + '<div class="pgrain"></div><div class="pgloss"></div>'
      + `<span class="pcorner tl">${t.food}</span><span class="pcorner br">${t.food}</span>`
      + `<div class="pmid"><span class="pname">${t.food}</span><div class="prule"></div>`
      + `<div class="pdesc">${esc(t.desc)}</div></div></div></div>`;
  },
  wall: () => {
    const pool = require(R + '/data/daily.js');
    const days = LOGM.wallDays(60), base = LOGM.dayKey();
    const items = days.map((day) => {
      const diff = Math.round((new Date(base.replace(/-/g, '/')) - new Date(day.replace(/-/g, '/'))) / 864e5);
      const idx = ((pool.dayIndex() - diff) % pool.taste.length + pool.taste.length) % pool.taste.length;
      const food = pool.taste[idx].food;
      const [deep, lit] = pool.cardColor(food);
      return { day, md: day.slice(5).replace('-', '/'), food, deep, lit,
        on: LOGM.dayMeals(day).filter(Boolean).length > 0, today: day === base };
    });
    let out = '<div class="shelf">';
    for (let i = 0; i < items.length; i += 3) {
      out += '<div class="srow">' + items.slice(i, i + 3).map((x) =>
        `<div class="spine ${x.on ? 'on' : ''} ${x.today ? 'out' : ''}" style="--deep:${x.deep};--lit:${x.lit}">`
        + `<span class="sd">${x.md}</span><span class="sf">${x.food}</span></div>`).join('')
        + '</div><div class="sboard"></div>';
    }
    return out + '</div>';
  },
  /* 星空。位置走 data/jar.js 的 skyLayout —— 和真机同一份。
     原来这里自己抄了一遍那个 sin 哈希，于是截图里的星图和真机的不是同一张，
     而她提的意见正是关于排布的：抄一遍等于把要看的东西看错。
     屏底那三行日期（.skyfoot）也去了：现在是点一颗星读一行。 */
  sky: () => {
    const ns = LOGM.nights();
    const pos = JARM.skyLayout(ns.map((n) => n.day));
    const stars = ns.map((n, i) => `<div class="starhit" style="left:${pos[i].x.toFixed(1)}%;top:${pos[i].y.toFixed(1)}%">`
      + `<div class="star d${n.level}"></div></div>`).join('');
    return `<div class="sky">${stars}</div><div class="skyread"><span class="none">点一颗星</span></div>`;
  },
  sleeppick: (b) => '<div class="spick">'
        + b.slice(1).map((t) => `<div class="sp-b">${t}</div>`).join('') + '</div>',
  breath:() => '<div class="breath"><div class="halo"></div><div class="ring"></div><div class="core"></div></div>',
  relax:() => '<div class="relax"><div class="rx-out"></div><div class="rx-mid"></div><div class="rx-core"></div>'
        + '<div class="rx-cue"><span class="tight">紧</span></div></div>',
  write:(b) => `<div class="wwrap"><div class="wtext" style="color:var(--paper3)">${esc(b[1])}</div></div>`,
  sw:   (b) => `<div class="swrow"><span class="swk">${b[1]}</span><span class="swh">${esc(b[2])}</span>`
        + '<span class="swt"><span class="swd"></span></span></div>',
  warn: (b) => `<div class="s-warn"><span class="wt">必须动</span><span class="wb">${esc(b[1])}</span></div>`,
  q:    (b) => `<div class="s-q">${b[1]}<span class="chev">›</span></div>`,
  b:    (b) => `<div class="s-b ${b[1]}">${esc(b[2])}</div>`,
  bbig: (b) => `<div class="s-b big">${esc(b[1])}</div>`,
  pair: (b) => `<div class="s-pair"><div class="s-q">${b[1]}</div><div class="s-q">${b[2]}</div></div>`,
  pair2:(b) => `<div class="s-pair">${b.slice(1).map((x) => `<div class="s-b cl flat">${x[0]}</div>`).join('')}</div>`,
  foot: (b) => `<div class="s-foot">${b.slice(1).map((x) => `<div class="footbtn">${x[0]}</div>`).join('')}</div>`,
  cells:   (b) => cells(b[1]),
  cellsGo: (b) => cells(b[1]),
  words:(b) => `<div class="words">${b[1].map((w) => `<span class="word">${w}</span>`).join('')}</div>`,
  pick: (b) => `<div class="pick">${b.slice(1).map((x, i) => `<div class="pickbtn${i === b.length - 2 ? ' wide' : ''}">${x}</div>`).join('')}</div>`,
  player:(b) => `<div class="player"><span class="pl-ico">▶</span><span class="pl-t">${b[1]}</span></div>`,
  /* 情绪瓶子。真机上珠子是 canvas + 每帧物理（重力、碰撞、跟着手机晃），
     所以这里**不能**再摆一套静态的 DOM 珠子——那就是第二份实现，必然和真机分叉。
     这个工具跑的本来就是真 Chrome，所以把 data/jar.js 里那几个纯函数
     用 toString() 原样注进页面，在页面里跑同一套物理、画同一张 sprite，
     让它落定之后再截图。一份代码，两个宿主。
     ⚠️ 截图里重力恒定朝下（headless 没有加速度计），真机上它跟着手机转。 */
  machine: () => {
    const days = LOGM.balls(D.HUE || {}).map((it) => ({ hue: it.hue, unity: it.unity }));
    const inject = [JARM.rnd, JARM.pile, JARM.fitD, JARM.layers, JARM.sprite, JARM.step]
      .map((f) => f.toString()).join('\n');
    return `<div class="machine"><div class="neck"></div><div class="glass">`
      + `<canvas id="jarcv" class="jarcv" width="${JARM.JAR}" height="${JARM.JAR}"></canvas>`
      + `<div class="gloss"></div></div>`
      + '<div class="base"><span>八月</span></div></div>'
      + `<script>${inject}
(function(){
  var J=${JARM.JAR}, R=J/2-5, days=${JSON.stringify(days)};
  var d=fitD(days.length,R), r=d/2;
  var mk=function(w,h){var c=document.createElement('canvas');c.width=w;c.height=h||w;return c;};
  /* 出生点必须在**罐内**（y = −(R − d/2)）。写在罐外的话容器约束会在第 0 帧
     把珠子瞬移到内壁，而速度是位置差回写的，于是它是被弹射进去的。
     所以这里也照小程序那样排队放：一颗落一段再放下一颗。 */
  var top=-(R-d/2)+1;
  var all=days.map(function(it,i){return {
    x:(rnd(i,21)-0.5)*R*0.34, y:top, vx:0, vy:0,
    spr:sprite(mk,d,1,it.hue,i,it.unity)};});
  var B=[], gap=Math.pow(d*1.06,2), wait=0;
  for(var f=0;f<900;f++){
    if(all.length && wait<=0){
      var q=all[0], clear=B.every(function(o){return Math.pow(o.x-q.x,2)+Math.pow(o.y-q.y,2)>gap;});
      if(clear){ B.push(all.shift()); wait=14; }
    }
    wait--;
    step(B,r,R,0,1500,1/60);
  }
  var g=document.getElementById('jarcv').getContext('2d');
  B.forEach(function(q){ g.drawImage(q.spr.cv, J/2+q.x-q.spr.W/2, J/2+q.y-q.spr.W/2, q.spr.W, q.spr.W); });
})();</script>`;
  },
};
const cells = (on) => '<div class="cells">' + Array.from({ length: 6 },
  (_, i) => `<div class="cell ${i === on ? 'on' : i > on ? 'e' : ''}"></div>`).join('') + '</div>';

/* home 的第四层在 index.js 的 draw() 里被折进 .foldwrap，这里照做 */
function build(sid) {
  seenLongS = 0;
  const raw = D.SCREENS[sid].body();
  const FOLD_AT = { home: '平时练的', help: '怎么看出这个人合不合适', vom: '下一顿吃点什么' };   // 与 index.js 同表
  const cut = FOLD_AT[sid] ? raw.findIndex((b) => b[0] === 'ti' && b[1] === FOLD_AT[sid]) : -1;
  const from = cut > 0 && raw[cut - 1]?.[0] === 'hr' ? cut - 1 : cut;
  /* 与 draw() 同一条硬规则：折叠区不含 foot／b／bbig（急救线与动作按钮） */
  let shown = raw;
  if (from > 0) {
    const stop = raw.findIndex((b, i) => i >= from && ['foot', 'b', 'bbig'].includes(b[0]));
    const end = stop > from ? stop : raw.length;
    shown = raw.slice(0, from).concat(raw.slice(end));
  }
  /* 与 index.js 的 draw() 一致：mind 注入呼吸圆、medit 注入松紧方，
     插在第一个 player 之前 */
  const VIS = { mind: 'breath', medit: 'relax' };
  /* 与 index.js 的 mergeTaste() 同一件事：ti + food 合成一张卡。
     只做 home —— 别的屏的 food 块不进卡（taste-card 走的是 card 块）。 */
  if (sid === 'home') {
    const fi = shown.findIndex((b) => b[0] === 'food');
    if (fi >= 0) {
      const hasTi = fi > 0 && shown[fi - 1][0] === 'ti';
      const from = hasTi ? fi - 1 : fi;
      shown = shown.slice(0, from)
        .concat([['taste', hasTi ? shown[fi - 1][1] : '', shown[fi][1], shown[fi][2] || '']])
        .concat(shown.slice(fi + 1));
    }
  }
  if (sid === 'eat') {
    const ti = shown.findIndex((b) => b[0] === 'ti');
    if (ti >= 0) shown = shown.slice(0, ti).concat([['foodband', D.PICK]], shown.slice(ti + 1));
  }
  if (sid === 'entry') {
    const hi = shown.findIndex((b) => b[0] === 'h');
    if (hi >= 0) shown = shown.slice(0, hi + 1).concat([['gap']], shown.slice(hi + 1));
  }
  const withVis = (() => {
    if (!VIS[sid]) return shown;
    const at = shown.findIndex((b) => b[0] === 'player');
    const cp = shown.slice();
    cp.splice(at < 0 ? cp.length : at, 0, [VIS[sid]]);
    return cp;
  })();
  /* 每块后跟一个 .vgap，和 index.wxml 一样 —— 少了它截图里的间距就不是真机的 */
  const html = withVis
    .filter((b) => !['dim', 'clockbar', 'tide'].includes(b[0]))
    .map((b) => (RENDER[b[0]] ? RENDER[b[0]](b) : `<!-- 未映射块型 ${b[0]} -->`)
                + '<div class="vgap"></div>')
    .join('\n');
  return { html, folded: from > 0 ? raw.length - from : 0, n: shown.length };
}
const screen = (sid) => {
  const { html, folded } = build(sid);
  const r = D.SCREENS[sid].root;
  return `${sid === 'entry' ? '<div class="haze"><div class="hz h1"></div><div class="hz h2"></div><div class="hz h3"></div></div>' : ''}<div class="view s-${sid}" style="padding-top:${TOP}px"><div class="page" data-id="${sid}">
<div class="nav${r ? ' root' : ''}">${r ? '' : '<div class="navbtn">← 返回</div>'}</div>
${html}
${folded ? '<div class="foldwrap"><div class="morebtn"><span>更多</span><span class="chev mchev">›</span></div></div>' : ''}
</div></div>`;
};

/* --all：把每屏铺成一列，一次 Chrome 量完全部。逐屏起 Chrome 要 76 次，会超时 */
if (ALL) {
  const ids = Object.keys(D.SCREENS);
  const parts = [];
  for (const sid of ids) {
    const cs = (!CARE && sid === 'home') ? ['day', 'risk', 'night'] : ['day'];
    for (const c of cs) { D.CLOCK = c; parts.push(`<div class="wrap" data-key="${sid}${cs.length > 1 ? '·' + c : ''}" style="width:${W}px">${screen(sid)}</div>`); }
  }
  D.CLOCK = 'night';
  /* 同上：这里窗口高 2000px，100vh 也是 2000 —— entry 那条
     min-height:calc(100vh - 240rpx) 会被撑到 1870px，量出来是假的"超屏"。
     按真实视口高折成绝对 px，量的才是真机的高度。 */
  const all = `<meta charset="utf-8"><style>html,body{margin:0} ${css}
  .page{min-height:${Math.round(H - 260 * K)}px}
  .s-entry .page{min-height:${Math.round(H - 240 * K)}px}
  .wrap{display:inline-block;vertical-align:top}</style>${parts.join('')}
  <script>addEventListener('load',()=>{document.title=[...document.querySelectorAll('.wrap')]
    .map(w=>w.dataset.key+':'+Math.round(w.querySelector('.page').getBoundingClientRect().height)).join('|')})</script>`;
  const out2 = R + '/.sync-mp/out'; fs.mkdirSync(out2, { recursive: true });
  const f = out2 + '/_all.html'; fs.writeFileSync(f, all);
  const dom = execFileSync(CHROME, ['--headless', '--disable-gpu', '--dump-dom',
    `--window-size=${W * 4},2000`, 'file://' + f], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const t = dom.match(/<title>([^<]*)<\/title>/);
  if (!t) { console.error('量不到高度'); process.exit(1); }
  const avail0 = H - TOP;
  /* ⚠️ 故意不压的屏。「一屏装下」这条规矩的来由是**发作当下认知窄化，
     不该让人找东西**——所以它只对急性期那几屏是硬的。
     这三屏都不是发作当下，硬压反而会砍掉它们真正要给的东西： */
  const SCROLL_OK = {
    sos: '红旗清单是查阅型安全信息，不该为「不用滑」牺牲行距',
    mentors: '四个人各带介绍，本来就该读——压它就要删掉「他会怎么说」',
    'mentor-chat': '聊天窗天生往上滑，输入框吸底不动。压它等于限制对话长度',
  };
  const rows = t[1].split('|').map((x) => { const [k, v] = x.split(':'); return [k, +v]; })
    .sort((a, b) => b[1] - a[1]);
  const all_over = rows.filter((r) => r[1] > avail0);
  const over = all_over.filter((r) => !SCROLL_OK[r[0].split('·')[0]]);
  const okScroll = all_over.filter((r) => SCROLL_OK[r[0].split('·')[0]]);
  console.log(`${rows.length} 个屏态　可用 ${avail0}px`);
  console.log(over.length ? `\n✗ 超出 ${over.length} 个：` : '\n✓ 该装下的都装下了');
  over.forEach(([k, v]) => console.log(`   ${k.padEnd(14)} ${v}px　超 ${v - avail0}px（≈${Math.round((v - avail0) / K)}rpx）`));
  if (okScroll.length) {
    console.log('\n· 故意可滑的：');
    okScroll.forEach(([k, v]) => console.log(`   ${k.padEnd(14)} ${v}px　${SCROLL_OK[k.split('·')[0]]}`));
  }
  const tight = rows.filter((r) => r[1] <= avail0).slice(0, 6);
  console.log('\n余量最小的 6 个：');
  tight.forEach(([k, v]) => console.log(`   ${k.padEnd(14)} ${v}px　余 ${avail0 - v}px`));
  process.exit(0);
}

const built = build(id);
const body = built.html;
const from = built.folded ? 1 : 0;
const shown = { length: built.n };

/* charset 必须声明：file:// 下 Chrome 不猜 UTF-8，中文会变乱码，
   而乱码字符宽度不同 → 换行数不同 → 量出来的高度是错的 */
const html = `<meta charset="utf-8"><meta name=viewport content="width=${W}"><style>
html,body{margin:0} ${css}
#vp{width:${W}px}
/* ⚠️ 截图窗口是 H×1.6（要截到线以下那截），于是 100vh 也跟着变成 1.6 倍，
   短屏和 entry 的 min-height:calc(100vh - …) 会把按钮撑到视口线以下 ——
   真机上 100vh 就是一屏。这里把那两条按真实视口高折成绝对 px，
   截图看到的才和真机是同一件事。量高度的探针窗口本来就是 H，不受影响。 */
.page{min-height:${Math.round(H - 260 * K)}px}
.s-entry .page{min-height:${Math.round(H - 240 * K)}px}
/* 视口底那条线：线以下就是要滑才看得到的部分 */
.vpline{position:absolute;left:0;right:0;top:${H}px;height:2px;background:#CB7E62;z-index:9}
.vpline::after{content:'↑ 一屏到这里';position:absolute;right:6px;top:4px;
  font:11px/1.4 -apple-system,sans-serif;color:#CB7E62}
</style><div id=vp>${screen(id)}</div><div class="vpline"></div>`;

const out = R + '/.sync-mp/out';
fs.mkdirSync(out, { recursive: true });
const page = `${out}/${id}-${clock}.html`;
const png = `${out}/${id}-${clock}.png`;
fs.writeFileSync(page, html);

if (!fs.existsSync(CHROME)) { console.log('没找到 Chrome，只生成了 ' + page); process.exit(0); }
/* 截图开到视口的 1.6 倍高，好看清超出了多少 */
execFileSync(CHROME, ['--headless', '--disable-gpu', '--hide-scrollbars',
  '--force-device-scale-factor=2', `--window-size=${W},${Math.round(H * 1.6)}`,
  `--screenshot=${png}`, 'file://' + page], { stdio: 'ignore' });

/* 量真实高度：再跑一次 Chrome，把 scrollHeight 打到 stdout */
const probe = page.replace('.html', '-probe.html');
fs.writeFileSync(probe, html.replace('</style>',
  `</style><script>addEventListener('load',()=>{document.title='H='+document.querySelector('.page').getBoundingClientRect().height})</script>`));
let h = null;
try {
  const dom = execFileSync(CHROME, ['--headless', '--disable-gpu', '--dump-dom',
    `--window-size=${W},${H}`, 'file://' + probe], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const m = dom.match(/H=([0-9.]+)/);
  if (m) h = parseFloat(m[1]);
} catch { /* dump-dom 拿不到就只报截图 */ }

const avail = H - TOP;
console.log(`${id} · ${clock}　块 ${built.n}${built.folded ? `（另有 ${built.folded} 块在折叠里）` : ''}`);
if (h !== null) {
  const over = Math.round(h - avail);
  console.log(`内容 ${Math.round(h)}px　可用 ${avail}px　` +
    (over <= 0 ? `✓ 一屏装下，还余 ${-over}px` : `✗ 超出 ${over}px（≈ ${Math.round(over / K)}rpx）要滑`));
}
console.log('截图 ' + png);
