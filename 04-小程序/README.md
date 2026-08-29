# 退潮 · 微信小程序

36 屏 = **一个页面**。原型本来就是单页换内容，小程序里照旧。

## 屏级文字仍然只有一个源

**唯一源是 `../02-给UI-可交互原型.html`。这里的 `data/screens.js` 和
`pages/index/index.wxss` 都是生成的，手改会在下一次生成时被覆盖。**

改完原型跑：

```
node .sync-mp/gen.mjs     # 从原型抽 SCREENS + 抽屏内 CSS（rem→rpx、选择器改名）
node .sync-mp/chk.mjs     # 自检：每块有 prep 分支、无死链、块型全覆盖
```

原型那边原有的四步（chk / sync / gen01 / chk01）照旧跑，两条链互不干扰——
定稿册和小程序是同一份文案的两个渲染器，第三个是原型自己。

## 文件

| 文件 | 手写还是生成 |
|---|---|
| `pages/index/index.wxml` | 手写。25 种块型各一个渲染分支 |
| `pages/index/index.js` | 手写。跳转、时段、词、球堆几何、潮汐 canvas |
| `pages/index/index.wxss` | **生成**。源是原型的屏内 CSS |
| `data/screens.js` | **生成**。源是原型的 `SCREENS` 段 |
| `.sync-mp/gen.mjs` `.sync-mp/chk.mjs` | 手写 |

## 和网页原型的三处不同

- **没有手机外壳**。原型画了机身/刘海/状态栏，小程序里手机就是手机。
- **`button` 全换成 `view`**。小程序 button 的默认样式压不干净，
  生成脚本里 `SEL` 表负责把 `.words button` 这类选择器改成 `.word`。
- **`rem` 全换成 `rpx`（×32）**。WXSS 里 `1rem` 是屏宽/20（≈18.75px），
  照搬会让整份排版胖 17%。边框的 `1px` 没动——细线比自适应重要。

## 这一版还没做

- **在场人数是写死的**。它是唯一需要后端的东西，也是唯一会自己变的数字。
  真要接：微信云开发一个 `online` 集合 + 心跳。演示阶段写死看不出差别。
- **衬线字体在安卓会回退**。iOS 有 Songti SC，安卓没有，会掉到系统 serif。
  要一致得 `wx.loadFontFace` 加一个 https 上的字体文件。
- **`prefers-reduced-motion` 没接**。小程序没有这个 API，潮汐一直在动。
