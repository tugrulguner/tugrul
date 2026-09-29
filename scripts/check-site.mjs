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
  'id="story"',
  'id="work"',
  'id="career"',
  'id="research"',
  'id="writing"',
  'class="leadership-spotlight"',
  'Results that expanded my scope',
  'I led one pod to a 2.5× increase in delivery velocity. That success led to responsibility for a second, separate pod.',
  '>CDAI<',
  'lead two cross-functional pods and seven projects',
  'manage four direct reports',
  'two separate pods of five and seven',
  'Oversee seven projects',
  'Expanded my scope to a second, separate pod after leading the first to a 2.5× increase in delivery velocity.',
  'improved menu-item attachment rate by 4×',
  'first AI infrastructure',
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
