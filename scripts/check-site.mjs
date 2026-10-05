import { readFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const styles = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
const headerStyle = styles.match(/\.site-header\s*\{([^}]+)\}/)?.[1];
if (!headerStyle?.includes('grid-template-columns: auto minmax(0, 1fr) auto auto') || !headerStyle.includes('gap: 1rem')) {
  throw new Error('The four header elements need four separated desktop grid columns.');
}
const required = [
  '<title>Tugrul Guner',
  'rel="canonical" href="https://tugrul.modepot.io/"',
  'type="application/ld+json"',
  'twitter:site" content="@Tugrul_Guner',
  'twitter:creator" content="@Tugrul_Guner',
  "posthog.init('phc_",
  "api_host: 'https://us.i.posthog.com'",
  "defaults: '2026-05-30'",
  "person_profiles: 'identified_only'",
  'capture_pageview: true',
  'capture_pageleave: true',
  "dom_event_allowlist: ['click']",
  "element_allowlist: ['a', 'button']",
  'disable_session_recording: true',
  'data-posthog-event="modepot_project_clicked" data-posthog-project="dexpot" data-posthog-surface="personal_profile"',
  'data-posthog-event="modepot_project_clicked" data-posthog-project="intpot" data-posthog-surface="personal_profile"',
  'data-posthog-event="modepot_project_clicked" data-posthog-project="summonpot" data-posthog-surface="personal_profile"',
  'data-posthog-event="modepot_project_clicked" data-posthog-project="lifepot" data-posthog-surface="personal_profile"',
  "transport: 'sendBeacon'",
  'send_instantly: true',
  'data-posthog-event="resume_downloaded" data-posthog-surface="header"',
  'href="https://modepot.io/" data-posthog-event="modepot_clicked" data-posthog-surface="header">ModePot',
  'data-posthog-event="resume_downloaded" data-posthog-surface="hero"',
  'class="hero-social" aria-label="Profiles and newsletter"',
  'href="https://x.com/Tugrul_Guner" rel="me" data-posthog-event="social_profile_clicked" data-posthog-network="x" data-posthog-surface="hero"',
  'href="https://www.linkedin.com/in/tugrulguner/" rel="me" data-posthog-event="social_profile_clicked" data-posthog-network="linkedin" data-posthog-surface="hero"',
  'href="https://github.com/tugrulguner" rel="me" data-posthog-event="github_profile_clicked" data-posthog-surface="hero"',
  'href="https://tugrulguner.beehiiv.com/" data-posthog-event="newsletter_clicked" data-posthog-content="homepage" data-posthog-surface="hero">Newsletter</a>',
  'class="hero-social-link ph-no-autocapture"',
  'data-posthog-event="resume_downloaded" data-posthog-surface="career"',
  'data-posthog-event="social_profile_clicked" data-posthog-network="linkedin" data-posthog-surface="career"',
  'data-posthog-event="modepot_clicked" data-posthog-surface="about"',
  'data-posthog-event="newsletter_subscribe_clicked" data-posthog-surface="writing"',
  'data-posthog-event="newsletter_article_clicked"',
  'data-posthog-event="medium_article_clicked"',
  'data-posthog-event="email_clicked" data-posthog-surface="contact"',
  'data-posthog-event="github_profile_clicked" data-posthog-surface="footer"',
  'data-posthog-event="scholar_clicked"',
  'data-posthog-event="newsletter_clicked"',
  'data-posthog-event="medium_clicked"',
  'data-posthog-event="social_profile_clicked"',
  'https://dexpot.modepot.io/',
  'https://intpot.modepot.io/',
  'https://summonpot.modepot.io/',
  'https://lifepot.modepot.io/',
  'https://github.com/NousResearch/hermes-agent/pulls?q=is%3Apr+author%3Atugrulguner',
  'https://github.com/obra/superpowers/pulls?q=is%3Apr+author%3Atugrulguner',
  'https://github.com/NousResearch/hermes-agent/commit/44665783a936d173aba639ecd74483e0a6a016ce',
  'id="story"',
  'id="work"',
  'id="career"',
  'id="research"',
  'id="writing"',
  'class="leadership-spotlight"',
  'Tugrul Guner · AI Engineering Manager at CDAI · Toronto',
  'I lead AI engineering and <em>architect the systems behind it.</em>',
  'build high-performing teams, operate well under pressure, and make difficult decisions without lowering engineering standards',
  'scalable, robust backend, AI, and agentic systems designed to adapt',
  'ModePot creator',
  'Contributor to Hermes Agent and Superpowers',
  'Earlier physics and materials-science research',
  '30 journal publications · 1 patent · 1,000+ citations',
  'That work shaped the analytical, evidence-led mindset I bring to innovation and uncertainty.',
  'Measurable leadership results',
  'In under six months, I led one pod to 2.5× faster delivery and helped the team launch three products',
  'The first pod’s delivery improvement led CDAI to expand my scope to a second, separate pod.',
  '2.5×</dt><dd>delivery velocity in one pod',
  '3 products</dt><dd>launched by the team',
  '4×</dt><dd>menu-item attachment rate',
  '>CDAI<',
  'lead two cross-functional pods across more than six products',
  'Lead two separate cross-functional pods of five and seven people across a portfolio of more than six products, with responsibility for technical direction, cross-team alignment, and delivery.',
  'contributing to more than $2 million in new revenue',
  'In under six months, led one pod to a 2.5× increase in delivery velocity',
  'manage a portfolio of more than six products across both',
  '&lt;6 months</dt><dd>delivery gain and launches',
  'improved menu-item attachment rate by 4×',
  'first AI infrastructure',
  'Quotograph.io',
  '<h3>Senior Tech Lead</h3><p>Jul 2025 – Present</p>',
  '<h3>Chief Technology Officer</h3><p>Jan 2024 – Jul 2025</p>',
  'Waterloo, Ontario, Canada · Remote',
  'From models and agents to the infrastructure that makes them reliable.',
  'My experience spans agent orchestration, reusable skills, evaluation, low-level LLM optimization',
  'Hermes Agent: a high-level autonomous-agent harness.',
  'deepagents: a programmable agent-harness library',
  'Pydantic AI for typed agents; LangGraph for stateful workflows and durable execution; DSPy for composing and optimizing LLM programs.',
  'Superpowers: a collection of reusable software-development skills.',
  'MCP: the Model Context Protocol.',
  'FastMCP: the Python framework for implementing MCP servers and clients.',
  'PyTorch, TensorFlow, Hugging Face, llama.cpp, vLLM',
  'LLM inference optimization, quantization, and ONNX optimization.',
  'FastAPI, Django',
  'PostgreSQL, DynamoDB, MongoDB, Qdrant, Redis, RabbitMQ',
  'I began coding and working with machine learning during my master’s degree in 2012.',
  'computer vision with microscope images during my first postdoc',
  'image reconstruction during my second',
  'the backend, deployment, infrastructure, and operating practices that keep AI reliable at scale',
  'My ambition as a manager',
  'Build high-performing teams where talented people take ownership',
  'I operate well under pressure, especially when timelines are tight',
  'I bring structure to ambiguity, make the necessary tradeoffs',
  'University of Ottawa · Deep learning for quantum optics',
  'Institut national de la recherche scientifique (INRS)',
  'Legacy Is Overrated. I Want to Be Alive for What Comes Next.',
  'Nothing Is Waiting For Us. And That’s Why I Care.',
  'href="https://tugrulguner.beehiiv.com/subscribe"',
  'Subscribe to Passionately Curious',
  'Read all seven Medium essays',
  'data-posthog-network="x" data-posthog-surface="hero">X</a>',
  'data-posthog-network="x" data-posthog-surface="contact">X <span aria-hidden="true">↗</span></a>',
  'data-posthog-network="x" data-posthog-surface="footer">X</a>',
  'href="https://www.linkedin.com/in/tugrulguner/" rel="me"',
  '/tugrul-guner-resume.pdf',
  'https://scholar.google.com.tr/citations?user=RznlT4AAAAAJ&hl=en',
  'https://tugrulguner.beehiiv.com/',
];
for (const token of required) {
  if (!html.includes(token)) throw new Error(`Missing required site content: ${token}`);
}
const technicalRange = html.match(/<section class="skills"[\s\S]*?<\/section>/)?.[0];
const groupNames = [...technicalRange.matchAll(/<dt>([^<]+)<\/dt>/g)].map(match => match[1]);
const expectedGroups = [
  'Agent harnesses', 'Agent &amp; LLM application development',
  'Skills, protocols &amp; tool integration', 'Models &amp; low-level inference',
  'Model serving &amp; ML operations', 'Backend engineering',
  'Databases &amp; messaging', 'Languages, cloud &amp; delivery',
];
if (JSON.stringify(groupNames) !== JSON.stringify(expectedGroups)) {
  throw new Error('Technical range must retain the eight distinct capability layers.');
}
const llms = await readFile(new URL('../public/llms.txt', import.meta.url), 'utf8');
for (const token of ['Hermes Agent is a high-level autonomous-agent harness', 'deepagents is a programmable agent-harness library', 'Superpowers is a collection', 'MCP is the Model Context Protocol', 'FastMCP is the Python framework', 'Django', 'DynamoDB', 'MongoDB', 'llama.cpp', 'low-level LLM optimization']) {
  if (!llms.includes(token)) throw new Error(`Machine-readable technical range is missing: ${token}`);
}
for (const stale of ['Deep Agents', 'Agent Skills', 'MCP/FastMCP']) {
  if (technicalRange.includes(stale) || llms.includes(stale)) {
    throw new Error(`Stale or conflated technology wording: ${stale}`);
  }
}
const resumeSource = await readFile(new URL('../scripts/build-resume.py', import.meta.url), 'utf8');
for (const token of ['Hermes Agent (high-level)', 'deepagents (programmable library)', '<b>Skills:</b> Superpowers', '<b>Protocol:</b> MCP', '<b>MCP framework:</b> FastMCP', 'Django', 'DynamoDB', 'MongoDB', 'llama.cpp', 'low-level LLM optimization']) {
  if (!resumeSource.includes(token)) throw new Error(`Resume source technical range missing: ${token}`);
}
for (const stale of ['Deep Agents', 'Agent Skills', 'MCP/FastMCP']) {
  if (resumeSource.includes(stale)) throw new Error(`Stale resume technology wording: ${stale}`);
}
console.log('Technical range checks passed (8 capability layers; HTML, llms.txt, resume source).');
const description = html.match(/<meta name="description" content="([^"]+)">/)?.[1];
if (!description || description.length > 160) {
  throw new Error(`Meta description must be present and at most 160 characters; got ${description?.length ?? 0}`);
}
const title = html.match(/<title>([^<]+)<\/title>/)?.[1].replaceAll('&amp;', '&');
if (!title || title.length > 60) {
  throw new Error(`Page title must be present and at most 60 characters; got ${title?.length ?? 0}`);
}
for (const path of ['../public/styles.css', '../public/favicon.svg', '../public/robots.txt', '../public/sitemap.xml', '../public/llms.txt', '../public/tugrul-guner.jpg', '../public/social-card.png', '../public/tugrul-guner-resume.pdf']) {
  await access(new URL(path, import.meta.url));
}
execFileSync('python3', [fileURLToPath(new URL('./check-career-sync.py', import.meta.url))], { stdio: 'inherit' });
console.log(`Site checks passed (${required.length} content assertions, 8 required assets).`);
