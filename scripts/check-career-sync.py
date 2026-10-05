#!/usr/bin/env python3
"""Validate canonical career facts across all generated public outputs."""
import json
import re
from html import unescape
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
data=json.loads((ROOT/'career-data.json').read_text())['roles']
html=(ROOT/'public/index.html').read_text()
llms=(ROOT/'public/llms.txt').read_text()
public=json.loads((ROOT/'public/career.json').read_text())['roles']
resume=(ROOT/'public/tugrul-guner-resume.pdf').read_bytes()
assert data==public, 'public career JSON differs from canonical data'
visible=unescape(re.sub(r'<[^>]+>',' ',html))
for role in data:
    for field in ('title','company','dates','location'):
        assert role[field] in visible, f"Website missing {field}: {role[field]}"
        assert role[field] in llms, f"llms.txt missing {field}: {role[field]}"
    for bullet in role['website_bullets']:
        assert unescape(bullet) in visible, f"Website missing career evidence: {bullet}"
        assert bullet in llms, f"llms.txt missing career evidence: {bullet}"
assert resume.startswith(b'%PDF'), 'Resume PDF is missing or invalid'
print(f'Career synchronization checks passed ({len(data)} roles; canonical website/llms/json data).')
