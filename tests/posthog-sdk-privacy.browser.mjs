import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';

const origin = 'https://tugrul.modepot.io';
const token = 'phc_qXkp5FBQfrqHQwkqf3ys8iSoGoMYw2tpTHXGugXJhP8V';
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
const posts = [];
const server = createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('creator-profile-local-fixture'); return; }
  res.writeHead(404); res.end('not found');
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const address = server.address();
assert.ok(address && typeof address === 'object' && address.port, 'fixture server must bind an exclusive port');
const local = `http://127.0.0.1:${address.port}`;
let browser;
try {
  const health = await fetch(`${local}/health`);
  assert.equal(await health.text(), 'creator-profile-local-fixture', 'server identity must be verified before browser test');
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    extraHTTPHeaders: { 'sec-ch-ua': '"Chromium";v="140", "Google Chrome";v="140", "Not:A-Brand";v="24"', 'sec-ch-ua-mobile': '?0', 'sec-ch-ua-platform': '"macOS"' },
  });
  await context.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { configurable: true, get: () => false }));
  await context.addInitScript(({ token, sentinel }) => {
    Object.defineProperty(Navigator.prototype, 'userAgentData', { configurable: true, get: () => ({ brands: [{ brand: 'Chromium', version: '140' }, { brand: 'Google Chrome', version: '140' }], mobile: false, platform: 'macOS' }) });
    const key = `ph_${token}_posthog`;
    const prior = JSON.parse(localStorage.getItem(key) || '{}');
    Object.assign(prior, { distinct_id: 'creator-persisted-fixture', $device_id: 'creator-device', $initial_utm_source: sentinel, $session_entry_gclid: sentinel, $initial_referrer: `https://ref.example/path?campaign=${sentinel}#${sentinel}` });
    localStorage.setItem(key, JSON.stringify(prior));
    window.__acquisitionSeeded = prior.$session_entry_gclid === sentinel && prior.$initial_utm_source === sentinel;
  }, { token, sentinel: 'PERSISTED_ACQUISITION_SENTINEL' });
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin) {
      if (url.pathname === '/') return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
      if (url.pathname === '/styles.css') return route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: css });
      return route.fulfill({ status: 200, contentType: 'text/plain', body: 'local fixture asset' });
    }
    if (/posthog/i.test(url.hostname) && route.request().method() === 'POST') {
      const body = route.request().postDataBuffer();
      const bytes = body ? Buffer.from(body) : Buffer.alloc(0);
      let decoded = bytes;
      if (bytes[0] === 0x1f && bytes[1] === 0x8b) decoded = gunzipSync(bytes);
      const text = decoded.toString('utf8');
      posts.push({ url: route.request().url(), method: 'POST', body: text, raw: bytes.toString('base64') });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) });
    }
    return route.continue();
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(window, '__shippedBotFilter', { value: true });
  });
  const browserErrors = [];
  page.on('requestfailed', (request) => browserErrors.push({ url: request.url(), error: request.failure()?.errorText }));
  page.on('console', (message) => { if (message.type() === 'error') browserErrors.push({ console: message.text() }); });
  await page.goto(`${origin}/?utm_source=URL_CAMPAIGN_SENTINEL&gclid=AD_CLICK_SENTINEL#FRAGMENT_SENTINEL`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.title.includes('Tugrul Guner'), null, { timeout: 5000 });
  assert.ok(await page.locator('a[data-posthog-event="modepot_project_clicked"]').count() >= 4, 'local production content was fulfilled on the production-origin host');
  await page.waitForFunction(() => window.posthog?.__loaded === true, null, { timeout: 30000 });
  await page.waitForFunction(() => performance.getEntriesByType('resource').some((e) => /posthog.*static\/array\.js/.test(e.name)), null, { timeout: 30000 });
  await page.waitForFunction(() => window.posthog?.config?.capture_pageview === true && window.posthog?.is_capturing?.() === true, null, { timeout: 15000 });
  await page.waitForFunction(() => window.posthog?.get_distinct_id?.(), null, { timeout: 10000 });
  for (let i = 0; i < 40 && !posts.some((request) => request.body.includes('$pageview')); i++) await page.waitForTimeout(500);
  const initial = await page.evaluate(() => ({
    loaded: window.posthog?.__loaded, capturing: window.posthog?.is_capturing?.(), optedOut: window.posthog?.has_opted_out_capturing?.(),
    config: { capture_pageview: window.posthog?.config?.capture_pageview, capture_pageleave: window.posthog?.config?.capture_pageleave, autocapture: window.posthog?.config?.autocapture, disable_session_recording: window.posthog?.config?.disable_session_recording, disable_feature_flags: window.posthog?.config?.disable_feature_flags, advanced_disable_flags: window.posthog?.config?.advanced_disable_flags, opt_out_useragent_filter: window.posthog?.config?.opt_out_useragent_filter },
    webdriver: navigator.webdriver, acquisitionSeeded: window.__acquisitionSeeded, ua: navigator.userAgent, persisted: localStorage.getItem(`ph_${'phc_qXkp5FBQfrqHQwkqf3ys8iSoGoMYw2tpTHXGugXJhP8V'}_posthog`),
  }));
  assert.equal(initial.loaded, true, 'real PostHog SDK loaded');
  assert.equal(initial.capturing, true, 'SDK is positively capturing');
  assert.equal(initial.optedOut, false, 'initial browser is not opted out');
  assert.equal(initial.webdriver, false, 'test identity suppresses webdriver');
  assert.equal(initial.config.opt_out_useragent_filter, false, 'shipped bot filtering remains enabled');
  assert.equal(initial.config.advanced_disable_flags, true, 'unused feature flags disabled in shipped config');
  assert.equal(initial.acquisitionSeeded, true, 'existing campaign/ad metadata was seeded before SDK initialization');
  const click = await page.locator('a[data-posthog-event="modepot_project_clicked"]').first();
  await click.evaluate((el) => { el.href += '?campaign=URL_CAMPAIGN_SENTINEL#FRAGMENT_SENTINEL'; });
  await page.evaluate(() => document.addEventListener('click', (event) => event.preventDefault()));
  await click.focus();
  await page.keyboard.press('Enter');
  for (let i = 0; i < 20 && !posts.some((request) => request.body.includes('modepot_project_clicked')); i++) await page.waitForTimeout(500);
  const ingress = posts.filter((request) => /\/(?:i\/v0\/)?e\//.test(new URL(request.url).pathname));
  const events = ingress.flatMap((request) => {
    try { const payload = JSON.parse(request.body); return Array.isArray(payload.batch) ? payload.batch : Array.isArray(payload) ? payload : payload.event ? [payload] : []; } catch { return []; }
  });
  const pageviews = events.filter((event) => event.event === '$pageview');
  assert.ok(pageviews.some((event) => event.properties?.$current_url === `${origin}/`), `automatic pageview must survive sanitizer; initial=${JSON.stringify(initial)} errors=${JSON.stringify(browserErrors)} requests=${JSON.stringify(posts.map(({ url, body }) => ({ url, body: body.slice(0, 800) })))} events=${JSON.stringify(events.map((e) => [e.event, e.properties?.$current_url]))}`);
  const cta = events.find((event) => event.event === 'modepot_project_clicked');
  assert.ok(cta, `actual CTA must survive sanitizer; events=${JSON.stringify(events.map((e) => e.event))}`);
  assert.equal(cta.properties.project, 'dexpot');
  assert.equal(cta.properties.destination, 'https://dexpot.modepot.io/');
  const optSentinels = ['URL_CAMPAIGN_SENTINEL', 'AD_CLICK_SENTINEL', 'FRAGMENT_SENTINEL', 'PERSISTED_ACQUISITION_SENTINEL'];
  for (const request of posts) {
    assert.ok(!request.url.includes('SENTINEL'), `sentinel leaked in PostHog request URL ${request.url}`);
    for (const sentinel of optSentinels) assert.ok(!request.body.includes(sentinel), `${sentinel} leaked through ${request.url}: ${request.body.slice(Math.max(0, request.body.indexOf(sentinel)-500), request.body.indexOf(sentinel)+500)}`);
  }
  const sdkDistinctId = await page.evaluate(() => window.posthog.get_distinct_id());
  assert.equal(sdkDistinctId, 'creator-persisted-fixture', `SDK adopts persisted identity, found ${sdkDistinctId}; storage=${initial.persisted}`);
  const optContext = await browser.newContext({ userAgent: initial.ua, extraHTTPHeaders: { 'sec-ch-ua': '"Chromium";v="140", "Google Chrome";v="140", "Not:A-Brand";v="24"', 'sec-ch-ua-mobile': '?0', 'sec-ch-ua-platform': '"macOS"' } });
  await optContext.addInitScript(({ token }) => { Object.defineProperty(Navigator.prototype, 'userAgentData', { configurable: true, get: () => ({ brands: [{ brand: 'Chromium', version: '140' }, { brand: 'Google Chrome', version: '140' }], mobile: false, platform: 'macOS' }) }); localStorage.setItem(`__ph_opt_in_out_${token}`, '0'); Object.defineProperty(Navigator.prototype, 'webdriver', { configurable: true, get: () => false }); }, { token });
  await optContext.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
    if (/posthog/i.test(url.hostname) && route.request().method() === 'POST') { posts.push({ url: route.request().url(), method: 'POST', body: route.request().postData() || '' }); return route.fulfill({ status: 200, body: '{}' }); }
    return route.continue();
  });
  const beforeOptRequests = posts.length;
  const optPage = await optContext.newPage();
  await optPage.goto(origin, { waitUntil: 'domcontentloaded' });
  await optPage.waitForFunction(() => window.posthog?.__loaded === true, null, { timeout: 30000 });
  await optPage.waitForTimeout(1500);
  const optState = await optPage.evaluate(() => ({ loaded: window.posthog?.__loaded, optedOut: window.posthog?.has_opted_out_capturing?.(), capturing: window.posthog?.is_capturing?.() }));
  assert.equal(optState.loaded, true, 'opt-out case positively loads real SDK');
  assert.equal(optState.optedOut, true, 'existing opt-out is recognized');
  assert.equal(optState.capturing, false, 'SDK capture disabled in persisted opt-out context');
  assert.equal(posts.length, beforeOptRequests, 'persisted opt-out emits no PostHog POST requests');
  console.log(JSON.stringify({ origin, local, requestCount: posts.length, sdkLoaded: initial.loaded, capturePageview: initial.config.capture_pageview, pageviewEvent: pageviews[0]?.event, pageviewUrl: pageviews[0]?.properties?.$current_url, ctaEvent: cta.event, ctaProject: cta.properties.project, ctaDestination: cta.properties.destination, sentinelsAbsent: true, persistedIdentity: sdkDistinctId, optOutLoaded: optState.loaded, optOutCaptureDisabled: !optState.capturing, optOutPostCount: posts.length - beforeOptRequests }, null, 2));
  await optContext.close();
  await context.close();
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
