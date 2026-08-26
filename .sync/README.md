# 同步脚本

屏级文字的唯一源是 `02-给UI-可交互原型.html`。
定稿册（01）的屏级数据由它生成，**不手抄**——手抄就是 08-21 那次两份文档分叉的原因。

## 改完原型之后跑这三步

```
node .sync/chk.mjs        # 原型自检：死链、可达性、块型、球堆容量
node .sync/sync.mjs       # 从原型导出 screens.json（每屏的块，含 home/eat 的多变体）
python3 .sync/gen01.py    # 用 screens.json + meta.py 重写定稿册的 S 数组
node .sync/chk01.mjs      # 定稿册自检：屏卡数、渲染分支覆盖、与原型抽样比对
```

`meta.py` 里放的是每屏的**层、屏名、说明**——说明是判断不是文案，所以手写、不生成。
新增屏要在 `meta.py` 的 `META` 和 `ORDER` 里各加一条（id 特殊的再加进 `SID`）。
