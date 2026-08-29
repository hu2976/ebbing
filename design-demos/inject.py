#!/usr/bin/env python3
"""把 cards/ 里的插画 SVG 内嵌进方向稿。
SVG 里有 filter/gradient 的 id，同一张图在一页上出现多次会撞 id，
所以每次注入都给 id 加后缀。"""
import re, sys, pathlib
D = pathlib.Path(__file__).parent
def load(n, tag):
    s = (D/'cards'/n).read_text(encoding='utf8')
    for i in set(re.findall(r'id="([^"]+)"', s)):
        s = s.replace(f'id="{i}"', f'id="{i}_{tag}"').replace(f'#{i})', f'#{i}_{tag})')
    return s
for f in sys.argv[1:]:
    p = D/f; s = p.read_text(encoding='utf8')
    for m in sorted(set(re.findall(r'\{\{SVG_(\d\d)\}\}', s))):
        hit = next(x for x in (D/'cards').iterdir() if x.name.startswith(m+'-'))
        n = 0
        while '{{SVG_'+m+'}}' in s:
            n += 1
            s = s.replace('{{SVG_'+m+'}}', load(hit.name, f'{m}x{n}'), 1)
    (D/f.replace('.html','.out.html')).write_text(s, encoding='utf8')
    print('→', f.replace('.html','.out.html'))
