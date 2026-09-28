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
  'id="resume"',
];
for (const token of required) {
  if (!html.includes(token)) throw new Error(`Missing required site content: ${token}`);
}
for (const path of ['../public/styles.css', '../public/favicon.svg', '../public/robots.txt', '../public/sitemap.xml', '../public/llms.txt', '../public/tugrul-guner.jpg', '../public/social-card.png']) {
  await access(new URL(path, import.meta.url));
}
console.log(`Site checks passed (${required.length} content assertions, 7 required assets).`);
