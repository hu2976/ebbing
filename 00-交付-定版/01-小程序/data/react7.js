/* 七张反应卡。两端共用这一份内容。

   为什么可以共用：硬隔离防的是"患者读到照护者端那些话"（比如翻译卡里的
   「你会想：浪费。任性。」——那是直接的负罪感投喂）。
   而反应卡是**内容**不是用户数据，而且它出现的两条路上都只有照护者：
     · 独立照护者端（启动参数 role=care）
     · 患者端 entry 选「为了一个我在意的人」→ worry 分支
   PRD 那句是"两边共用代码，不共用数据"——这里共用的正是代码那一侧。

   ⚠️ 逐字取自《01-定稿册》附录 C，不是 PRD 那张精简表。
   定稿册写明的设计意图：动物词条在卡片下方、加引号、可点，点开是文献原表
   （New Maudsley Model，Treasure／Schmidt 组；Beat 官方以动物类比呈现同一组反应）。
   动物是可查的记法，不是贴在人身上的标签 —— 所以正文一律不出现「你是」，
   动物名也只出现在卡片下方那一行，不进标题。 */

const REACT = [
 { id: 'rhino', nav: '想把道理讲清楚', animal: '犀牛', ideal: false,
 look: 'ta 说不吃，你就解释为什么必须吃。ta 躲开，你就追上去接着说。你说的每一句都是对的。',
 cost: '正在发生的时候讲道理，ta 听到的不是道理，是「你又要跟我吵」。',
 swap: '这一刻不谈。要谈，挑一个不挨着饭桌、也不挨着卫生间的时间。' },
 { id: 'terrier', nav: '忍不住一直提', animal: '梗犬', ideal: false,
 look: '每隔一会儿问一句「你吃了吗」。你知道自己在重复，但不问更难受。',
 cost: '提醒的次数越多，ta 越需要藏。你想制止的那个行为，正在被你的关心推着往隐蔽处走。',
 swap: '一天只说一次。说完就走开，不等回答。' },
 { id: 'ostrich', nav: '看见了但装作没看见', animal: '鸵鸟', ideal: false,
 look: '垃圾里有包装，饭后卫生间里的水声。你都看见了，但不知道从哪儿开口，于是当作没看见。',
 cost: '沉默不会让它停下来，只会让它更省事。而且 ta 多半知道你看见了。',
 swap: '不用先弄清全部。只说你看见的一件事，不带评价，也不问是不是。' },
 { id: 'kangaroo', nav: '把所有难都替 ta 挡掉', animal: '袋鼠', ideal: false,
 look: '不让 ta 做饭，不让 ta 面对聚餐，替 ta 解释，替 ta 拒绝。你宁可自己累。',
 cost: '挡得越干净，ta 越没有机会发现自己其实应付得来。',
 swap: '留一件 ta 能自己做的小事，哪怕做得不好。' },
 { id: 'jelly', nav: '自己先撑不住', animal: '水母', ideal: false,
 look: 'ta 的病让你愤怒、害怕、半夜睡不着、忍不住哭。',
 cost: '这些情绪 ta 全都收得到，然后还给你同样的失控。你们会在同一个情绪里越转越紧。',
 swap: '先管你自己那一份。你稳一点，ta 才有一个稳的地方可以靠。' },
 { id: 'dolphin', nav: '在旁边一起走', animal: '海豚', ideal: true,
 look: '不在前面拉，不在后面推。ta 慢，你就慢；ta 停下来，你就在旁边站一会儿再说话。',
 swap: '温和地推一下就够了，一次一下。方向由 ta 定。' },
 { id: 'stbernard', nav: '不慌', animal: '圣伯纳犬', ideal: true,
 look: 'ta 最需要的不是有人替 ta 着急，<br>是有人不慌。',
 swap: '先确认身体上是安全的。确认了，就可以慢下来——慢下来不是放弃，是这件事本来就快不了。',
 red: true },
];

/* 把七张卡装进某一端的 SCREENS。
   prefix   两端的屏 id 不能撞（照护者端 r-*，患者端 w-*）
   back     索引屏的返回目标
   redTo    「先确认身体是安全的」指到哪一屏（两端的红旗屏 id 不同） */
function mount(SCREENS, T, { prefix, indexId, back, redTo, title, lead }) {
 SCREENS[indexId] = { back, body: () => [
 T('h', title),
 T('s', lead),
 T('animals', ...REACT.map((r) => [r.nav, prefix + r.id, r.animal, r.ideal ? 1 : 0])),
 ] };
 REACT.forEach((r) => {
 SCREENS[prefix + r.id] = { back: indexId, body: () => {
 /* 三段照定稿册的顺序：那是什么样子（大字）／它的代价／换成什么。
         动物名单独一行放最下面，加引号——它是记法不是标签。 */
 const b = [T('beast', r.animal, r.ideal ? 1 : 0), T('h', r.nav), T('p', r.look)];
 if (r.cost) b.push(T('ti', '它的代价'), T('p', r.cost));
 b.push(T('ti', '换成什么'), T('box', r.swap));
 if (r.red && redTo) b.push(T('q', '先确认身体是安全的', redTo));
 b.push(T('s', `文献里这叫「${r.animal}」——New Maudsley Model，Treasure／Schmidt 组。动物是可查的记法，不是贴在人身上的标签。`));
 return b;
 } };
 });
 return REACT.map((r) => prefix + r.id);
}

module.exports = { REACT, mount };
