#!/usr/bin/env python3
"""Render shared career facts into HTML timeline, llms.txt, and public JSON."""
import html
import json
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / "career-data.json").read_text())
roles = data["roles"]
def career_html():
    parts=[]
    q=[r for r in roles if r["company"] == "Quotograph.io"]
    for role in roles:
        if role["company"] == "Quotograph.io":
            continue
        bullets="".join(f"<li>{html.escape(x)}</li>" for x in role["website_bullets"])
        parts.append(f'<article class="timeline-item"><div class="timeline-meta"><span>{html.escape(role["dates"])}</span><span>{html.escape(role["location"])}</span></div><div><h3>{html.escape(role["title"])}</h3><p class="organization">{html.escape(role["company"])}</p></div><ul>{bullets}</ul></article>')
    parts.insert(2,'<article class="timeline-item"><div class="timeline-meta"><span>2024—present</span><span>'+html.escape(q[0]["location"])+'</span></div><div><p class="organization">Quotograph.io</p>'+''.join(f'<h3>{html.escape(r["title"])}</h3><p>{html.escape(r["dates"])}</p>' for r in q)+'</div></article>')
    return '\n          '.join(parts)
def career_text():
    out=[]
    for r in roles:
        detail=' '.join(r['website_bullets']) if r['website_bullets'] else f'Based in {r["location"]}.'
        out.append(f'- {r["title"]}, {r["company"]} ({r["dates"]}; {r["location"]}): {detail}')
    return '\n'.join(out)
outputs=[('public/index.html','          <!-- CAREER-EXPERIENCE-START -->','          <!-- CAREER-EXPERIENCE-END -->',career_html()),('public/llms.txt','<!-- CAREER-DATA-START -->','<!-- CAREER-DATA-END -->',career_text())]
expected={}
for rel,start,end,rendered in outputs:
    path=ROOT/rel; text=path.read_text()
    if text.count(start)!=1 or text.count(end)!=1: raise SystemExit(f'Expected unique career markers in {rel}')
    a=text.index(start)+len(start); b=text.index(end,a)
    expected[rel]=text[:a]+'\n'+rendered+'\n'+text[b:]
expected['public/career.json']=json.dumps({'roles':roles},ensure_ascii=False,indent=2)+'\n'
if '--check' in sys.argv:
    stale=[rel for rel,content in expected.items() if (ROOT/rel).read_text()!=content]
    if stale: raise SystemExit('Generated career sources are stale: '+', '.join(stale))
    print('Generated career sources are current')
else:
    for rel,content in expected.items(): (ROOT/rel).write_text(content)
    print('Generated website timeline, llms.txt career data, and career.json')
