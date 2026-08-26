/* 本机记录。数据不出设备（PRD：记录、情绪、设置全部走本地存储，
   这既是隐私设计，也省掉整个后端）。

   ⚠️ 这个文件是为了修一个根本性的错误而加的。
   原来的实现是：点一个词 → LOG.push([day, word]) → 罐子里多一颗球。
   于是「一颗球」等于「一个词」。而正确的模型是两层：

     餐级  一天六格，每格一个词。词存在那一餐上，格子显示那个词的颜色。
     日级  一天一颗球。球的颜色由当天所有词聚合而来（见下面 dayHue）。

   一颗球代表一天，不代表一个词——罐子是"这段时间"，不是"记了多少次"。
   PRD 也要求瓶子上不写数量：写了就成了计次。 */

const MEALS = 6;          // 一天六格，与首页六格一致
const KEY = 'meals';      // { '2026-08-22': ['温','足',null,null,null,null] }
const KEY_FIRST = 'firstDay';

/* wx 只在小程序里有。chk.mjs 与 shot.mjs 在 node 里跑，退回内存存储，
   这样两个工具不用 mock 整个 wx。 */
const store = (() => {
  if (typeof wx !== 'undefined' && wx.getStorageSync) {
    return { get: (k) => { try { return wx.getStorageSync(k) || null; } catch (e) { return null; } },
      set: (k, v) => { try { wx.setStorageSync(k, v); } catch (e) { /* 存不进就算了，不能因此崩 */ } } };
  }
  const m = {};
  return { get: (k) => (k in m ? m[k] : null), set: (k, v) => { m[k] = v; } };
})();

function dayKey(d) {
  const t = d || new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
}

function readAll() { return store.get(KEY) || {}; }
function writeAll(v) { store.set(KEY, v); }

/* 第一次用是哪天——卡片墙要从这天开始翻 */
function firstDay() {
  let f = store.get(KEY_FIRST);
  if (!f) { f = dayKey(); store.set(KEY_FIRST, f); }
  return f;
}

/* 某一天的六格。没记过的返回六个 null。 */
function dayMeals(day) {
  const all = readAll();
  const row = all[day || dayKey()];
  return Array.isArray(row) ? row.slice(0, MEALS) : new Array(MEALS).fill(null);
}

/* 往第 idx 格记一个词。同一格再记会覆盖——一餐只有一个词，
   改主意应该能改，不该变成又记了一次。 */
function setMeal(idx, word, day) {
  const d = day || dayKey();
  const all = readAll();
  const row = Array.isArray(all[d]) ? all[d].slice(0, MEALS) : new Array(MEALS).fill(null);
  row[idx] = word || null;
  all[d] = row;
  writeAll(all);
  firstDay();
  return row;
}

/* 当天记了几格——首页六格的填充数就是这个，不再用原型里那个写死的数字 */
function filledToday() { return dayMeals().filter(Boolean).length; }

/* 一天一颗球。
   ⚠️ 算术平均不行：跑过一次，11 天的色相全落在 83–97°，整罐同一种绿。
      因为算术平均天生趋中，而"香"(161°) 和"踏实"(48°) 的算术均值没有语义。
   改成把色相当角度做向量平均：
      方向 → 主色相
      模长 → 这一天有多一致（1 = 词都相近，0 = 完全分散）
   一致度映射到饱和度：一致的日子是纯色玻璃珠，杂的日子是灰调珠。
   这样罐子里才有对比，而且"那天很杂"是看得出来的，不需要写字说明。

   HUE 从外面传进来，log.js 不 require screens.js——那会把
   "本机记录"和"屏级文案"两件事绑在一起。 */
function dayHue(words, HUE) {
  let sx = 0, sy = 0, n = 0;
  for (const w of (words || [])) {
    const h = HUE[w];
    if (h === undefined) continue;
    const r = (h * Math.PI) / 180;
    sx += Math.cos(r); sy += Math.sin(r); n += 1;
  }
  if (!n) return null;
  const hue = Math.round((((Math.atan2(sy, sx) * 180) / Math.PI) + 360) % 360);
  const unity = n === 1 ? 1 : Math.hypot(sx, sy) / n;
  return { hue, unity };
}

/* 那一天的主题词。
   ⚠️ 不用"出现次数最多的词"：六格里词基本不重复，众数多半是平手，
   而且众数和球的颜色没关系——用户看到的是一颗球，说"这天的主题是 X"
   却和球色对不上，就成了两套说法。
   球的颜色是色相向量平均（dayHue），所以主题词取**离球色最近的那个词**：
   这颗球看起来最像谁，主题词就是谁。一致的日子它就是那一群词的代表，
   很杂的日子它是居中的那一个——两种情况读起来都成立。 */
function dayTheme(words, HUE) {
  const h = dayHue(words, HUE);
  if (!h) return null;
  let best = null, bd = 361;
  for (const w of (words || [])) {
    if (HUE[w] === undefined) continue;
    const raw = Math.abs(HUE[w] - h.hue) % 360;
    const d = raw > 180 ? 360 - raw : raw;      // 色环上的最短弧，359° 和 1° 只差 2°
    if (d < bd) { bd = d; best = w; }
  }
  return best;
}

/* 罐子里的球，按日期从早到晚。每一项是一天。 */
function balls(HUE) {
  const all = readAll();
  return Object.keys(all).sort().map((day) => {
    const words = all[day].filter(Boolean);
    const h = dayHue(words, HUE);
    return h === null ? null
      : { day, hue: h.hue, unity: h.unity, words, n: words.length };
  }).filter(Boolean);
}

/* ── 珠子在罐子里的位置 ────────────────────────────────────────
   她说"瓶子里的球不是随机生成啊，是在瓶子里存着的"。
   所以位置要落盘：下次打开，那颗珠子还在它上次滚到的地方。
   存成**相对罐子半径的比例**（−1…1），不存像素——珠子数量变了直径会变、
   罐子在别的机型上也不是同一个像素尺寸，存像素下次就对不上了。 */
const KEY_POS = 'jarpos';
function jarPos() { return store.get(KEY_POS) || {}; }
function setJarPos(map) { store.set(KEY_POS, map); }


/* ── 睡眠：一晚一条，一颗星 ──────────────────────────────────
   原来那三个按钮点了直接回首页，什么都不留——记了也看不见，等于没记。
   三档存成 2/1/0，星空里映射成亮度。
   ⚠️ 不打分不排名：亮度是那一晚的样子，不是"你睡得好不好"的评价。 */
const KEY_SLEEP = 'sleep';
const SLEEP = ['几乎没睡', '凑合', '睡够了'];   // 下标就是亮度档

function setSleep(level, day) {
  const all = store.get(KEY_SLEEP) || {};
  all[day || dayKey()] = level;
  store.set(KEY_SLEEP, all);
  firstDay();
  return all;
}
function sleepToday() {
  const all = store.get(KEY_SLEEP) || {};
  const v = all[dayKey()];
  return v === undefined ? null : v;
}
/* 星空：从第一次用的那天到今天，一天一颗。没记的那天不给星，
   天上有空隙是正常的——补一颗暗星等于替她记了一笔没发生的事。 */
function nights() {
  const all = store.get(KEY_SLEEP) || {};
  return Object.keys(all).sort().map((day) => ({ day, level: all[day], label: SLEEP[all[day]] || '' }));
}

/* 卡片墙：从第一次用的那天排到今天，一天一格。
   有记录的那天给当日的滋味卡，没记录的那天格子也在、是暗的。
   ⚠️ 不做连续天数、不做百分比——空格不是失分（PRD 不做清单）。 */
function wallDays(max) {
  const first = firstDay();
  const out = [];
  const [y, m, d] = first.split('-').map(Number);
  const from = new Date(y, m - 1, d);
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (let cur = new Date(t0); cur >= from; cur.setDate(cur.getDate() - 1)) {
    out.push(dayKey(cur));
    if (max && out.length >= max) break;
  }
  return out;   // 今天在最前
}

/* 演示用种子。黑客松现场要看得见球，而一个空罐子演示不了。
   只在存储完全为空时写一次，真实使用不会覆盖用户数据。
   词从传进来的 HUE 表里挑，日期倒推。 */
function seedIfEmpty(pool) {
  if (Object.keys(readAll()).length) return false;
  const now = new Date();
  const plan = [
    [10, ['踏实', '满足', '香']], [9, ['平静', '软']], [8, ['累', '空', '还行']],
    [7, ['轻松', '甜']], [6, ['紧张', '烫']], [5, ['还行', '咸', '平静']],
    [4, ['孤单', '凉']], [3, ['满足', '鲜', '踏实']], [2, ['烦', '酸']],
    [1, ['轻松', '脆', '有力气']], [0, ['温' in pool ? '温' : '平静', '甜']],
  ];
  const all = {};
  for (const [ago, words] of plan) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ago);
    const row = new Array(MEALS).fill(null);
    words.forEach((w, i) => { if (pool[w] !== undefined) row[i] = w; });
    all[dayKey(d)] = row;
  }
  writeAll(all);
  store.set(KEY_FIRST, Object.keys(all).sort()[0]);
  /* 睡眠也种几晚，否则星空是空的、演示不了 */
  const sl = {};
  [[10, 1], [9, 2], [8, 0], [7, 2], [6, 1], [5, 2], [4, 0], [3, 1], [2, 2], [1, 1]].forEach(([ago, lv]) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ago);
    sl[dayKey(d)] = lv;
  });
  store.set(KEY_SLEEP, sl);
  return true;
}

module.exports = {
  MEALS, SLEEP, dayKey, dayMeals, setMeal, filledToday, dayHue, dayTheme, balls, firstDay, seedIfEmpty,
  readAll, setSleep, sleepToday, nights, wallDays,
  jarPos, setJarPos,
};
