import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(root, 'public/science-issues.json');
const htmlPath = path.join(root, 'public/index.html');
const check = process.argv.includes('--check');
const esc = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const data = JSON.parse(await readFile(dataPath, 'utf8'));
if (!Array.isArray(data.issues) || data.issues.length !== 3) throw new Error('Expected exactly three published science issues');
const seen = new Set();
for (const issue of data.issues) {
  const u = new URL(issue.url);
  if (u.origin !== 'https://tugrulguner.beehiiv.com' || !/^\/p\/[a-z0-9-]+$/.test(u.pathname) || u.search || u.hash) throw new Error(`Invalid canonical issue URL: ${issue.url}`);
  if (!/^[a-z0-9-]+$/.test(issue.content) || seen.has(issue.content)) throw new Error(`Invalid or duplicate content key: ${issue.content}`);
  seen.add(issue.content);
  if (!Number.isFinite(Date.parse(issue.publishedAt)) || !/^\d{4}-\d\d-\d\dT/.test(issue.publishedAt)) throw new Error(`Invalid published date: ${issue.publishedAt}`);
  if (!/^\/newsletter\/[a-z0-9-]+\.webp$/.test(issue.cover) || !existsSync(path.join(root, 'public', issue.cover.slice(1)))) throw new Error(`Missing or invalid local cover: ${issue.cover}`);
  if (!Number.isInteger(issue.width) || !Number.isInteger(issue.height) || issue.width <= 0 || issue.height <= 0) throw new Error(`Invalid cover dimensions: ${issue.content}`);
}
const issues = [...data.issues].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
const articleLink = (issue, extra = '') => `<a class="ph-no-autocapture" href="${esc(issue.url)}" data-posthog-event="newsletter_article_clicked" data-posthog-content="${esc(issue.content)}" data-posthog-surface="writing"${extra}>`;
const [lead, ...recent] = issues;
const section = `<section class="science-newsletter" id="science-newsletter" aria-labelledby="science-newsletter-title">
<p class="science-heading-kicker">Science newsletter</p>
<div class="science-title-row"><h3 class="science-heading" id="science-newsletter-title">Passionately Curious</h3><a class="science-subscribe ph-no-autocapture" href="https://tugrulguner.beehiiv.com/subscribe" data-posthog-event="newsletter_subscribe_clicked" data-posthog-surface="writing">Subscribe to Passionately Curious <span aria-hidden="true">↗</span></a></div>
<div class="science-story"><p>Years in research showed me how much discovery gets buried under language written for a narrow field. I started Passionately Curious to bring those ideas back into view for anyone who cares about how the world works, whatever their background.</p><p>Each feature follows one question through the mechanism and keeps the uncertainty visible.</p></div>
<div class="science-article-layout">
<article class="science-featured" data-science-issue="${esc(lead.content)}"><a class="science-cover-link ph-no-autocapture" href="${esc(lead.url)}" data-posthog-event="newsletter_article_clicked" data-posthog-content="${esc(lead.content)}" data-posthog-surface="writing" aria-label="Read ${esc(lead.title)}"><img class="science-cover" src="${esc(lead.cover)}" alt="" width="${lead.width}" height="${lead.height}" loading="lazy"></a><div class="science-featured-copy"><time datetime="${esc(lead.publishedAt)}">${new Date(lead.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</time><h4>${articleLink(lead)}${esc(lead.title)}</a></h4><p>${esc(lead.excerpt)}</p><a class="science-read-link ph-no-autocapture" href="${esc(lead.url)}" data-posthog-event="newsletter_article_clicked" data-posthog-content="${esc(lead.content)}" data-posthog-surface="writing">Read the feature <span aria-hidden="true">↗</span></a></div></article>
<ol class="science-recent">${recent.map((issue) => `<li data-science-issue="${esc(issue.content)}"><a class="science-cover-link ph-no-autocapture" href="${esc(issue.url)}" data-posthog-event="newsletter_article_clicked" data-posthog-content="${esc(issue.content)}" data-posthog-surface="writing" aria-label="Read ${esc(issue.title)}"><img class="science-cover" src="${esc(issue.cover)}" alt="" width="${issue.width}" height="${issue.height}" loading="lazy"></a><div><time datetime="${esc(issue.publishedAt)}">${new Date(issue.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</time><h4>${articleLink(issue)}${esc(issue.title)}</a></h4><p>${esc(issue.excerpt)}</p></div></li>`).join('\n')}</ol>
</div>
<div class="science-actions"><a class="science-browse ph-no-autocapture" href="https://tugrulguner.beehiiv.com/" data-posthog-event="newsletter_clicked" data-posthog-content="homepage" data-posthog-surface="writing">Browse all issues <span aria-hidden="true">↗</span></a></div>
</section>`;
const html = await readFile(htmlPath, 'utf8');
const start = '<!-- SCIENCE-ISSUES-START -->';
const end = '<!-- SCIENCE-ISSUES-END -->';
const a = html.indexOf(start), b = html.indexOf(end);
if (a < 0 || b < a || html.indexOf(start, a + 1) >= 0 || html.indexOf(end, b + 1) >= 0) throw new Error('Expected one bounded science issues block in index.html');
const expected = `${html.slice(0, a + start.length)}\n${section}\n${html.slice(b)}`;
if (check) {
  if (html !== expected) throw new Error('Science issue markup has drifted; run node scripts/build-science-issues.mjs');
  console.log('Science issues markup is current (3 verified records).');
} else {
  await writeFile(htmlPath, expected);
  console.log('Rendered 3 science issues into public/index.html.');
}
