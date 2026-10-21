#!/usr/bin/env python3
"""Validate the generated one-page resume PDF against canonical data."""
import json
from pathlib import Path
import pymupdf
ROOT=Path(__file__).resolve().parents[1]
pdf=pymupdf.open(ROOT/'public/tugrul-guner-resume.pdf')
assert len(pdf)==1, f'Expected one resume page, got {len(pdf)}'
text=' '.join(pdf[0].get_text().split())
roles=json.loads((ROOT/'career-data.json').read_text())['roles']
for role in roles:
    assert role['title'] in text, f"Missing role: {role['title']}"
    assert role['company'] in text, f"Missing employer: {role['company']}"
    assert role['dates'] in text, f"Missing dates: {role['dates']}"
    assert role['location'] in text, f"Missing location: {role['location']}"
for term in ['2.5×','three products','4×','60%','10×']:
    assert term in text, f'Missing outcome: {term}'
for term in ['Hermes Agent', 'Claude Code', 'Cursor Agent', 'deepagents', 'CLI execution', 'model routing', 'multi-agent coordination', 'subagents']:
    assert term in text, f'Missing agentic capability: {term}'
assert 'more than $2M' in text
for term in ['tugrul.modepot.io', 'Dexpot', 'Intpot', 'Summonpot', 'LifePot', 'RefPot', 'UtilityPot']:
    assert term in text, f'Missing profile/ModePot evidence: {term}'
uris = {link.get('uri') for link in pdf[0].get_links()}
assert 'https://tugrul.modepot.io/' in uris, 'Personal profile must be a clickable PDF link'
assert 'https://modepot.io/' in uris, 'ModePot must be a clickable PDF link'
assert 'four direct reports' not in text.lower()
print(f'Resume validation passed ({len(pdf)} page; {len(roles)} roles; expected metrics present).')
