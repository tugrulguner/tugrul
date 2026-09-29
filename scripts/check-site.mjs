import { readFile, access } from 'node:fs/promises';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const required = [
  '<title>Tugrul Guner',
  'rel="canonical" href="https://tugrul.modepot.io/"',
  'type="application/ld+json"',
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
  'Measured leadership results',
  'I led one pod to 2.5× faster delivery and helped the team launch three products',
  'Based on the first pod’s delivery improvement, CDAI expanded my scope to a second, separate pod.',
  '2.5×</dt><dd>delivery velocity in one pod',
  '3 products</dt><dd>launched by the team',
  '4×</dt><dd>menu-item attachment rate',
  '>CDAI<',
  'lead two cross-functional pods and seven projects',
  'manage four direct reports',
  'two separate pods of five and seven',
  'Oversee seven projects',
  'Expanded my scope to a second, separate pod after leading the first to a 2.5× increase in delivery velocity.',
  'improved menu-item attachment rate by 4×',
  'first AI infrastructure',
  'From models and agents to the infrastructure that makes them reliable.',
  'I design agent workflows, reusable skills, execution and evaluation harnesses, and multi-agent systems',
  'Hermes Agent, Deep Agents, Pydantic AI, LangGraph',
  'Superpowers, Agent Skills, MCP, FastMCP',
  'I began coding and working with machine learning during my master’s degree in 2012.',
  'computer vision with microscope images during my first postdoc',
  'image reconstruction during my second',
  'the backend, deployment, infrastructure, and operating practices that keep AI reliable at scale',
  'My ambition as a manager',
  'Build high-performing teams where talented people take ownership',
  'University of Ottawa · Deep learning for quantum optics',
  'Institut national de la recherche scientifique (INRS)',
  'Legacy Is Overrated. I Want to Be Alive for What Comes Next.',
  'Nothing Is Waiting For Us. And That’s Why I Care.',
  'href="https://tugrulguner.beehiiv.com/subscribe"',
  'Subscribe to Passionately Curious',
  'Read all seven Medium essays',
  '/tugrul-guner-resume.pdf',
  'https://scholar.google.com.tr/citations?user=RznlT4AAAAAJ&hl=en',
  'https://tugrulguner.beehiiv.com/',
];
for (const token of required) {
  if (!html.includes(token)) throw new Error(`Missing required site content: ${token}`);
}
for (const path of ['../public/styles.css', '../public/favicon.svg', '../public/robots.txt', '../public/sitemap.xml', '../public/llms.txt', '../public/tugrul-guner.jpg', '../public/social-card.png', '../public/tugrul-guner-resume.pdf']) {
  await access(new URL(path, import.meta.url));
}
console.log(`Site checks passed (${required.length} content assertions, 8 required assets).`);
