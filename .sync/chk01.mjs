import fs from 'fs';
const h=fs.readFileSync('/Users/hujinghan/Desktop/搓点有趣的/黑客松/01-给UI-定稿册·每屏长什么样.html','utf8');
const S=JSON.parse('['+h.match(/const S=\[([\s\S]*?)\n\];/)[1]
  .replace(/\{L:/g,'{"L":').replace(/,id:/g,',"id":').replace(/,nm:/g,',"nm":')
  .replace(/,note:/g,',"note":').replace(/,b:/g,',"b":')+']');
console.log('屏卡:',S.length);
const byL={}; S.forEach(x=>byL[x.L]=(byL[x.L]||0)+1);
console.log('分层:',JSON.stringify(byL));
// 渲染分支覆盖
const kinds=new Set(S.flatMap(x=>x.b.map(b=>b[0])));
const rendered=new Set([...h.matchAll(/k===['"](\w+)['"]/g)].map(m=>m[1]));
console.log('块型:',[...kinds].sort().join(' '));
const missing=[...kinds].filter(k=>!rendered.has(k));
console.log('没有渲染分支:',missing.length?missing:'无');
// 屏级文字是否真和原型一致（抽样比对）
const proto=fs.readFileSync('/Users/hujinghan/Desktop/搓点有趣的/黑客松/02-给UI-可交互原型.html','utf8');
const probes=['饿了。','太久没吃东西，饿的感觉会像潮水一样涨起来。','想吃点什么样的？',
 '嘴里和喉咙','相信我们的身体','到点了就吃点东西叭','写下感受吧','但这只是一个词',
 '改变会发生在你想改变的时候','情绪瓶子','如果愿意，请相信','给你看的东西','一起正念'];
let bad=[];
for(const t of probes){ const a=h.includes(t), b=proto.includes(t); if(!(a&&b)) bad.push(t+' 册:'+a+' 型:'+b); }
console.log('抽样一致:', bad.length?bad:'全部一致');
// 已删的东西不该残留在屏级数据里
for(const t of ['一样，一次','给医生的一页','越压，后面越饿','吐、泻药、不吃下一顿']){
  const inS=S.some(x=>JSON.stringify(x.b).includes(t));
  if(inS) console.log('  !! 屏级数据里仍有:',t);
}
