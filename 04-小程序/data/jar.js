/* 屏上那两处「东西怎么摆」的几何：情绪瓶子的珠子，和星空的星。
   ⚠️ 文件名叫 jar，但星空的排布（skyLayout）也在这儿。原因是它必须和
      罐子那套一样被三个宿主共用：小程序、.sync-mp/shot.mjs、以及自检。
      放在 index.js 里的那一版导致 shot.mjs 自己抄了一份哈希，
      于是截图里的星图和真机的星图不是同一张——而她正是在星图的排布上提的意见。
      要么两处各抄一遍（必然分叉），要么共用一份放在这里。选了后者。

   情绪瓶子的几何与球的样式。
   抽出来是为了 pages/index/index.js 和 .sync-mp/shot.mjs 用同一份——
   否则改球的视觉只能靠真机看，一轮一轮试太慢。

   不做物理引擎。一个球堆不需要，而且"看起来像随手堆的"靠的是扰动，
   不是碰撞求解。 */

const JAR = 250;   // 与 wxss 里 .glass 的尺寸一致，两边必须同一把尺子

/* 种子化伪随机：同一个 (i, salt) 永远得到同一个值。
   不能用 Math.random——每次 setData 都会重算 style，球会原地乱跳。 */
function rnd(i, salt) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/* 从底往上一行行摆，每行宽度由该高度的弦长决定。 */
function pile(n, R, d) {
  const out = [], gap = d * 0.90;
  let i = 0, row = 0;
  while (i < n && row < 14) {
    const y = R - d / 2 - row * gap * 0.87;
    if (y < -R + d / 2) break;
    const half = Math.sqrt(Math.max(0, R * R - y * y)) - d / 2;
    if (half <= 0) { row++; continue; }
    const cnt = Math.max(1, Math.floor((2 * half) / gap));
    const span = (cnt - 1) * gap;
    for (let c = 0; c < cnt && i < n; c++, i++) {
      out.push({ x: -span / 2 + c * gap + (row % 2 ? gap * 0.14 : -gap * 0.14), y, row });
    }
    row++;
  }
  return out;
}

function fitD(n, R) {
  // 面积估一个起点，再收缩直到真摆得下。堆叠有空隙，所以估完还要验。
  let d = Math.min(44, Math.sqrt(0.78 * Math.PI * R * R / Math.max(1, n)));   // 上限 34 时珠子太小、罐子显空
  for (let k = 0; k < 24; k++) {
    if (pile(n, R, d).length >= n) return d;
    d *= 0.92;
    if (d < 9) return 9;
  }
  return d;
}

/* 一颗玻璃珠的四层配方。
   上一版的病根是"实心"：不透光的高饱和渐变 + 一大团柔高光 = 塑料糖豆。
   真玻璃弹珠靠的不是饱和度，是通透：
   1 高光点——小、硬、偏左上。这一点几乎决定了玻璃还是塑料
   2 底部透光斑——光穿过珠子在下缘积起来的那一片亮，塑料没有这个
   3 主体带 alpha——瓶内的暗色要能透出来一点，边缘比中心更透
   4 顶亮／底暗——厚度
   明度按索引交替（奇数暗一档）：相邻两天的色相常常很近，靠明暗把邻居分开。
   饱和度只按一致度调：那一天的词都相近就是纯色玻璃，很杂就是灰调玻璃。
   整体压在 50% 以下——一罐真玻璃弹珠颜色是全的，但每一颗都不艳。 */
function layers(h, i, unity) {
  const dim = (i || 0) % 2 ? -6 : 0;
  const u = unity === undefined ? 1 : Math.max(0, Math.min(1, unity));
  const k = 0.46 + 0.54 * u;
  return { h, L1: 72 + dim, L2: 52 + dim, L3: 34 + dim,
    S1: 52 * k, S2: 44 * k, S3: 36 * k };
}

/* layout() 和 ballStyle() 已删。
   layout 是"按几何算好一堆静止位置"，ballStyle 是把一颗珠子写成一串 CSS——
   两个都是关键帧时代的东西。位置现在每帧由 step() 解，
   画法在 sprite() 里（canvas）。小程序和 .sync-mp/shot.mjs 走的是同一份，
   shot.mjs 把这几个纯函数 toString() 注进它那张 HTML 里跑。
   保留 pile/fitD 是因为 fitD 还在定珠子直径：多少颗珠子摆得下决定它多大。 */

/* ── 真物理：重力 + 碰撞 + 跟着手机晃 ──────────────────────────
   她说了三轮：「重力效果」→「滚动效果」→「随着手机晃他们也会滚动」。
   前两轮我用的是参数化的 CSS 关键帧（落球三段 + 邻球被顶开），
   那条路走到头了：关键帧只能播一条**事先算好**的轨迹，
   而"跟着手机晃"要求每一帧的重力方向都可能变——必须每帧解位置。
   所以 bump / pushVec / dropPath 那三个函数删了，换成下面这个解算器。

   用的是位置约束松弛（PBD）：
     1 预测　按重力和当前速度往前走一步
     2 松弛　把重叠的球推开、把出界的球拉回罐壁，来回几轮
     3 回写　速度 = (新位置 − 旧位置) / dt
   第 3 步是关键：碰撞之后速度自动和位置一致，不用单独写碰撞冲量，
   而"球压在球上互相顶着"这种堆叠状态天生稳定（弹簧法在这里会抖）。

   罐子当成半径 R 的圆。WXSS 里 .glass 的形状是圆角矩形近似的罐形，
   球本来就只堆在中下部，圆约束和看到的形状对得上。
   ponytail: 不做转动惯量、不做摩擦系数。一罐珠子不需要，
   而"滚"这件事的观感全部来自位置沿罐壁的移动，不来自珠子自转。 */
function step(B, r, R, gx, gy, dt) {
  const lim = R - r;
  for (const b of B) {
    b.px = b.x; b.py = b.y;
    b.vx += gx * dt; b.vy += gy * dt;
    b.vx *= 0.992; b.vy *= 0.992;          // 阻尼。没有它，晃两下罐子就变摇奖机
    b.x += b.vx * dt; b.y += b.vy * dt;
  }
  /* 松弛四轮。轮数越多堆得越实，四轮在十几颗的规模上已经看不出穿透 */
  for (let k = 0; k < 4; k++) {
    for (let i = 0; i < B.length; i++) {
      for (let j = i + 1; j < B.length; j++) {
        const dx = B[j].x - B[i].x, dy = B[j].y - B[i].y;
        const d2 = dx * dx + dy * dy;
        const min = r * 2;
        if (d2 >= min * min || d2 === 0) continue;
        const d = Math.sqrt(d2), push = (min - d) / 2 / d;
        B[i].x -= dx * push; B[i].y -= dy * push;
        B[j].x += dx * push; B[j].y += dy * push;
      }
    }
    for (const b of B) {
      const d = Math.hypot(b.x, b.y);
      if (d <= lim || d === 0) continue;
      const s = lim / d;
      b.x *= s; b.y *= s;
    }
  }
  /* 速度从位置差回写。0.86 是碰撞损耗——玻璃珠不是弹球，撞完就该停 */
  for (const b of B) {
    b.vx = ((b.x - b.px) / dt) * 0.86;
    b.vy = ((b.y - b.py) / dt) * 0.86;
  }
}

/* 一颗珠子预渲染成一张小图，之后每帧只贴。
   为什么不每帧现画：一颗珠子六层渐变，十几颗就是每帧上百个渐变对象，
   在中低端安卓上直接掉到二十几帧。珠子的样子只在换色的时候变。
   mk 是造离屏画布的函数（小程序是 wx.createOffscreenCanvas），
   传进来而不是直接调 wx —— 这个文件在 node 里也要能 require（shot.mjs 用它）。 */
function sprite(mk, d, dpr, h, i, unity) {
  const { L1, L2, L3, S1, S2, S3 } = layers(h, i, unity);
  const pad = d * 0.10;                      // 只留一点点边，不留给发光
  const W = Math.ceil((d + pad * 2) * dpr);
  const cv = mk(W, W);
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  const c = d / 2 + pad, r = d / 2;
  /* rg(相对圆心的偏移，半径倍数，色标) —— 偏移和半径都按直径算，
     所以珠子多大都是同一颗珠子，不用逐尺寸调参数 */
  const rg = (x, y, k, stops) => {
    const q = g.createRadialGradient(c + x * d, c + y * d, 0, c + x * d, c + y * d, r * k);
    stops.forEach(([o, col]) => q.addColorStop(o, col));
    return q;
  };
  const fill = (grad) => { g.fillStyle = grad; g.fillRect(0, 0, c * 2, c * 2); };

  g.save();
  g.beginPath(); g.arc(c, c, r, 0, 6.2832); g.clip();

  /* 1 主体。中心比边缘**更透**——这一条是玻璃和塑料的分界：
     光从中间穿过去，所以看得见后面罐子的暗；边缘是斜着看进去的厚玻璃，
     所以更实、更暗。上一版反了（中心 .96 边缘 .80），于是每颗都是实心糖豆。 */
  fill(rg(-0.10, -0.14, 1.16, [
    [0, `hsla(${h},${S1.toFixed(0)}%,${L1}%,.62)`],
    [0.46, `hsla(${h},${S2.toFixed(0)}%,${L2}%,.78)`],
    [0.86, `hsla(${h},${S3.toFixed(0)}%,${L3}%,.94)`],
    [1, `hsla(${h},${S3.toFixed(0)}%,${(L3 - 10)}%,.98)`]]));

  /* 2 焦散。光穿过珠子在下缘聚成的一小点亮 —— 小而亮，不是一片。
     上一版是 r*0.62 的一大片，那就成了"底下也在发光"的气球。 */
  fill(rg(0.09, 0.26, 0.34, [
    [0, `hsla(${h},${(S1 + 14).toFixed(0)}%,${Math.min(92, L1 + 16)}%,.78)`],
    [0.45, `hsla(${h},${S1.toFixed(0)}%,${L1}%,.22)`],
    [1, 'transparent']]));

  /* 3 边缘那一圈暗。玻璃球在边上全内反射，读起来是一道硬边。
     它同时把珠子和珠子分开——没有它，一堆珠子会糊成一片彩色的云。 */
  fill(rg(0, 0, 1, [[0.66, 'transparent'], [0.88, 'rgba(0,0,0,.26)'],
    [0.97, 'rgba(0,0,0,.52)'], [1, 'rgba(0,0,0,.62)']]));

  /* 4 暖光罩。整罐在同一盏灯下，颜色才像一批材质 */
  fill(rg(-0.05, -0.18, 1.05, [[0, 'rgba(201,160,99,.11)'],
    [0.62, 'rgba(201,160,99,.03)'], [1, 'transparent']]));

  /* 5 高光点。小、硬、偏左上——这一点几乎单独决定了玻璃还是塑料。
     上一版 r*0.40 且到 48% 才消失，糊成一团柔光就是气球的读法。 */
  fill(rg(-0.21, -0.26, 0.22, [[0, 'rgba(255,255,255,.96)'],
    [0.42, 'rgba(255,255,255,.34)'], [0.8, 'rgba(255,255,255,.05)'], [1, 'transparent']]));

  /* 6 下缘那一道细反光弧。玻璃从下面接到的环境光，一条窄弧，
     和上面那个硬高光一起把"球面"立起来 */
  g.beginPath();
  g.arc(c, c, r * 0.88, 0.62, 1.92);
  g.strokeStyle = 'rgba(255,255,255,.20)';
  g.lineWidth = Math.max(0.6, r * 0.07);
  g.stroke();

  g.restore();
  return { cv, pad, W: W / dpr };
}

/* ── 星空的排布 ────────────────────────────────────────────────
   她说"星星不要规则排列，位置随机一点"。走过两版弯路，都记下来：

   v1 GLSL 那个经典哈希 fract(sin(i*91.7)*43758.5)，按下标取。实测的毛病：
      · i=0 时 sin(0)=0，第一颗星永远钉死在左上角 (6%, 8%)
      · 11 个样本太少，哈希的低频结构直接露出来：x 有四颗挤在 30 附近、
        三颗在 64 附近，y 有五颗压在 27–35 那条带上 —— 读起来是一张松格栅
   v2 按日期哈希 + O(n²) 推开。随机是真的了，但**覆盖没保证**：
      连续十天的哈希碰巧偏向一侧，十颗星全落在右半边，
      而"推开"只会让两颗分离，不会把一群铺开。

   v3（现在）分层抖动：天幕切成 cols×rows 个格子，每晚按日期哈希挑一个格子
   （占了就顺着往后找下一个空格），再在格子里按哈希抖一下。
     覆盖　由格子保证 —— 不可能全挤在一边
     不成团 由格内抖动幅度封顶（±0.34 格）保证 —— 相邻两颗最少也隔 0.32 格
     不像格栅 由抖动幅度下限保证 —— 每颗都偏离格心，看不出格子在哪
   星多了格子自动变密，不用调参数。 */
const FNV = (str) => {
  let x = 2166136261;
  for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); }
  /* murmur3 的收尾混合。少了这一步，相邻日期（只差最后一个字符）的高位几乎一样，
     取哪一段位都还是相邻——v2 全挤在右半边就是这么来的。 */
  x ^= x >>> 16; x = Math.imul(x, 2246822507);
  x ^= x >>> 13; x = Math.imul(x, 3266489909);
  return (x ^ (x >>> 16)) >>> 0;
};
function skyLayout(days) {
  const n = days.length;
  if (!n) return [];
  /* 天幕比正方形宽（640rpx 高、整宽），所以列比行多 */
  const cols = Math.max(1, Math.round(Math.sqrt(n * 1.6)));
  const rows = Math.max(1, Math.ceil(n / cols));
  const taken = new Array(cols * rows).fill(false);
  return days.map((day) => {
    const h = FNV(day);
    let c = h % (cols * rows);
    while (taken[c]) c = (c + 1) % (cols * rows);   // 占了就往后找，确定性的
    taken[c] = true;
    const jx = ((h >>> 10) & 255) / 255 - 0.5;      // −0.5…0.5
    const jy = ((h >>> 20) & 255) / 255 - 0.5;
    return {
      x: 7 + ((c % cols) + 0.5 + jx * 0.68) / cols * 86,
      y: 9 + (Math.floor(c / cols) + 0.5 + jy * 0.68) / rows * 78,
    };
  });
}

module.exports = { JAR, rnd, pile, fitD, layers, step, sprite, skyLayout };
