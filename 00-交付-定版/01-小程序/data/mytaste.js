/* 我写的滋味。

   这一层要解的事，是她自己说过的那句「我的食物滋味消失了是不是」——
   一个人对食物的语言只剩下数字，说不出「香」，只能说「多少卡」。
   所以这里做的不是记录吃了什么（那是评价她），是把形容词还回去。

   四条规则，每一条都是被推翻很多次之后剩下的：

   1. 存和给别人看是两个权限。
      她写什么都存，永远在她自己手机里。门槛只决定这条会不会进公共池。
      → 所以产品从头到尾没有否定过她任何一个字。昨天那个「拒绝还是引导、
        删了是不是强权」的死结，就是把这两件事捆在一起才解不开的。

   2. 提示一次，第二次沉默。
      第一次那一栏下面出一句「这是判断，不是味道」，字不清空；
      再写同一个词就直接收下，不提示、不解释、不安慰。
      沉默是唯一不评价的回应。

   3. 空着就用系统那句。
      没有「提交失败」这个状态——任何时候都能走开，卡片一定存得下来。
      这个默认值是让整道门槛不伤人的那个零件：有它，提示才是建议；
      没它，提示就是「你不改就别想走」。

   4. 不夸、不计数。
      同一样食物可以写很多条，按日期排开。她自己看见三月和八月不一样，
      那比任何一句「有新的感受了不错啊」都强——而且夸会给变化定方向，
      如果这次比上次更难受呢。只显示日期，不显示「第 3 条」（计数就是打卡，
      s-passed 写过「不用算成这个月的第几次」）。

   门槛不是正能量过滤器，是「描述 vs 判断」过滤器：
     恶心   → 拦。它是身体反应加判断，不是气味也不是滋味。
     像屎一样 → 拦。是比喻。
     臭     → 放行。臭是真实的气味，臭豆腐、臭鳜鱼、蓝纹奶酪。
   规则对称，不偏向好话：「入口即化」被拦的理由和「恶心」一模一样。
   → 台上那句：我们不要求她说好话，只要求她说的是味道。
*/

const KEY = 'mine';       // { '烤红薯': [{ at, cells:{色,香,味,声,质地}, text, pub }] }
const KEY_HINTED = 'mineHinted';   // 已经提示过的角度，提示只出一次

const store = (() => {
  if (typeof wx !== 'undefined' && wx.getStorageSync) {
    return {
      get: (k) => { try { return wx.getStorageSync(k) || null; } catch (e) { return null; } },
      set: (k, v) => { try { wx.setStorageSync(k, v); } catch (e) { /* 存不进也不能崩 */ } },
    };
  }
  const m = {};
  return { get: (k) => (k in m ? m[k] : null), set: (k, v) => { m[k] = v; } };
})();

/* 五个角度。没有好坏轴——这是它比「好不好吃」强的地方。
   「声」尤其好：没人会用声音评判一个人的品行。

   lead 是串联时加在她的词前面的骨架字。
   ⚠️ 骨架不是替换：「香甜」→「闻着香甜」，她的词一个字没动，只是有了句子。
      早前一版只用句号连缀，出来是「白色。香甜。暖呼呼的味道。」——
      五个碎片摆在一起不是话，而且「不换词」被我执行成了「不加词」，那是过头了。 */
const ASPECTS = [
  { k: '色', hint: '什么颜色，什么样子' },
  { k: '香', hint: '闻起来' },
  { k: '味', hint: '嘴里是什么' },
  { k: '声', hint: '有没有声音' },
  { k: '质地', hint: '牙齿和手的感觉' },
];

/* 「味」的骨架跟着食物走：喝的和吃的不一样。 */
const DRINK = /汤|粥|茶|奶|浆|水|饮|咖啡|可乐|酒|露/;

/* 她写的已经是一句完整的话就别插手——
   「整只手都是那个味」加了「闻着」变成「闻着整只手都是那个味」，读着别扭。

   判据用长度，不用正则查动词。
   ⚠️ 试过列一张动词表（是/有/在/会/都/一…），结果把「什么都不加也有一点甜」
      和「越靠里越甜」这类也当成成句了——那几个字在形容词里同样常见。
      拿正则做中文句法判断这条路走不通。
   长度是个糙但稳的近似：短的多半是形容词碎片，需要骨架；
   长的多半自带主谓，不该插手。中间那段宁可不加——少一个字不难看，加错才难看。 */
function needLead(v) {
  const s = String(v || '').trim();
  return s.length >= 1 && s.length <= 6;
}

function leadFor(aspect, food, v) {
  if (!needLead(v)) return '';
  /* ⚠️ 判断词不加骨架。「恶心」加成「喝着恶心」更难看，
     而且骨架是给描述用的——判断本来就不该被顺成一句话。 */
  if (gate(v) !== null) return '';
  if (aspect === '香') return '闻着';
  if (aspect === '味') return DRINK.test(String(food || '')) ? '喝着' : '吃着';
  return '';
}

/* 那一栏等于没写：空的，或者她写的就是「没有」「无」这类。
   ⚠️ 用户在「声」里写「没有」是常事（热牛奶确实没声音），
      那一栏不该占一句——早前一版把「没有。」原样搬上了卡面。 */
const EMPTY = /^(没有|无|没|不知道|想不起来|说不上来|不清楚|没注意|\/|-|—|无声)$/;
function blank(v) {
  const s = String(v || '').trim();
  return !s || EMPTY.test(s);
}

/* ── 门槛 ──────────────────────────────────────────────
   纯规则，不用模型。这三类占了绝大多数，模型留给真正模糊的。 */

/* 判断词：说的是「我怎么评价它」，不是「它是什么」。
   注意这张表两头都收：恶心和入口即化同罪。 */
const JUDGE = [
  '恶心', '难吃', '好吃', '美味', '难闻', '绝了', '绝绝子', '一般般',
  '入口即化', '唇齿留香', '回味无穷', '人间美味', '垃圾', '恶臭',
  '健康', '不健康', '有营养', '没营养', '该吃', '不该吃', '罪恶',
];

/* 比喻标记。「像屎一样」走这条，不用单独列脏词。 */
const SIMILE = ['像', '似的', '一样', '仿佛', '如同', '好比', '般'];

/* 欲望词与身体判断——不是味道，是她对自己的判断 */
const DESIRE = ['想吃', '馋', '忍不住', '控制不住', '胖', '瘦', '长肉'];

/* 数字与份量：屏幕上只有食物 */
const NUM = /\d|卡路里|大卡|千卡|热量|克重|斤|多少钱/;

/* 返回 null 表示这一栏可以进公共池；否则返回该说的那句话。
   ⚠️ 任何情况下都不阻止保存——这个函数只决定 pub 标志。 */
function gate(text) {
  const s = String(text || '').trim();
  if (blank(s)) return null;      // 等于没写，不判
  if (NUM.test(s)) return '这里只放味道，不放数字。';
  for (const w of JUDGE) if (s.includes(w)) return '这是判断，不是味道。';
  for (const w of SIMILE) if (s.includes(w)) return '这是个比喻。';
  for (const w of DESIRE) if (s.includes(w)) return '这说的是你，不是它。';
  return null;
}

/* 提示只出一次。第二次写同一个角度直接收下，什么都不说。 */
function shouldHint(food, aspect) {
  const h = store.get(KEY_HINTED) || {};
  return !(h[food] && h[food][aspect]);
}
function markHinted(food, aspect) {
  const h = store.get(KEY_HINTED) || {};
  h[food] = h[food] || {};
  h[food][aspect] = 1;
  store.set(KEY_HINTED, h);
}

/* ── 串联 ──────────────────────────────────────────────
   把五个角度串成一句她自己的话。

   ⚠️ 一个词都不许换，但可以加骨架字。这两件事早前被我混成了一件：
      第一版只用句号连缀，热牛奶那张卡出来是
        「白色。香甜。暖呼呼的味道。没有。软软的，流动。」
      ——五个碎片摆在一起不是话，而「没有」是她在「声」那栏写的，
      本来等于空着，却占了一句。
      「不换词」说的是不许替换她的形容词；加「闻着」「喝着是」是给句子加骨头，
      不是替换。verify() 校验的方向因此也反过来：查她的每个词还在不在，
      不查有没有多出字。 */
function stitch(cells, food) {
  const parts = [];      // [角度, 那一句]
  ASPECTS.forEach((a) => {
    const v = String(cells[a.k] || '').trim();
    if (blank(v)) return;                       // 空的那一栏不占一句
    const lead = leadFor(a.k, food, v);
    parts.push([a.k, lead ? lead + v : v]);
  });
  if (!parts.length) return '';
  /* 质地紧跟在味后面时用逗号接住——「喝着是暖呼呼的味道，软软的」；
     另起一句会把同一口里的两件事拆开。其余一律句号（句子短是写作规则之一）。 */
  return parts.reduce((out, [k, t], i) => {
    if (!i) return t;
    const sep = (k === '质地' && parts[i - 1][0] === '味') ? '，' : '。';
    return out + sep + t;
  }, '') + '。';
}

/* 她写的每一个词都必须原样留在结果里。返回 true 才算合格。
   ⚠️ 方向是「她的词还在不在」，不是「有没有多出字」——
      骨架字（闻着／喝着是）本来就是多出来的，那是句子的骨头不是替换。
      将来接模型生成串联版本时，这个函数是那道硬闸：模型把「黏手」改成
      「绵密」就会在这里被逮住，退回用 stitch()。 */
function verify(cells, text, food) {
  const t = String(text || '');
  return ASPECTS.every((a) => {
    const v = String(cells[a.k] || '').trim();
    return blank(v) || t.includes(v);
  });
}

/* ── 存 ────────────────────────────────────────────────
   全填空 → 不存，那天仍旧显示系统那句（也包括「没吃过」）。 */
function add(food, cells) {
  /* 五栏都等于没写（含「没有」这类）就不存，那天仍旧显示系统那句 */
  const has = ASPECTS.some((a) => !blank(cells[a.k]));
  if (!has) return null;
  const text = stitch(cells, food);
  const entry = {
    at: dayKey(),
    cells: Object.assign({}, cells),
    text,
    /* 五个角度全部过闸才进公共池。有一栏是判断，整条只留在她这儿。 */
    pub: ASPECTS.every((a) => blank(cells[a.k]) || gate(cells[a.k]) === null),
  };
  const all = store.get(KEY) || {};
  all[food] = (all[food] || []).concat([entry]);
  store.set(KEY, all);
  return entry;
}

function dayKey(d) {
  const t = d || new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
}

/* 某样食物我写过的所有条，旧的在前——时间线要看得出变化 */
function mine(food) {
  const all = store.get(KEY) || {};
  return (all[food] || []).slice();
}

/* 卡面上显示谁的话。

   ⚠️ 这里取的是最后一条**过了门槛的**，不是最后一条。
   存下来、上时间线、上卡面，是三个不同的层：
     存      —— 她写什么都存，永远在（存 ≠ 给别人看）
     时间线  —— 全都在，包括「恶心」。变化要看得见
     卡面    —— 只放过了门槛的那条
   理由：这张卡是她每天会再看到的东西。把最难受那句挂在最显眼的地方，
   等于每天提醒她一次。这不是删她的字——那条在时间线里原样留着。
   一条合格的都没有就退回系统那句。 */
function textFor(food, sysDesc) {
  const ok = mine(food).filter((x) => x.pub);
  return ok.length ? ok[ok.length - 1].text : sysDesc;
}

function hasMine(food) { return mine(food).length > 0; }

/* 日期显示成「3 月 12 日」。不显示第几条——计数就是打卡。 */
function label(at) {
  const [, m, d] = String(at).split('-');
  return `${Number(m)} 月 ${Number(d)} 日`;
}

module.exports = {
  ASPECTS, blank, gate, shouldHint, markHinted, stitch, verify,
  add, mine, textFor, hasMine, label, dayKey,
};
