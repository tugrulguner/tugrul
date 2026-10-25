import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('../public/', import.meta.url)));
const feed = JSON.parse(await readFile(resolve(root, 'x-articles.json'), 'utf8'));
const pairs = JSON.parse(await readFile(new URL('../worker/substack-pairs.json', import.meta.url), 'utf8'));
const merged = { ...feed, articles: feed.articles.map(a => ({ ...a, ...(pairs.find(p => p.xArticleId === a.id) ? { substackUrl: pairs.find(p => p.xArticleId === a.id).substackUrl } : {}) })) };
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!path.startsWith(root + sep)) throw Error('path');
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': ({ '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.jpg':'image/jpeg' })[extname(path)] || 'application/octet-stream' }); res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const evidence = process.env.ARTICLE_EVIDENCE_DIR || resolve(root, '../.wrangler/article-evidence');
await mkdir(evidence, { recursive:true });
const browser = await chromium.launch();
async function assertPairLinks(page) {
  assert.equal(await page.locator('#x-articles [data-article-id]').count(), feed.articles.length);
  for (const pair of pairs) {
    const card = page.locator(`[data-article-id="${pair.xArticleId}"]`);
    assert.equal(await card.count(), 1);
    assert.equal(await card.locator('.article-reading-links a').count(), 2);
    assert.equal(await card.locator('.article-reading-links a').nth(0).getAttribute('href'), pair.substackUrl);
    assert.equal(await card.locator('.article-reading-links a').nth(1).getAttribute('href'), `https://x.com/i/article/${pair.xArticleId}`);
    assert.equal(await card.locator('time').getAttribute('datetime'), feed.articles.find(a => a.id === pair.xArticleId).publishedAt);
  }
  assert.equal(await page.locator('#science-newsletter a[href*="substack"]').count(), 0);
}
try {
  for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({ viewport:{width,height:1000} });
    await context.route('**/*posthog.com/**', r => r.abort());
    await context.route('**/api/articles', r => r.fulfill({json:merged}));
    const page = await context.newPage(); await page.goto(origin);
    await page.waitForFunction(() => document.querySelector('#x-articles').dataset.feedState === 'live');
    await assertPairLinks(page);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.evaluate(() => { window.captures=[]; window.posthog={capture:(...args)=>window.captures.push(args)}; document.addEventListener('click', e => e.preventDefault(), true); });
    let clicked = 0;
    for (const pair of pairs) for (const platform of ['substack', 'x']) {
      const event = platform === 'x' ? 'x_article_clicked' : 'substack_article_clicked';
      const action = page.locator(`[data-article-id="${pair.xArticleId}"] .article-reading-links a[data-posthog-event="${event}"]`);
      await action.scrollIntoViewIfNeeded(); const box = await action.boundingBox();
      assert.ok(box.height >= 44 && box.x >= 0 && box.x + box.width <= width, `${width}: action target`);
      await action.click(); const capture = await page.evaluate(() => window.captures.at(-1));
      assert.equal(capture[0], event); assert.equal(capture[1].content, pair.xArticleId);
      assert.equal(capture[1].destination, platform === 'x' ? `https://x.com/i/article/${pair.xArticleId}` : pair.substackUrl);
      clicked++;
      await action.focus(); await page.keyboard.press('Enter'); clicked++;
      assert.equal(await page.evaluate(() => window.captures.length), clicked, 'one event per click/keyboard activation');
    }
    for (const img of await page.locator('#x-articles .x-article-layout img').all()) { await img.scrollIntoViewIfNeeded(); await img.evaluate(i => i.decode()); }
    await page.evaluate(() => document.activeElement?.blur());
    await page.locator('#x-articles').screenshot({path:resolve(evidence, `paired-${width}.png`),style:'.skip-link:not(:focus){visibility:hidden}'});
    await context.close();
  }
  for (const mode of ['nojs', 'failure', 'legacy', 'unsafe', 'archive']) {
    const context = await browser.newContext({javaScriptEnabled:mode !== 'nojs', viewport:{width:320,height:1000}});
    await context.route('**/*posthog.com/**', r => r.abort());
    let payload = structuredClone(merged);
    if (mode === 'legacy') payload = feed;
    if (mode === 'unsafe') payload.articles = payload.articles.map(a => ({...a, title:'MALICIOUS REPLACEMENT', substackUrl:'javascript:alert(1)'}));
    if (mode === 'archive') payload.articles = payload.articles.map(a => pairs.some(p => p.xArticleId === a.id) ? {...a,publishedAt:'2026-01-01T00:00:00.000Z'} : a);
    await context.route('**/api/articles', r => mode === 'failure' ? r.fulfill({status:503,body:''}) : r.fulfill({json:payload}));
    const page = await context.newPage(); await page.goto(origin); await page.waitForLoadState('networkidle');
    if (mode !== 'archive') await assertPairLinks(page);
    else {
      await page.locator('.x-archive summary').click();
      for (const pair of pairs) assert.equal(await page.locator(`.x-archive [data-article-id="${pair.xArticleId}"] .article-reading-links a`).count(),2);
    }
    if (mode === 'unsafe') assert.equal(await page.getByText('MALICIOUS REPLACEMENT',{exact:true}).count(),0);
    await context.close();
  }
  console.log('Paired Substack/X shelf: four viewports, real click/keyboard events, static/live dual links, no-JS/failure/legacy/unsafe fallback, archive parity and science exclusion passed.');
} finally { await browser.close(); await new Promise(r => server.close(r)); }
