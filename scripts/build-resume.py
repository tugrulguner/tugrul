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
ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/'public/tugrul-guner-resume.pdf'
roles=json.loads((ROOT/'career-data.json').read_text())['roles']
INK=colors.HexColor('#171714'); MUTED=colors.HexColor('#5f5d57'); ACCENT=colors.HexColor('#a9462b'); LINE=colors.HexColor('#d8d1c4')
styles=getSampleStyleSheet()
def style(name,base,**kw): return ParagraphStyle(name,parent=styles[base],**kw)
name_style=style('Name','Title',fontName='Helvetica-Bold',fontSize=23,leading=25,textColor=INK,spaceAfter=2,alignment=TA_LEFT)
role_style=style('Role','Normal',fontName='Helvetica',fontSize=9.5,leading=12,textColor=ACCENT,spaceAfter=4)
contact_style=style('Contact','Normal',fontName='Helvetica',fontSize=7.8,leading=10,textColor=MUTED,spaceAfter=7)
section_style=style('Section','Heading2',fontName='Helvetica-Bold',fontSize=9,leading=10,textColor=ACCENT,spaceBefore=6,spaceAfter=3,borderColor=LINE,borderWidth=0,borderPadding=0)
summary_style=style('Summary','Normal',fontName='Helvetica',fontSize=8.3,leading=10.5,textColor=INK,spaceAfter=2)
job_style=style('Job','Heading3',fontName='Helvetica-Bold',fontSize=9.5,leading=11,textColor=INK,spaceBefore=3,spaceAfter=1)
meta_style=style('Meta','Normal',fontName='Helvetica-Oblique',fontSize=7.5,leading=9,textColor=MUTED,spaceAfter=2)
bullet_style=style('Bullet','Normal',fontName='Helvetica',fontSize=7.75,leading=9.6,textColor=INK,leftIndent=10,firstLineIndent=-7,bulletIndent=0,spaceAfter=1.2)
skill_style=style('Skill','Normal',fontName='Helvetica',fontSize=7.8,leading=9.8,textColor=INK,spaceAfter=1)
def p(t,s=summary_style): return Paragraph(t,s)
def safe(t): return html.escape(t,quote=False)
def bullet(t): return Paragraph('• '+safe(t),bullet_style)
def job(r):
    return KeepTogether([Paragraph(safe(r['title'])+' | '+safe(r['company']),job_style),Paragraph(safe(r['resume_dates']),meta_style),*[bullet(x) for x in r['resume_bullets']]])
def draw_page(canvas,doc):
    canvas.saveState();canvas.setStrokeColor(LINE);canvas.setLineWidth(.5);canvas.line(.65*inch,.53*inch,7.85*inch,.53*inch);canvas.setFont('Helvetica',7);canvas.setFillColor(MUTED);canvas.drawString(.65*inch,.35*inch,'Tugrul Guner');canvas.drawRightString(7.85*inch,.35*inch,f'Page {doc.page}');canvas.restoreState()
frame=Frame(.65*inch,.62*inch,7.2*inch,9.75*inch,leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)
doc=BaseDocTemplate(str(OUTPUT),pagesize=LETTER,leftMargin=.65*inch,rightMargin=.65*inch,topMargin=.62*inch,bottomMargin=.62*inch,title='Tugrul Guner Resume',author='Tugrul Guner')
doc.addPageTemplates(PageTemplate(id='resume',frames=[frame],onPage=draw_page))
story=[p('TUGRUL GUNER',name_style),p('AI Engineering Leader | Portfolio Strategy | Hands-on Architecture',role_style),p('Toronto, ON, Canada &nbsp; | &nbsp; tugrulgunr@gmail.com &nbsp; | &nbsp; (514) 585-3990 &nbsp; | &nbsp; linkedin.com/in/tugrulguner',contact_style),p('PROFILE',section_style),p('AI engineering leader and hands-on architect who builds high-performing teams and scalable, robust backend, AI, and agentic systems. Lead two cross-functional pods across a portfolio of more than six products, combining product direction and stakeholder leadership with architecture and production delivery. Operate well under pressure and make difficult tradeoffs without lowering engineering standards.'),p('EXPERIENCE',section_style)]
for r in roles: story.extend([job(r),Spacer(1,3)])
story += [p('TECHNICAL RANGE',section_style),p('<b>Languages:</b> Python, SQL, Bash, Git &nbsp; | &nbsp; <b>ML:</b> PyTorch, TensorFlow, Hugging Face, DSPy, vLLM',skill_style),p('<b>Agents:</b> Hermes Agent, Superpowers, Deep Agents, Pydantic AI, LangGraph, MCP/FastMCP &nbsp; | &nbsp; <b>MLOps:</b> KServe, MLflow, Ray Serve, LitServe',skill_style),p('<b>Platforms:</b> AWS, Azure, GCP, Docker, Kubernetes, Databricks, GitHub Actions &nbsp; | &nbsp; <b>Systems:</b> FastAPI, Django, PostgreSQL, Qdrant, MongoDB, Redis, RabbitMQ',skill_style),p('EDUCATION &amp; RESEARCH',section_style),p('<b>Postdoctoral Fellow</b>, University of Ottawa, 2021–2022 — deep learning for quantum optics and beam shaping',skill_style),p('<b>Postdoctoral Fellow</b>, Institut national de la recherche scientifique (INRS), 2018–2021 — ultrafast transmission electron microscopy and measurement algorithms',skill_style),p('<b>MBA</b>, Quantic School of Business and Technology, 2025 &nbsp; | &nbsp; <b>Ph.D., Materials Science and Engineering</b>, Izmir Institute of Technology, 2018',skill_style),p('30 journal publications, one patent, 1,023 Google Scholar citations, h-index 19, i10-index 21 (September 2026).',skill_style),p('OPEN SOURCE &amp; WRITING',section_style),p('Created <b>ModePot</b>, an open-source family focused on simpler APIs, modern runtimes, performance, and bounded agent-owned decisions. Contribute to <b>Hermes Agent</b> and <b>Superpowers</b>. Write <b>Passionately Curious</b> and publish essays on Medium.',skill_style)]
doc.build(story)
print(OUTPUT)
