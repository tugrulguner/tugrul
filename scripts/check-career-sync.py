#!/usr/bin/env python3
"""Guard role/date parity and shared career evidence across profile sources."""
import ast
import re
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
html = (ROOT / "public/index.html").read_text()
llms = (ROOT / "public/llms.txt").read_text()
source = (ROOT / "scripts/build-resume.py").read_text()


def normalize(text):
    text = unescape(re.sub(r"<[^>]+>", " ", text))
    text = text.replace("×", "x").replace("$2M", "$2 million")
    text = re.sub(r"[–—-]", " ", text)
    return " ".join(text.lower().split())


def match(pattern, text):
    result = re.search(pattern, text)
    assert result is not None, f"Missing expected career markup: {pattern}"
    return result.group(1)


articles = re.findall(r'<article class="timeline-item">(.*?)</article>', html, re.S)
roles = []
for article in articles:
    company = match(r'<p class="organization">(.*?)</p>', article)
    headings = re.findall(r"<h3>(.*?)</h3>", article)
    for title in headings:
        if len(headings) == 1:
            dates = match(r'<div class="timeline-meta"><span>(.*?)</span>', article)
        else:
            dates = match(r"<h3>" + re.escape(title) + r"</h3><p>(.*?)</p>", article)
        roles.append((normalize(title), normalize(company), normalize(dates)))

resume_roles = []
for node in ast.walk(ast.parse(source)):
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "job":
        title, company, location_dates = [ast.literal_eval(arg) for arg in node.args[:3]]
        dates = location_dates.split(" | ", 1)[1]
        resume_roles.append((normalize(title), normalize(company), normalize(dates)))

assert roles == resume_roles, f"Website/resume role or date mismatch: {roles!r} != {resume_roles!r}"
for title, company, dates in roles:
    assert title in normalize(llms), f"Missing machine-readable role: {title}"
    assert company in normalize(llms), f"Missing machine-readable employer: {company}"
    assert dates in normalize(llms), f"Missing machine-readable dates: {dates}"

for label, text in [("website", html), ("resume source", source), ("machine-readable profile", llms)]:
    normalized = normalize(text)
    for token in ["five and seven", "more than six products", "2.5x", "three products", "4x", "$2 million", "60%", "10x"]:
        assert token in normalized, f"Missing career evidence in {label}: {token}"
    assert "four people" not in normalized, f"Stale direct-report emphasis in {label}"

print(f"Career synchronization checks passed ({len(roles)} roles; matching dates and shared outcome evidence).")
