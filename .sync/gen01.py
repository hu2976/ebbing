#!/usr/bin/env python3
"""用 screens.json（sync.mjs 从原型导出）+ meta.py 重写定稿册的 S 数组。
屏级文字全部来自原型，一个字都不在这里手写。"""
import sys, json, re, os
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from meta import META, ORDER, SID

SCR_JSON = os.environ.get('SCREENS_JSON') or os.path.join(HERE, 'screens.json')
DOC = os.path.join(ROOT, '01-给UI-定稿册·每屏长什么样.html')

scr = json.load(open(SCR_JSON, encoding='utf8'))

def body_for(key):
    if key.startswith('home_'):
        return scr['home']['variants'][key.split('_')[1]]
    if key.startswith('eat_'):
        return scr['eat']['variants'][key[4:]]
    return scr[key]['variants']['_']

missing = [k for k in ORDER if k not in scr and not k.startswith(('home_', 'eat_'))]
if missing:
    sys.exit('原型里没有这些屏，先更新 meta.py：' + ', '.join(missing))
extra = [k for k in scr if k not in ('home', 'eat')
         and k not in ORDER and 'home_' + k not in ORDER]
if extra:
    print('原型里有但定稿册没收的屏（要收就加进 meta.py）：', ', '.join(extra))

j = lambda v: json.dumps(v, ensure_ascii=False)
rows = []
for k in ORDER:
    L, nm, note = META[k]
    rows.append('{L:%d,id:%s,nm:%s,note:%s,b:%s}' % (
        L, j(SID.get(k, 's-' + k)), j(nm), j(note), j(body_for(k))))
newS = 'const S=[\n' + ',\n'.join(rows) + '\n];'

s = open(DOC, encoding='utf8').read()
s2, n = re.subn(r'const S=\[[\s\S]*?\n\];', newS, s, count=1)
if not n:
    sys.exit('没在定稿册里找到 S 数组')
open(DOC, 'w', encoding='utf8').write(s2)
print('写入 %d 屏卡，%d → %d 字符' % (len(rows), len(s), len(s2)))
