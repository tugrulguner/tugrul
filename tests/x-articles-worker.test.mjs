import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { normalizeFeed, syncArticles } from '../worker/index.mjs';

const fixture = { schemaVersion: 1, updatedAt: '2026-10-23T00:00:00.000Z', articles: [{ id: '2113450673068965888', postId: '2113455187515916724', title: 'TorchTPU Makes Moving a Model Easier. Optimization Comes Next.', excerpt: 'Actual published article fixture.', publishedAt: '2026-10-23T02:19:17.000Z', url: 'https://x.com/i/article/2113450673068965888', cover: { url: 'https://pbs.twimg.com/media/HVR8WXMXkAA33tw.jpg', alt: '', width: 1600, height: 640 } }] };
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('normalizes published X article posts and validates URLs', () => {
  const posts = [{ id: '2113455187515916724', created_at: '2026-10-23T02:19:17Z', article: { id: '2113450673068965888', title: 'Title', preview_text: 'Excerpt', cover_media: 'cover_key' }, entities: { urls: [{ expanded_url: 'https://x.com/i/article/2113450673068965888' }] } }];
  const feed = normalizeFeed(posts, [{ media_key: 'cover_key', url: 'https://pbs.twimg.com/media/HVR8WXMXkAA33tw.jpg', width: 1600, height: 640, alt_text: 'Cover' }], new Date('2026-10-23T03:00:00Z'));
  assert.equal(feed.articles[0].cover.alt, 'Cover'); assert.equal(feed.articles[0].id, '2113450673068965888');
  assert.equal(normalizeFeed([{ ...posts[0], entities: { urls: [{ expanded_url: 'https://evil.example/i/article/1' }] } }], [], new Date()).articles.length, 0);
});

test('public feed serves valid KV, falls back to seed, and never calls X', async () => {
  let outbound = 0;
  const env = { ARTICLES_KV: { get: async () => JSON.stringify(fixture) }, ASSETS: { fetch: async () => response(fixture) } };
  const res = await worker.fetch(new Request('https://site.test/api/x-articles'), env, { fetch: async () => { outbound++; } });
  assert.equal(res.status, 200); assert.deepEqual(await res.json(), fixture); assert.equal(outbound, 0);
  env.ARTICLES_KV.get = async () => '{bad';
  assert.deepEqual(await (await worker.fetch(new Request('https://site.test/api/x-articles'), env)).json(), fixture);
});

test('missing KV and seed safely yields a valid empty feed', async () => {
  const res = await worker.fetch(new Request('https://site.test/api/x-articles'), { ASSETS: { fetch: async () => new Response('no', { status: 404 }) } });
  assert.equal(res.status, 200); assert.deepEqual((await res.json()).articles, []);
});

test('refresh rotation persists tokens privately and scheduled sync publishes bounded timeline data', async () => {
  const writes = new Map([['x-articles:sync-state', JSON.stringify({historyDone:true})]]); let calls = 0;
  const kv = { get: async k => writes.get(k) ?? null, put: async (k,v) => writes.set(k,v) };
  const fetcher = async (url, init) => {
    calls++;
    if (String(url).includes('/oauth2/token')) { assert.equal(init.body.get('grant_type'), 'refresh_token'); return response({ access_token: 'new-access', refresh_token: 'rotated-refresh', expires_in: 3600 }); }
    assert.equal(new Headers(init.headers).get('authorization'), 'Bearer new-access');
    return response({ data: [{ id: '2113455187515916724', created_at: '2026-10-23T02:19:17Z', article: { id: '2113450673068965888', title: 'Title', preview_text: 'Text' }, entities: { urls: [{ expanded_url: 'https://x.com/i/article/2113450673068965888' }] } }], includes: { media: [] }, meta: {} });
  };
  const env = { ARTICLES_KV: kv, X_CLIENT_ID: 'id', X_CLIENT_SECRET: 'secret', X_REFRESH_TOKEN: 'bootstrap', fetch: fetcher, ASSETS: { fetch: async () => response({ articles: [] }) } };
  await syncArticles(env, { fetch: fetcher, now: new Date('2026-10-23T04:00:00Z') });
  assert.equal(calls, 2); assert.equal(JSON.parse(writes.get('x-articles:oauth')).refreshToken, 'rotated-refresh');
  assert.equal(JSON.parse(writes.get('x-articles:feed')).articles[0].id, '2113450673068965888');
});

test('missing secrets and provider errors preserve last good feed', async () => {
  const writes = new Map([['x-articles:feed', JSON.stringify(fixture)]]);
  const kv = { get: async k => writes.get(k) ?? null, put: async (k,v) => writes.set(k,v) };
  await syncArticles({ ARTICLES_KV: kv }, { fetch: async () => { throw Error('offline'); } });
  assert.deepEqual(JSON.parse(writes.get('x-articles:feed')), fixture);
  await assert.rejects(syncArticles({ ARTICLES_KV: kv, X_CLIENT_ID: 'id', X_CLIENT_SECRET: 'secret', X_REFRESH_TOKEN: 'seed' }, { fetch: async () => response({ errors: ['denied'] }, 429) }));
  assert.deepEqual(JSON.parse(writes.get('x-articles:feed')), fixture);
});

test('manual refresh path is absent and unauthorized requests perform no fetch', async () => {
  let calls = 0; const env = { ARTICLES_SYNC_TOKEN: 'secret', fetch: async () => calls++ };
  const res = await worker.fetch(new Request('https://site.test/api/x-articles/refresh', { method: 'POST' }), env);
  assert.equal(res.status, 404); assert.equal(calls, 0);
});

test('other static paths pass through assets', async () => {
  const env = { ASSETS: { fetch: async req => new Response(new URL(req.url).pathname) } };
  assert.equal(await (await worker.fetch(new Request('https://site.test/about'), env)).text(), '/about');
});

test('timeline paging deduplicates articles and ignores ordinary posts', async () => {
  const values = new Map([['x-articles:sync-state', JSON.stringify({historyDone:true})]]); const kv = { get: async k => values.get(k) ?? null, put: async (k,v) => values.set(k,v) };
  const mk = (id, pid, title) => ({ id: pid, created_at: '2026-10-23T02:00:00Z', article: { id, title, preview_text: 'Excerpt' }, entities: { urls: [{ expanded_url: `https://x.com/i/article/${id}` }] } });
  let timelines = 0;
  const fetcher = async url => {
    if (String(url).includes('/oauth2/token')) return response({ access_token: 'a', refresh_token: 'r', expires_in: 3600 });
    timelines++;
    if (timelines === 1) return response({ data: [mk('2113450673068965888','2113455187515916724','New'), { id: '2113460000000000001', created_at: '2026-10-23T03:00:00Z', text: 'ordinary post' }], meta: { next_token: 'next' } });
    assert.equal(new URL(url).searchParams.get('pagination_token'), 'next');
    return response({ data: [mk('2113450673068965888','2113455187515916724','New'), mk('2113083507429797889','2113083651856408576','Older')], meta: {} });
  };
  await syncArticles({ ARTICLES_KV: kv, X_CLIENT_ID: 'id', X_CLIENT_SECRET: 'secret', X_REFRESH_TOKEN: 'seed' }, { fetch: fetcher, now: new Date('2026-10-23T04:00:00Z') });
  const feed = JSON.parse(values.get('x-articles:feed'));
  assert.equal(timelines, 2); assert.deepEqual(feed.articles.map(a => a.id), ['2113450673068965888','2113083507429797889']);
});

test('malicious seed URL and corrupted KV cannot escape validation', async () => {
  const bad = { ...fixture, articles: [{ ...fixture.articles[0], url: 'https://evil.example/article' }] };
  const res = await worker.fetch(new Request('https://site.test/api/x-articles'), { ARTICLES_KV: { get: async () => JSON.stringify(bad) }, ASSETS: { fetch: async () => response(fixture) } });
  assert.deepEqual(await res.json(), fixture);
});

import fs from 'node:fs';
test('normalizes captured real provider article IDs from expanded article URL', () => {
  const captured = JSON.parse(fs.readFileSync(new URL('./fixtures/x-article-real-provider.json', import.meta.url)));
  const feed = normalizeFeed(captured.data, captured.includes.media, new Date('2026-10-23T04:00:00Z'));
  assert.equal(feed.articles.length, 3);
  assert.deepEqual(feed.articles.map(a => a.id), ['2113450673068965888','2113083507429797889','2112866456417263616']);
  assert.equal(feed.articles[0].cover.url, 'https://pbs.twimg.com/media/HVR8WXMXkAA33tw.jpg');
});
