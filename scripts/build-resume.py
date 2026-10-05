#!/usr/bin/env python3
"""Build the public Tugrul Guner resume PDF."""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageTemplate,
    Paragraph,
    Spacer,
    KeepTogether,
)

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "tugrul-guner-resume.pdf"

INK = colors.HexColor("#171714")
MUTED = colors.HexColor("#5f5d57")
ACCENT = colors.HexColor("#a9462b")
LINE = colors.HexColor("#d8d1c4")

font_dir = Path("/System/Library/Fonts")
regular = font_dir / "Helvetica.ttc"
if regular.exists():
    # macOS Helvetica TTC indexes are not stable across releases; built-ins are safer.
    BODY_FONT = "Helvetica"
else:
    BODY_FONT = "Helvetica"

styles = getSampleStyleSheet()
name_style = ParagraphStyle(
    "Name", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=23,
    leading=25, textColor=INK, spaceAfter=2, alignment=TA_LEFT,
)
role_style = ParagraphStyle(
    "Role", parent=styles["Normal"], fontName="Helvetica", fontSize=9.5,
    leading=12, textColor=ACCENT, spaceAfter=4,
)
contact_style = ParagraphStyle(
    "Contact", parent=styles["Normal"], fontName="Helvetica", fontSize=7.8,
    leading=10, textColor=MUTED, spaceAfter=7,
)
section_style = ParagraphStyle(
    "Section", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=9,
    leading=10, textColor=ACCENT, spaceBefore=6, spaceAfter=3,
    borderColor=LINE, borderWidth=0, borderPadding=0,
)
summary_style = ParagraphStyle(
    "Summary", parent=styles["Normal"], fontName=BODY_FONT, fontSize=8.3,
    leading=10.5, textColor=INK, spaceAfter=2,
)
job_style = ParagraphStyle(
    "Job", parent=styles["Heading3"], fontName="Helvetica-Bold", fontSize=9.5,
    leading=11, textColor=INK, spaceBefore=3, spaceAfter=1,
)
meta_style = ParagraphStyle(
    "Meta", parent=styles["Normal"], fontName="Helvetica-Oblique", fontSize=7.5,
    leading=9, textColor=MUTED, spaceAfter=2,
)
bullet_style = ParagraphStyle(
    "Bullet", parent=styles["Normal"], fontName=BODY_FONT, fontSize=7.75,
    leading=9.6, textColor=INK, leftIndent=10, firstLineIndent=-7,
    bulletIndent=0, spaceAfter=1.2,
)
skill_style = ParagraphStyle(
    "Skill", parent=styles["Normal"], fontName=BODY_FONT, fontSize=7.8,
    leading=9.8, textColor=INK, spaceAfter=1,
)
footer_style = ParagraphStyle(
    "Footer", parent=styles["Normal"], fontName="Helvetica", fontSize=7,
    textColor=MUTED,
)


def p(text, style=summary_style):
    return Paragraph(text, style)


def bullet(text):
    return Paragraph(f"• {text}", bullet_style)


def job(title, company, dates, bullets):
    return KeepTogether([
        Paragraph(f"{title} | {company}", job_style),
        Paragraph(dates, meta_style),
        *[bullet(item) for item in bullets],
    ])


def draw_page(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(0.65 * inch, 0.53 * inch, 7.85 * inch, 0.53 * inch)
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(MUTED)
    canvas.drawString(0.65 * inch, 0.35 * inch, "Tugrul Guner")
    canvas.drawRightString(7.85 * inch, 0.35 * inch, f"Page {doc.page}")
    canvas.restoreState()


frame = Frame(
    0.65 * inch, 0.62 * inch, 7.2 * inch, 9.75 * inch,
    leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
)
doc = BaseDocTemplate(
    str(OUTPUT), pagesize=LETTER,
    leftMargin=0.65 * inch, rightMargin=0.65 * inch,
    topMargin=0.62 * inch, bottomMargin=0.62 * inch,
    title="Tugrul Guner Resume", author="Tugrul Guner",
)
doc.addPageTemplates(PageTemplate(id="resume", frames=[frame], onPage=draw_page))

story = [
    p("TUGRUL GUNER", name_style),
    p("AI Engineering Leader | Portfolio Strategy | Hands-on Architecture", role_style),
    p("Toronto, ON, Canada &nbsp; | &nbsp; tugrulgunr@gmail.com &nbsp; | &nbsp; (514) 585-3990 &nbsp; | &nbsp; linkedin.com/in/tugrulguner", contact_style),

    p("PROFILE", section_style),
    p("AI engineering leader and hands-on architect who builds high-performing teams and scalable, robust backend, AI, and agentic systems. Lead two cross-functional pods across a portfolio of more than six products, combining product direction and stakeholder leadership with architecture and production delivery. Operate well under pressure and make difficult tradeoffs without lowering engineering standards."),

    p("EXPERIENCE", section_style),
    job(
        "AI Engineering Manager", "CDAI", "Toronto, ON | Jan 2026 - Present",
        [
            "Lead two separate cross-functional pods of five and seven people across a portfolio of more than six products, with responsibility for technical direction, cross-team alignment, and delivery.",
            "In under six months, led one pod to a 2.5x increase in delivery velocity and helped the team launch three products. That delivery improvement led to responsibility for the second, separate pod.",
            "Helped deliver a recommendation system that improved menu-item attachment rate by 4x.",
            "Remain hands-on: prototype ideas, make architectural changes, deliver production work, and build shared platforms that reduce redundancy and improve scalability.",
            "Build high-performing teams around ownership and engineering standards; started the AI &amp; Science channel and co-host the company-wide AI Center of Excellence meeting.",
        ],
    ),
    Spacer(1, 3),
    job(
        "Technical Manager, AI Architect", "Haptiq", "Toronto, ON | May 2025 - Jan 2026",
        [
            "Built Haptiq's AI team and first AI infrastructure from the ground up; recruited and led seven people across ML engineering, MLOps, and backend development.",
            "Led technical delivery and client conversations for the company's first AI product, helping sell AI solutions to companies and contributing to more than $2M in new revenue.",
            "Worked with clients and executives on product direction, architecture, delivery plans, risk assessments, and performance reporting.",
            "Established ownership, knowledge-sharing, reviews, documentation, release management, and sprint planning for reliable delivery.",
        ],
    ),
    Spacer(1, 3),
    job(
        "Senior Tech Lead", "Quotograph.io", "Waterloo, Ontario, Canada (Remote) | Jul 2025 - Present",
        [],
    ),
    job(
        "Chief Technology Officer", "Quotograph.io", "Waterloo, Ontario, Canada (Remote) | Jan 2024 - Jul 2025",
        [],
    ),
    Spacer(1, 3),
    job(
        "Lead MLOps Engineer", "Arteria AI", "Toronto, ON | Dec 2024 - May 2025",
        [
            "Architected scalable AI and backend systems aligned with business goals and integrated Ray with Kubernetes.",
            "Led cross-functional delivery, mentoring, cost optimization, availability, and fault-tolerance work.",
        ],
    ),
    Spacer(1, 3),
    job(
        "Senior MLOps Engineer", "Arteria AI", "Toronto, ON | Sep 2022 - Dec 2024",
        [
            "Automated backend systems for model integration and scaling, and built user-friendly APIs for rapid experimentation and deployment.",
            "Reduced Kubernetes infrastructure costs by 60% with KServe and improved model performance 10x with quantization and ONNX.",
            "Built CI/CD pipelines with GitHub Actions and Databricks to streamline the machine-learning lifecycle.",
        ],
    ),

    p("TECHNICAL RANGE", section_style),
    p("<b>Agent harnesses:</b> Hermes Agent (high-level), Claude Code, deepagents (programmable library) &nbsp; | &nbsp; <b>Agent/LLM development:</b> Pydantic AI, LangGraph, DSPy", skill_style),
    p("<b>Skills:</b> Superpowers, custom skills &nbsp; | &nbsp; <b>Protocol:</b> MCP &nbsp; | &nbsp; <b>MCP framework:</b> FastMCP", skill_style),
    p("<b>Models/inference:</b> PyTorch, TensorFlow, Hugging Face, llama.cpp, vLLM; low-level LLM optimization, quantization, ONNX", skill_style),
    p("<b>ML operations:</b> KServe, MLflow, Ray Serve, LitServe, Databricks &nbsp; | &nbsp; <b>Backend/data:</b> FastAPI, Django, PostgreSQL, DynamoDB, MongoDB, Qdrant, Redis, RabbitMQ", skill_style),
    p("<b>Languages/platforms:</b> Python, SQL, Bash, Git; AWS, Azure, GCP, Docker, Kubernetes, GitHub Actions", skill_style),

    p("EDUCATION &amp; RESEARCH", section_style),
    p("<b>Postdoctoral Fellow</b>, University of Ottawa, 2021–2022 — deep learning for quantum optics and beam shaping", skill_style),
    p("<b>Postdoctoral Fellow</b>, Institut national de la recherche scientifique (INRS), 2018–2021 — ultrafast transmission electron microscopy and measurement algorithms", skill_style),
    p("<b>MBA</b>, Quantic School of Business and Technology, 2025 &nbsp; | &nbsp; <b>Ph.D., Materials Science and Engineering</b>, Izmir Institute of Technology, 2018", skill_style),
    p("30 journal publications, one patent, 1,023 Google Scholar citations, h-index 19, i10-index 21 (September 2026).", skill_style),

    p("OPEN SOURCE &amp; WRITING", section_style),
    p("Created <b>ModePot</b>, an open-source family focused on simpler APIs, modern runtimes, performance, and bounded agent-owned decisions. Contribute to <b>Hermes Agent</b> and <b>Superpowers</b>. Write <b>Passionately Curious</b> and publish essays on Medium.", skill_style),
]

doc.build(story)
print(OUTPUT)
