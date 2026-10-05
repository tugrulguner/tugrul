#!/usr/bin/env python3
"""Validate the generated one-page resume PDF against canonical data."""
import json
from pathlib import Path
import pymupdf
ROOT=Path(__file__).resolve().parents[1]
pdf=pymupdf.open(ROOT/'public/tugrul-guner-resume.pdf')
assert len(pdf)==1, f'Expected one resume page, got {len(pdf)}'
text=pdf[0].get_text()
roles=json.loads((ROOT/'career-data.json').read_text())['roles']
for role in roles:
    assert role['title'] in text, f"Missing role: {role['title']}"
    assert role['company'] in text, f"Missing employer: {role['company']}"
    assert role['resume_dates'].split(' | ')[1] in text, f"Missing dates: {role['resume_dates']}"
for term in ['2.5×','three products','4×','60%','10×']:
    assert term in text, f'Missing outcome: {term}'
assert 'more than $2M' in text
assert 'four direct reports' not in text.lower()
print(f'Resume validation passed ({len(pdf)} page; {len(roles)} roles; expected metrics present).')
