/* 运行时挂进 SCREENS 的那些屏，集中在这里挂一次。

   ⚠️ 为什么需要这个文件：有几组屏的内容不在原型里，是代码生成的——
   七张反应卡（data/react7.js）、gate 的七种建议、two 的两支（data/advice.js）。
   `index.js` 的 onLoad 会挂它们，而 gen.mjs / chk.mjs / ia.mjs / shot.mjs
   四个工具各自 require 原始数据，看不到这些屏。
   前两轮的做法是**在四个工具里各抄一遍挂载代码**——加一组屏就要改五个地方，
   而且每次都漏掉一两个，于是"死链"和"孤岛"报个不停。
   现在挂载只写在这里，五处都调它。

   patient(SCREENS) 患者端；caregiver 那一侧的七张卡由 care.js 自己挂。 */
const R7 = require('./react7.js');
const ADV = require('./advice.js');
const MY = require('./mytaste.js');
const MEN = require('./mentor.js');

const T = (k, ...a) => [k, ...a];

function patient(SCREENS) {
 if (SCREENS['g-A']) return SCREENS; // 挂过就不再挂

 /* 「我写的滋味」两屏。放在这里而不是原型里：原型是 26 屏文案的唯一源，
     门槛最高；这两屏是新增功能屏，内容由 mytaste.js 决定，不是文案。 */

 /* 写：五个角度。
     ⚠️ 不写「请填写」「必填」——五栏全空也能走，那天仍旧显示系统那句。
     引导词不催她："想到哪个写哪个" 而不是 "把它们填完"。 */
 SCREENS['taste-write'] = { back: 'taste-card', body: () => {
 const b = [T('h', '它是什么样的。')];
 b.push(T('aspects'));
 b.push(T('s', '想到哪个写哪个。都想不起来也没关系，这一张就还是原来那段。'));
 return b;
 } };

 /* 看别人写的。
     ⚠️ 两条硬规则由 index.js 的入口判断保证：
        · 先写后看——没写过自己的，这屏的入口不出现
        · 不并排——单独一屏，绝不和她自己那张放一起（并排就是比较） */
 SCREENS['taste-others'] = { back: 'taste-card', body: () => [
 T('h', '别人写的。'),
 T('others'),
 T('s', '没有回复，也看不到是谁。就是些句子。'),
 ] };

 /* 四个人。四屏：认识他们 → 说点什么 → 聊 → 以前说过的。
     ⚠️ 屏上每个字要么在 data/mentor.js 里（人写的兜底），
        要么来自云函数 talk（模型生成，三道护栏在云端）。 */

 /* 认识他们。⚠️ 第一句不是指令也不是提问（语气原则第一条）。 */
 SCREENS['mentors'] = { back: 'home', body: () => [
 T('h', '四个人在这儿。'),
 T('s', '同一件事，ta 们看的地方不一样。说给谁听都行，也可以四个一起听。'),
 T('mentors'),
 T('q', '说点什么', 'mentor-say'),
 T('q', '以前说过的', 'mentor-past'),
 ] };

 /* 说点什么。⚠️ 不追问、不催——写不出来能直接走。 */
 SCREENS['mentor-say'] = { back: 'mentors', body: () => [
 T('h', '今天怎么样。'),
 T('mentorin'),
 T('s', '写一句就够，写不出来就先放着。'),
 ] };

 /* 聊。消息流 + 底部输入框，像和人说话，不像查询结果。 */
 SCREENS['mentor-chat'] = { back: 'mentors', body: () => [
 T('chat'),
 ] };

 /* 以前说过的。点一条能回去接着看。 */
 SCREENS['mentor-past'] = { back: 'mentors', body: () => [
 T('h', '以前说过的。'),
 T('talks'),
 T('s', '都存在这台手机上。'),
 ] };

 /* gate 的七种组合，各一屏建议 */
 Object.keys(ADV.GATE).forEach((key) => {
 const a = ADV.GATE[key];
 SCREENS['g-' + key] = { back: 'gate', body: () => {
 const b = [T('h', a.h), T('p', a.p), T('box', a.box), T('s', a.s)];
 if (a.go) b.push(T('q', a.go[0], a.go[1]));
 /* 原来这里还统一加一条「下一餐怎么吃」→ empty。
         但这一屏本身讲的就是下一餐怎么吃，再给一个同名入口就是套娃。
         要回去看别的，返回键在。 */
 return b;
 } };
 });

 /* two 的两支。每支末尾直接放它对应的那两张卡——
     七张卡的总入口从 two 屏移走了（她说不要在那页进入）。 */
 [ADV.TWO.say, ADV.TWO.quiet].forEach((x) => {
 SCREENS[x.id] = { back: 'two', body: () => {
 const b = [T('h', x.h), T('p', x.p), T('box', x.box), T('s', x.s)];
 if (x.s2) b.push(T('s', x.s2));
 if (x.cards) {
 b.push(T('ti', x.cardLead));
 b.push(T('animals', ...x.cards.map((cid) => {
 const r = R7.REACT.find((y) => y.id === cid);
 return [r.nav, 'w-' + r.id, r.animal, r.ideal ? 1 : 0];
 })));
 }
 return b;
 } };
 });

 /* 七张反应卡。worry 分支这条路上只有照护者，所以这一端也挂 */
 R7.mount(SCREENS, T, {
 prefix: 'w-', indexId: 'w-react', back: 'worry', redTo: 'sos',
 title: '你自己的反应，<br>也在起作用。',
 lead: '这七张不给人贴标签，只给反应命名。前五种有代价，后两种是理想的样子。',
 });
 return SCREENS;
}

module.exports = { patient };
