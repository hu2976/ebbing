/* 四个人各自回应一段话。

   流程：四个人并发 → 各自过后置检查 → 不合格的退回人写的那段。

   ⚠️ 三道护栏，缺一不可：
     1. 人设（persona.js）——每个人能说的范围各自更窄，四条窄路比一条宽路安全
     2. 后置检查（guard.js）——提示词是请求，检查才是保证
     3. 兜底——不合格不重试、不改写，直接换成 data/mentor.js 里人写的那段
        （改写等于在有害内容上打补丁，补丁过的那句仍然是模型写的）

   ⚠️ key 存在云函数的环境变量里，前端拿不到，反编译也拿不到。
      设置：云开发控制台 → 云函数 → talk → 版本与配置 → 环境变量
      变量名 OPENROUTER_KEY

   ⚠️ 不存任何用户输入。这个函数是无状态的——她写的话用完就没了。 */

const { PERSONAS } = require('./persona.js');
const { check } = require('./guard.js');
const https = require('https');

/* ⚠️ 不用 reasoning 模型。
   deepseek-v4-flash 单次要十几秒（reasoning token 也算生成时间），
   四个并发实测 23 秒——摆摊时评委不会等 23 秒。
   这一层要的是"说一段短话"，不是推理，用非 reasoning 的快模型就够。 */
/* ⚠️ 必须用**非 reasoning** 模型。这一处撞了两轮：
     reasoning 模型（qwen3.7-flash / step-3.5-flash / deepseek-v4-flash）
     把 max_tokens 全花在思考上——给 300 就返回空，给 3000 就要 16 秒。
     调那个数字是解不开的，得换模型。

   实测（max_tokens=400，从本机，四个人各一次）：
     ernie-4.5    3.3s  中文自然，「松一下后槽牙」这种细节完全在人设里  ← 选它
     mistral-nemo 2.1s  最快，但爱输出双换行和 markdown 星号
     llama-3.1-8b 1.5s  中文生硬（「这感觉一直持续着」）
     hunyuan      6.0s  能用但慢
     minimax      7.0s  慢
   guard.js 会拦掉带 markdown 的输出，所以 nemo 那种排版问题会变成"被拦"，
   而被拦就退回模板——所以宁可慢一秒，选输出干净的。 */
const MODEL = process.env.TALK_MODEL || 'baidu/ernie-4.5-vl-424b-a47b';

const TIMEOUT = 20000;   // 实测单次 3~4s，20s 是给冷启动和网络抖动的余量

/* history 是之前几轮：[{ me:true|false, t:'…' }]，只带最近几轮。
   ⚠️ 不在云端存任何历史——历史由前端每次带上来，函数本身无状态。
   她写的话用完就没了。 */
function ask(system, user, history) {
  return new Promise((resolve) => {
    const key = process.env.OPENROUTER_KEY;
    if (!key) { resolve(null); return; }
    const msgs = [{ role: 'system', content: system }];
    (history || []).slice(-6).forEach((h) => {     // 最多六轮，再多就跑偏且贵
      msgs.push({ role: h.me ? 'user' : 'assistant', content: String(h.t).slice(0, 300) });
    });
    msgs.push({ role: 'user', content: String(user).slice(0, 300) });
    const body = JSON.stringify({
      model: MODEL,
      temperature: 0.7,          // 太低四个人会说得一样；太高会滑出人设
      /* ⚠️ 这个数不是上限保护，是模型的**写作预算**——给多少它就想写多少。
         原来写 3000，于是每次都要十几秒；这一层要的是三句话，300 够了。
         实测：3000 → 16s，300 → 2~5s。一个数字的事。 */
      max_tokens: 400,   // 三句话够用；400 是留一点余量，不是写作预算
      messages: msgs,
    });
    const req = https.request({
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: TIMEOUT,
    }, (res) => {
      let buf = '';
      res.on('data', (d) => { buf += d; });
      res.on('end', () => {
        try {
          const d = JSON.parse(buf);
          const m = d.choices && d.choices[0] && d.choices[0].message;
          /* ⚠️ 模型爱在行尾留空格，上屏会多出间距。清掉再判。 */
          const t = (m && m.content || '').split('\n')
            .map((x) => x.trim()).filter(Boolean).join('\n');
          resolve(t || null);
        } catch (e) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}

/* 一次只答一个人。

   ⚠️ 为什么不是四个一起返回：四个并发实测 18–23 秒，而她在屏幕前干等。
   分成四次调用之后，前端可以谁先回来谁先出现——
   **四个人本来就该像四个人陆续开口，不该像一次数据加载。**

   不传 who 时仍然四个一起答（本机测试和排查时用）。 */
exports.main = async (event) => {
  const text = String(event && event.text || '').trim();
  if (!text) return { ok: false };

  const hist = Array.isArray(event.history) ? event.history : null;
  const one = async (id) => {
    const raw = await ask(PERSONAS[id], text, hist);
    if (!raw) return { id, t: null, why: '没拿到' };
    const bad = check(raw);
    /* ⚠️ 不合格不重试、不改写。前端会换成人写的那段。 */
    return bad ? { id, t: null, why: bad } : { id, t: raw, why: null };
  };

  const who = String(event.who || '');
  const ids = PERSONAS[who] ? [who] : Object.keys(PERSONAS);
  const out = await Promise.all(ids.map(one));

  const said = {}, dropped = {};
  out.forEach((r) => { if (r.t) said[r.id] = r.t; else dropped[r.id] = r.why; });
  /* dropped 只为排查——⚠️ 它不上屏，屏上不出现「这条被拦了」这类话 */
  return { ok: true, said, dropped };
};
