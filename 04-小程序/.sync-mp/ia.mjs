/* 信息架构体检：孤岛、入口重复、可达深度。
   她的原话是"整个小程序也跟套娃一样，动不动就一口水、记一下，毫无逻辑"——
   那不是返回栈的问题，是同一个动作有好几个入口。这个脚本把它量出来。
   跑法：node .sync-mp/ia.mjs [--care] */
import { createRequire } from 'module';
import path from 'path';
const require = createRequire(import.meta.url);
const R = path.resolve(import.meta.dirname, '..');
const CARE = process.argv.includes('--care');
const D = require(R + (CARE ? '/data/care.js' : '/data/screens.js'));
/* 与运行时一致：代码生成的那些屏挂进患者端（见 data/runtime-screens.js） */
if (!CARE) require(R + '/data/runtime-screens.js').patient(D.SCREENS);

/* 收集所有跳转边。home/eat 有多状态，每个状态的 body 都要过 */
const edges = [];
for (const id of Object.keys(D.SCREENS)) {
  const states = (!CARE && id === 'home') ? ['day', 'risk', 'night']
    : (!CARE && id === 'eat') ? ['热乎乎的', '冰冰凉的', '软的、好咽的', '有嚼头的', '说不上来'] : [null];
  for (const st of states) {
    if (!CARE && id === 'home') D.CLOCK = st;
    if (!CARE && id === 'eat') D.PICK = st;
    for (const b of D.SCREENS[id].body()) {
      const t = b[0] === 'q' ? b[2] : b[0] === 'b' ? b[3] : b[0] === 'bbig' ? b[2]
        : b[0] === 'cellsGo' ? b[2] : b[0] === 'food' ? b[2] : null;
      const label = b[0] === 'b' ? b[2] : b[1];
      if (t && D.SCREENS[t]) edges.push([id, t, String(label ?? '').slice(0, 14)]);
      /* animals 块每一项都是一个入口：[文案, 目标屏, 动物名, 是否理想] */
      /* two2 块：两支各自一个入口（目标在 data/advice.js 的 TWO.*.id） */
      if (b[0] === 'two2') {
        ['w-say', 'w-quiet'].forEach((t) => { if (D.SCREENS[t]) edges.push([id, t, 'two 的一支']); });
      }
      if (b[0] === 'animals') {
        b.slice(1).forEach((x) => { if (D.SCREENS[x[1]]) edges.push([id, x[1], String(x[0]).slice(0, 14)]); });
      }
      if (b[0] === 'pair2' || b[0] === 'foot') {
        b.slice(1).forEach((x) => { if (D.SCREENS[x[1]]) edges.push([id, x[1], String(x[0]).slice(0, 14)]); });
      }
    }
  }
  if (!CARE) { D.CLOCK = 'night'; D.PICK = '说不上来'; }
}
/* 有几条跳转写在 index.js 里而不在数据里（选口味→eat、点词→logged、
   点格子→mood、点睡眠→stars、点卡片墙一格→taste-card）。
   不算进来就会把它们误报成孤岛。 */
if (!CARE) {
  [['empty', 'eat', '选口味'], ['mood', 'logged', '点词'], ['home', 'mood', '点某一格'],
    ['clock', 'mood', '点某一格'], ['sleep', 'stars', '选睡眠'],
    ['taste-wall', 'taste-card', '点一格'], ['home', 'taste-card', '点食物名'],
    /* gate 改成清单之后：按勾选组合跳七种建议之一，都没勾去 empty（见 gateGo()） */
    ...['A', 'B', 'C', 'AB', 'AC', 'BC', 'ABC'].map((k) => ['gate', 'g-' + k, '勾了 ' + k]),
    ['gate', 'empty', '都没勾']]
    .forEach((e) => { if (D.SCREENS[e[0]] && D.SCREENS[e[1]]) edges.push(e); });
}
const uniq = [...new Map(edges.map((e) => [e.join('|'), e])).values()];

/* 入口数：有几个不同的屏指向它 */
const inFrom = {};
uniq.forEach(([f, t]) => { (inFrom[t] = inFrom[t] || new Set()).add(f); });

const roots = Object.keys(D.SCREENS).filter((id) => D.SCREENS[id].root);
const island = Object.keys(D.SCREENS).filter((id) => !inFrom[id] && !roots.includes(id));
const multi = Object.entries(inFrom).filter(([, s]) => s.size >= 3)
  .sort((a, b) => b[1].size - a[1].size);

/* 从根屏走 BFS，看最深要点几次 */
const adj = {};
uniq.forEach(([f, t]) => { (adj[f] = adj[f] || []).push(t); });
const depth = {}; const q = roots.map((r) => [r, 0]);
roots.forEach((r) => { depth[r] = 0; });
while (q.length) {
  const [cur, d] = q.shift();
  for (const nx of (adj[cur] || [])) if (depth[nx] === undefined) { depth[nx] = d + 1; q.push([nx, d + 1]); }
}
const unreach = Object.keys(D.SCREENS).filter((id) => depth[id] === undefined);
const deep = Object.entries(depth).filter(([, d]) => d >= 4).sort((a, b) => b[1] - a[1]);

console.log(`${CARE ? '照护者端' : '患者端'}　${Object.keys(D.SCREENS).length} 屏　${uniq.length} 条跳转　根屏 ${roots.join(' ')}`);
console.log(island.length ? `\n✗ 孤岛（没有任何屏指向它）: ${island.join(' ')}` : '\n✓ 没有孤岛');
console.log(unreach.length ? `✗ 从根屏走不到: ${unreach.join(' ')}` : '✓ 每屏都从根屏走得到');
if (multi.length) {
  console.log('\n入口 ≥3 个的屏（"动不动就一口水、记一下"就是这个）:');
  multi.forEach(([t, s]) => {
    const labels = [...new Set(uniq.filter((e) => e[1] === t).map((e) => e[2]))];
    console.log(`   ${t.padEnd(8)} ${s.size} 个入口 ← ${[...s].join(' ')}`);
    console.log(`   ${' '.repeat(8)} 入口文案: ${labels.join(' / ')}`);
  });
}
if (deep.length) {
  console.log('\n要点 ≥4 次才到的屏:');
  deep.forEach(([id, d]) => console.log(`   ${id.padEnd(8)} 第 ${d} 层`));
}
