/* 四个人的说法。

   ⚠️ 屏上出现的每一个字都在这个文件里，没有一句是现场生成的。

   架构：模型只做分诊（认出这段话属于哪一类困境），回应从这里取。
   和滋味层同一条立场——**AI 只判语言，不写内容**。
   依据在 PRD 证据章：Tessa（对已告知患 ED 的用户仍推荐热量限制，一周下架）、
   Pucci 2026（临床标注 268 对中仅 44.7% 安全）、CCDH（对假装 13 岁者给 0 卡计划
   并教其隐瞒家人）、Bilen 2026（五个模型给青少年餐单平均低估 695 kcal）。
   带人设更险：「以某某的口吻」是绕过对齐的经典手法。

   ⚠️ 为什么不用弗洛伊德这类真人名：精神分析对进食障碍的经典解释是口欲期固着、
   对母亲的攻击、拒绝性成熟——把这套话对患者说出来，是把病因归到她的欲望和
   家庭关系上。而且那不是模型跑偏，是**忠实还原人设**的结果。
   换成四个流派的代言人，而这四个恰好是产品四个层的化身：
     稳住 = DBT 定时小组与急性期三屏 · 那句话 = CBT 与破戒效应那屏
     不等 = 「产品不制造动机」那条原则 · 身体 = 滋味层与正念课

   写作规则（和滋味卡同一套，chk.mjs 扫）：
     · 说有什么，不说没什么
     · 念出来，念整屏——不会对着坐在旁边的人这么说，它就是机械的
     · 屏幕上只有食物；不出现热量、份量、够不够、该不该
     · 不用「应该」「建议你」「正确做法是」
     · 不出现进度、评价、总结性判断
     · 主语不能是「你」在下判断——否定式的评价仍然是评价
     · 命名她已有的念头，不造出她没有的
*/

/* 四个人。tag 是他们各自看事情的角度，不是头衔。 */
const MENTORS = [
 { id: 'dbt', name: '岸', tag: '先过这一阵',
 intro: '不问为什么，只问你此刻手上能做什么。',
 lead: 'ta 给的都是马上能做的小动作——接一杯水、换一把椅子、把手放到凉的地方。做完一件，这一阵就过去一些。ta 不分析，也不追问。' },
 { id: 'cbt', name: '回声', tag: '那句话是谁说的',
 intro: '把你心里那句话拎出来，放在桌上听一听。',
 lead: 'ta 会引用你刚说的那句，问它是一件正在发生的事，还是一个说法。有时会问那是谁的声音、从哪儿学来的。ta 不给动作，也不安慰。' },
 { id: 'act', name: '同路', tag: '不用先感觉好',
 intro: '难受可以一直在，你也可以同时往前走一点。',
 lead: 'ta 从不劝你想开、放下。ta 说的是：一边这么难受，一边仍然可以去做本来要做的事。ta 也会点出你正在等的那个条件，然后说不用等。' },
 { id: 'body', name: '地面', tag: '此刻的身体',
 intro: '只问你身上现在什么感觉。',
 lead: '手是凉的还是温的，肩膀端着没有，脚有没有踩实。ta 只问当下的身体，不问过去，不解释道理。ta 说得比谁都短。' },
];

/* 三类困境。key 是分诊要输出的标签。
   ⚠️ cue 是给模型看的例句，不上屏——上屏会变成「原来我该这么想」。 */
const CASES = [
 {
 key: 'broken',
 /* 破戒效应。她的亲历输入原话：「干错一件事天就塌了」 */
 title: '已经这样了',
 cue: ['今天已经这样了', '干脆放弃算了', '反正都破了', '一整天都毁了', '前功尽弃'],
 say: {
 dbt: '这一阵会退。每次都会退。\n去接一杯水，或者换一把椅子坐。\n做一件就行。',
 cbt: '「都毁了」这四个字，是刚才那一件事说的，还是你替它说的？\n一天有很多个小时。刚才那一段已经过去了，后面那些还没发生。\n它们之间没有连线，是你心里那句话把它们连起来的。',
 act: '难受可以一直在。\n一边这么难受，一边去吃下一顿，这两件事不打架。',
 body: '手是凉的还是温的。\n胸口紧不紧。',
 },
 },
 {
 key: 'unworthy',
 /* 不配吃／没资格。对应 s-empty 与热量下限那一轮。
       ⚠️ 四段里一个「够不够」「多不多」都不许出现——那是产品判断的语言。 */
 title: '不该吃',
 cue: ['我不该吃这么多', '我不配', '没资格吃', '今天什么都没做', '白吃了'],
 say: {
 dbt: '这句话先放着，不用现在跟它辩。\n到点了就去吃。吃完再回来看它还在不在。',
 cbt: '「不该吃」——这话你是从哪儿学来的。\n要是别人这么说你，你会觉得 ta 说得对吗。\n同一句话从自己嘴里出来，听着像真的，其实还是一句话。',
 act: '吃饭不用先挣。\n你今天做没做成什么，和桌上有几样，是两件不相干的事。\n不用等到觉得自己可以了再吃。',
 body: '手在抖吗。\n站起来眼前有没有黑一下。',
 },
 },
 {
 key: 'hidden',
 /* 不敢让人看见。对应藏食那条亲历输入与照护者端。
       ⚠️ 不劝她说出来——「产品不制造动机」。 */
 title: '不敢让人知道',
 cue: ['被发现了怎么办', '不敢让人看见', '躲着吃', '怕 ta 问', '不想说'],
 say: {
 dbt: '不用今天就决定要不要说。\n先把门关上，自己待一会儿。\n藏着这件事很累，那个累是真的。',
 cbt: '你在怕的是被看见这件事，还是怕看见之后那句话？\n这两个怕不一样。\n如果是后者，那句话你已经在心里听过很多遍了——先看看它是谁的声音。',
 act: '可以先不说。\n不说也能去吃下一顿，也能明天照常起来。\n说不说是往后的事，今天不用一起解决。',
 body: '躲着的时候肩膀是端着的。\n松一下试试。',
 },
 },
];

/* 认不出是哪一类时的通用四段。

   ⚠️ 这一组的存在是为了让「接不住」永远不出现在正常路径上。
   之前的设计是：分诊认不出 → 沉默。但对一个刚说出口的人，
   **沉默不是中立，她会读成「连这个都接不住」**。她试的是「好累」——
   那是最普通的一句话，产品却哑了。

   这四段不针对具体困境，只是四种在场方式。
   四个人本来就不需要先认出你的问题才能陪你。 */
const ANY = {
 title: '',
 /* ⚠️ 四段刻意长短不一。
     四个人本来说话就不一样长——地面最短，回声最长。
     写成一般长会在屏上堆成四块等大的文字砖，那正是「同样大小的卡片堆叠」
     这个毛病（8-22 那轮骂过的"太死板 AI"的头号来源）。
     ⚠️ 也要说人话：念出来，不会对着坐在旁边的人这么说，就是机械的。 */
 say: {
 dbt: '先去接一杯水。\n凉的，端在手里待一会儿。',
 cbt: '刚才那句话，说的是这会儿的事，还是说的你这个人。\n听起来很像，其实是两回事。',
 act: '这样也行。不用等它过去了才开始做别的。',
 body: '肩膀松一下。',
 },
};

/* 真的什么都没有时（云函数挂了且连 ANY 都取不到）才出这段。
   ⚠️ 正常路径上永远不该看到它。
   不说「我不理解你」（那是评价她的表达），说「我这儿只有这几样」。 */
const MISS = {
 title: '这个我接不住',
 say: '这儿只有那三种说法，你说的不在里面。\n不是你说得不清楚，是这里就这么大。\n要不要看看别的，或者过会儿再来。',
 go: [['如果愿意，可以找人帮忙', 'help'], ['回到今天的滋味', 'taste-card']],
};

/* 分诊。⚠️ 模型只输出一个 key，不输出任何要上屏的字。
   这个函数是纯规则兜底版：模型不可用、超时、或返回了不认识的 key 时走它。 */
function triageLocal(text) {
 const s = String(text || '');
 let best = null, hit = 0;
 CASES.forEach((c) => {
 const n = c.cue.filter((w) => s.includes(w)).length;
 if (n > hit) { hit = n; best = c.key; }
 });
 return best; // 认不出返回 null → 走 MISS
}

/* 认不出就给通用那组——所以这个函数永远返回得出东西。 */
function caseOf(key) { return CASES.find((c) => c.key === key) || ANY; }
function mentorOf(id) { return MENTORS.find((m) => m.id === id) || null; }

/* 四个人对同一段话的说法。顺序固定，不排名——排名就是评价。 */
function replies(key) {
 const c = caseOf(key);
 if (!c) return [];
 return MENTORS.map((m) => ({ id: m.id, name: m.name, tag: m.tag, t: c.say[m.id] }));
}

/* ── 一次对话 ────────────────────────────────────────────
   ⚠️ 存的是「日期 + 主题 + 主导那一位」加消息流，全部在本机。
   她写的话存在她自己手机里，不上传、不出设备——云函数是无状态的，
   每次把最近几轮带上去，用完就没了。 */
const KEY = 'talks';
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

function dayKey(d) {
 const t = d || new Date();
 const p = (n) => String(n).padStart(2, '0');
 return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
}

/* 一次对话：{ at, key, title, lead, msgs:[{ me, who, t }] }
   msgs 里 me=true 是她说的；me=false 时 who 是哪一位。 */
function save(rec) {
 if (!rec || !rec.msgs || !rec.msgs.length) return null;
 const all = store.get(KEY) || [];
 const i = all.findIndex((x) => x.id === rec.id);
 if (i >= 0) all[i] = rec; else all.push(rec);
 store.set(KEY, all);
 return rec;
}

function talks() { return (store.get(KEY) || []).slice().reverse(); } // 新的在前
function talkOf(id) { return (store.get(KEY) || []).find((x) => x.id === id) || null; }

/* 「3 月 12 日 · 已经这样了 · 岸」。⚠️ 不显示第几次——计数就是打卡。 */
function label(rec) {
 const [, mo, d] = String(rec.at).split('-');
 const t = [`${Number(mo)} 月 ${Number(d)} 日`];
 if (rec.title) t.push(rec.title);
 if (rec.lead) t.push(rec.lead);
 return t.join(' · ');
}

/* 导出成一段纯文本。她要能拿走。 */
function exportText(rec) {
 if (!rec || !rec.msgs) return '';
 const head = label(rec);
 const body = rec.msgs.map((m) => (m.me ? '我：' + m.t
 : `【${(mentorOf(m.who) || {}).name || ''}】${m.t}`)).join('\n\n');
 return `${head}\n\n${body}\n`;
}

module.exports = {
 MENTORS, CASES, MISS, ANY,
 triageLocal, caseOf, mentorOf, replies,
 save, talks, talkOf, label, exportText, dayKey,
};
