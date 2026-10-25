import fs from 'node:fs';
import assert from 'node:assert/strict';
const seedUrl = new URL('../public/x-articles.json', import.meta.url);
const pageUrl = new URL('../public/index.html', import.meta.url);
const pairUrl = new URL('../worker/substack-pairs.json', import.meta.url);
const moduleUrl = new URL('../worker/substack-pairs.mjs', import.meta.url);
const checking = process.argv.includes('--check');
const feed = JSON.parse(fs.readFileSync(seedUrl, 'utf8'));
const pairs = fs.existsSync(pairUrl) ? JSON.parse(fs.readFileSync(pairUrl, 'utf8')) : [];
assert.ok(Array.isArray(pairs) && pairs.length <= 100);
const pairMap = new Map(), urls = new Set();
for (const pair of pairs) {
  assert.equal(Object.keys(pair).sort().join(','), 'substackUrl,xArticleId');
  assert.equal(typeof pair.xArticleId, 'string');
  assert.match(pair.xArticleId, /^\d{15,20}$/);
  assert.equal(typeof pair.substackUrl, 'string');
  assert.match(pair.substackUrl, /^https:\/\/tugrulguner\.substack\.com\/p\/[a-z0-9-]{1,180}$/);
  assert.ok(!pairMap.has(pair.xArticleId) && !urls.has(pair.substackUrl));
  pairMap.set(pair.xArticleId, pair.substackUrl); urls.add(pair.substackUrl);
}
// Workerd imports JS; JSON is the sole editable source and CI rejects module drift.
if (fs.existsSync(pairUrl)) {
  const generated = '// Generated from substack-pairs.json by npm run articles:seed. Do not edit.\nexport default ' + JSON.stringify(pairs, null, 2) + ';\n';
  if (checking) assert.equal(fs.readFileSync(moduleUrl, 'utf8'), generated, 'Pairing module stale; run npm run articles:seed');
  else fs.writeFileSync(moduleUrl, generated);
}
assert.equal(feed.schemaVersion, 1);
assert.ok(Array.isArray(feed.articles) && feed.articles.length > 0 && feed.articles.length <= 100);
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const seen = new Set();
for (const a of feed.articles) {
  assert.match(a.id, /^\d{15,20}$/); assert.equal(a.url, `https://x.com/i/article/${a.id}`);
  assert.ok(!seen.has(a.id)); seen.add(a.id);
  assert.ok(a.title && a.excerpt && Number.isFinite(Date.parse(a.publishedAt)));
  if (a.cover) { const u = new URL(a.cover.url); assert.equal(u.origin, 'https://pbs.twimg.com'); assert.match(u.pathname, /^\/media\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/i); assert.ok(a.cover.width > 0 && a.cover.height > 0); }
}
const articles = [...feed.articles].sort((a,b) => Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
const date = a => `<time datetime="${esc(a.publishedAt)}">${esc(new Intl.DateTimeFormat('en-CA', {year:'numeric',month:'long',day:'numeric',timeZone:'UTC'}).format(new Date(a.publishedAt)))}</time>`;
const excerpt = value => { const text = value.replace(/\[\d+\]/g,'').replace(/\s+/g,' ').trim(); if (/[.!?…]$/.test(text)) return text; const sentence = text.match(/^[\s\S]*[.!?](?=\s)/)?.[0]; return sentence && sentence.length >= 60 ? sentence : text.replace(/\s+\S*$/,'')+'…'; };
const link = (a, text, cls = '', extra = '', platform = 'primary') => {
  const substack = platform !== 'x' && pairMap.get(a.id);
  return `<a class="${esc([cls,'ph-no-autocapture'].filter(Boolean).join(' '))}" href="${esc(substack || a.url)}" data-posthog-event="${substack ? 'substack_article_clicked' : 'x_article_clicked'}" data-posthog-content="${esc(a.id)}" data-posthog-surface="${substack ? 'ai_articles' : 'x_articles'}"${extra}>${text}</a>`;
};
const actions = a => `<div class="article-reading-links">${pairMap.has(a.id) ? link(a,'Read on Substack ↗','x-read-link') : ''}${link(a,'Read on X ↗','x-read-link','','x')}</div>`;
const image = (a, decorative = false) => a.cover ? `<img${decorative ? '' : ' class="x-cover"'} src="${esc(a.cover.url)}" alt="${decorative ? '' : esc(a.cover.alt)}" width="${a.cover.width}" height="${a.cover.height}" loading="lazy">` : '';
const a = articles[0];
const lines = [
  '<section class="x-articles" id="x-articles" aria-labelledby="x-articles-title" data-feed-state="seed">',
  '<div class="x-articles-heading"><div><p class="writing-kicker">Writing on Substack and X</p><h3 id="x-articles-title">AI &amp; agentic systems</h3></div><a class="x-profile-link ph-no-autocapture" href="https://x.com/Tugrul_Guner" rel="me" data-posthog-event="social_profile_clicked" data-posthog-network="x" data-posthog-surface="writing">All articles on X <span aria-hidden="true">↗</span></a></div>',
  `<div class="x-article-layout"><article class="x-featured" data-article-id="${a.id}">${a.cover ? link(a,image(a),'x-cover-link',` aria-label="Read ${esc(a.title)}"`) : ''}<div class="x-featured-copy">${date(a)}<h4>${link(a,esc(a.title))}</h4><p>${esc(excerpt(a.excerpt))}</p>${actions(a)}</div></article>`,
  '<ol class="x-recent">',
  ...articles.slice(1,6).map(a => `<li data-article-id="${a.id}">${a.cover ? link(a,image(a,true),'x-recent-cover',' tabindex="-1" aria-hidden="true"') : ''}<div>${date(a)}<h4>${link(a,esc(a.title))}</h4><p>${esc(excerpt(a.excerpt))}</p>${actions(a)}</div></li>`),
  '</ol></div>'
];
if (articles.length > 6) lines.push('<details class="x-archive"><summary>Older articles</summary><ol class="x-archive-list">', ...articles.slice(6).map(a => `<li data-article-id="${a.id}">${date(a)}${link(a,esc(a.title))}${actions(a)}</li>`), '</ol></details>');
lines.push(`<script type="application/json" data-article-baseline>${JSON.stringify({...feed, articles:feed.articles.map(a => pairMap.has(a.id) ? {...a, substackUrl:pairMap.get(a.id)} : a)}).replace(/</g,'\\u003c')}</script>`, '</section>');
const html = fs.readFileSync(pageUrl, 'utf8');
const pattern = /<section class="x-articles" id="x-articles"(?=\s|>)[\s\S]*?<\/section>/;
assert.equal((html.match(new RegExp(pattern.source,'g')) || []).length, 1, 'one bounded article section must exist');
const updated = html.replace(pattern, () => lines.join('\n'));
if (checking) assert.equal(updated, html, 'Article HTML stale; run npm run articles:seed');
else fs.writeFileSync(pageUrl, updated);
console.log(`${checking ? 'Checked' : 'Generated'} static article inventory (${articles.length} articles).`);
