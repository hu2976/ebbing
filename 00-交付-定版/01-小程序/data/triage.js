/* 分诊：认出这段话属于哪一类困境。

   ⚠️ 这个文件从头到尾不产生任何要上屏的字。
   它只输出一个 key（'broken' / 'unworthy' / 'hidden' / null），
   屏上的话全部来自 data/mentor.js。
   这是「AI 只判语言，不写内容」在这一层的执行——和滋味层同一条立场。

   三级，从便宜到贵，早退出：

     1. 本地关键词  零成本、零延迟、断网可用。摆摊时评委输的多半是常见说法，
                    这一级就中了。
     2. 模型        本地没中才调。⚠️ 没配 key 就直接跳过，整条链照样走通——
                    模型是补救，不是依赖。
     3. 接不住      两级都没中。出 MISS 那段。
                    ⚠️ 这不是失败，是立场：知道自己边界的产品比什么都敢答的可信。

   ── 关于 key ─────────────────────────────────────────────
   两条路，差别不在技术在安全：
     · 云函数     key 在云端，前端拿不到。安全，但要开通云开发。
     · 前端直连   key 写在小程序里，**反编译就能拿走**，别人能刷你的额度。
   现在两条都没走：CFG.endpoint 是空的，于是第 2 级被跳过。
   要接哪条，填 CFG 就行，其余代码不用动。 */

const MEN = require('./mentor.js');

/* 留空 = 不调模型。
   走云函数：type:'cloud'，name 填云函数名。
   走直连：  type:'http'，url 和 key 填上（⚠️ key 会随包发出去）。 */
const CFG = {
  type: '',        // '' | 'cloud' | 'http'
  name: 'triage',  // 云函数名
  url: '',         // 直连时的完整地址
  key: '',         // 直连时的密钥
  model: 'deepseek/deepseek-v4-flash',
  timeout: 4000,   // ⚠️ 摆摊网络不可控，超时就走「接不住」，不能让她干等
};

/* 给模型的话。⚠️ 只让它选一个标签，不让它写一个字。
   例句来自 mentor.js 的 cue——那些例句不上屏（chk.mjs 扫这条）。 */
function prompt(text) {
  const list = MEN.CASES.map((c) =>
    `${c.key}：${c.title}。比如「${c.cue.slice(0, 3).join('」「')}」`).join('\n');
  return `把下面这段话归到一类里。

${list}
none：不属于上面任何一类

只回答一个标签（${MEN.CASES.map((c) => c.key).join(' / ')} / none），不要解释，不要多余的字。

这段话：${String(text).slice(0, 200)}`;
}

/* 模型只可能回这几个词。回了别的一律当 none——
   ⚠️ 这一步是硬闸：模型返回的东西永远只能是一个已知 key，不会变成屏上的字。 */
function parseKey(raw) {
  const s = String(raw || '').trim().toLowerCase();
  const hit = MEN.CASES.find((c) => s.includes(c.key));
  return hit ? hit.key : null;
}

function askCloud(text) {
  return new Promise((resolve) => {
    if (typeof wx === 'undefined' || !wx.cloud) { resolve(null); return; }
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve(null); } }, CFG.timeout);
    wx.cloud.callFunction({
      name: CFG.name,
      data: { text: String(text).slice(0, 200) },
      success: (r) => { if (!done) { done = true; clearTimeout(t); resolve(parseKey(r && r.result)); } },
      fail: () => { if (!done) { done = true; clearTimeout(t); resolve(null); } },
    });
  });
}

function askHttp(text) {
  return new Promise((resolve) => {
    if (typeof wx === 'undefined' || !CFG.url) { resolve(null); return; }
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve(null); } }, CFG.timeout);
    wx.request({
      url: CFG.url,
      method: 'POST',
      header: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + CFG.key },
      data: {
        model: CFG.model,
        temperature: 0,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt(text) }],
      },
      success: (r) => {
        if (done) return;
        done = true; clearTimeout(t);
        const d = r && r.data;
        const c = d && d.choices && d.choices[0] && d.choices[0].message;
        resolve(parseKey(c && c.content));
      },
      fail: () => { if (!done) { done = true; clearTimeout(t); resolve(null); } },
    });
  });
}

/* 唯一的出口。返回 key 或 null，永远不返回文字。 */
function triage(text) {
  const local = MEN.triageLocal(text);
  if (local) return Promise.resolve(local);          // 本地中了就不花这一次往返
  if (CFG.type === 'cloud') return askCloud(text);
  if (CFG.type === 'http') return askHttp(text);
  return Promise.resolve(null);                      // 没配模型 → 接不住
}

/* ── 四个人真的开口 ───────────────────────────────────────
   ⚠️ 这是整个产品里唯一让模型自由生成的地方。三道护栏都在云函数里：
     人设（各守流派，四条窄路比一条宽路安全）
     后置检查（提示词是请求，检查才是保证）
     兜底（不合格不重试不改写，直接退回人写的那段）

   ⚠️ 一次只问一个人，不是四个一起等。
   实测这条链路（跨境 + 冷启动）单次就要 16 秒，四个一起也是 18–23 秒——
   慢的不是并发，是链路本身。所以：
     进屏时立刻显示人写的四段（一秒都不等）
     模型的谁回来就替换谁
   四个人本来就该像四个人陆续开口，不该像一次数据加载。 */
function talkOne(text, who, history) {
  return new Promise((resolve) => {
    if (typeof wx === 'undefined' || !wx.cloud) { resolve(null); return; }
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve(null); } }, 40000);
    wx.cloud.callFunction({
      name: 'talk',
      data: { text: String(text).slice(0, 300), who, history: history || [] },
      success: (r) => {
        if (done) return;
        done = true; clearTimeout(t);
        const d = r && r.result;
        const t2 = d && d.ok && d.said && d.said[who];
        if (!t2) console.warn('[talk] ' + who + ' 没拿到', d && d.dropped);
        resolve(t2 || null);
      },
      fail: (e) => {
        if (done) return;
        done = true; clearTimeout(t);
        console.error('[talk] ' + who + ' 调用失败', e && e.errMsg);
        resolve(null);
      },
    });
  });
}

module.exports = { triage, talkOne, prompt, parseKey, CFG };
