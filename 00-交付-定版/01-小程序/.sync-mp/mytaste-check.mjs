/* 「我写的滋味」这一层的自检。node .sync-mp/mine-check.mjs
   两条最要紧的断言，改代码时先看它们还过不过：
     · 写了「恶心」照样存下来（存 ≠ 给别人看）
     · 润色过的串联退回（AI 只判语言，不写内容）*/
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const M = require('../data/mytaste.js');
const O = require('../data/others.js');
const a = (c, m) => { if (!c) { console.log('✗ ' + m); process.exitCode = 1; } else console.log('✓ ' + m); };

// 门槛：拦判断，不拦真实感受
a(M.gate('恶心') !== null, '拦「恶心」');
a(M.gate('像屎一样') !== null, '拦「像屎一样」');
a(M.gate('入口即化') !== null, '拦「入口即化」——规则对称，不偏向好话');
a(M.gate('臭') === null, '放行「臭」（臭豆腐、臭鳜鱼是真实气味）');
a(M.gate('酸了') === null, '放行「酸了」');
a(M.gate('发苦') === null, '放行「发苦」');
a(M.gate('黏手') === null, '放行「黏手」');
a(M.gate('凉了') === null, '放行「凉了」');
a(M.gate('300大卡') !== null, '拦数字');
a(M.gate('想吃') !== null, '拦欲望词');
a(M.gate('') === null && M.gate(null) === null, '空栏不拦');

// 核心：写什么都存，门槛只决定进不进公共池
const bad = M.add('白粥', { 色: '白的', 味: '恶心' });
a(bad !== null, '写了「恶心」照样存下来——产品没有否定她任何一个字');
a(bad.pub === false, '但它不进公共池');
const good = M.add('白粥', { 色: '表面结了皮', 质地: '稠' });
a(good.pub === true, '合格的那条进公共池');

// 全空不存 → 那天仍显示系统那句
a(M.add('米饭', { 色: '', 香: '', 味: '', 声: '', 质地: '' }) === null, '五栏全空不存');
a(M.textFor('米饭', '系统那句') === '系统那句', '没写过 → 用系统那句');
a(M.textFor('白粥', '系统那句') === good.text, '写过 → 用她最后写的那条');

// 提示只出一次
a(M.shouldHint('白粥', '味') === true, '第一次要提示');
M.markHinted('白粥', '味');
a(M.shouldHint('白粥', '味') === false, '第二次沉默——不提示不解释不安慰');

// 串联：一个词都不许换，但可以加骨架
const cells = { 色: '皮上有一块黑的', 质地: '中间那口是化的' };
const t = M.stitch(cells, '烤红薯');
a(M.verify(cells, t) === true, 'stitch 的结果逐词校验能过');
a(M.verify(cells, '绵密细腻，口感丰富') === false, '润色过的退回——她要拥有的是自己的形容词');

// 「没有」等于没写（她在「声」里写「没有」是常事）
a(M.blank('没有') && M.blank('') && M.blank('说不上来'), '「没有」这类等于没写');
a(!M.blank('香甜'), '真的写了就不算空');
const milk = { 色:'白色', 香:'香甜', 味:'暖呼呼的味道', 声:'没有', 质地:'软软的，流动' };
const mt = M.stitch(milk, '热牛奶');
a(!mt.includes('没有'), '「没有」不上卡面——空的那一栏不占一句');
a(mt.includes('闻着香甜'), '短的形容词加骨架：香甜 → 闻着香甜');
a(mt.includes('喝着'), '喝的东西用「喝着」，不是「吃着」');
a(M.stitch({ 味:'咸' }, '排骨汤').startsWith('喝着咸'), '单字也加骨架——「咸。」裸着不成话');
// 已经成句的不插手
a(!M.stitch({ 香:'整只手都是那个味' }, '烤红薯').startsWith('闻着'),
  '她写的已经成句就别加骨架——「闻着整只手都是那个味」读着别扭');
a(M.stitch({ 味:'鲜', 质地:'皮会垂下去' }, '小笼包').includes('鲜，皮会垂下去'),
  '质地紧跟味用逗号接住，不另起一句');

// 时间线：多条、不计数
const list = M.mine('白粥');
a(list.length === 2, '同一样食物存得下多条');
a(list.every(x => x.at), '每条都带日期');
a(/月.*日/.test(M.label(list[0].at)), '日期显示成「几月几日」，不显示第几条');

// 别人写的
a(O.count('烤红薯') > 0, '公共池有种子——摆摊时不会是空的');
const o = O.others('白粥');
a(o.length > 0 && o[0].at <= o[o.length-1].at, '别人写的按时间排，旧的在前');
