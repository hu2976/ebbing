// 滋味卡插画生成器 · 按 food-illustration skill
// 输入：daily.js 的 taste / cardHue / cardTexFam ＋ 下面的 SPEC
// 输出：30 张 SVG 插画 ＋ 一个展示页
// 上线后加新食物：在 SPEC 里补一行（vessel ＋ n ＋ 可选 tweak），不用画图
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const require = createRequire(import.meta.url);
const R = path.resolve(import.meta.dirname, '../04-小程序');
const D = require(R + '/data/daily.js');

// ── 两套主题 ──
// food-illustration skill：米白纸底用减法颗粒（打孔露纸）＋可以用细线；
// 深底必须用加法颗粒（洒亮点）＋器物换浅色。照搬会脏。
export const THEME = {
  dark:  { vessel:'#D6CAB2', vIn:'#A99C82', rim:'#3E6488', rimOp:.6,  foot:'#B9A98C',
           plate:'#CFC3AB', plate2:'#E2D8C2', grain:'dust', shadow:'0 6px 9px #00000090',
           drop:'#8A7C64', dropOp:.34, geo:['#C87A4A','#C9563C','#A2957F','#C9A063','#8E8468'] },
  paper: { vessel:'#EDE4CE', vIn:'#C0B298', rim:'#2F4A6B', rimOp:.85, foot:'#B5A588',
           plate:'#E4DAC2', plate2:'#F2EBD9', grain:'cut',  shadow:'0 3px 5px #6B5F4A44',
           drop:'#8A7C64', dropOp:.2,  geo:['#B5563C','#A8452C','#8A8071','#B08D4A','#6E6552'] },
};
let TH = THEME.dark;

// ── 确定性随机：种子取自食物名，同一道菜每次生成完全一样 ──
const seedOf = s => [...s].reduce((a, c) => (a * 31 + c.codePointAt(0)) >>> 0, 7);
function rng(seed) { let x = seed || 1; return () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; }

// ── 每道菜的构成：容器 ＋ 主体块数 ＋ 个性微调 ──
// vessel: bowl 碗 / plate 盘 / cup 杯 / none 直接落在桌上
const SPEC = {
  '烤红薯':      { vessel:'none',  draw:'sweetpotato' },
  '饺子':        { vessel:'plate', draw:'jiaozi' },
  '米饭':        { vessel:'bowl',  draw:'rice' },
  '小蛋糕':      { vessel:'plate', draw:'cake' },
  '可乐':        { vessel:'cup',   n:1, fizz:true, mark:'ice' },
  '西瓜':        { vessel:'plate', n:2, wedge:true, rind:'#5C7F4A' },  // 三角块＋绿皮＋籽
  '白粥':        { vessel:'bowl',  draw:'congee' },
  '糖炒栗子':    { vessel:'none',  draw:'chestnut' },
  '刚出炉的面包': { vessel:'none',  n:1, big:1.2, layer:true },
  '豆浆':        { vessel:'cup',   n:1, mark:'bean' },
  '刚捞出来的那片肉': { vessel:'plate', n:3, big:.8, marble:true },   // 纹理
  '冰棍':        { vessel:'none',  n:1, bar:true },                   // 方块不是球
  '凉皮':        { vessel:'bowl',  draw:'liangpi' },
  '小笼包':      { vessel:'plate', draw:'xiaolong' },
  '糖藕':        { vessel:'plate', draw:'lotus' },
  '奶茶第一口':  { vessel:'cup',   n:1, pearl:true },
  '煮玉米':      { vessel:'none',  draw:'corn' },
  '咸鸭蛋':      { vessel:'plate', draw:'saltegg' },
  '豆腐脑':      { vessel:'bowl',  n:1, soft:true, mark:'drizzle' },
  '葱油饼':      { vessel:'plate', n:1, big:1.1, coil:true },        // 盘旋的层
  '银耳汤':      { vessel:'bowl',  n:5, big:.4, float:true, mark:'wisp' },
  '芝麻汤圆':    { vessel:'bowl',  draw:'tangyuan' },
  '蒸南瓜':      { vessel:'plate', draw:'pumpkin' },
  '烧麦':        { vessel:'plate', draw:'shaomai' },
  '韭菜盒子':    { vessel:'plate', draw:'hezi' },
  '排骨汤':      { vessel:'bowl',  n:3, big:.6, float:true, mark:'bone' },
  '热牛奶':      { vessel:'cup',   n:1, mark:'skin' },
  '草莓':        { vessel:'plate', draw:'berry' },          // 尖头
  '蒸蛋':        { vessel:'bowl',  n:1, soft:true, mark:'chive' },
  '羊肉汤':      { vessel:'bowl',  n:4, big:.55, float:true, mark:'slice' },
};

// 质感家族 → 该画什么 / 不该画什么（skill：质感跟着这一样食物走）
const TEX = {
  sear:  { grain:.62, spots:'char',  steam:0, gloss:.18, note:'焦斑' },
  steam: { grain:.34, spots:'none',  steam:2, gloss:.42, note:'蒸汽＋光滑' },
  soup:  { grain:.22, spots:'none',  steam:2, gloss:.58, note:'液面高光' },
  grain: { grain:.78, spots:'grain', steam:1, gloss:.20, note:'颗粒最重' },
  chill: { grain:.16, spots:'none',  steam:0, gloss:.72, note:'硬高光' },
  soft:  { grain:.30, spots:'none',  steam:0, gloss:.50, note:'大而柔的高光' },
};

const famOf = (() => {
  const m = {};
  for (const [fam, list] of Object.entries(D.cardTexFam)) for (const f of list) m[f] = fam;
  return f => m[f] || 'soft';
})();

// 色：deep/lit 来自 daily.js，再派生中间调与高光
function palette(food, vessel) {
  const [deep, lit] = D.cardHue[food] || ['#6F5A3D', '#C4B08A'];
  const mix = (a, b, t) => '#' + [0, 2, 4].map(i => {
    const x = Math.round(parseInt(a.substr(1 + i, 2), 16) * (1 - t) + parseInt(b.substr(1 + i, 2), 16) * t);
    return x.toString(16).padStart(2, '0');
  }).join('');
  // 暗底可见性下限：亮度低于阈值就往米白提，色相不动
  const lum = c => [0,2,4].map(i=>parseInt(c.substr(1+i,2),16)).reduce((a,v,i)=>a+v*[.299,.587,.114][i],0);
  const lift = (c, floor) => lum(c) >= floor ? c : mix(c, '#F2E4C6', Math.min(.72, (floor - lum(c)) / 150));
  // 有容器的食物靠容器的浅色轮廓提供对比，不动食物本身的颜色
  // （上一版无脑提亮把可乐变成了豆浆——深色食物本来就该深）
  const bare = vessel === 'none' && TH.grain !== 'cut';
  const D2 = bare ? lift(deep, 62) : deep, L2 = bare ? lift(lit, 96) : lit;
  return { deep: D2, lit: L2, mid: mix(D2, L2, .5), hi: mix(L2, '#FFF8E8', .55), sh: mix(D2, '#1A120A', .3) };
}

// ── 容器：全部 fill，不用 stroke（skill 4：那些「弧」是色块不是线）──
const VESSEL = {
  bowl: p => ({ front:'', back: `
    <path d="M84 132 C86 190, 130 222, 172 220 C216 218, 254 186, 256 126
              A86 24 0 0 0 84 132 Z" fill="${TH.vessel}"/>
    <ellipse cx="170" cy="130" rx="80" ry="20" fill="${TH.vIn}"/>
    <path d="M92 141 C114 153, 232 151, 252 137 C248 145, 236 152, 220 157
              C193 164, 146 164, 120 157 C104 152, 94 147, 92 141 Z"
          fill="${TH.rim}" opacity="${TH.rimOp}"/>
    <path d="M148 226 C158 230, 186 230, 196 226 C186 232, 158 232, 148 226 Z" fill="${TH.foot}" opacity=".7"/>` }),
  plate: p => ({ front:'', back: `
    <ellipse cx="170" cy="168" rx="104" ry="34" fill="${TH.plate}"/>
    <ellipse cx="170" cy="163" rx="92" ry="27" fill="${TH.plate2}"/>
    <path d="M78 170 C104 182, 236 180, 262 168 C258 176, 240 184, 218 188
              C196 192, 144 192, 122 188 C100 184, 82 177, 78 170 Z"
          fill="${TH.rim}" opacity="${TH.rimOp * .7}"/>` }),
  // 玻璃杯：back 是杯壁的淡影，液体画在中间，front 是杯口厚度＋高光
  cup: p => ({
    back: `<path d="M116 96 L124 216 C126 226, 142 232, 170 232 C198 232, 214 226, 216 216
              L224 96 Z" fill="${TH.vessel}" opacity="${TH.grain === 'cut' ? .5 : .16}"/>`,
    front: `<ellipse cx="170" cy="98" rx="54" ry="15" fill="none" stroke="${TH.vIn}"
              stroke-width="3" opacity=".82"/>
      <path d="M116 96 L124 216 C126 226, 142 232, 170 232 C198 232, 214 226, 216 216 L224 96"
            fill="none" stroke="${TH.vIn}" stroke-width="2.6" opacity=".7" stroke-linecap="round"/>
      <path d="M131 116 L137 210" stroke="#FFFDF4" stroke-width="5" opacity=".26" stroke-linecap="round"/>`,
  }),
  none: () => ({ front:'', back:`<ellipse cx="170" cy="212" rx="76" ry="10" fill="${TH.drop}" opacity="${TH.dropOp}"/>` }),
};

// 容器内主体的可用区域
const AREA = {
  bowl:  { cx:170, cy:128, rx:74, ry:19 },
  plate: { cx:170, cy:160, rx:84, ry:24 },
  cup:   { cx:170, cy:120, rx:46, ry:13, liquid:true },
  none:  { cx:170, cy:176, rx:72, ry:32 },
};

// 一块不规则色块（有机、毛边由形状本身给）
function blob(x, y, w, h, r, rot = 0) {
  const j = (k = 1) => (r() - .5) * w * .1 * k;
  const d = `M${x - w / 2} ${y} C${x - w / 2 + j()} ${y - h / 2 - j()}, ${x - w * .22} ${y - h / 2}, ${x} ${y - h / 2 + j()}
    C${x + w * .26} ${y - h / 2 - j()}, ${x + w / 2} ${y - h * .3}, ${x + w / 2 + j()} ${y}
    C${x + w / 2} ${y + h * .34}, ${x + w * .24} ${y + h / 2}, ${x} ${y + h / 2 + j()}
    C${x - w * .26} ${y + h / 2}, ${x - w / 2} ${y + h * .3}, ${x - w / 2} ${y} Z`;
  return rot ? `<g transform="rotate(${rot} ${x} ${y})"><path d="${d}"/></g>` : `<path d="${d}"/>`;
}

// ── 专属画法：通用参数画不像的，照真实形态单独写 ──
const CUSTOM = {
  // 凉皮：宽扁半透明的面皮条堆在碗里，浇红油＋黄瓜丝＋面筋块
  liangpi(a, pal, r) {
    const o = [];
    for (let i = 0; i < 7; i++) {                       // 面皮条：宽、扁、层叠
      const y = a.cy + 6 - i * 4.4, w = 96 - Math.abs(i - 3) * 9;
      const x = a.cx + (r() - .5) * 14, rot = (r() - .5) * 12;
      o.push(`<g transform="rotate(${rot} ${x} ${y})">
        <rect x="${x - w / 2}" y="${y - 5}" width="${w}" height="10" rx="5"
              fill="${i % 2 ? pal.lit : pal.hi}" opacity=".93"/>
        <rect x="${x - w / 2 + 4}" y="${y - 3.4}" width="${w - 8}" height="3"
              rx="1.5" fill="#FFFDF4" opacity=".4"/></g>`);   // 半透明的那道光
    }
    o.push(`<ellipse cx="${a.cx + 10}" cy="${a.cy - 4}" rx="30" ry="11" fill="#C2452C" opacity=".66"/>`);
    for (let i = 0; i < 7; i++) o.push(`<circle cx="${a.cx + (r() - .5) * 74}" cy="${a.cy - 2 + (r() - .5) * 16}"
      r="${1.4 + r() * 1.2}" fill="#E0603C" opacity=".85"/>`);          // 辣油碎
    for (let i = 0; i < 5; i++) o.push(`<rect x="${a.cx - 34 + i * 16}" y="${a.cy - 14 + (r() - .5) * 10}"
      width="17" height="4" rx="2" fill="#7FA86A" opacity=".9"
      transform="rotate(${(r() - .5) * 34} ${a.cx} ${a.cy})"/>`);        // 黄瓜丝
    for (let i = 0; i < 3; i++) o.push(`<rect x="${a.cx - 22 + i * 22}" y="${a.cy - 10 + (r() - .5) * 12}"
      width="13" height="11" rx="3" fill="#B08A5C" opacity=".85"/>`);    // 面筋块
    return o.join('');
  },
  // 玉米：细长圆柱，粒纵向成行，不是椭圆铺网格
  corn(a, pal, r) {
    const o = [], W = 62, H = 168, cx = a.cx, cy = a.cy - 6;
    o.push(`<path d="M${cx - W / 2} ${cy - H * .34} C${cx - W / 2 - 4} ${cy + H * .2},
      ${cx - W * .3} ${cy + H / 2}, ${cx} ${cy + H / 2} C${cx + W * .3} ${cy + H / 2},
      ${cx + W / 2 + 4} ${cy + H * .2}, ${cx + W / 2} ${cy - H * .34}
      C${cx + W * .36} ${cy - H / 2 - 6}, ${cx - W * .36} ${cy - H / 2 - 6}, ${cx - W / 2} ${cy - H * .34} Z"
      fill="${pal.mid}"/>`);
    for (let col = 0; col < 6; col++) {                  // 6 列，每列纵向一行粒
      const t2 = (col - 2.5) / 2.5, x = cx + t2 * W * .38;
      const shrink = 1 - Math.abs(t2) * .3;              // 侧面的列窄一点＝圆柱
      for (let row = 0; row < 11; row++) {
        const y = cy - H * .4 + row * H * .078 + Math.abs(t2) * 5;
        o.push(`<rect x="${x - 4.6 * shrink}" y="${y - 3.4}" width="${9.2 * shrink}" height="6.8" rx="3"
          fill="${(row + col) % 3 ? pal.hi : pal.lit}" opacity="${.92 - Math.abs(t2) * .16}"/>`);
      }
    }
    // 绿叶苞：从根部裹上来两片
    o.push(`<path d="M${cx - W * .5} ${cy + H * .2} C${cx - W * .9} ${cy + H * .3},
      ${cx - W * .8} ${cy + H * .5}, ${cx - W * .2} ${cy + H * .52}
      C${cx - W * .4} ${cy + H * .38}, ${cx - W * .44} ${cy + H * .3}, ${cx - W * .5} ${cy + H * .2} Z"
      fill="#6E8B4E"/>`);
    o.push(`<path d="M${cx + W * .5} ${cy + H * .16} C${cx + W * .92} ${cy + H * .28},
      ${cx + W * .78} ${cy + H * .48}, ${cx + W * .22} ${cy + H * .5}
      C${cx + W * .42} ${cy + H * .36}, ${cx + W * .46} ${cy + H * .26}, ${cx + W * .5} ${cy + H * .16} Z"
      fill="#7C9B5A"/>`);
    o.push(`<path d="M${cx - 2} ${cy - H / 2 - 4} C${cx + 6} ${cy - H / 2 - 20},
      ${cx - 8} ${cy - H / 2 - 30}, ${cx + 2} ${cy - H / 2 - 44}"
      fill="none" stroke="#C9B27A" stroke-width="2" stroke-linecap="round" opacity=".5"/>`);
    return o.join('');
  },
  // 米饭：堆成小山高出碗沿，粒粒分明（干的）
  rice(a, pal, r) {
    const o = [], cx = a.cx, cy = a.cy;
    o.push(`<path d="M${cx - 76} ${cy + 6} C${cx - 66} ${cy - 30}, ${cx - 26} ${cy - 46},
      ${cx} ${cy - 46} C${cx + 26} ${cy - 46}, ${cx + 66} ${cy - 30}, ${cx + 76} ${cy + 6}
      C${cx + 40} ${cy + 18}, ${cx - 40} ${cy + 18}, ${cx - 76} ${cy + 6} Z" fill="#F2EBDA"/>`);
    for (let i = 0; i < 90; i++) {          // 粒粒分明：短椭圆，各自有角度
      const t2 = r(), ang = r() * Math.PI * 2, rad = Math.sqrt(t2);
      const x = cx + Math.cos(ang) * rad * 68, y = cy - 16 + Math.sin(ang) * rad * 22 + rad * 8;
      o.push(`<ellipse cx="${x}" cy="${y}" rx="3.4" ry="1.9" fill="${r() > .45 ? '#FFFDF6' : '#E6DCC6'}"
        transform="rotate(${r() * 180} ${x} ${y})"/>`);
    }
    return o.join('');
  },
  // 白粥：满到碗口的平液面，表面细密糊化的泡，不堆
  congee(a, pal, r) {
    const o = [], cx = a.cx, cy = a.cy;
    o.push(`<ellipse cx="${cx}" cy="${cy}" rx="${a.rx * 1.04}" ry="${a.ry * 1.06}" fill="#EDE6D4"/>`);
    o.push(`<ellipse cx="${cx - 6}" cy="${cy - 3}" rx="${a.rx * .72}" ry="${a.ry * .66}"
      fill="#F7F2E4" opacity=".8"/>`);
    for (let i = 0; i < 60; i++) {          // 细密的泡，越靠中心越密
      const ang = r() * Math.PI * 2, rad = Math.sqrt(r());
      const x = cx + Math.cos(ang) * rad * a.rx * .96, y = cy + Math.sin(ang) * rad * a.ry * .92;
      o.push(`<circle cx="${x}" cy="${y}" r="${.9 + r() * 1.5}" fill="#FFFDF6" opacity="${.4 + r() * .4}"/>`);
    }
    for (let i = 0; i < 10; i++) {          // 糊化开的米粒
      const x = cx + (r() - .5) * a.rx * 1.5, y = cy + (r() - .5) * a.ry * 1.2;
      o.push(`<ellipse cx="${x}" cy="${y}" rx="3" ry="1.7" fill="#FFFEFA" opacity=".7"
        transform="rotate(${r() * 180} ${x} ${y})"/>`);
    }
    return o.join('');
  },
  // 烤红薯：纺锤形（两头收），裂开一道口子露橙黄瓤
  sweetpotato(a, pal, r) {
    const o = [];
    for (let i = 0; i < 2; i++) {
      const cx = a.cx - 26 + i * 52, cy = a.cy + (i ? 6 : -4), L = i ? 96 : 108, W = i ? 42 : 48;
      const rot = i ? 14 : -8;
      o.push(`<g transform="rotate(${rot} ${cx} ${cy})">
        <path d="M${cx - L / 2} ${cy} C${cx - L * .42} ${cy - W * .52}, ${cx - L * .12} ${cy - W * .5},
          ${cx + L * .1} ${cy - W * .46} C${cx + L * .36} ${cy - W * .4}, ${cx + L / 2} ${cy - W * .2},
          ${cx + L / 2} ${cy} C${cx + L / 2} ${cy + W * .2}, ${cx + L * .36} ${cy + W * .4},
          ${cx + L * .1} ${cy + W * .46} C${cx - L * .12} ${cy + W * .5}, ${cx - L * .42} ${cy + W * .52},
          ${cx - L / 2} ${cy} Z" fill="${i ? pal.deep : pal.mid}"/>`);
      if (i === 0) {   // 裂口 ＋ 橙黄的瓤
        o.push(`<path d="M${cx - L * .26} ${cy - 3} C${cx - L * .06} ${cy - 11}, ${cx + L * .16} ${cy - 9},
          ${cx + L * .3} ${cy - 2} C${cx + L * .14} ${cy + 7}, ${cx - L * .08} ${cy + 8},
          ${cx - L * .26} ${cy - 3} Z" fill="#E39A3E"/>`);
        o.push(`<path d="M${cx - L * .18} ${cy - 2} C${cx - L * .02} ${cy - 7}, ${cx + L * .14} ${cy - 6},
          ${cx + L * .24} ${cy - 1} C${cx + L * .1} ${cy + 4}, ${cx - L * .06} ${cy + 4},
          ${cx - L * .18} ${cy - 2} Z" fill="#F3BE68"/>`);
      }
      for (let c2 = 0; c2 < 6; c2++) o.push(`<ellipse cx="${cx + (r() - .5) * L * .7}"
        cy="${cy + (r() - .5) * W * .6}" rx="${1.6 + r() * 2.2}" ry="${1.2 + r() * 1.4}"
        fill="${pal.sh}" opacity="${.24 + r() * .26}"/>`);
      o.push('</g>');
    }
    return o.join('');
  },
  // 饺子：半月形，一侧一排褶
  jiaozi(a, pal, r) {
    const o = [];
    for (let i = 0; i < 5; i++) {
      const x = a.cx - 62 + i * 31, y = a.cy - (i % 2) * 11, W = 40, H = 24;
      const rot = (r() - .5) * 22;
      o.push(`<g transform="rotate(${rot} ${x} ${y})">
        <path d="M${x - W / 2} ${y + H * .2} C${x - W * .42} ${y - H * .8}, ${x + W * .42} ${y - H * .8},
          ${x + W / 2} ${y + H * .2} C${x + W * .2} ${y + H * .6}, ${x - W * .2} ${y + H * .6},
          ${x - W / 2} ${y + H * .2} Z" fill="${i % 2 ? pal.lit : pal.hi}"/>`);
      // 褶：沿弧形上缘的一串捏痕，压在皮上而不是浮在外面
      let dd = `M${x - W * .44} ${y - H * .2}`;
      for (let k = 0; k < 4; k++) {
        const x1 = x - W * .4 + k * W * .22, x2 = x1 + W * .11, x3 = x1 + W * .22;
        const yy = y - H * .2 - Math.sin((k + .5) / 6 * Math.PI) * H * .42;
        dd += ` Q${x2} ${yy - H * .14} ${x3} ${yy + H * .04}`;
      }
      o.push(`<path d="${dd}" fill="none" stroke="${pal.mid}" stroke-width="1.8"
        opacity=".62" stroke-linecap="round" stroke-linejoin="round"/>`);
      o.push(`<ellipse cx="${x}" cy="${y + H * .14}" rx="${W * .3}" ry="${H * .18}"
        fill="#FFFDF4" opacity=".34"/></g>`);   // 皮薄透出的馅
    }
    return o.join('');
  },
  // 小蛋糕：纸杯＋胚体＋鼓出来的奶油顶＋一颗果
  cake(a, pal, r) {
    const o = [], cx = a.cx, cy = a.cy - 4;
    o.push(`<path d="M${cx - 34} ${cy - 2} L${cx - 27} ${cy + 40} C${cx - 25} ${cy + 47},
      ${cx + 25} ${cy + 47}, ${cx + 27} ${cy + 40} L${cx + 34} ${cy - 2} Z" fill="#C9A98A"/>`);
    for (let i = 0; i < 7; i++) {   // 纸杯褶：上宽下窄的梯形，跟着杯壁收
      const t2 = (i - 3) / 3, xt = cx + t2 * 31, xb = cx + t2 * 25;
      o.push(`<path d="M${xt - 1.6} ${cy} L${xt + 1.6} ${cy} L${xb + 1.4} ${cy + 43} L${xb - 1.4} ${cy + 43} Z"
        fill="#B08F70" opacity=".42"/>`);
    }
    o.push(`<path d="M${cx - 36} ${cy - 2} C${cx - 30} ${cy - 22}, ${cx + 30} ${cy - 22},
      ${cx + 36} ${cy - 2} Z" fill="${pal.mid}"/>`);                          // 露出的胚
    // 挤花：三层由大到小的波浪环，越往上越小
    [[0, 30, 11], [-13, 23, 9], [-24, 15, 7]].forEach(([dy, rx, ry], L) => {
      let d = `M${cx - rx} ${cy + dy - 4}`;
      for (let k = 0; k < 6; k++) {
        const x1 = cx - rx + k * rx / 3, x2 = x1 + rx / 6, x3 = x1 + rx / 3;
        d += ` Q${x2} ${cy + dy - 4 - ry * .9} ${x3} ${cy + dy - 4}`;
      }
      d += ` L${cx + rx} ${cy + dy + ry * .5} C${cx} ${cy + dy + ry * .9}, ${cx} ${cy + dy + ry * .9},
        ${cx - rx} ${cy + dy + ry * .5} Z`;
      o.push(`<path d="${d}" fill="${L === 2 ? '#FFFDF6' : L === 1 ? '#FAF2E2' : '#F2E6D2'}"/>`);
    });
    o.push(`<circle cx="${cx + 2}" cy="${cy - 46}" r="6" fill="#C24A4A"/>`);   // 顶上一颗果
    return o.join('');
  },
  // 咸鸭蛋：切半，白色蛋白＋橙红流油的蛋黄
  saltegg(a, pal, r) {
    const o = [];
    for (let i = 0; i < 2; i++) {
      const x = a.cx - 30 + i * 60, y = a.cy - (i % 2) * 8;
      o.push(`<ellipse cx="${x}" cy="${y}" rx="30" ry="23" fill="#F2EADA"/>`);
      o.push(`<ellipse cx="${x}" cy="${y}" rx="30" ry="23" fill="none" stroke="#D8CBB4" stroke-width="2"/>`);
      o.push(`<circle cx="${x + (i ? 3 : -2)}" cy="${y + 1}" r="12.5" fill="#E07E2A"/>`);
      o.push(`<circle cx="${x + (i ? 3 : -2)}" cy="${y + 1}" r="12.5" fill="none" stroke="#C4631C"
        stroke-width="1.6" opacity=".7"/>`);
      o.push(`<ellipse cx="${x + (i ? -1 : -6)}" cy="${y - 4}" rx="4.5" ry="3" fill="#F6B45E" opacity=".8"/>`);
      if (i === 0) o.push(`<ellipse cx="${x + 13}" cy="${y + 9}" rx="5" ry="2.6" fill="#E8A34A" opacity=".75"/>`);
    }
    return o.join('');
  },
  // 草莓：红、心形、表面籽点、绿萼
  berry(a, pal, r) {
    const o = [];
    for (let i = 0; i < 4; i++) {
      const x = a.cx - 48 + i * 32, y = a.cy - (i % 2) * 10, W = 27, H = 32;
      const rot = (r() - .5) * 30;
      o.push(`<g transform="rotate(${rot} ${x} ${y})">
        <path d="M${x} ${y + H * .5} C${x - W * .56} ${y + H * .16}, ${x - W * .5} ${y - H * .34},
          ${x - W * .16} ${y - H * .4} C${x} ${y - H * .44}, ${x} ${y - H * .44}, ${x + W * .16} ${y - H * .4}
          C${x + W * .5} ${y - H * .34}, ${x + W * .56} ${y + H * .16}, ${x} ${y + H * .5} Z"
          fill="#C93A3C"/>
        <path d="M${x - W * .3} ${y - H * .3} C${x - W * .1} ${y - H * .16}, ${x - W * .14} ${y + H * .1},
          ${x - W * .3} ${y + H * .16} C${x - W * .44} ${y - H * .02}, ${x - W * .42} ${y - H * .2},
          ${x - W * .3} ${y - H * .3} Z" fill="#E05C56" opacity=".8"/>`);
      for (let k = 0; k < 9; k++) o.push(`<ellipse cx="${x + (r() - .5) * W * .74}"
        cy="${y + (r() - .5) * H * .66}" rx="1.5" ry="2" fill="#F7E6B8" opacity=".85"/>`);
      o.push(`<path d="M${x - 8} ${y - H * .42} L${x} ${y - H * .62} L${x + 8} ${y - H * .42}
        L${x} ${y - H * .34} Z" fill="#4E7A42"/></g>`);
    }
    return o.join('');
  },
  // 烧麦：开口的，顶上露出糯米馅
  shaomai(a, pal, r) {
    const o = [];
    for (let i = 0; i < 4; i++) {
      const x = a.cx - 45 + i * 30, y = a.cy - (i % 2) * 10, W = 30, H = 34;
      o.push(`<g transform="rotate(${(r() - .5) * 14} ${x} ${y})">
        <path d="M${x - W * .38} ${y + H * .3} C${x - W * .46} ${y - H * .1}, ${x - W * .5} ${y - H * .34},
          ${x - W * .34} ${y - H * .4} C${x} ${y - H * .48}, ${x} ${y - H * .48}, ${x + W * .34} ${y - H * .4}
          C${x + W * .5} ${y - H * .34}, ${x + W * .46} ${y - H * .1}, ${x + W * .38} ${y + H * .3}
          C${x + W * .18} ${y + H * .44}, ${x - W * .18} ${y + H * .44}, ${x - W * .38} ${y + H * .3} Z"
          fill="${i % 2 ? pal.lit : pal.hi}"/>`);
      for (let k = 0; k < 6; k++) o.push(`<path d="M${x - W * .3 + k * W * .12} ${y - H * .36}
        C${x - W * .28 + k * W * .12} ${y - H * .1}, ${x - W * .3 + k * W * .12} ${y + H * .1},
        ${x - W * .28 + k * W * .12} ${y + H * .3}" fill="none" stroke="${pal.sh}"
        stroke-width="1.1" opacity=".34"/>`);   // 竖褶
      o.push(`<ellipse cx="${x}" cy="${y - H * .42}" rx="${W * .32}" ry="${H * .13}" fill="#E0B95A"/>`);
      for (let g = 0; g < 5; g++) o.push(`<circle cx="${x + (r() - .5) * W * .42}"
        cy="${y - H * .42 + (r() - .5) * H * .12}" r="1.9" fill="#F2D98E" opacity=".9"/>`);
      o.push(`<circle cx="${x + 4}" cy="${y - H * .46}" r="1.8" fill="#7A5A2E" opacity=".7"/>`);
      o.push('</g>');
    }
    return o.join('');
  },
  // 小笼包：圆身，顶上一个旋褶收口
  xiaolong(a, pal, r) {
    const o = [];
    for (let i = 0; i < 5; i++) {
      const x = a.cx - 56 + i * 28, y = a.cy - (i % 2) * 9, R = 15;
      o.push(`<g><ellipse cx="${x}" cy="${y}" rx="${R}" ry="${R * .84}" fill="${i % 2 ? pal.lit : pal.hi}"/>`);
      for (let k = 0; k < 7; k++) {   // 从顶点放射的褶
        const ang = -Math.PI / 2 + (k - 3) * .38;
        o.push(`<path d="M${x} ${y - R * .72} L${x + Math.cos(ang) * R * .9} ${y + Math.sin(ang) * R * .78}"
          stroke="${pal.mid}" stroke-width="1.2" opacity=".42" fill="none"/>`);
      }
      o.push(`<circle cx="${x}" cy="${y - R * .68}" r="3" fill="${pal.mid}" opacity=".9"/>`);
      o.push(`<ellipse cx="${x - R * .3}" cy="${y + R * .2}" rx="${R * .34}" ry="${R * .2}"
        fill="#FFFDF4" opacity=".3"/></g>`);
    }
    return o.join('');
  },
  // 糖炒栗子：一面平一面圆，顶上一道开口
  chestnut(a, pal, r) {
    const o = [];
    for (let i = 0; i < 5; i++) {
      const x = a.cx - 58 + i * 29, y = a.cy - (i % 2) * 12, W = 28, H = 24;
      o.push(`<g transform="rotate(${(r() - .5) * 26} ${x} ${y})">
        <path d="M${x - W / 2} ${y + H * .34} C${x - W * .54} ${y - H * .2}, ${x - W * .2} ${y - H * .52},
          ${x} ${y - H * .52} C${x + W * .2} ${y - H * .52}, ${x + W * .54} ${y - H * .2},
          ${x + W / 2} ${y + H * .34} C${x + W * .2} ${y + H * .46}, ${x - W * .2} ${y + H * .46},
          ${x - W / 2} ${y + H * .34} Z" fill="${i % 2 ? pal.mid : pal.deep}"/>
        <path d="M${x - W * .3} ${y - H * .18} C${x - W * .12} ${y - H * .42}, ${x + W * .12} ${y - H * .42},
          ${x + W * .3} ${y - H * .18} C${x + W * .14} ${y - H * .04}, ${x - W * .14} ${y - H * .04},
          ${x - W * .3} ${y - H * .18} Z" fill="#F2DFAE"/>
        <path d="M${x - W * .3} ${y - H * .18} C${x - W * .06} ${y - H * .3}, ${x + W * .06} ${y - H * .3},
          ${x + W * .3} ${y - H * .18}" fill="none" stroke="${pal.sh}" stroke-width="1.6" opacity=".6"/>
        <ellipse cx="${x - W * .16}" cy="${y + H * .04}" rx="${W * .16}" ry="${H * .12}"
          fill="${pal.hi}" opacity=".5"/></g>`);
    }
    return o.join('');
  },
  // 糖藕：圆片＋中间一圈藕孔
  lotus(a, pal, r) {
    const o = [];
    for (let i = 0; i < 4; i++) {
      const x = a.cx - 48 + i * 32, y = a.cy - (i % 2) * 10, R = 17;
      o.push(`<circle cx="${x}" cy="${y}" r="${R}" fill="${i % 2 ? pal.mid : pal.lit}"/>`);
      o.push(`<circle cx="${x}" cy="${y}" r="${R}" fill="none" stroke="${pal.sh}" stroke-width="1.4" opacity=".5"/>`);
      o.push(`<circle cx="${x}" cy="${y}" r="${R * .22}" fill="${pal.sh}" opacity=".72"/>`);
      for (let k = 0; k < 7; k++) {   // 一圈孔
        const ang = k / 7 * Math.PI * 2;
        o.push(`<ellipse cx="${x + Math.cos(ang) * R * .56}" cy="${y + Math.sin(ang) * R * .56}"
          rx="${R * .17}" ry="${R * .13}" fill="${pal.sh}" opacity=".7"
          transform="rotate(${ang * 180 / Math.PI} ${x + Math.cos(ang) * R * .56} ${y + Math.sin(ang) * R * .56})"/>`);
      }
    }
    return o.join('');
  },
  // 韭菜盒子：外面是烙过的面皮（金黄＋焦斑），绿色只从咬开的缺口露出来
  hezi(a, pal, r) {
    const o = [], SKIN = '#D9B478', SKIN2 = '#C49A5E', CHAR = '#8A5F32', FILL = '#6E8B4E';
    for (let i = 0; i < 2; i++) {
      const x = a.cx - 30 + i * 58, y = a.cy - i * 8, w = 74, h = 50, rot = (r() - .5) * 18;
      o.push(`<g transform="rotate(${rot} ${x} ${y})">
        <path d="M${x - w / 2} ${y} C${x - w / 2} ${y - h * .62}, ${x + w / 2} ${y - h * .62},
          ${x + w / 2} ${y} C${x + w / 2} ${y + h * .5}, ${x - w / 2} ${y + h * .5}, ${x - w / 2} ${y} Z"
          fill="${i ? SKIN2 : SKIN}"/>
        <path d="M${x - w / 2 + 3} ${y + h * .12} C${x - w * .2} ${y + h * .3}, ${x + w * .2} ${y + h * .3},
          ${x + w / 2 - 3} ${y + h * .12}" fill="none" stroke="${CHAR}" stroke-width="1.6" opacity=".45"/>`);
      for (let c2 = 0; c2 < 7; c2++) o.push(`<ellipse cx="${x + (r() - .5) * w * .8}" cy="${y + (r() - .5) * h * .6}"
        rx="${1.8 + r() * 2.6}" ry="${1.2 + r() * 1.6}" fill="${CHAR}" opacity="${.26 + r() * .3}"/>`);
      if (i === 0) {   // 咬开的那一口：缺口 ＋ 露出来的韭菜馅
        o.push(`<path d="M${x + w * .3} ${y - h * .4} C${x + w * .5} ${y - h * .18},
          ${x + w * .44} ${y + h * .1}, ${x + w * .2} ${y + h * .2}
          C${x + w * .3} ${y - h * .06}, ${x + w * .32} ${y - h * .24}, ${x + w * .3} ${y - h * .4} Z"
          fill="${FILL}"/>`);
        for (let g = 0; g < 5; g++) o.push(`<rect x="${x + w * .2 + (r() - .5) * 14}"
          y="${y - h * .3 + g * 7}" width="${5 + r() * 5}" height="3" rx="1.5" fill="#8FAF63" opacity=".9"/>`);
      }
      o.push('</g>');
    }
    return o.join('');
  },
  // 芝麻汤圆：白团子浮在汤里，黑芝麻从咬开那颗流出来
  tangyuan(a, pal, r) {
    const o = [];
    o.push(`<ellipse cx="${a.cx}" cy="${a.cy}" rx="${a.rx * 1.02}" ry="${a.ry * .98}" fill="#D9C4A2"/>`);
    o.push(`<ellipse cx="${a.cx - 6}" cy="${a.cy - 2}" rx="${a.rx * .7}" ry="${a.ry * .62}"
      fill="#E6D4B4" opacity=".7"/>`);
    const TINT = ['#FBF6E8', '#F0C8CC', '#FBF6E8', '#CADEC0'];
    const pos = [[-34, 4], [-2, -6], [30, 3], [12, 12]];
    pos.forEach(([dx, dy], i) => {
      const x = a.cx + dx, y = a.cy + dy, rr = 15 - (i % 2) * 1.6;
      o.push(`<circle cx="${x}" cy="${y}" r="${rr}" fill="${TINT[i]}"/>`);
      o.push(`<ellipse cx="${x - rr * .3}" cy="${y - rr * .34}" rx="${rr * .34}" ry="${rr * .24}"
        fill="#FFFFFF" opacity=".7"/>`);
      if (i === 1) {   // 咬开的那颗：黑芝麻馅流出来
        o.push(`<path d="M${x + 2} ${y - rr * .5} C${x + rr * .8} ${y - rr * .2}, ${x + rr * .7} ${y + rr * .4},
          ${x + 1} ${y + rr * .6} C${x + rr * .3} ${y + rr * .1}, ${x + rr * .3} ${y - rr * .2}, ${x + 2} ${y - rr * .5} Z"
          fill="#332B26"/>`);
        o.push(`<ellipse cx="${x + rr * .9}" cy="${y + rr * .8}" rx="5.5" ry="3.2" fill="#332B26" opacity=".85"/>`);
      }
    });
    return o.join('');
  },
  // 蒸南瓜：带皮的弧形块，不是等边三角
  pumpkin(a, pal, r) {
    const o = [];
    for (let i = 0; i < 4; i++) {
      const x = a.cx - 54 + i * 36 + (r() - .5) * 6, y = a.cy - (i % 2) * 9, w = 42, h = 30;
      o.push(`<g transform="rotate(${(r() - .5) * 24} ${x} ${y})">
        <path d="M${x - w / 2} ${y + h * .42} C${x - w * .3} ${y - h * .5}, ${x + w * .3} ${y - h * .5},
          ${x + w / 2} ${y + h * .42} C${x + w * .2} ${y + h * .56}, ${x - w * .2} ${y + h * .56},
          ${x - w / 2} ${y + h * .42} Z" fill="${i % 2 ? '#E9A93E' : '#F2C05A'}"/>
        <path d="M${x - w / 2} ${y + h * .42} C${x + w * .2} ${y + h * .56}, ${x - w * .2} ${y + h * .56},
          ${x + w / 2} ${y + h * .42} C${x + w * .46} ${y + h * .64}, ${x - w * .46} ${y + h * .64},
          ${x - w / 2} ${y + h * .42} Z" fill="#3F5C33"/>
        ${[0,1,2].map(q=>`<ellipse cx="${x + (q-1) * w * .17}" cy="${y - h * .1}" rx="2.6" ry="3.6"
          fill="#F0E2B4" opacity=".9"/>`).join('')}</g>`);
    }
    return o.join('');
  },
};

// ── 主体：按 spec 摆块 ──
function body(food, sp, pal, fam, r) {
  const a = AREA[sp.vessel], t = TEX[fam];
  if (sp.draw) return CUSTOM[sp.draw](a, pal, r);
  if (a.liquid) {
    // 杯里的液体：从液面一直到杯底，颜色就是这杯东西本来的颜色
    const o = [`<path d="M124 118 L${129} 214 C131 223, 145 228, 170 228 C195 228, 209 223, 211 214
      L216 118 C198 126, 142 126, 124 118 Z" fill="${pal.mid}"/>`];
    o.push(`<ellipse cx="170" cy="120" rx="45" ry="11" fill="${pal.hi}" opacity=".8"/>`);
    o.push(`<ellipse cx="${170 - 14}" cy="118" rx="13" ry="4.4" fill="#FFFDF4" opacity=".42"/>`);
    const M = sp.mark, cx = 170, cy = 120;
    if (M === 'ice') for (let i = 0; i < 3; i++)
      o.push(`<rect x="${cx - 26 + i * 19}" y="${cy + 8 + (r() - .5) * 22}" width="17" height="16" rx="3"
        fill="#EAF2F4" opacity=".34" transform="rotate(${(r() - .5) * 40} ${cx} ${cy})"/>`);
    if (M === 'skin') o.push(`<ellipse cx="${cx}" cy="${cy - 1}" rx="42" ry="10" fill="#FFFDF6" opacity=".62"/>`);
    if (M === 'bean') for (let i = 0; i < 3; i++)
      o.push(`<ellipse cx="${cx + (i - 1) * 13}" cy="${cy + 3 + (r() - .5) * 5}" rx="5" ry="3.6"
        fill="#F2E8CE" opacity=".62"/>`);
    if (sp.pearl) for (let i = 0; i < 7; i++)
      o.push(`<circle cx="${cx + (r() - .5) * 60}" cy="${196 + (r() - .5) * 22}" r="5" fill="#3A2A1E"/>`);
    if (sp.fizz) for (let i = 0; i < 12; i++)
      o.push(`<circle cx="${cx + (r() - .5) * 68}" cy="${cy + 14 + r() * 88}" r="${1.3 + r() * 1.7}"
        fill="#FFF6E0" opacity=".42"/>`);
    return o.join('');
  }
  const out = [];
  const scale = sp.big || 1;

  if (sp.n === 1) {
    // 一整摊/一整块：液面、粥、蛋、饼、面包
    const w = a.rx * 2 * (sp.vessel === 'none' ? .9 : .96) * scale;
    const h = a.ry * 2 * (sp.vessel === 'none' ? 1.5 : 1.05) * scale;
    out.push(`<g fill="${pal.mid}">${blob(a.cx, a.cy, w, h, r)}</g>`);
    out.push(`<g fill="${pal.lit}" opacity=".92">${blob(a.cx - w * .04, a.cy - h * .08, w * .74, h * .66, r)}</g>`);
    if (sp.layer) out.push(`<g fill="${pal.hi}" opacity=".8">${blob(a.cx, a.cy - h * .26, w * .82, h * .3, r)}</g>`);
    if (sp.split) out.push(`<g fill="${pal.sh}" opacity=".78">${blob(a.cx + w * .06, a.cy, w * .12, h * .8, r, 8)}</g>`);
    if (sp.coil) out.push(`<g fill="none" stroke="${pal.sh}" stroke-width="2.4" opacity=".4">
      <path d="M${a.cx - 26} ${a.cy} a26 12 0 1 0 52 0 a26 12 0 1 0 -52 0"/>
      <path d="M${a.cx - 14} ${a.cy} a14 7 0 1 0 28 0 a14 7 0 1 0 -28 0"/></g>`);
    if (sp.bar) { out.length = 0;
      out.push(`<rect x="${a.cx - 30}" y="${a.cy - 44}" width="60" height="88" rx="9" fill="${pal.mid}"/>`);
      out.push(`<rect x="${a.cx - 22}" y="${a.cy - 36}" width="26" height="60" rx="7" fill="${pal.hi}" opacity=".55"/>`);
      out.push(`<rect x="${a.cx - 5}" y="${a.cy + 42}" width="10" height="40" rx="4" fill="#C6B393"/>`); }
    if (sp.cob) { out.length = 0;
      out.push(`<g fill="${pal.mid}">${blob(a.cx, a.cy, w * .92, h * .86, r)}</g>`);
      for (let c2 = 0; c2 < 7; c2++) for (let rw = 0; rw < 5; rw++) {
        const x = a.cx - w * .34 + c2 * w * .114, y = a.cy - h * .26 + rw * h * .13 + (c2 % 2) * h * .06;
        out.push(`<ellipse cx="${x}" cy="${y}" rx="${w * .045}" ry="${h * .052}" fill="${rw % 2 ? pal.lit : pal.hi}" opacity=".95"/>`); } }
  } else {
    // 多块：饺子、包子、栗子、汤圆、草莓、藕片…
    const n = sp.n;
    const bw = a.rx * 2 / (n * .62) * scale, bh = bw * (sp.wedge ? .78 : .82);
    for (let i = 0; i < n; i++) {
      const row = i % 2, k = (i - (n - 1) / 2);
      const x = a.cx + k * bw * .68 + (r() - .5) * 5;
      const y = a.cy - row * bh * .34 + (r() - .5) * 4;
      const c = i % 3 === 0 ? pal.lit : i % 3 === 1 ? pal.mid : pal.deep;
      if (sp.wedge) {
        const s = bw * .5, rot = (r() - .5) * 26;
        out.push(`<g transform="rotate(${rot} ${x} ${y})">
          <path d="M${x - s} ${y + s * .7} L${x} ${y - s * .8} L${x + s} ${y + s * .7} Z" fill="${c}"/>
          ${sp.rind ? `<path d="M${x - s} ${y + s * .7} L${x + s} ${y + s * .7} L${x + s * .82} ${y + s * .46} L${x - s * .82} ${y + s * .46} Z" fill="${sp.rind}"/>` : ''}
          ${sp.rind ? [0,1,2].map(q=>`<ellipse cx="${x + (q-1) * s * .34}" cy="${y + s * .1}" rx="2.2" ry="3" fill="#2E2418" opacity=".7"/>`).join('') : ''}
        </g>`);
      } else if (sp.tip) {
        out.push(`<g fill="${c}"><path d="M${x} ${y - bh * .55} C${x + bw * .42} ${y - bh * .2},
          ${x + bw * .3} ${y + bh * .5}, ${x} ${y + bh * .55}
          C${x - bw * .3} ${y + bh * .5}, ${x - bw * .42} ${y - bh * .2}, ${x} ${y - bh * .55} Z"/></g>`);
      } else {
        out.push(`<g fill="${c}">${blob(x, y, bw, bh, r, (r() - .5) * 18)}</g>`);
      }
      if (sp.pleat) out.push(`<g stroke="${pal.sh}" stroke-width="1.3" opacity=".42" fill="none">
        <path d="M${x - bw * .2} ${y - bh * .3} L${x} ${y - bh * .5} L${x + bw * .2} ${y - bh * .3}"/></g>`);
      if (sp.holes) for (let h2 = 0; h2 < 3; h2++)
        out.push(`<circle cx="${x + (h2 - 1) * bw * .22}" cy="${y + (r() - .5) * 5}" r="${bw * .085}" fill="${pal.sh}" opacity=".62"/>`);
      if (sp.leaf) out.push(`<path d="M${x - 5} ${y - bh * .5} L${x} ${y - bh * .74} L${x + 5} ${y - bh * .5}
        L${x} ${y - bh * .42} Z" fill="#5C7F4A"/>`);
      if (sp.shine) out.push(`<ellipse cx="${x - bw * .16}" cy="${y - bh * .2}" rx="${bw * .16}" ry="${bh * .12}" fill="${pal.hi}" opacity=".6"/>`);
      if (sp.yolk && i === 0) out.push(`<circle cx="${x}" cy="${y}" r="${bw * .3}" fill="#E09A3C"/>`);
      if (sp.ribbon) out.push(`<g fill="${c}" opacity=".85"><rect x="${x - bw * .5}" y="${y - 4}" width="${bw}" height="8" rx="4"/></g>`);
      if (sp.marble) out.push(`<g stroke="${pal.hi}" stroke-width="1.6" opacity=".5" fill="none">
        <path d="M${x - bw * .3} ${y} C${x} ${y - bh * .2}, ${x} ${y + bh * .2}, ${x + bw * .3} ${y}"/></g>`);
    }
  }

  // 浮料（汤类表面漂的东西）
  if (sp.float) for (let i = 0; i < 5; i++)
    out.push(`<circle cx="${a.cx + (r() - .5) * a.rx * 1.5}" cy="${a.cy + (r() - .5) * a.ry}" r="${2 + r() * 2}"
      fill="${i % 2 ? '#8CAE7A' : pal.hi}" opacity=".72"/>`);
  if (sp.pearl) for (let i = 0; i < 6; i++)
    out.push(`<circle cx="${a.cx + (r() - .5) * a.rx * 1.3}" cy="${a.cy + 46 + (r() - .5) * 16}" r="4.6" fill="#4A3524"/>`);
  if (sp.fizz) for (let i = 0; i < 9; i++)
    out.push(`<circle cx="${a.cx + (r() - .5) * a.rx * 1.5}" cy="${a.cy + 12 + r() * 70}" r="${1.4 + r() * 1.8}"
      fill="#FFF6E0" opacity=".5"/>`);
  if (sp.mound) for (let i = 0; i < 34; i++) {
    const x = a.cx + (r() - .5) * a.rx * 1.7, y = a.cy + (r() - .5) * a.ry * 1.7;
    out.push(`<ellipse cx="${x}" cy="${y}" rx="${2.4 + r() * 1.6}" ry="${1.5 + r()}" fill="${r() > .5 ? pal.hi : pal.lit}" opacity=".9"/>`);
  }
  // ── 辨识特征 ──
  const M = sp.mark, cx = a.cx, cy = a.cy;
  if (M === 'rice') for (let i = 0; i < 22; i++)
    out.push(`<ellipse cx="${cx + (r() - .5) * a.rx * 1.5}" cy="${cy + (r() - .5) * a.ry * 1.4}"
      rx="2.6" ry="1.5" fill="#FFFBF0" opacity=".85" transform="rotate(${r() * 90} ${cx} ${cy})"/>`);
  if (M === 'drizzle') {
    out.push(`<path d="M${cx - 34} ${cy - 4} C${cx - 12} ${cy + 6}, ${cx + 10} ${cy - 8}, ${cx + 32} ${cy + 3}
      C${cx + 14} ${cy + 10}, ${cx - 14} ${cy + 12}, ${cx - 34} ${cy - 4} Z" fill="#6B4526" opacity=".78"/>`);
    for (let i = 0; i < 26; i++) out.push(`<circle cx="${cx + (r() - .5) * 84}"
      cy="${cy + (r() - .5) * 22}" r="${.9 + r() * 1.5}" fill="#C9A468" opacity="${.5 + r() * .4}"/>`);
    out.push(`<circle cx="${cx + 18}" cy="${cy - 8}" r="2.2" fill="#8CAE7A"/>`);
  }
  if (M === 'wisp') for (let i = 0; i < 6; i++) {
    const x = cx + (r() - .5) * a.rx * 1.5, y = cy + (r() - .5) * a.ry * 1.2;
    out.push(`<path d="M${x - 9} ${y} C${x - 4} ${y - 5}, ${x + 4} ${y + 4}, ${x + 9} ${y - 1}
      C${x + 4} ${y + 5}, ${x - 4} ${y + 3}, ${x - 9} ${y} Z" fill="#FFFBF2" opacity=".8"/>`);
  }
  if (M === 'bone') {
    for (let i = 0; i < 3; i++) {   // 炖到发白的肉块，不是卡通骨头
      const x = cx - 26 + i * 26, y = cy + (r() - .5) * 10;
      out.push(`<g transform="rotate(${(r() - .5) * 34} ${x} ${y})">
        <rect x="${x - 13}" y="${y - 8}" width="26" height="16" rx="6" fill="#A8886A"/>
        <rect x="${x - 9}" y="${y - 5}" width="18" height="6" rx="3" fill="#C9AE8E" opacity=".8"/></g>`);
    }
    for (let i = 0; i < 7; i++) out.push(`<circle cx="${cx + (r() - .5) * 78}"
      cy="${cy + (r() - .5) * 20}" r="${1.6 + r()}" fill="#7FA86A" opacity=".85"/>`);
  }
  if (M === 'slice') for (let i = 0; i < 3; i++)
    out.push(`<g fill="#8A5A44" opacity=".9" transform="rotate(${(r() - .5) * 40} ${cx} ${cy})">
      <rect x="${cx - 22 + i * 16}" y="${cy - 6 + (r() - .5) * 8}" width="20" height="9" rx="4.5"/></g>`);
  if (M === 'chili') {
    out.push(`<ellipse cx="${cx + 8}" cy="${cy - 2}" rx="${a.rx * .5}" ry="${a.ry * .5}"
      fill="#C2452C" opacity=".62"/>`);
    for (let i = 0; i < 8; i++) out.push(`<circle cx="${cx + (r() - .5) * a.rx * 1.3}"
      cy="${cy + (r() - .5) * a.ry}" r="${1.3 + r()}" fill="#E0603C" opacity=".8"/>`);
  }
  if (M === 'ice') for (let i = 0; i < 3; i++)
    out.push(`<rect x="${cx - 26 + i * 20}" y="${cy + 4 + (r() - .5) * 14}" width="17" height="15" rx="3"
      fill="#EAF2F4" opacity=".42" transform="rotate(${(r() - .5) * 40} ${cx} ${cy})"/>`);
  if (M === 'skin') out.push(`<ellipse cx="${cx}" cy="${cy - 1}" rx="${a.rx * .88}" ry="${a.ry * .8}"
    fill="#FFFDF6" opacity=".5"/>`);
  if (M === 'bean') for (let i = 0; i < 3; i++)
    out.push(`<ellipse cx="${cx + (i - 1) * 13}" cy="${cy + 2 + (r() - .5) * 6}" rx="5" ry="3.6"
      fill="#E8DEC2" opacity=".7"/>`);
  if (M === 'chive') {
    for (let i = 0; i < 4; i++) out.push(`<rect x="${cx - 26 + i * 15}" y="${cy - 4 + (r() - .5) * 12}"
      width="8" height="4.4" rx="2" fill="#7FA86A" transform="rotate(${(r() - .5) * 44} ${cx} ${cy})"/>`);
    out.push(`<ellipse cx="${cx - 16}" cy="${cy + 6}" rx="6.5" ry="3" fill="#7A5433" opacity=".72"/>`);
  }
  if (sp.leaf) out.push('');
  if (sp.soft) out.push(`<ellipse cx="${a.cx - a.rx * .2}" cy="${a.cy - a.ry * .3}" rx="${a.rx * .42}" ry="${a.ry * .4}"
      fill="${pal.hi}" opacity="${t.gloss}"/>`);
  return out.join('\n');
}

// 质感：焦斑 / 颗粒点 / 高光 / 蒸汽
function texture(food, sp, pal, fam, r) {
  const a = AREA[sp.vessel], t = TEX[fam], out = [];
  if (t.spots === 'char') for (let i = 0; i < 14; i++)
    out.push(`<ellipse cx="${a.cx + (r() - .5) * a.rx * 1.6}" cy="${a.cy + (r() - .5) * a.ry * 1.8}"
      rx="${1.6 + r() * 2.4}" ry="${1.1 + r() * 1.4}" fill="${pal.sh}" opacity="${.3 + r() * .3}"/>`);
  if (t.gloss > .35 && !sp.soft)
    out.push(`<ellipse cx="${a.cx - a.rx * .26}" cy="${a.cy - a.ry * .34}" rx="${a.rx * .38}" ry="${a.ry * .32}"
      fill="#FFFCEE" opacity="${t.gloss * .5}"/>`);
  for (let i = 0; i < t.steam; i++) {
    const x = a.cx + (i - (t.steam - 1) / 2) * 26;
    out.push(`<path d="M${x} ${a.cy - 44} C${x + 5} ${a.cy - 58}, ${x - 5} ${a.cy - 68}, ${x + 3} ${a.cy - 82}"
      fill="none" stroke="#CFC0A2" stroke-width="1.9" stroke-linecap="round" opacity=".3"/>`);
  }
  return out.join('\n');
}

// 几何配重：3–5 个，位置由种子定，不代表食物（skill 5）
function geo(pal, r) {
  const out = [];
  const pool = [];
  const sx = 22 + r() * 46, sy = 176 + r() * 46;
  const flip = r() > .5 ? 1 : -1, ox = flip > 0 ? 0 : 250;
  pool.push(`<path d="M${sx + ox * 0} ${sy} h${22 + r() * 14} v18 h${18 + r() * 12} v18 h-52 v-18 h-24 z"
    fill="${TH.geo[0]}" opacity="${.3 + r() * .16}"/>`);
  const rx = flip > 0 ? 276 + r() * 18 : 30 + r() * 16, ry = 120 + r() * 70;
  pool.push(`<path d="M${rx} ${ry} A${15 + r() * 7} ${15 + r() * 7} 0 1 1 ${rx} ${ry + 34 + r() * 12}"
    fill="none" stroke="${TH.geo[1]}" stroke-width="2.3" stroke-linecap="round" opacity="${.36 + r() * .18}"/>`);
  const dx = flip > 0 ? 34 + r() * 22 : 288 + r() * 14, dy = 58 + r() * 70, dn = 3 + Math.floor(r() * 3);
  pool.push(`<g fill="${TH.geo[2]}" opacity="${.34 + r() * .16}">${Array.from({length:dn}, (_, i) =>
    `<circle cx="${dx}" cy="${dy + i * 9}" r="2"/>`).join('')}</g>`);
  pool.push(`<g stroke="${TH.geo[3]}" stroke-width="1.2" opacity="${.24 + r() * .14}" stroke-linecap="round">
    <path d="M${flip > 0 ? 238 : 34} ${222 + r() * 20} h${34 + r() * 24}"/>
    <path d="M${flip > 0 ? 238 : 34} ${230 + r() * 20} h${18 + r() * 18}"/></g>`);
  pool.push(`<rect x="${flip > 0 ? 40 + r() * 20 : 268 + r() * 16}" y="${96 + r() * 60}"
    width="${10 + r() * 12}" height="${10 + r() * 10}" fill="${TH.geo[4]}" opacity="${.26 + r() * .14}"/>`);
  // 每张随机取 3–5 个，位置也变 —— 固定位置会让 30 张读成同一个模板
  const k = 3 + Math.floor(r() * 3);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, k).join('\n');
}

// ── 组装一张 ──
export function draw(food, mode = 'dark') {
  TH = THEME[mode] || THEME.dark;
  const sp = SPEC[food], fam = famOf(food), pal = palette(food, SPEC[food].vessel);
  if (!sp) throw new Error('SPEC 缺 ' + food);
  const r = rng(seedOf(food)), t = TEX[fam];
  return `<svg viewBox="0 0 340 262" xmlns="http://www.w3.org/2000/svg">
<defs><filter id="d_${seedOf(food)}" x="-10%" y="-10%" width="120%" height="120%">
<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" seed="${seedOf(food) % 100}" result="n"/>
<feColorMatrix in="n" type="saturate" values="0" result="g"/>
<feComponentTransfer in="g" result="c"><feFuncA type="discrete" tableValues="${TH.grain === 'cut' ? '0 0 .22 .44 .62 .78 .9 1' : '0 0 0 0 .35 .7 1'}"/></feComponentTransfer>
<feComposite in="SourceGraphic" in2="c" operator="in"/></filter></defs>
${geo(pal, r)}
<g style="filter:drop-shadow(${TH.shadow})">
${VESSEL[sp.vessel](pal).back}
${TH.grain === 'cut' ? `<g filter="url(#d_${seedOf(food)})">` : ''}
${body(food, sp, pal, fam, rng(seedOf(food)))}
${TH.grain === 'cut' ? '</g>' : ''}
${VESSEL[sp.vessel](pal).front}
${texture(food, sp, pal, fam, rng(seedOf(food) + 3))}
<g filter="url(#d_${seedOf(food)})" opacity="${t.grain * .6}">
${body(food, sp, { ...pal, mid:'#FFF8E2', lit:'#FFFDF2', deep:'#FFEFC8', hi:'#FFF', sh:'#FFF' }, fam, rng(seedOf(food)))}
</g>
</g>
</svg>`;
}

// ── 跑：生成 30 张 ＋ 展示页 ──
const foods = D.taste.map(t => t.food);
const out = path.resolve(import.meta.dirname, 'cards');
fs.mkdirSync(out, { recursive: true });
const cells = foods.map((f, i) => {
  const svg = draw(f);
  fs.writeFileSync(path.join(out, `${String(i).padStart(2, '0')}-${f}.svg`), svg);
  return `<div class=c><div class=s>${svg}</div><div class=t>${f}</div>
    <div class=m>${famOf(f)} · ${SPEC[f].vessel} · ${TEX[famOf(f)].note}</div></div>`;
}).join('\n');

fs.writeFileSync(path.resolve(import.meta.dirname, '滋味卡-30张.html'), `<!doctype html>
<meta charset=utf-8><title>滋味卡 · 30 张</title>
<style>
body{background:#0a0806;color:#F4EDE3;font:14px/1.6 -apple-system,"PingFang SC",sans-serif;
     margin:0;padding:38px 34px;-webkit-font-smoothing:antialiased}
h1{font-size:22px;font-weight:600;margin:0 0 5px}
.n{font-size:13px;color:#8B8073;margin:0 0 28px}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(258px,1fr));gap:22px}
.c{}
.s{background:#0C0906;border:1px solid #241e18;border-radius:16px;overflow:hidden;position:relative}
.s::before{content:'';position:absolute;left:50%;top:22%;transform:translateX(-50%);
  width:78%;height:52%;border-radius:50%;filter:blur(38px);
  background:radial-gradient(circle,#F0BE6a4a 0%,#D08A4a22 46%,transparent 74%)}
.s svg{display:block;width:100%;height:auto;position:relative}
.t{font-family:"STXingkai","STKaiti",KaiTi,serif;font-size:22px;color:#FBEDCF;padding:9px 2px 1px}
.m{font-family:ui-monospace,Menlo,monospace;font-size:10.5px;color:#8B8073;letter-spacing:.04em}
</style>
<h1>滋味卡 · 30 张</h1>
<p class=n>参数化生成：色取自 daily.js 的 cardHue，画法由 cardTexFam 六分类驱动，种子取食物名（同一道菜每次一样）。加新食物＝在 card-gen.mjs 的 SPEC 补一行。</p>
<div class=g>${cells}</div>`);

console.log(`生成 ${foods.length} 张 → cards/ ＋ 滋味卡-30张.html`);
