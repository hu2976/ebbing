/* 运行期冒烟测试：mock 掉 wx，把 Page 的 36 屏全走一遍。
   静态检查只看得见块型和跳转，这个看得见「渲染出来是不是空的」——
   36 屏全空那次就是它抓到的（mergeTaste 的别名 bug）。
   跑法：node .sync-mp/smoke.cjs */
/* 把 Page 在 node 里跑一遍：mock 掉 wx，看 onLoad→draw 到底抛在哪 */
let page = null;
global.Page = (o) => { page = o; };
global.wx = {
  getSystemInfoSync: () => ({ statusBarHeight: 44, pixelRatio: 3 }),
  pageScrollTo: () => {},
  createSelectorQuery: () => ({ in: () => ({ select: () => ({ fields: () => ({ exec: () => {} }) }) }) }),
  createOffscreenCanvas: () => ({ getContext: () => ({ createImageData: () => ({ data: [] }), putImageData: () => {} }) }),
};
require('/Users/hujinghan/Desktop/搓点有趣的/退潮/04-小程序/pages/index/index.js');

page.data = { ...page.data };
page.setData = function (o, cb) { Object.assign(this.data, o); if (cb) cb(); };
try {
  page.onLoad();
  console.log('onLoad ✓  首屏', page.data.blocks.length, '块:',
    page.data.blocks.map((b) => b.k).join(' '));
} catch (e) { console.log('✗ onLoad 抛错:', e.message, '\n', e.stack.split('\n')[1]); process.exit(1); }

/* 把 36 屏全走一遍 */
const D = require('/Users/hujinghan/Desktop/搓点有趣的/退潮/04-小程序/data/screens.js');
let bad = 0;
for (const id of Object.keys(D.SCREENS)) {
  page.cur = id;
  try { page.draw(); if (!page.data.blocks.length) { console.log('⚠ 空屏:', id); bad++; } }
  catch (e) { console.log('✗', id, '→', e.message); bad++; }
}
console.log(bad ? `✗ ${bad} 屏有问题` : '✓ 36 屏全部渲染出块');

if (page._on) clearInterval(page._on);   // 在场人数的心跳，不清 node 不退出
process.exit(bad ? 1 : 0);
