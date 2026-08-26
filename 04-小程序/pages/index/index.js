/* 36 屏是一个页面，不是 36 个页面——原型本来就是单页换内容。
   屏级文字全部来自 data/screens.js（由 .sync-mp/gen.mjs 从原型抽出）。 */
/* 两端共用这一个渲染器，不共用数据（PRD 硬约束）。
   患者端 data/screens.js ← 原型 02 生成；照护者端 data/care.js ← PRD 那一章。
   D 在 onLoad 里按启动参数定一次，之后不再切——切换等于让两边互见。 */
const PATIENT = require('../../data/screens.js');
const CARE = require('../../data/care.js');
let D = PATIENT;
const DAILY = require('../../data/daily.js');   // 每日轮换内容池
const LOGD = require('../../data/log.js');      // 本机记录：餐级的词 + 日级的球
const R7 = require('../../data/react7.js');     // 七张反应卡，两端共用同一份内容
const ADV = require('../../data/advice.js');    // 按选项组合给建议（gate 七种 / two 两支）
const RUNTIME = require('../../data/runtime-screens.js');   // 运行时挂载的那些屏
const MY = require('../../data/mytaste.js');    // 我写的滋味：门槛、串联、本机存
const OTH = require('../../data/others.js');    // 别人写的：静态公共池，读不用后端
const MEN = require('../../data/mentor.js');    // 四个人：屏上每个字都在这里，模型只做分诊
const TRI = require('../../data/triage.js');    // 分诊：本地关键词 → 模型 → 接不住，只输出 key

const JAR_ = require('../../data/jar.js');   // 罐子的几何、物理与玻璃珠画法，shot.mjs 共用同一份
const JAR = JAR_.JAR;
const skyLayout = JAR_.skyLayout;   // 星空的排布，和 shot.mjs 共用同一份

/* 重力标度：px/s²。1500 在 250px 的罐子里落起来像玻璃珠，不像羽毛也不像铅。 */
const G_ACC = 1500;
/* 手机的加速度轴 → 屏幕坐标的重力方向。
   微信的 x/y/z 单位是 g，竖着拿的时候 a 大致就指向地面那一侧：
   竖屏时地面在设备 −y（屏幕下方），而 canvas 的 +y 也朝下，所以 y 要翻号。
   ⚠️ 这是**校准旋钮**，不是推导结果。加速度计的符号约定按平台和机型会不一样，
      真机上要是珠子往上掉、或者左右反了，只翻这两个常量，别去改 jar.js 的物理。 */
const G_SIGN_X = 1, G_SIGN_Y = -1;

/* 动物名 → CSS 类名。七只动物用线条勾形态，不用 emoji：
   craft-floor 那条"Unicode 字形或 emoji 顶替图标系统"是禁令，
   而且 emoji 在安卓和 iOS 上长得完全不一样。 */
const ANIMAL_CLS = { 犀牛: 'rhino', 梗犬: 'terrier', 鸵鸟: 'ostrich', 袋鼠: 'kangaroo',
  水母: 'jelly', 海豚: 'dolphin', 圣伯纳犬: 'stbernard' };

/* 文案里带 <br>（断行位置＝念出来的节奏）和 <b>（医学风险要点），
   交给 rich-text 原样渲染。CSS 变量在 rich-text 内部作用域里不解析，换成色值。
   ⚠️ 这个定义被我删过一次：改用 data/jar.js 时切掉了"球堆几何"那一整段，
   而它就在那段末尾。后果是 prep 一跑就 ReferenceError、setData 执行不到，
   整屏空白只剩返回键——白屏不是渲染问题，是渲染前就炸了。 */
const rich = (t) => String(t).replace(/var\(--cool\)/g, '#7FBDA9');

/* 用当日／本次内容替换屏上写死的那条。改的是渲染结果，不动 screens.js——
   原型仍是屏级文案的源，daily.js 是"同一屏每次换一条"这个维度的源。
   （这个函数曾被我改 jar.js 时连带删掉过一次，调用还在、定义没了。） */
function applyDaily(blocks, cur, wallDay) {
  if (cur === 'home') {
    const t = DAILY.pick(DAILY.taste);
    if (!t) return;
    const fi = blocks.findIndex((b) => b.k === 'food');
    if (fi < 0) return;
    /* 夜里与那场前后是「烤红薯　·　明早再看」，后缀要留着，换的只是食物名 */
    const suffix = String(blocks[fi].t).includes('·') ? '　·　明早再看' : '';
    /* 颜色和质感族跟着当日这样食物走，和牌面同一个来源（daily.js 的
       cardHue／cardTexFam）。首页这张卡是那张牌的入口，两处该是同一样东西。 */
    const [deep, lit] = DAILY.cardColor(t.food);
    blocks[fi] = { ...blocks[fi], t: rich(t.food + suffix), desc: t.desc,
                   deep, lit, tex: DAILY.cardTex(t.food) };
    const next = blocks[fi + 1];
    if (next && next.k === 'p') blocks[fi + 1] = { ...next, t: rich(t.desc) };
    return;
  }
  /* 急性期那一句每次进屏换一条。只换第一个 h 块——那是"接住"的那句，
     后面的动作和分诊一个字不动。 */
  const ac = DAILY.nextAcute(cur);
  if (ac) {
    const hi = blocks.findIndex((b) => b.k === 'h');
    if (hi >= 0) blocks[hi] = { ...blocks[hi], t: rich(ac) };
  }
  if (cur === 'taste-card') {
    /* wallDay 有值就是从书架点进来的：展开那一天的牌，不是今天的 */
    const t = DAILY.pickForDay(DAILY.taste, wallDay);
    const ci = blocks.findIndex((b) => b.k === 'card');
    if (t && ci >= 0) {
      const [deep, lit] = DAILY.cardColor(t.food);
      const md = wallDay ? wallDay.slice(5).replace('-', ' 月 ') + ' 日' : '';
      /* 她写过就用她的话，把系统那段抹掉——这个产品最后会把自己说的话还给她。
         没写过（也包括没吃过、五栏全空）就还是系统那段。 */
      const desc = MY.textFor(t.food, t.desc);
      blocks[ci] = { ...blocks[ci], food: t.food, desc: rich(desc), deep, lit, md,
        tex: DAILY.cardTex(t.food), mineOn: MY.hasMine(t.food) };

      /* 同一样食物写过好几条就按日期排开。
         ⚠️ 不夸、不显示第几条——她自己看见三月和今天不一样，那比夸有用；
            而计数就是打卡（s-passed：不用算成这个月的第几次）。 */
      const list = MY.mine(t.food);
      const add = [];
      if (list.length > 1) {
        add.push({ k: 'ti', t: '你写过的' });
        list.forEach((x) => add.push({ k: 'pastline', at: MY.label(x.at), t: x.text }));
      }
      /* 写的入口。写过了就是「再写一条」——覆盖是不对的，变化要看得见。 */
      add.push({ k: 'q', t: list.length ? '再写一条' : '写下它是什么样的', go: 'taste-write' });
      /* 先写后看：没写过自己的，这个入口不出现。
         否则她会照着别人的写，那就不是她的滋味了。 */
      if (list.length && OTH.count(t.food)) {
        add.push({ k: 'q', t: '别人写的', go: 'taste-others' });
      }

      const si = blocks.findIndex((b) => b.k === 'q');
      blocks.splice(si >= 0 ? si : blocks.length, 0, ...add);
    }
    return;
  }
  /* eat 屏：五支各有自己的颜色。原来这一屏只有文字，
     她说「这些页面还是没有食物质感」。顶上给一条那一类食物的色带——
     不放照片、不做识别（PRD：识别通往量化），质感全靠颜色、受光斑和麻点合成。 */
  if (cur === 'eat') {
    const [deep, lit] = DAILY.pickColor(D.PICK);
    const ti = blocks.findIndex((x) => x.k === 'ti');
    /* 色带上已经写着这一支的名字，下面那个层标签就重复了——换掉它 */
    if (ti >= 0) blocks.splice(ti, 1, { k: 'foodband', t: D.PICK, deep, lit });
    return;
  }
  /* passed：刚吃完那一屏。h 由上面的 nextAcute 换过了，这里换 p 和 box 那两句。
     这一屏现在只有话术，没有记录入口——「写下感受」指向 mood（就是首页六格那一屏），
     刚吃完再要她产出一条记录，是在门槛最高的时候抬门槛。 */
  if (cur === 'passed') {
    const t = DAILY.nextSoothe();
    const pi = blocks.findIndex((b) => b.k === 'p');
    if (pi >= 0) blocks[pi] = { ...blocks[pi], t: rich(t.p) };
    const bi = blocks.findIndex((b) => b.k === 'box');
    if (bi >= 0) blocks[bi] = { ...blocks[bi], t: rich(t.box) };
    return;
  }
  /* sip：一口水的三句。输入框删了之后这一屏只剩引导，那就让引导每次不一样 */
  if (cur === 'sip') {
    const [a, b2] = DAILY.nextSip();
    const ps = [];
    blocks.forEach((x, i) => { if (x.k === 'p') ps.push(i); });
    if (ps[0] !== undefined) blocks[ps[0]] = { ...blocks[ps[0]], t: rich(a) };
    if (ps[1] !== undefined) blocks[ps[1]] = { ...blocks[ps[1]], t: rich(b2) };
    return;
  }
  /* 情绪瓶子那一句每次进屏换一条 */
  if (cur === 'bottle') {
    const si = blocks.findIndex((b) => b.k === 's');
    if (si >= 0) blocks[si] = { ...blocks[si], t: rich(DAILY.nextNote()), long: false };
    return;
  }
  const pool = cur === 'mind' ? DAILY.mind : cur === 'medit' ? DAILY.medit : null;
  if (!pool) return;
  const c = DAILY.pick(pool);
  if (!c) return;
  const pi = blocks.findIndex((b) => b.k === 'player');
  if (pi >= 0) blocks[pi] = { ...blocks[pi], t: `${c.title} · ${c.min}` };
  /* 引导词是「引导词」这个层标签之后连续的 p 块 */
  const ti = blocks.findIndex((b) => b.k === 'ti' && b.t === '引导词');
  if (ti < 0) return;
  let k = 0;
  for (let i = ti + 1; i < blocks.length && blocks[i].k === 'p'; i++) {
    if (c.steps[k] !== undefined) blocks[i] = { ...blocks[i], t: rich(c.steps[k]) };
    k++;
  }
}

/* 视觉块按屏注入：文案的源是原型，视觉的源是设计画布。呼吸圆、材质条
   这类东西是视觉不是文案，所以不进 screens.js，在这儿按屏号插。
   位置：插在该屏第一个 player 之前（设计画布 Breathe 的排法）。 */
/* 两屏原来长得完全一样：同一个呼吸圆、同一套结构。
   现在按通道分开——这是从那个「轻疗愈」小程序偷来的二分，它每次给两个方案，
   一个接收型一个身体动作型，因为状态差的时候做不了动作、就只能听；
   听不进去的时候反而能动手。

   mind  正念 · 15 分钟 · 接收型  → 呼吸圆（胀缩）
   medit 冥想 · 10 分钟 · 身体锚定 → 松紧方（收紧再松开）

   PRD 那条"夜里那场不做正念——急性期解离已高，注意力不可用，失败会转成羞耻"
   也支持这个分法：注意力不可用的时候，还剩下身体。 */
const BREATH_SCREENS = ['mind'];
const RELAX_SCREENS = ['medit'];

/* 潮水三态。照 BREATH_SCREENS 的路子在小程序侧注入，原型与 gen.mjs 都不用动。
   水位是屏高的比例：from 缓动到 to，之后停在 to 上继续起伏——不能无限涨，
   涨到头看不见岸就不是潮，是水位计。
   rise 想吃：水在来，还没到。慢、幅小、由弱转强
   peak 正在吃：满、快、亮。这一屏不劝停，只是别让她觉得自己在深渊里独自发作
   ebb  吃完了：落、越来越慢、越来越淡。名字就是从这一态来的 */
const TIDE = {
  rise:  { from: .82, to: .54, dur: 20, amp: [8, 4.5, 3.5], spd: .58, dots: 110, ink: .72, ampCurve: 'grow' },
  peak:  { from: .44, to: .29, dur: 7,  amp: [26, 15, 10],  spd: 1.5, dots: 195, ink: 1.4, ampCurve: 'hold' },
  ebb:   { from: .38, to: .78, dur: 26, amp: [12, 6.5, 4.5], spd: .44, dots: 130, ink: .82, ampCurve: 'fade' },
  still: { from: .54, to: .54, dur: 1,  amp: [13, 7, 5.5],  spd: 1,   dots: 160, ink: 1,   ampCurve: 'hold' },
};
const TIDE_MODES = { urge: 'rise', during: 'peak', after: 'ebb', empty: 'still' };

/* 屏级折叠：从这个标题起、到急救线／动作按钮之前的一段收进折叠。
   都是 PRD 语气原则那条的应用——参考性内容放在动作后面且可折叠。
   入口文案直接用标题原文，不另造词。
   home  第四层「平时练的」本来就是 PRD 说的"虚线供给层 1，排最下面字最小"
   help  前两组是动作（挂哪个科／第一次怎么说），第三组是判断医生的参考标准 */
const FOLD_AT = {
  home: '平时练的',
  help: '怎么看出这个人合不合适',
  /* vom 按时间分层：屏上留「此刻」那四条手部动作（先别刷牙／水一小口／别平躺／
     下一顿到点吃），「下一顿吃点什么」是接下来几小时的事，收进折叠。
     第四条动作本身已经说了"下一顿还是到点吃"，折叠里是细节不是新信息。 */
  vom: '下一顿吃点什么',
};

/* 滋味卡：把原型里独立的 ti/food/p/s 四块重组成设计画布那张卡。
   文案还是那四块的文案，这里只改结构——结构属于视觉。
   夜里那张卡不加材质：拿掉感官细节，线索就不成立。 */
function mergeTaste(blocks) {
  const i = blocks.findIndex((b) => b.k === 'food');
  if (i < 0) return blocks;
  /* go 要带上——原来这里丢了它，于是首页那张滋味卡怎么点都没反应：
     food 块的跳转在合并成 taste 块的时候被吞了。 */
  const card = { k: 'taste', ti: '', food: blocks[i].t, go: blocks[i].go || '',
    p: '', s: '', mat: false,
    /* 由 applyDaily 挂上，见那里的注释；缺省值和牌面的 cardColor 兜底一致 */
    deep: blocks[i].deep || '#463A2A', lit: blocks[i].lit || '#A98A5E',
    tex: blocks[i].tex || '' };
  let from = i, to = i + 1;
  if (i > 0 && blocks[i - 1].k === 'ti') { card.ti = blocks[i - 1].t; from = i - 1; }
  if (blocks[to] && blocks[to].k === 'p') { card.p = blocks[to].t; card.mat = true; to++; }
  if (blocks[to] && blocks[to].k === 's') { card.s = blocks[to].t; to++; }
  return [...blocks.slice(0, from), card, ...blocks.slice(to)];
}

/* clockNow() 和它那张三场时刻表已删。首页只有一种版式了（见 screens.js 的 home），
   所以"现在是哪个时段"不再决定任何东西——留着就是一个没人读的返回值。
   三场的时间仍然写在 group 屏上，提醒用到的那份在 setRemind 里。 */

Page({
  data: { blocks: [], root: false, pick: null, slipOpen: false, star: null, balls: [], topPad: 0, onlineN: 0, seq: 0, dir: 'f', backLabel: '返回', tideMode: '', fold: [], foldLabel: '', moreOpen: false, sid: '' },

  /* options.role === 'care' 时整个 app 变成照护者端。
     入口是一张独立的小程序码（路径带 ?role=care），患者端首页没有任何通往
     那一端的入口——患者读到那七张卡里的「你会想：浪费。任性。」是负罪感投喂。
     开发者工具里切：编译模式 → 启动参数填 role=care。 */
  onLoad(options) {
    const care = (options && options.role) === 'care';
    D = care ? CARE : PATIENT;
    this.care = care;
    /* ⚠️ 试过在这儿记住上次在 entry 选的那一边（少点一次），撤回了。
       entry 那道分流是这个产品理念的核心展示点（不预设你是谁），
       现场演示必须每次可达 —— 记住之后自己这台手机就再也回不到它。
       （评委各自扫码是新用户、storage 空的，看得到；断的只有演示者那台。）
       补救方案全试过：长按重置不可发现、折叠区加入口要占 home 仅剩的 5px、
       「当天有效」在同一天演示两次照样锁死。
       一个功能需要另一个功能来补救它引入的问题，通常是它本身不该有。
       黑客松之后如果要，正确的做法是先有一个「设置」的落点，再把它放进去。 */
    this.stack = []; this.cur = care ? 'care' : 'entry'; this.newball = -1; this.recolor = -1;
    /* 演示种子：只在完全没有记录时写一次，真实使用不会覆盖 */
    if (!care) LOGD.seedIfEmpty(D.HUE);

    /* 七张反应卡挂进患者端。
       为什么可以：entry 选「为了一个我在意的人」→ worry 这条路上只有照护者，
       患者不会点那一支。而 two 屏那一行原来写着「看那七张卡」却指向 tr——
       tr 是五条动作翻译，不是七张反应卡，所以那七张永远走不到。
       屏 id 用 w- 前缀，和照护者端的 r- 分开；内容是同一份（data/react7.js）。 */
    /* 有几组屏的内容不在原型里、是代码生成的（七张反应卡、gate 的七种建议、
       two 的两支）。挂载集中在 data/runtime-screens.js —— 五个地方要挂
       （这里 + gen/chk/ia/shot 四个工具），抄五遍必漏，所以只写一份。 */
    if (!care) RUNTIME.patient(D.SCREENS);

    /* 去掉了微信导航栏（沉浸式深色），自己让出状态栏 + 胶囊按钮的高度 */
    const info = wx.getSystemInfoSync();
    this.setData({ topPad: (info.statusBarHeight || 20) + 40 });
    this.draw();
  },
  onShow() { this.draw(); },   // 回到前台重画一次：每日轮换的那几条要换
  onUnload() { this.stopTide(); this.stopJar(); if (this._on) clearInterval(this._on);
    if (this._remind) clearTimeout(this._remind); },
  onHide() { this.stopTide(); this.stopJar(); },   // 珠子的位置在 stopJar 里落盘

  /* ── 渲染 ────────────────────────────────────────────── */
  draw() {
    const s = D.SCREENS[this.cur];
    if (!s) return;
    const raw = s.body();
    let blocks = raw.map((b) => this.prep(b)).filter(Boolean);
    /* 数据里自带 tide 的屏（empty）退化成 still，映射表里的三屏各取一态 */
    const tideMode = TIDE_MODES[this.cur] || (raw.some((b) => b[0] === 'tide') ? 'still' : '');
    /* applyDaily 必须在 mergeTaste 之前：mergeTaste 会把 ti+food 合并成 taste 块，
       合并之后 applyDaily 里 findIndex(k==='food') 就找不到了，
       于是首页停在原型写死的「烤红薯」，而点进去的卡片屏走的是当日那条——
       同一天首页和卡片显示两种食物。 */
    applyDaily(blocks, this.cur, this.wallDay);
    blocks = mergeTaste(blocks);   // 可能原样返回同一个数组，所以不能原地清空它
    /* home 是 36 屏里最长的一屏（1226 字符，第二名只有 718）。PRD 视觉规格要「大字号、
       极少元素」，所以腾空间的办法不是缩字号，是减同屏元素——语气原则里那条
       「解释一律放在动作后面，且可折叠」就是授权。
       第四层「平时练的」按 PRD 本来就是「虚线供给层 1，排最下面字最小」，连同底部两链
       一起收进折叠：首屏留给日常主线（滋味 → 今天怎么样 → 那场），而「我现在不太好」
       落到拇指能到的位置——它可能是躺着、在桌子底下点的。 */
    let fold = [], foldLabel = '';
    if (FOLD_AT[this.cur]) {
      const at = blocks.findIndex((b) => b.k === 'ti' && b.t === FOLD_AT[this.cur]);
      if (at > 0) {
        foldLabel = FOLD_AT[this.cur];
        const from = blocks[at - 1] && blocks[at - 1].k === 'hr' ? at - 1 : at;
        /* 硬规则：折叠区不含 foot／b／bbig。foot 是急救线（「身体不舒服」
           「什么时候必须去医院」），PRD 写明它在底部、在拇指区——藏进折叠是错的。
           所以折叠区只到急救线之前，急救线留在流里、排在折叠入口之后。 */
        const stop = blocks.findIndex((b, i) => i >= from && ['foot', 'b', 'bbig'].includes(b.k));
        const end = stop > from ? stop : blocks.length;
        fold = blocks.slice(from, end);
        blocks = blocks.slice(0, from).concat(blocks.slice(end));
      }
    }
    /* entry 只有一句问话加两个选项，等距铺开就会上面挤、下面空一大片。
       在标题后插一个撑开的空档：标题留在顶上，选项被推到拇指区。
       用块而不用 :first-of-type —— WXSS 对伪类支持有限，那条靠运气。 */
    /* 返回键说清楚退到哪。
       换屏动画已经说了"我在往哪走"（进去从右边来、退出来从左边来），
       但没说"退回去是哪儿" —— 36 屏共用一个 page，点返回之前
       不知道会落到哪一屏，也不知道会不会直接退出小程序。
       这里先把目标算出来：和 back() 同一条链，只是不 pop。 */
    const backTo = this.stack[this.stack.length - 1] || s.back
                   || (this.care ? 'care' : 'home');
    const backIsRoot = !!(D.SCREENS[backTo] && D.SCREENS[backTo].root);
    const backLabel = this.backLabel(backTo, backIsRoot);
    if (this.cur === 'entry') {
      const hi = blocks.findIndex((b) => b.k === 'h');
      if (hi >= 0) blocks.splice(hi + 1, 0, { k: 'gap' });
    }

    /* 每日轮换：把原型里写死的那条替换成当日那条。按块型定位，不按下标——
       home 三个时段的块序不一样，写死下标会错位。 */
    /* 回填本机存过的输入与开关状态。不读就等于每次进来都清空，
       而「第一次存了之后，以后点开直接到这儿」是屏上写着的承诺。 */
    blocks.forEach((b, i) => {
      if (b.k === 'sw') blocks[i] = { ...b, on: !!wx.getStorageSync('sw:' + this.cur + ':' + b.t) };
    });

    /* 一屏有两条以上长说明时，只让第一条出「为什么」入口，其余跟着一起展开。
       否则折叠反而多出几行入口，vom 就是这么比原来只省了一半。 */
    let lead = -1;
    blocks.forEach((b, i) => {
      if (b.k === 's' && b.long) { if (lead < 0) { lead = i; b.lead = true; } else b.lead = false; }
    });
    if (BREATH_SCREENS.includes(this.cur) || RELAX_SCREENS.includes(this.cur)) {
      const at = blocks.findIndex((b) => b.k === 'player');
      const vis = RELAX_SCREENS.includes(this.cur) ? 'relax' : 'breath';
      blocks.splice(at < 0 ? blocks.length : at, 0, { k: vis });
    }
    this.stopTide();
    /* 方向有三态，不是两态：前进 f / 后退 b / 原地 s。
       原地是屏号没变的重画——onShow 从后台回来、聊天屏发一条消息补一条回复，
       这些都会整屏 draw()。当成前进就是骗人：屏没换却往左滑一下，
       发一条消息晃一下更晕。屏号一样就一律不播位移，不用去改那 15 个调用点。 */
    const dir = (this._drawn === this.cur) ? 's' : (this.dir || 'f');
    this._drawn = this.cur;
    this.setData({ blocks, root: !!s.root, pick: null, slipOpen: false, star: null,
                   seq: this.data.seq ? 0 : 1, dir, backLabel,
                   tideMode, fold, foldLabel, moreOpen: false, sid: this.cur }, () => {
      if (tideMode) this.startTide(tideMode);
    });
    this.dir = 'f';   /* 只有 back() 会拨成 'b'；画完即还原，其余入口一律算前进 */
    if (blocks.some((b) => b.k === 'machine')) this.startJar(); else this.stopJar();
    if (blocks.some((b) => b.k === 'taste' && b.mat)) this.drawMat();
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },

  /* 复杂的活在这里干完，WXML 里只取字段——WXML 表达能力弱，硬塞逻辑会写不下去 */
  prep(b) {
    const [k, ...a] = b;
    switch (k) {
      /* dim 是写给设计师的规格注，产品屏上不能出现——原型里它是浅灰小字，
         抄进小程序就成了用户能读到的正文。 */
      case 'dim': return null;
      case 'h': case 'h2': case 'p': case 'box': case 'num':
        return { k, t: rich(a[0]) };
      /* food 带第二个参数时是入口：点食物名进完整卡片（她第 14 条）。
         之前只在原型里加了目标屏、没实现点击，所以点了没反应。 */
      case 'food': return { k, t: rich(a[0]), go: a[1] || '' };
      /* s 是次级说明。长的那些是机制解释——PRD 语气原则：「解释一律放在动作后面，
         且可折叠；机制和依据是给评委和给状态好的时候看的，不是给发作当下的人看的」。
         按字数分：20 字以内是提示（"想到什么都行。"），超过就是解释，默认收起。
         这样不用维护屏级映射表，新写的文案自动适用。 */
      case 's': {
        const plain = String(a[0]).replace(/<[^>]+>/g, '');
        return { k, t: rich(a[0]), long: plain.length > 20, open: false };
      }
      /* 注：同屏多条长 s 的入口合并在 draw() 里做——prep 一次只看一块，
         看不到同屏还有没有别的 s。 */
      case 'ti': return { k, t: a[0] };   // 层标签是纯文本，不含标记
      /* 警示块：躯体安全的例外条件。永不折叠、永不截断——它是唯一
         比「一屏装下」优先级更高的东西。照护者端的三张卡在用。 */
      case 'warn': return { k, t: rich(a[0]) };
      /* 清单：可勾多条。勾选状态存在块上，不落盘——这三条不该被记成一条记录。 */
      case 'checks': return { k, items: a[0].map((t, i) => ({ t, i, on: false })) };
      /* 清单后面那个按钮：勾了任意一条去化验单那屏，都没勾直接进下一餐。 */
      case 'gatego': return { k, t: a[0] };
      /* 食物色带。eat 屏在用——一支口味一个颜色，带质感 */
      case 'foodband': return { k, t: a[0] };
      /* 三张卡。原来是三个 h2 + 三段 p 连着排，读起来像条款。
         每张卡一个念头 + 它的解释，编号不出现（craft-floor：编号不承载信息就是装饰）。 */
      case 'cards3': return { k, items: a.map((x, n) => ({ t: x[0], p: rich(x[1]), n })) };
      /* two 的两支。点进去各有一屏建议——PRD 说这两种需要的建议正好相反。 */
      case 'two2': return { k, items: [ADV.TWO.say, ADV.TWO.quiet].map((x) => ({
        t: x.nav, hint: x.hint, go: x.id })) };
      /* 到点叫我。原来是个跳回首页的按钮——点了什么也没发生。
         现在真的排一个前台提醒：到点 wx.showModal 弹「一起放松」。
         ⚠️ 只在小程序开着的时候有效。真正的锁屏推送要订阅消息（要模板 ID
         + 用户逐次授权 + 后端定时触发），那是另一件事。 */
      case 'remind': return { k, t: a[0], on: !!this._remind };
      /* 五个角度的填写栏。色/香/味/声/质地——没有好坏轴，
         这是它比「好不好吃」强的地方。「声」尤其好：没人用声音评判品行。
         hint 里的字是提示不是要求，空着走开是允许的（那天仍用系统那句）。 */
      case 'aspects': return { k, items: MY.ASPECTS.map((x) => ({
        k: x.k, hint: x.hint, v: '', say: '' })) };
      /* 四个人。顺序固定，不排名——排名就是评价。
         上一页给 intro（一句）＋ lead（他会怎么说）——她得先知道找谁。 */
      case 'mentors': return { k, items: MEN.MENTORS.map((m) => ({
        id: m.id, name: m.name, tag: m.tag, intro: m.intro, lead: m.lead })) };
      /* 说点什么。⚠️ 不写「必填」，写不出来能直接走。 */
      case 'mentorin': return { k, v: '', busy: false };
      /* 聊。消息流：她说的靠右，某一位说的靠左带名字。
         ⚠️ 「谁在说」那一行只在等的时候出现，不写「正在分析你」。 */
      case 'chat': {
        const c = this._chat || { msgs: [], to: null, waiting: [] };
        return { k,
          to: c.to ? (MEN.mentorOf(c.to) || {}).name : '',
          msgs: c.msgs.map((m) => ({
            me: !!m.me,
            who: m.me ? '' : ((MEN.mentorOf(m.who) || {}).name || ''),
            tag: m.me ? '' : ((MEN.mentorOf(m.who) || {}).tag || ''),
            pending: !!m.pending,
            t: rich(String(m.t || '').replace(/\n/g, '<br>')),
          })),
          /* 还在等谁。名字而已，没有转圈也没有进度。 */
          waiting: (c.waiting || []).map((id) => (MEN.mentorOf(id) || {}).name).filter(Boolean),
          /* 四个人一起聊的时候，可以挑一位单独接着聊 */
          /* ⚠️ 四个都说完了才问要不要挑人。还在等的时候问就是催她。 */
          pick: (!c.to && !(c.waiting || []).length && c.msgs.some((m) => !m.me && !m.pending))
            ? MEN.MENTORS.map((m) => ({ id: m.id, name: m.name })) : [],
        };
      }
      /* 以前说过的。点一条回去接着看。 */
      case 'talks': return { k, items: MEN.talks().map((r) => ({
        id: r.id, t: MEN.label(r), n: (r.msgs || []).length })) };
      /* 别人写的。⚠️ 单独一屏，绝不和她自己那条并排——并排就是比较。 */
      case 'others': {
        const food = this._wFood || '';
        return { k, items: OTH.others(food).map((o) => ({
          at: MY.label(o.at), t: o.text })) };
      }
      /* 滋味卡完整版。当日内容由 applyDaily 换掉，这里只搭结构。 */
      case 'card': {
        const [deep, lit] = DAILY.cardColor(a[0]);
        /* tex 是这样食物的质感族（烙／蒸／汤／粒／冰／糕，见 data/daily.js 的 cardTex）。
           原来 30 张牌只差颜色、纹理一模一样——她说"这不对，我要的是对应食物的质感"。 */
        return { k, food: a[0], desc: rich(a[1]), deep, lit, tex: DAILY.cardTex(a[0]) };
      }
      /* 七张反应卡的陈列。每张背景用线条勾对应动物的形态，
         理想的那两张（海豚／圣伯纳犬）多一层光。 */
      case 'animals': return { k, items: a.map((x) => ({
        t: x[0], go: x[1], animal: x[2], ideal: !!x[3],
        cls: 'a-' + ANIMAL_CLS[x[2]] })) };
      /* 卡内顶部那只动物 */
      case 'beast': return { k, animal: a[0], ideal: !!a[1], cls: 'a-' + ANIMAL_CLS[a[0]] };
      /* 卡片墙：一天一格，从第一次用的那天到今天。今天在最前。
         空着的日子格子也在——PRD：空格不是失分。 */
      case 'wall': {
        const days = LOGD.wallDays(60);
        const pool = DAILY.taste;
        const base = LOGD.dayKey();
        const items = days.map((day) => {
          /* 那一天显示的是那一天的卡：按天数差回推池子下标 */
          const diff = Math.round((new Date(base.replace(/-/g, '/')) - new Date(day.replace(/-/g, '/'))) / 864e5);
          const idx = ((DAILY.dayIndex() - diff) % pool.length + pool.length) % pool.length;
          const meals = LOGD.dayMeals(day).filter(Boolean);
          const [deep, lit] = DAILY.cardColor(pool[idx].food);
          return { day, md: day.slice(5).replace('-', '/'), food: pool[idx].food,
            deep, lit, on: meals.length > 0, today: day === base };
        });
        /* 分成一层三张——书架是一层一层的，不是一片网格 */
        const rows = [];
        for (let i = 0; i < items.length; i += 3) rows.push(items.slice(i, i + 3));
        return { k, items, rows };
      }
      /* 星空：一晚一颗。亮度是那一晚的样子，不是评分。
         位置见上面的 skyLayout：按日期哈希 + 推开，不按下标。
         点一颗星出那一晚 —— 原来是屏底列出最近三晚，那是个列表不是星空，
         而且只有三晚，别的星星点了没反应。 */
      case 'sky': {
        const ns = LOGD.nights();
        const pos = skyLayout(ns.map((n) => n.day));
        return { k, stars: ns.map((n, i) => ({
          ...n, md: n.day.slice(5).replace('-', ' / '),
          x: pos[i].x, y: pos[i].y,
          dim: ['d0', 'd1', 'd2'][n.level] || 'd1',
        })) };
      }
      /* 睡眠三档。选了要存，否则记了也看不见（原来三个按钮直接回首页）。 */
      case 'sleeppick': return { k, items: a.map((t, i) => ({ t, i, on: LOGD.sleepToday() === 2 - i })) };
      /* write（输入框）那一支删了：唯一用它的是「一口水」那屏，而存进
         wx.setStorage 的 write:sip 没有任何地方读回来给用户看。
         存了看不见等于没存，屏上那句「第一次存了之后，以后点开直接到这儿」
         是一句兑不了的承诺。她的原话：「我没懂这块存啥啊……用户怎么回看呢」。 */
      /* 开关。原来是一行静态的「声音：关」，点不动。 */
      case 'sw': return { k, t: a[0], hint: a[1] };
      case 'hr': return { k };
      case 'q':    return { k, t: a[0], go: a[1] };
      case 'b':    return { k, cls: a[0], t: a[1], go: a[2] };
      case 'bbig': return { k, t: a[0], go: a[1] };
      case 'row':  return { k, t: a[0], v: a[1] };
      /* 正反问。原来是 { go: this.cur }——点哪个都跳回本屏、什么都不存，
         所以"选不选都没用"。现在带 key，答案存本机，选中态看得出来。 */
      case 'pair2': return { k, items: a.map((x) => ({ t: x[0], go: x[1] })) };
      case 'foot':  return { k, items: a.map((x) => ({ t: x[0], go: x[1] })) };
      /* 六格 = 一天六次进食。每格独立可点，点进去记一个词，词就存在那一格上。
         原来六格是整行一个入口、填充数写死在原型里（演示假数据）；
         现在填充状态来自本机记录。 */
      case 'cells': case 'cellsGo': {
        const meals = LOGD.dayMeals();
        /* next：下一个该记的那格。六格没有文字标签（那是刻意的），
           所以「这里可以点」这件事必须由视觉说 —— 竞品的首页都有一个
           明确的「今天记录了吗」入口，这一格就是这个产品的说法。
           just：刚记完回到首页的那一格，亮一次就停，是静默完成的反馈。 */
        const next = meals.findIndex((x) => !x);
        const just = this.justCell;
        this.justCell = -1;
        return { k: 'cells', go: k === 'cellsGo' ? a[1] : '',
          cells: meals.map((w, i) => ({
            i, w: w || '', on: !!w,
            next: i === next,
            just: i === just,
            color: w && D.HUE[w] !== undefined ? D.col(w) : '',
          })) };
      }
      case 'words':
        return { k, items: a[0].map((w) => {
          const known = D.HUE[w] !== undefined;
          return { w, known, color: known ? D.col(w) : '' };
        }) };
      case 'pick':  return { k, items: a.map((x, i) => ({ t: x, wide: i === a.length - 1 })) };
      case 'online': this.startOnline(a[0]); return { k };
      case 'player': return { k, t: a[0], on: false };
      case 'clockbar': return null;   // 时段跟随系统时间，不给用户选
      case 'machine': return { k };
      /* 潮水改成屏级环境层（position:fixed 铺屏底），不占文档流高度——
         内嵌 300rpx 的 canvas 会直接吃掉四分之一屏，和「不滑动看全」冲突 */
      case 'tide': return null;
      default: return null;
    }
  },

  toggleMore() { this.setData({ moreOpen: !this.data.moreOpen }); },

  /* 睡眠三档。存下来，然后去星空看——记了要看得见 */
  pickSleep(e) {
    const i = Number(e.currentTarget.dataset.i);
    LOGD.setSleep(2 - i);          // items 顺序是 睡够了/凑合/几乎没睡 → 2/1/0
    this.pushHistory('stars'); this.cur = 'stars'; this.draw();
  },
  /* 点一颗星 → 那一晚睡得怎么样。和点一颗球同一个动作，同一种读法。 */
  tapStar(e) {
    const { day, label } = e.currentTarget.dataset;
    const m = String(day).match(/^\d{4}-(\d{2})-(\d{2})$/);
    this.setData({ star: { day, md: m ? `${Number(m[1])} 月 ${Number(m[2])} 日` : String(day), label } });
  },
  /* 点卡片墙里的一格 → 那天的完整卡片 */
  tapWall(e) {
    this.wallDay = e.currentTarget.dataset.day;
    this.pushHistory('taste-card'); this.cur = 'taste-card'; this.draw();
  },
  /* 排一个前台提醒。三场里挑最近的下一场。 */
  setRemind(e) {
    const i = e.currentTarget.dataset.i;
    if (this._remind) { clearTimeout(this._remind); this._remind = null;
      this.setData({ [`blocks[${i}].on`]: false });
      wx.showToast({ title: '不叫了', icon: 'none' }); return; }
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const slots = [17 * 60, 20 * 60 + 30, 22 * 60 + 30];
    const next = slots.find((m) => m > mins);
    /* 今天三场都过了就排明天第一场——但演示时那要等一整夜，所以给 10 秒的兜底 */
    const wait = next ? (next - mins) * 60000 : 10000;
    this._remind = setTimeout(() => {
      this._remind = null;
      wx.showModal({ title: '', content: '一起放松', showCancel: false, confirmText: '好' });
    }, wait);
    this.setData({ [`blocks[${i}].on`]: true });
    const hh = next ? `${String(Math.floor(next / 60)).padStart(2, '0')}:${String(next % 60).padStart(2, '0')}` : '一会儿';
    wx.showToast({ title: hh + ' 叫你', icon: 'none' });
  },
  /* 勾一条清单 */
  toggleCheck(e) {
    const { i, b } = e.currentTarget.dataset;
    this.setData({ [`blocks[${b}].items[${i}].on`]: !this.data.blocks[b].items[i].on });
  },
  /* 清单后面那个按钮：勾了就去看化验单，都没勾就直接下一餐。
     「都没有」原来是一个不起眼的小链接，现在合并进这一个按钮里。 */
  /* 按勾选组合跳到对应那份建议。七种组合各一屏（见 data/advice.js），
     一条都没勾就直接进下一餐。 */
  gateGo() {
    const cs = this.data.blocks.find((x) => x.k === 'checks');
    const picked = cs ? cs.items.filter((x) => x.on).map((x) => x.i) : [];
    const key = ADV.gateKey(picked);
    const to = key ? 'g-' + key : 'empty';
    this.pushHistory(to); this.cur = to; this.draw();
  },
  toggleSw(e) {
    const i = e.currentTarget.dataset.i;
    const on = !this.data.blocks[i].on;
    this.setData({ [`blocks[${i}].on`]: on });
    wx.setStorage({ key: 'sw:' + this.cur + ':' + this.data.blocks[i].t, data: on });
  },
  toggleS(e) {
    const on = !this.data.blocks[e.currentTarget.dataset.i].open;
    const d = {};
    this.data.blocks.forEach((b, i) => { if (b.k === 's' && b.long) d[`blocks[${i}].open`] = on; });
    this.setData(d);
  },

  /* ── 跳转 ────────────────────────────────────────────── */
  /* 三个入口（点条目 / 选口味 / 点词）原来各自 push 一次，策略要改就得改三处。
     收到这里：返回链有多长，只由 pushHistory 一个地方决定。 */
  /* 返回链有多长只由这里决定。三条规则叠加：
     1 进根屏就清栈——"退回主页之前"正是套娃感的来源
     2 目标已在栈里说明在绕圈（home→那场→home），截断到那一次，
       否则来回切两下就攒出一长串重复，点返回像在倒放
     3 封顶 6 层。链再长用户也不会一路点回去，只会关掉小程序
     实测：深入五层→栈 5；来回切两轮→栈 1；十层长链→栈 6 */
  pushHistory(id) {
    if (id === this.cur) return;                 // 原地跳不记
    const sc = D.SCREENS[id];
    if (sc && sc.root) { this.stack = []; return; }
    const at = this.stack.indexOf(id);
    if (at >= 0) { this.stack.length = at; return; }
    /* 栈只留最近一层。再往前走 s.back——那是数据里定义的语义父屏，
       比一长串历史更可预测：第一次返回回到来处，第二次就沿着结构往上。
       6 层那一版仍然会"退回一长串"，她说还是套娃。 */
    this.stack.push(this.cur);
    if (this.stack.length > 1) this.stack.shift();
  },

  /* ── 我写的滋味 ────────────────────────────────────────
     四条规则的实现位置都在这一段，改之前先看 data/mytaste.js 顶上的注释。 */

  /* 输错了一个字就重画整屏会顶掉输入法，所以只改块上的值，不 setData 整棵树。 */
  aspIn(e) {
    const i = Number(e.currentTarget.dataset.i);
    const v = e.detail.value;
    const bs = this.data.blocks.slice();
    const bi = bs.findIndex((b) => b.k === 'aspects');
    if (bi < 0) return;
    const items = bs[bi].items.slice();
    items[i] = { ...items[i], v };
    bs[bi] = { ...bs[bi], items };
    this.data.blocks = bs;      // 只更内存，失焦时才判
    this._asp = items;
  },

  /* 失焦时判一次。⚠️ 永远不清空她写的字，也永远不阻止保存——
     这里只决定要不要出那一句提示。 */
  aspBlur(e) {
    const i = Number(e.currentTarget.dataset.i);
    const items = (this._asp || []).slice();
    if (!items[i]) return;
    const food = this._wFood || '';
    const say = MY.gate(items[i].v);
    /* 提示只出一次。第二次写同一个角度直接收下，什么都不说——
       沉默是唯一不评价的回应。 */
    if (say && MY.shouldHint(food, items[i].k)) {
      MY.markHinted(food, items[i].k);
      items[i] = { ...items[i], say };
    } else {
      items[i] = { ...items[i], say: '' };
    }
    this._asp = items;
    const bs = this.data.blocks.slice();
    const bi = bs.findIndex((b) => b.k === 'aspects');
    if (bi >= 0) { bs[bi] = { ...bs[bi], items }; this.setData({ blocks: bs }); }
  },

  /* ── 四个人 ────────────────────────────────────────────
     ⚠️ 屏上的字要么是 data/mentor.js 里人写的，要么来自云函数（护栏在云端）。
        这一层不在前端生成任何一个字。 */

  menIn(e) { this._mText = e.detail.value; },

  /* 开一段新的。
     ⚠️ 立刻进屏，先放人写的那四段——这条链路单次要十几秒，
        让她对着空屏等十几秒是不能接受的。模型的谁回来就替换谁。 */
  menGo() {
    const t = String(this._mText || '').trim();
    if (!t) { this.back(); return; }        // 写不出来直接走，不催不追问
    this._mText = '';
    const key = MEN.triageLocal(t);
    const c = MEN.caseOf(key);              // 认不出也有通用那四段
    /* ⚠️ to 和 lead 都清空——上一段挑的那位不该带进新的一段。
       屏上出现「在和岸说」而她这次并没挑人，那是状态泄漏。 */
    /* ⚠️ 占位不放兜底文案。
       放了她会当成回答读完，然后那段字十几秒后突然换成另一段——
       等于产品说了一遍又改口。占位只说「在想」，谁写完了才放谁的。
       兜底文案留给「模型真的没拿到」那种情况（见 _askAll）。 */
    this._chat = {
      id: 'c' + Date.now(),
      at: MEN.dayKey(), key, title: c && c.title ? c.title : '',
      lead: '', to: null,
      msgs: [{ me: true, t }].concat(
        MEN.MENTORS.map((m) => ({ me: false, who: m.id, t: '', pending: true }))),
      waiting: MEN.MENTORS.map((m) => m.id),
    };
    this.pushHistory('mentor-chat');
    this.cur = 'mentor-chat'; this.draw();
    this._askAll(t);
  },

  /* 四个人各自去问，谁回来填谁那条。
     ⚠️ 不调 draw()。draw() 是整屏重建，四个人陆续回来就是重建四次，
        看起来是页面抖四下。这里只把变的那一条 setData 打进去。 */
  _askAll(text) {
    const cid = this._chat.id;
    MEN.MENTORS.forEach((m) => {
      TRI.talkOne(text, m.id, this._hist(m.id)).then((said) => {
        const c = this._chat;
        if (!c || c.id !== cid) return;      // 她已经开了新的一段
        c.waiting = c.waiting.filter((x) => x !== m.id);
        /* 拿不到就用人写的那段兜底——那时候才放，不在占位阶段放 */
        const cc = MEN.caseOf(c.key);
        const t2 = said || (cc && cc.say[m.id]) || '';
        const i = c.msgs.findIndex((x) => !x.me && x.who === m.id && x.pending);
        if (i >= 0) { c.msgs[i] = { me: false, who: m.id, t: t2 }; }
        MEN.save(this._plain(c));
        this._patch(i, t2, c);
      });
    });
  },

  /* 只更新那一条 + 还在等谁。⚠️ 这是不抖的关键。 */
  _patch(i, t, c) {
    if (this.cur !== 'mentor-chat' || i < 0) return;
    const bs = this.data.blocks || [];
    const bi = bs.findIndex((b) => b.k === 'chat');
    if (bi < 0) return;
    const d = {};
    d[`blocks[${bi}].msgs[${i}].t`] = rich(String(t).replace(/\n/g, '<br>'));
    d[`blocks[${bi}].msgs[${i}].pending`] = false;
    d[`blocks[${bi}].waiting`] = (c.waiting || [])
      .map((id) => (MEN.mentorOf(id) || {}).name).filter(Boolean);
    /* 四个都回来了才出「想单独跟谁说」——没说完话就问要不要挑人是催她 */
    if (!c.waiting.length) {
      d[`blocks[${bi}].pick`] = c.to ? []
        : MEN.MENTORS.map((m) => ({ id: m.id, name: m.name }));
    }
    this.setData(d);
  },

  /* 接着说一句。
     ⚠️ 选了一位就只问那一位——四个人同时接话会把对话变成会诊。 */
  menSend() {
    const t = String(this._mText || '').trim();
    if (!t || !this._chat) return;
    this._mText = '';
    const c = this._chat;
    c.msgs.push({ me: true, t });
    const who = c.to ? [c.to] : MEN.MENTORS.map((m) => m.id);
    c.waiting = who.slice();
    /* 先把她那句和几个「在想」占位一起放上去，然后只补内容，不整屏重画 */
    who.forEach((id) => c.msgs.push({ me: false, who: id, t: '', pending: true }));
    this.setData({ chatIn: '' });
    this.draw();
    const cid = c.id;
    who.forEach((id) => {
      TRI.talkOne(t, id, this._hist(id)).then((said) => {
        const cc = this._chat;
        if (!cc || cc.id !== cid) return;
        cc.waiting = cc.waiting.filter((x) => x !== id);
        /* ⚠️ 拿不到也要有话。
           原来是把占位撤掉，于是四个都失败时她那句话孤零零挂着——
           沉默又回来了，而这正是这一层最不该出现的东西。
           现在退回人写的那段：那些话是通用的、跟上文关系弱，
           但「有一句朴素的话」永远好过「什么都没有」。 */
        const i = cc.msgs.findIndex((x) => !x.me && x.who === id && x.pending);
        const back = (MEN.caseOf(cc.key) || {}).say || {};
        const t2 = said || back[id] || '';
        if (i >= 0) {
          if (t2) { cc.msgs[i] = { me: false, who: id, t: t2 }; }
          else { cc.msgs.splice(i, 1); }
        }
        MEN.save(this._plain(cc));
        if (t2) this._patch(i, t2, cc);
        else if (this.cur === 'mentor-chat') this.draw();
      });
    });
  },

  /* 挑一位单独接着聊。再点一次回到四个人。 */
  menTo(e) {
    const id = e.currentTarget.dataset.id;
    const c = this._chat;
    if (!c) return;
    c.to = (c.to === id) ? null : id;
    c.lead = c.to ? (MEN.mentorOf(c.to) || {}).name : '';
    MEN.save(this._plain(c));
    this.draw();
  },

  /* 带给模型的上文。
     ⚠️ 只带这一位说过的话 + 她说过的话。
     原来这里不分人，把四个人的话全传给每一位——于是模型看到自己
     「说过」别人的话，人设直接串掉，输出被护栏拦下，看起来就是没回应。
     （注释当时写的是"只带这一位"，但代码没实现。这种不一致比没注释更坏。） */
  _hist(who) {
    const c = this._chat;
    if (!c) return [];
    return c.msgs
      .filter((m) => !m.pending && String(m.t || '').trim()
        && (m.me || m.who === who))
      .slice(-8)
      .map((m) => ({ me: !!m.me, t: m.t }));
  },

  /* 落盘用的干净副本——stub 标记不存 */
  _plain(c) {
    return { id: c.id, at: c.at, key: c.key, title: c.title, lead: c.lead,
      msgs: c.msgs.map((m) => ({ me: !!m.me, who: m.who || '', t: m.t })) };
  },

  /* 从「以前说过的」点回一段接着聊 */
  menOpen(e) {
    const rec = MEN.talkOf(e.currentTarget.dataset.id);
    if (!rec) return;
    this._chat = Object.assign({}, rec, { waiting: [], to: null });
    this.pushHistory('mentor-chat');
    this.cur = 'mentor-chat'; this.draw();
  },

  /* 导出。小程序不能写文件给用户，所以走剪贴板。 */
  menCopy() {
    if (!this._chat) return;
    const t = MEN.exportText(this._plain(this._chat));
    if (t) wx.setClipboardData({ data: t });
  },

  /* 存。五栏全空就什么都不存，那天仍旧显示系统那句——
     没有「提交失败」这个状态，任何时候都能走开。 */
  aspSave() {
    const cells = {};
    (this._asp || []).forEach((x) => { cells[x.k] = x.v; });
    MY.add(this._wFood || '', cells);
    this.back();
  },

  go(e) {
    const id = e.currentTarget.dataset.id;
    /* 不是从书架点进来的，就把上次记的那一天清掉——否则从首页进也会显示那天 */
    if (id === 'taste-card') this.wallDay = null;
    /* 写／看别人写的，都要知道是哪样食物。从当前那张卡上取。 */
    if (id === 'taste-write' || id === 'taste-others') {
      const c = (this.data.blocks || []).find((b) => b.k === 'card');
      if (c) this._wFood = c.food;
      if (id === 'taste-write') this._asp = null;
    }
    if (!id || !D.SCREENS[id]) return;
    this.pushHistory(id);
    this.cur = id; this.draw();
  },
  /* 返回键上写什么。
     backTo 是点下去会落到的那一屏的 id，backIsRoot 说明它是不是根屏
     （home＝患者端的家，entry＝照护者端的家）。
     ⚠️ 这里的产出是用户读得到的文案，患者端一个临床词都不能有。 */
  backLabel(backTo, backIsRoot) {
    /* 只区分根屏和非根屏。用户在深层点返回，真正要知道的只有一件事：
       这一下是回到最上层、还是再往上一层 —— 因为回到最上层之后就没有
       返回键了，那是唯一一次状态变化。
       没有给 36 屏各起名字：屏上的标题是句子不是名字（「你来了。」
       「饭就是饭。」），搬到按钮上会很怪，而且那是十几条要维护的文案。
       home 说「今天」不说「首页」：那一屏全篇是今天的滋味／今天怎么样／
       今天三场，心理模型本来就是今天；「首页」是系统词，不是这产品的话。 */
    if (!backIsRoot) return '返回';
    return backTo === 'home' ? '今天' : '开头';
  },

  back() {
    const s = D.SCREENS[this.cur];
    this.dir = 'b';                 /* 这一屏从左边滑进来，读作"退回来的" */
    this.cur = this.stack.pop() || s.back || (this.care ? 'care' : 'home');
    this.draw();
  },
  /* 点某一格 → 去记词屏。哪一格记在 this.mealIdx 上，
     直接从「记一个词」进来（没经过格子）就落到当天第一个空格。 */
  tapCell(e) {
    this.mealIdx = Number(e.currentTarget.dataset.i);
    this.pushHistory('mood'); this.cur = 'mood'; this.draw();
  },

  setPick(e) {
    D.PICK = e.currentTarget.dataset.v;
    this.pushHistory('eat'); this.cur = 'eat'; this.draw();
  },
  tapWord(e) {
    const w = e.currentTarget.dataset.w;
    let idxJustSet = -1;
    if (D.HUE[w] !== undefined) {
      D.LAST = w;
      /* 词存到那一餐上。球是"这一天"，在 startJar 里由当天所有词聚合出来——
         这两层以前被做成了一件事（一个词一颗球），见 data/log.js 顶部的注释。 */
      const meals = LOGD.dayMeals();
      const idx = this.mealIdx !== undefined && this.mealIdx !== null
        ? this.mealIdx
        : Math.max(0, meals.findIndex((x) => !x));
      const before = meals.filter(Boolean).length;
      LOGD.setMeal(idx, w);
      idxJustSet = idx;
      this.mealIdx = null;
      /* 当天第一次记 → 罐子里多一颗，播落球；之后 → 那颗球换个颜色，弹一下 */
      const days = LOGD.balls(D.HUE);
      if (before === 0) this.newball = days.length - 1;
      else { this.newball = -1; this.recolor = days.length - 1; }
    }
    /* 记完直接回首页，不再经过 logged 屏。
       查了一圈市面上的记录类 app（Daylio 五个脸、How We Feel 的词云），
       常规路径都是「点入口 → 选一个 → 完成」两步，选完就存、自动回主界面。
       这里原来是四步：点格子 → 点词 → 点「好了」→ 回首页。
       多出来的那一步是 logged 屏，屏上写着「但这只是一个词，
       它不代表对你的任何评价」—— 那句话第一次看是这个产品的立场，
       第三十次就是每天多点一下。所以只在第一次记的时候给它。
       之后走静默完成：回首页，那一格自己亮起来（见 cells 的 justSet）。 */
    let to = 'home';
    if (D.HUE[w] !== undefined) {
      if (!wx.getStorageSync('logged:seen')) {
        wx.setStorageSync('logged:seen', 1);
        to = 'logged';
      } else {
        this.justCell = idxJustSet;       // 首页给这一格一次「刚记上」的反馈
      }
    }
    this.pushHistory(to);
    this.cur = to;
    this.draw();
  },
  tapPlay(e) {
    const i = e.currentTarget.dataset.i;
    this.setData({ [`blocks[${i}].on`]: !this.data.blocks[i].on });
  },

  /* ── 情绪瓶子：canvas + 真物理 ──────────────────────────────────
     这一屏走过三版，前两版都是 CSS 关键帧（落球三段 / 邻球被顶开），
     她说了三轮「重力效果」「滚动效果」「随着手机晃他们也会滚动」。
     关键帧走到头了：它只能播一条**事先算好**的轨迹，而"跟着手机晃"
     要求每一帧的重力方向都可能变。所以换 canvas + 每帧解位置（data/jar.js 的 step）。

     换掉的东西：DOM 里那十几个 .ball、dfall/dsquash/droll/bumphit/bumpsettle
     那五组关键帧、jar.js 里的 bump/pushVec/dropPath。
     ⚠️ 「情绪瓶子不用 canvas」那条早先的决定在这里作废了，理由就是上面这一条：
        重力和晃动不是视觉效果，是每帧的状态。 */
  startJar() {
    this.stopJar();
    wx.createSelectorQuery().in(this).select('#jarcv')
      .fields({ node: true, size: true }).exec((res) => {
        if (!res || !res[0] || !res[0].node) return;
        const cv = res[0].node;
        const W = res[0].width || JAR, H = res[0].height || JAR;
        const dpr = Math.min(2, wx.getSystemInfoSync().pixelRatio || 1);
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        const g = cv.getContext('2d');

        const days = LOGD.balls(D.HUE);
        /* 罐子内壁半径。WXSS 里 .glass 是 250×250、下半是半圆，所以内壁≈125−壁厚。
           上一版沿用几何堆叠时代的 −14，于是整堆珠子浮在罐底上方 28px。 */
        const R = Math.min(W, H) / 2 - 5;
        const d = JAR_.fitD(days.length, R);
        const r = d / 2;
        const saved = LOGD.jarPos();
        const mk = (w, h) => wx.createOffscreenCanvas({ type: '2d', width: w, height: h || w });

        /* 有存过位置的珠子直接回到原处；没存过的（今天新记的、第一次打开的）
           从罐口落进去。

           ⚠️ 出生点必须在**罐内**。上一版写的是 y = −R − d（罐口上方，罐子外面），
              于是容器约束在第 0 帧就把它瞬移到内壁——挪了 44px，
              而速度是 (x − px) / dt 回写的，44px 被当成一帧走完 → vy = 3406，
              是自然下落速度的四倍。珠子是被**弹射**进去的，不是掉进去的。
              她的原话：「情绪玻璃珠清脆的掉进去，不要弹射进去」。
              出生点挪进内壁之后实测反弹帧数 = 0：位置约束松弛本身就是完全非弹性的，
              落地"嗒"一下就停，不需要再调阻尼。 */
        const top = -(R - d / 2) + 1;
        const all = days.map((it, i) => {
          const p = saved[it.day];
          const known = Array.isArray(p) && i !== this.newball;
          return {
            day: it.day, hue: it.hue, unity: it.unity, words: it.words, i,
            x: known ? p[0] * R : (JAR_.rnd(i, 21) - 0.5) * R * 0.34,
            y: known ? p[1] * R : top,
            vx: 0, vy: 0,
            newOne: i === this.newball,        // 只有这一颗落地时震一下
            spr: JAR_.sprite(mk, d, dpr, it.hue, i, it.unity),
            wait: known ? 0 : 1,
          };
        });
        /* 已经有位置的先全部就位，没位置的排队从瓶口进 */
        const live = all.filter((x) => !x.wait);
        const queue = all.filter((x) => x.wait);

        this.jar = { cv, g, W, H, dpr, R, r, d, all, live, queue, next: 0, gx: 0, gy: G_ACC };
        this.jarTapMap = all;
        this.startTilt();
        const frame = () => {
          const j = this.jar;
          if (!j) return;
          /* 排队入罐：一颗一颗放，落进去要有先后，不然是"一团出现"。
             出生点被占着就等下一帧——硬放会和已有的珠子重叠，
             而松弛会在一帧之内把重叠推开，那就又是弹射。 */
          j.next -= 1 / 60;
          if (j.queue.length && j.next <= 0) {
            const q = j.queue[0];
            const gap = (j.d * 1.06) ** 2;
            if (j.live.every((o) => (o.x - q.x) ** 2 + (o.y - q.y) ** 2 > gap)) {
              j.live.push(j.queue.shift());
              j.next = 0.24;
            }
          }
          JAR_.step(j.live, j.r, j.R, j.gx, j.gy, 1 / 60);
          /* 「清脆」在手机上有一半是触觉：屏幕只能做到"停得干脆"，剩下那一半只有马达能给。
             只给新记那一颗——第一次打开是十几颗一起落，十几下震动是骚扰。
             判据是"速度从峰值掉下来"，不是"到底了"：它可能停在别的珠子上面。 */
          for (const q of j.live) {
            if (!q.newOne || q.rang) continue;
            const sp = Math.hypot(q.vx, q.vy);
            q.peak = Math.max(q.peak || 0, sp);
            if (q.peak > 300 && sp < q.peak * 0.25) {
              q.rang = true;
              wx.vibrateShort({ type: 'light', fail: () => {} });
            }
          }
          const gg = j.g;
          gg.setTransform(j.dpr, 0, 0, j.dpr, 0, 0);
          gg.clearRect(0, 0, j.W, j.H);
          for (const q of j.live) {
            gg.drawImage(q.spr.cv, j.W / 2 + q.x - q.spr.W / 2, j.H / 2 + q.y - q.spr.W / 2,
              q.spr.W, q.spr.W);
          }
          this._jarRaf = j.cv.requestAnimationFrame(frame);
        };
        frame();
      });
  },
  /* 跟着手机晃。重力方向每帧可能变，所以只更新 gx/gy，物理照跑。 */
  startTilt() {
    if (this._tilt) return;
    this._tilt = (a) => {
      if (!this.jar) return;
      this.jar.gx = G_SIGN_X * a.x * G_ACC;
      this.jar.gy = G_SIGN_Y * a.y * G_ACC;
    };
    wx.onAccelerometerChange(this._tilt);
    /* interval 'ui' 是 60ms 一次。'game' 更密（20ms）但这一屏不需要——
       重力方向变化本来就慢，密了只是多耗电。 */
    wx.startAccelerometer({ interval: 'ui', fail: () => { /* 没有传感器就只剩向下的重力 */ } });
  },
  stopJar() {
    if (this._jarRaf && this.jar && this.jar.cv) this.jar.cv.cancelAnimationFrame(this._jarRaf);
    this._jarRaf = null;
    if (this._tilt) { wx.offAccelerometerChange(this._tilt); wx.stopAccelerometer({ fail: () => {} }); this._tilt = null; }
    this.saveJar();
    this.jar = null;
  },
  /* 珠子停在哪儿就存在哪儿——她说"是在瓶子里存着的"。
     存相对半径的比例，不存像素：珠子数量变了直径会变，机型换了罐子尺寸也不同。 */
  saveJar() {
    const j = this.jar;
    if (!j) return;
    const map = LOGD.jarPos();
    for (const q of j.live) map[q.day] = [+(q.x / j.R).toFixed(4), +(q.y / j.R).toFixed(4)];
    LOGD.setJarPos(map);
  },
  /* 点罐子：canvas 上没有节点可以绑，所以自己按距离命中。
     touchstart 给的 x/y 是相对 canvas 的 CSS 像素。
     命中半径放宽到 1.35r —— 珠子最小的时候只有 9px，按实际半径点不到。 */
  tapJar(e) {
    const j = this.jar;
    const t = e.touches && e.touches[0];
    if (!j || !t) return;
    const px = t.x - j.W / 2, py = t.y - j.H / 2;
    let hit = null, best = (j.r * 1.35) ** 2;
    for (const q of j.live) {
      const dd = (q.x - px) ** 2 + (q.y - py) ** 2;
      if (dd < best) { best = dd; hit = q; }
    }
    if (hit) this.showDay(hit.day);
  },
  /* 点一颗球 → 那一天。先只给主题词一个词，别的都不给。
     原来是直接把当天所有词摊开成一行（'踏实 · 满足 · 香'），那读起来是一条流水账，
     而且一颗球点开就糊一屏历史，回顾就变成了对账。
     主题词是"这颗球看起来像谁"（见 data/log.js 的 dayTheme），
     要看那天的全貌得自己点「展开看看」。 */
  showDay(day) {
    const m = String(day).match(/^\d{4}-(\d{2})-(\d{2})$/);
    const slots = LOGD.dayMeals(day);
    const list = slots.filter(Boolean);
    const theme = LOGD.dayTheme(list, D.HUE);
    this.setData({
      slipOpen: false,          // 换一颗球就先收起来，不然纸条会串天
      pick: {
        day,
        md: m ? `${Number(m[1])} 月 ${Number(m[2])} 日` : String(day),
        theme: theme || '',
        color: theme && D.HUE[theme] !== undefined ? D.col(theme) : '',
        slots: slots.map((w, i) => ({ i, w: w || '', on: !!w,
          color: w && D.HUE[w] !== undefined ? D.col(w) : '' })),
        sum: DAILY.daySummary(list, theme, D.RISK || []),
      },
    });
  },
  /* 展开纸条：一阵云雾，雾散了纸条在下面。
     雾和纸条是同一个 class 驱动的两段动画（雾 .92s 自己散掉、纸条 .18s 后浮上来），
     不用第二次 setData —— 两次 setData 之间的间隔在真机上不稳，雾会卡在半空。 */
  toggleSlip() { this.setData({ slipOpen: !this.data.slipOpen }); },

  /* ── 食物材质：抽象的焦皮与橙芯，不用照片，不画一盘菜。
     设计画布用的是 SVG（feTurbulence 碎纹 + clipPath 裂口），而 WXML 没有
     <svg> 标签——所以用 canvas 重画。整套绘制在原设计的 342×118 坐标系里做，
     最后一次 scale 到实际尺寸，这样裂口的贝塞尔控制点可以原样照抄。 ─────── */
  drawMat() {
    wx.createSelectorQuery().in(this).select('#mat')
      .fields({ node: true, size: true }).exec((res) => {
        if (!res || !res[0] || !res[0].node) return;
        const cv = res[0].node;
        const W = res[0].width, H = res[0].height;
        const dpr = Math.min(2, wx.getSystemInfoSync().pixelRatio || 1);
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        const g = cv.getContext('2d');

        /* feTurbulence 的等价物：低分辨率随机图放大后自带插值平滑，
           两个尺度叠加就近似 fractalNoise。numOctaves=4 的四层里，
           后两层在 118px 高上已经看不出来，省掉。 */
        const noise = (fx, fy, pxW, pxH) => {
          const w = Math.max(2, Math.round(pxW * fx)), h = Math.max(2, Math.round(pxH * fy));
          const off = wx.createOffscreenCanvas({ type: '2d', width: w, height: h });
          const oc = off.getContext('2d');
          const id = oc.createImageData(w, h);
          for (let i = 0; i < id.data.length; i += 4) {
            const v = Math.random() * 255;
            id.data[i] = v; id.data[i + 1] = v; id.data[i + 2] = v; id.data[i + 3] = 255;
          }
          oc.putImageData(id, 0, 0);
          return off;
        };

        const PW = Math.round(W * dpr), PH = Math.round(H * dpr);
        g.save();
        g.scale(PW / 342, PH / 118);   // 原设计坐标系，控制点照抄

        // 皮
        const skin = g.createLinearGradient(0, 0, 68, 118);
        skin.addColorStop(0, '#2C2016');
        skin.addColorStop(0.46, '#1B120C');
        skin.addColorStop(1, '#241A11');
        g.fillStyle = skin; g.fillRect(0, 0, 342, 118);
        g.restore();

        // 焦皮的碎裂纹理（overlay，两个尺度）
        g.globalCompositeOperation = 'overlay';
        g.globalAlpha = 0.26;
        g.drawImage(noise(0.052, 0.11, PW, PH), 0, 0, PW, PH);
        g.globalAlpha = 0.13;
        g.drawImage(noise(0.14, 0.3, PW, PH), 0, 0, PW, PH);
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;

        g.save();
        g.scale(PW / 342, PH / 118);

        // 裂口后面那一团热光，让橙色像是从里面透出来的
        const halo = g.createRadialGradient(171, 70, 0, 171, 70, 128);
        halo.addColorStop(0, 'rgba(194,97,27,.50)');
        halo.addColorStop(0.6, 'rgba(194,97,27,.22)');
        halo.addColorStop(1, 'rgba(194,97,27,0)');
        g.save();
        g.translate(171, 70); g.scale(1, 26 / 128); g.translate(-171, -70);
        g.fillStyle = halo;
        g.beginPath(); g.arc(171, 70, 128, 0, 6.2832); g.fill();
        g.restore();

        // 裂口：不规则，两头收尖。控制点原样来自设计画布的 clipPath
        const split = () => {
          g.beginPath();
          g.moveTo(-8, 66);
          g.bezierCurveTo(42, 40, 78, 74, 116, 56);
          g.bezierCurveTo(152, 39, 186, 70, 224, 55);
          g.bezierCurveTo(262, 40, 300, 68, 350, 48);
          g.lineTo(350, 82);
          g.bezierCurveTo(300, 96, 262, 72, 224, 88);
          g.bezierCurveTo(186, 104, 152, 76, 116, 92);
          g.bezierCurveTo(78, 108, 42, 78, -8, 100);
          g.closePath();
        };

        // 橙芯
        g.save();
        split(); g.clip();
        const core = g.createRadialGradient(171, 61, 0, 171, 61, 198);
        core.addColorStop(0, '#FFC97E');
        core.addColorStop(0.34, '#E88F3A');
        core.addColorStop(0.72, '#B45A18');
        core.addColorStop(1, '#6E320D');
        g.fillStyle = core; g.fillRect(0, 0, 342, 118);
        g.restore();

        // 裂口边缘那一线焦黑。canvas 没有高斯模糊，用三层递减的粗描边近似
        g.save();
        split(); g.clip();
        const edge = (pts, w, a) => {
          g.beginPath();
          g.moveTo(pts[0], pts[1]);
          g.bezierCurveTo(pts[2], pts[3], pts[4], pts[5], pts[6], pts[7]);
          g.bezierCurveTo(pts[8], pts[9], pts[10], pts[11], pts[12], pts[13]);
          g.bezierCurveTo(pts[14], pts[15], pts[16], pts[17], pts[18], pts[19]);
          g.strokeStyle = `rgba(26,16,9,${a})`; g.lineWidth = w; g.stroke();
        };
        const top = [-8, 66, 42, 40, 78, 74, 116, 56, 152, 39, 186, 70, 224, 55, 262, 40, 300, 68, 350, 48];
        const bot = [-8, 100, 42, 78, 78, 108, 116, 92, 152, 76, 186, 104, 224, 88, 262, 72, 300, 96, 350, 82];
        for (const [w, a] of [[15, 0.16], [10, 0.2], [6, 0.3]]) { edge(top, w, a); edge(bot, w, a); }
        g.restore();

        // 底部压暗，接住下面的文字
        const fade = g.createLinearGradient(0, 72, 0, 118);
        fade.addColorStop(0, 'rgba(31,26,21,0)');
        fade.addColorStop(1, 'rgba(31,26,21,.92)');
        g.fillStyle = fade; g.fillRect(0, 72, 342, 46);
        g.restore();
      });
  },

  /* ── 潮汐：产品的中心隐喻，也是名字的来源。画的是水不是雾——
     三个不同周期叠出波线，线下是水体渐层，线上散墨点（幂分布，叠加模式
     重叠成浓淡），最后压一层纸纹。没有纸纹，墨看起来就是塑料。
     屏上不出现倒计时数字——看着秒数走本身会制造焦虑。 ─────────── */
  startTide(mode) {
    const M = TIDE[mode] || TIDE.still;
    wx.createSelectorQuery().in(this).select('#tide')
      .fields({ node: true, size: true }).exec((res) => {
        if (!res || !res[0] || !res[0].node) return;
        const cv = res[0].node;
        const W = res[0].width, H = res[0].height;
        const dpr = Math.min(2, wx.getSystemInfoSync().pixelRatio || 1);
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        const g = cv.getContext('2d');
        g.scale(dpr, dpr);

        // 纸纹：生成一次，之后每帧只贴
        const grain = wx.createOffscreenCanvas({ type: '2d', width: Math.round(W), height: Math.round(H) });
        const gg = grain.getContext('2d');
        const id = gg.createImageData(Math.round(W), Math.round(H));
        for (let i = 0; i < id.data.length; i += 4) {
          const v = 130 + Math.random() * 125;
          id.data[i] = v; id.data[i + 1] = v - 7; id.data[i + 2] = v - 18;
          id.data[i + 3] = Math.random() * 13;
        }
        gg.putImageData(id, 0, 0);

        // 墨点：小点多、大晕少（幂分布），各自漂移速度不同
        const P = [];
        for (let i = 0; i < M.dots; i++) P.push({
          px: Math.random(), off: Math.random() * 2 - 1,
          r: 3 + Math.pow(Math.random(), 2.3) * 32,
          a: (0.012 + Math.random() * 0.052) * M.ink,
          sp: 0.0035 + Math.random() * 0.014,
          ph: Math.random() * Math.PI * 2,
        });

        /* 进度：0→1 走完 dur 秒后钉住，三次缓出——潮靠近岸时自己会慢下来 */
        const prog = (t) => { const x = Math.min(1, t / M.dur); return 1 - Math.pow(1 - x, 3); };
        const level = (t) => H * (M.from + (M.to - M.from) * prog(t));
        /* 幅度随进度走：rise 由弱转强，ebb 越退越平，peak 一直满 */
        const ampK = (t) => {
          const p = prog(t);
          return M.ampCurve === 'grow' ? 0.55 + 0.45 * p
               : M.ampCurve === 'fade' ? 1 - 0.62 * p : 1;
        };
        // 三个周期叠加，所以看不出是正弦
        const wave = (x, t) => {
          const k = ampK(t), sp = M.spd;
          return level(t)
            + Math.sin((x / W) * 6.1 + t * 0.40 * sp) * M.amp[0] * k
            + Math.sin((x / W) * 10.7 - t * 0.26 * sp) * M.amp[1] * k
            + Math.sin((x / W) * 2.4 + t * 0.59 * sp) * M.amp[2] * k;
        };

        let t = 0;
        const frame = () => {
          g.clearRect(0, 0, W, H);

          // 水体
          g.beginPath();
          g.moveTo(0, H);
          for (let x = 0; x <= W; x += 4) g.lineTo(x, wave(x, t));
          g.lineTo(W, H); g.closePath();
          const wg = g.createLinearGradient(0, H * 0.30, 0, H);
          wg.addColorStop(0, `rgba(232,224,210,${(0.028 * M.ink).toFixed(4)})`);
          wg.addColorStop(0.55, `rgba(214,190,150,${(0.048 * M.ink).toFixed(4)})`);
          wg.addColorStop(1, `rgba(201,160,99,${(0.082 * M.ink).toFixed(4)})`);
          g.fillStyle = wg; g.fill();

          // 墨点：叠加模式，重叠处自然变浓，像洇开
          g.globalCompositeOperation = 'lighter';
          for (const q of P) {
            const x = (((q.px + t * q.sp) % 1.22) - 0.11) * W;
            const y = wave(x, t) + q.off * 28 + Math.sin(t * 0.75 + q.ph) * 4;
            const fade = 1 - Math.min(1, Math.abs(q.off));
            if (fade <= 0.02) continue;
            const rr = q.r * (0.86 + 0.28 * Math.sin(t * 0.45 + q.ph));
            const al = q.a * fade;
            const rg = g.createRadialGradient(x, y, 0, x, y, rr);
            rg.addColorStop(0, `rgba(242,234,220,${al.toFixed(4)})`);
            rg.addColorStop(0.42, `rgba(226,206,176,${(al * 0.5).toFixed(4)})`);
            rg.addColorStop(1, 'rgba(226,206,176,0)');
            g.fillStyle = rg;
            g.beginPath(); g.arc(x, y, rr, 0, 6.2832); g.fill();
          }
          g.globalCompositeOperation = 'source-over';

          // 波脊：一道极细的亮线，两端淡出
          g.beginPath();
          for (let x = 0; x <= W; x += 3) { const y = wave(x, t); x ? g.lineTo(x, y) : g.moveTo(x, y); }
          const cg = g.createLinearGradient(0, 0, W, 0);
          cg.addColorStop(0, 'rgba(242,234,220,0)');
          cg.addColorStop(0.22, 'rgba(242,234,220,0.15)');
          cg.addColorStop(0.78, 'rgba(242,234,220,0.15)');
          cg.addColorStop(1, 'rgba(242,234,220,0)');
          g.strokeStyle = cg; g.lineWidth = 1; g.stroke();

          g.globalAlpha = 0.55; g.drawImage(grain, 0, 0, W, H); g.globalAlpha = 1;

          t += 0.0105 * M.spd * (M.ampCurve === 'fade' ? 1 - 0.45 * prog(t) : 1);
          this._tide = cv.requestAnimationFrame(frame);
        };
        this._cv = cv;
        frame();
      });
  },
  /* 在场人数 4.5 秒一次。人数为 0 或 1 时整块不显示——
     凌晨三点看到「还有 0 个人」比看不到更糟。 */
  startOnline(base) {
    if (this._on) return;
    this.onlineN = base;
    this.setData({ onlineN: base });
    this._on = setInterval(() => {
      const step = (Math.random() < 0.3 ? 2 : 1) * (Math.random() < 0.5 ? -1 : 1);
      this.onlineN = Math.max(0, this.onlineN + step);
      this.setData({ onlineN: this.onlineN });
    }, 4500);
  },
  stopTide() {
    if (this._tide && this._cv) this._cv.cancelAnimationFrame(this._tide);
    this._tide = null;
  },
});
