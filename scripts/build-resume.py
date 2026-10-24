#!/usr/bin/env python3
"""Build the public Tugrul Guner resume PDF from canonical career data."""
import html
import json
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, KeepTogether
from reportlab.pdfgen.canvas import Canvas
ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/'public/tugrul-guner-resume.pdf'
roles=json.loads((ROOT/'career-data.json').read_text())['roles']
INK=colors.HexColor('#171714'); MUTED=colors.HexColor('#5f5d57'); ACCENT=colors.HexColor('#a9462b'); LINE=colors.HexColor('#d8d1c4')
styles=getSampleStyleSheet()
def style(name,base,**kw): return ParagraphStyle(name,parent=styles[base],**kw)
name_style=style('Name','Title',fontName='Helvetica-Bold',fontSize=23,leading=25,textColor=INK,spaceAfter=2,alignment=TA_LEFT)
role_style=style('Role','Normal',fontName='Helvetica',fontSize=9.5,leading=12,textColor=ACCENT,spaceAfter=4)
contact_style=style('Contact','Normal',fontName='Helvetica',fontSize=7.8,leading=10,textColor=MUTED,spaceAfter=7)
section_style=style('Section','Heading2',fontName='Helvetica-Bold',fontSize=9,leading=10,textColor=ACCENT,spaceBefore=5,spaceAfter=2,borderColor=LINE,borderWidth=0,borderPadding=0)
summary_style=style('Summary','Normal',fontName='Helvetica',fontSize=8.3,leading=10.5,textColor=INK,spaceAfter=2)
job_style=style('Job','Heading3',fontName='Helvetica-Bold',fontSize=9.5,leading=11,textColor=INK,spaceBefore=2,spaceAfter=1)
meta_style=style('Meta','Normal',fontName='Helvetica-Oblique',fontSize=7.5,leading=9,textColor=MUTED,spaceAfter=2)
bullet_style=style('Bullet','Normal',fontName='Helvetica',fontSize=8.25,leading=10,textColor=INK,leftIndent=10,firstLineIndent=-7,bulletIndent=0,spaceAfter=1.2)
skill_style=style('Skill','Normal',fontName='Helvetica',fontSize=8.25,leading=10,textColor=INK,spaceAfter=1)
def p(t,s=summary_style): return Paragraph(t,s)
def safe(t): return html.escape(t,quote=False)
def bullet(t): return Paragraph('• '+safe(t),bullet_style)
def job(r):
    return KeepTogether([Paragraph(safe(r['title'])+' | '+safe(r['company']),job_style),Paragraph(safe(r['location'] + ' | ' + r['dates']),meta_style),*[bullet(x) for x in r['resume_bullets']]])
def draw_page(canvas,doc):
    canvas.saveState();canvas.setStrokeColor(LINE);canvas.setLineWidth(.5);canvas.line(.65*inch,.53*inch,7.85*inch,.53*inch);canvas.setFont('Helvetica',7);canvas.setFillColor(MUTED);canvas.drawString(.65*inch,.35*inch,'Tugrul Guner');canvas.drawRightString(7.85*inch,.35*inch,f'Page {doc.page}');canvas.restoreState()
frame=Frame(.65*inch,.62*inch,7.2*inch,9.75*inch,leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)
doc=BaseDocTemplate(str(OUTPUT),pagesize=LETTER,leftMargin=.65*inch,rightMargin=.65*inch,topMargin=.62*inch,bottomMargin=.62*inch,title='Tugrul Guner Resume',author='Tugrul Guner')
doc.addPageTemplates(PageTemplate(id='resume',frames=[frame],onPage=draw_page))
story=[p('TUGRUL GUNER',name_style),p('AI Engineering Leader | Portfolio Strategy | Hands-on Architecture',role_style),p('Toronto, ON, Canada | <link href="mailto:tugrul@modepot.io">tugrul@modepot.io</link> | (514) 585-3990 | <link href="https://www.linkedin.com/in/tugrulguner/">linkedin.com/in/tugrulguner</link> | <link href="https://tugrul.modepot.io/">tugrul.modepot.io</link>',contact_style),p('PROFILE',section_style),p('AI engineering leader and hands-on architect leading two cross-functional pods across more than six products. Build high-performing teams and scalable backend, AI, and agentic systems, combining product direction, stakeholder leadership, and production delivery. Make difficult decisions under pressure without lowering engineering standards.'),p('EXPERIENCE',section_style)]
for r in roles: story.extend([job(r),Spacer(1,2)])
story += [p('TECHNICAL RANGE',section_style),p('<b>Harnesses:</b> Hermes Agent, Claude Code, Cursor Agent, deepagents; CLI execution, model routing, multi-agent coordination, subagents',skill_style),p('<b>Agent development:</b> Pydantic AI, LangGraph, DSPy | <b>Skills:</b> Superpowers, custom skills | <b>Protocol:</b> MCP | <b>MCP framework:</b> FastMCP',skill_style),p('<b>Inference:</b> PyTorch, llama.cpp, vLLM, ONNX; low-level LLM optimization | <b>MLOps:</b> KServe, MLflow, Ray Serve',skill_style),p('<b>Backend/data:</b> FastAPI, Django, PostgreSQL, DynamoDB, MongoDB | <b>Platforms:</b> Python, SQL, AWS, Azure, GCP, Docker, Kubernetes, GitHub Actions',skill_style),p('EDUCATION &amp; RESEARCH',section_style),p('<b>Postdoctoral Fellow</b>, University of Ottawa, 2021–2022 — deep learning for quantum optics and beam shaping',skill_style),p('<b>Postdoctoral Fellow</b>, Institut national de la recherche scientifique (INRS), 2018–2021 — ultrafast transmission electron microscopy and measurement algorithms',skill_style),p('<b>MBA</b>, Quantic School of Business and Technology, 2025 | <b>Ph.D., Materials Science and Engineering</b>, Izmir Institute of Technology, 2018',skill_style),p('30 journal publications, one patent, 1,023 Google Scholar citations, h-index 19, i10-index 21 (September 2026).',skill_style),p('OPEN SOURCE &amp; WRITING',section_style),p('Created <b>ModePot</b> (<link href="https://modepot.io/">modepot.io</link>): Dexpot, Intpot, Summonpot, LifePot, RefPot, UtilityPot. Modern open-source frameworks, tools, engines, and games. Landed contributions to <link href="https://github.com/NousResearch/hermes-agent/commit/44665783a936d173aba639ecd74483e0a6a016ce"><b>Hermes Agent</b></link> and <link href="https://github.com/obra/superpowers/commit/0a4d60db4faf3628abc3e6be4fc3e1a0697c69de"><b>Superpowers</b></link> (dev branch); write <b>Passionately Curious</b> and publish <link href="https://x.com/Tugrul_Guner" color="#934126"><u>X Articles</u></link> and Medium essays.',skill_style)]
def invariant_canvas(*args, **kwargs):
    kwargs["invariant"] = 1
    return Canvas(*args, **kwargs)
doc.build(story, canvasmaker=invariant_canvas)
print(OUTPUT)
