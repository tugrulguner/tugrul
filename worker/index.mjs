const FEED_KEY = 'x-articles:feed';
const OAUTH_KEY = 'x-articles:oauth';
const MAX_PAGES = 3;
const PAGE_SIZE = 20;
const MAX_POSTS = 60;
const SYNC_KEY = 'x-articles:sync-state';
const MAX_ARTICLES = 100;
const MAX_FEED_BYTES = 256_000;
const FEED_TTL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400';
const EMPTY = () => ({ schemaVersion: 1, updatedAt: new Date(0).toISOString(), articles: [] });

function validFeed(value) {
  const exact = (object, keys) => object && Object.keys(object).every(key => keys.includes(key)) && keys.every(key => Object.hasOwn(object, key));
  if (!exact(value, ['schemaVersion','updatedAt','articles']) || !value || value.schemaVersion !== 1 || typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt)) || !Array.isArray(value.articles) || value.articles.length > MAX_ARTICLES) return false;
  return value.articles.every(a => exact(a, ['id','postId','title','excerpt','publishedAt','url','cover']) && a && typeof a.id === 'string' && /^\d{15,20}$/.test(a.id) && typeof a.postId === 'string' && /^\d{15,20}$/.test(a.postId) && typeof a.title === 'string' && a.title.length <= 240 && typeof a.excerpt === 'string' && a.excerpt.length <= 1200 && typeof a.publishedAt === 'string' && Number.isFinite(Date.parse(a.publishedAt)) && a.url === `https://x.com/i/article/${a.id}` && (a.cover === null || (exact(a.cover, ['url','alt','width','height']) && a.cover && typeof a.cover.url === 'string' && /^https:\/\/pbs\.twimg\.com\/media\/[A-Za-z0-9_-]+(?:\.[A-Za-z0-9]+)?(?:\?.*)?$/.test(a.cover.url) && typeof a.cover.alt === 'string' && Number.isInteger(a.cover.width) && Number.isInteger(a.cover.height))));
}

function safeText(value, max) { return typeof value === 'string' ? value.replace(/\u0000/g, '').slice(0, max) : ''; }
function articleId(post) {
  const explicit = post?.article?.id ?? post?.article?.rest_id;
  const urlId = post?.entities?.urls?.map(u => typeof u?.expanded_url === 'string' ? u.expanded_url.match(/^https:\/\/x\.com\/i\/article\/(\d{15,20})(?:[?#].*)?$/)?.[1] : null).find(Boolean);
  if (explicit !== undefined && explicit !== null && (typeof explicit !== 'string' || !/^\d{15,20}$/.test(explicit) || (urlId && explicit !== urlId))) return null;
  return urlId ?? (typeof explicit === 'string' && /^\d{15,20}$/.test(explicit) ? explicit : null);
}

function coverFor(post, media) {
  const ref = post?.article?.cover_media;
  const key = typeof ref === 'string' ? ref : ref?.media_key;
  const item = key ? media.find(m => m.media_key === key) : null;
  if (!item || typeof item.url !== 'string' || !/^https:\/\/pbs\.twimg\.com\/media\/[A-Za-z0-9_-]+(?:\.[A-Za-z0-9]+)?(?:\?.*)?$/.test(item.url)) return null;
  return { url: item.url, alt: safeText(item.alt_text, 300), width: Number.isInteger(item.width) ? item.width : 0, height: Number.isInteger(item.height) ? item.height : 0 };
}

export function normalizeFeed(posts, media = [], now = new Date()) {
  const articles = [];
  const seen = new Set();
  for (const post of Array.isArray(posts) ? posts : []) {
    const id = articleId(post);
    const postId = typeof post?.id === 'string' && /^\d{15,20}$/.test(post.id) ? post.id : null;
    const url = post?.entities?.urls?.find(u => typeof u?.expanded_url === 'string' && /^https:\/\/x\.com\/i\/article\/\d{1,30}(?:\?.*)?$/.test(u.expanded_url))?.expanded_url;
    if (!id || !postId || !url || url !== `https://x.com/i/article/${id}` || seen.has(id)) continue;
    const title = safeText(post.article.title, 240).trim();
    const excerpt = safeText(post.article.preview_text ?? post.article.description ?? post.text, 1200).trim();
    const publishedAt = post.created_at;
    if (!title || typeof publishedAt !== 'string' || !Number.isFinite(Date.parse(publishedAt))) continue;
    seen.add(id);
    articles.push({ id, postId, title, excerpt, publishedAt: new Date(publishedAt).toISOString(), url: `https://x.com/i/article/${id}`, cover: coverFor(post, media) });
  }
  articles.sort((a, b) => BigInt(a.id) > BigInt(b.id) ? -1 : BigInt(a.id) < BigInt(b.id) ? 1 : Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  return { schemaVersion: 1, updatedAt: now.toISOString(), articles: articles.slice(0, MAX_ARTICLES) };
}

async function readFeed(env) {
  try {
    const raw = await env.ARTICLES_KV?.get(FEED_KEY);
    if (raw && raw.length <= MAX_FEED_BYTES) {
      const parsed = JSON.parse(raw);
      if (validFeed(parsed)) return parsed;
    }
  } catch { /* serve the last bundled good feed instead */ }
  try {
    const response = await env.ASSETS?.fetch(new Request('https://assets.invalid/x-articles.json'));
    if (response?.ok) {
      const text = await response.text();
      if (text.length <= MAX_FEED_BYTES) { const feed = JSON.parse(text); if (validFeed(feed)) return feed; }
    }
  } catch { /* no seed available */ }
  return EMPTY();
}

async function putFeed(kv, feed) {
  const encoded = JSON.stringify(feed);
  if (encoded.length > MAX_FEED_BYTES || !validFeed(feed)) throw new Error('feed validation failed');
  await kv.put(FEED_KEY, encoded);
}

async function jsonFetch(fetcher, url, init, label) {
  const response = await fetcher(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`${label} request failed (${response.status})`);
  if (!response.body) throw new Error(`${label} response invalid`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0, text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 512_000) { await reader.cancel(); throw new Error(`${label} response too large`); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally { reader.releaseLock(); }
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object' || data.errors?.length) throw new Error(`${label} response invalid`);
  return data;
}

async function getAccessToken(env, kv, fetcher, now) {
  let stored = null;
  try { const raw = await kv.get(OAUTH_KEY); if (raw && raw.length <= 8192) stored = JSON.parse(raw); } catch { /* bootstrap from secret */ }
  if (stored?.accessToken && stored.expiresAt > now.getTime() + 60_000 && typeof stored.refreshToken === 'string') return stored.accessToken;
  const refreshToken = stored?.refreshToken || env.X_REFRESH_TOKEN;
  if (!refreshToken || !env.X_CLIENT_ID || !env.X_CLIENT_SECRET) return null;
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: env.X_CLIENT_ID });
  const basic = btoa(`${env.X_CLIENT_ID}:${env.X_CLIENT_SECRET}`);
  const token = await jsonFetch(fetcher, 'https://api.x.com/2/oauth2/token', { method: 'POST', headers: { authorization: `Basic ${basic}`, 'content-type': 'application/x-www-form-urlencoded' }, body }, 'OAuth refresh');
  if (typeof token.access_token !== 'string' || typeof token.refresh_token !== 'string' || !Number.isFinite(token.expires_in)) throw new Error('OAuth refresh response invalid');
  await kv.put(OAUTH_KEY, JSON.stringify({ accessToken: token.access_token, refreshToken: token.refresh_token, expiresAt: now.getTime() + token.expires_in * 1000 }));
  return token.access_token;
}

export async function syncArticles(env, options = {}) {
  const kv = env.ARTICLES_KV;
  if (!kv || typeof kv.get !== 'function' || typeof kv.put !== 'function') return { synced: false, reason: 'storage unavailable' };
  const fetcher = options.fetch ?? env.fetch ?? fetch;
  const now = options.now ?? new Date();
  let previous = EMPTY();
  try { const raw = await kv.get(FEED_KEY); if (raw && raw.length <= MAX_FEED_BYTES) { const v = JSON.parse(raw); if (validFeed(v)) previous = v; } } catch { /* replace corrupt value only after fully successful sync */ }
  if (!previous.articles.length) { try { const seed = await env.ASSETS?.fetch(new Request('https://assets.invalid/x-articles.json')); if (seed?.ok) { const raw = await seed.text(); if (raw.length <= MAX_FEED_BYTES) { const parsed = JSON.parse(raw); if (validFeed(parsed)) previous = parsed; } } } catch { /* seed is optional */ } }
  const accessToken = await getAccessToken(env, kv, fetcher, now);
  if (!accessToken) return { synced: false, reason: 'credentials unavailable' };
  const records = new Map(previous.articles.map(a => [a.id, a]));
  let paginationToken, sinceId = null, newestId = null;
  try {
    const raw = await kv.get(SYNC_KEY);
    const state = raw && raw.length <= 8192 ? JSON.parse(raw) : null;
    if (state) {
      if (typeof state.sinceId === 'string' && /^\d{15,20}$/.test(state.sinceId)) sinceId = state.sinceId;
      if (typeof state.newestId === 'string' && /^\d{15,20}$/.test(state.newestId)) newestId = state.newestId;
      if (typeof state.nextToken === 'string' && state.nextToken.length <= 2048) paginationToken = state.nextToken;
    }
  } catch { /* restart conservatively without advancing over unseen posts */ }
  if (!paginationToken && !sinceId && previous.articles.length) {
    // Bootstrap from the oldest bundled article, not the account's entire posting history.
    const oldest = previous.articles.reduce((id, article) => BigInt(article.postId) < BigInt(id) ? article.postId : id, previous.articles[0].postId);
    sinceId = (BigInt(oldest) - 1n).toString();
  }
  let postsCount = 0;
  let continuation = null;
  for (let page = 0; page < MAX_PAGES && postsCount < MAX_POSTS; page++) {
    const url = new URL('https://api.x.com/2/users/90198388/tweets');
    url.searchParams.set('max_results', String(Math.min(PAGE_SIZE, MAX_POSTS - postsCount)));
    url.searchParams.set('exclude', 'replies,retweets');
    url.searchParams.set('tweet.fields', 'article,created_at,entities');
    url.searchParams.set('expansions', 'article.cover_media');
    url.searchParams.set('media.fields', 'url,alt_text,width,height');
    if (sinceId) url.searchParams.set('since_id', sinceId);
    if (paginationToken) url.searchParams.set('pagination_token', paginationToken);
    const data = await jsonFetch(fetcher, url, { headers: { authorization: `Bearer ${accessToken}` } }, 'Timeline');
    if (!data.meta || (!Array.isArray(data.data) && !(data.data === undefined && data.meta.result_count === 0)) || (data.meta.next_token !== undefined && (typeof data.meta.next_token !== 'string' || !data.meta.next_token || data.meta.next_token.length > 2048))) throw new Error('Timeline response invalid');
    const posts = data.data ?? [];
    if (posts.length > PAGE_SIZE || posts.some(p => !p || typeof p.id !== 'string' || !/^\d{15,20}$/.test(p.id))) throw new Error('Timeline post bounds invalid');
    for (const post of posts) if (!newestId || BigInt(post.id) > BigInt(newestId)) newestId = post.id;
    postsCount += posts.length;
    const media = Array.isArray(data.includes?.media) ? data.includes.media : [];
    const normalized = normalizeFeed(posts, media, now);
    for (const incoming of normalized.articles) {
      const old = records.get(incoming.id);
      if (old && incoming.cover === null && old.cover) incoming.cover = old.cover;
      records.set(incoming.id, incoming);
    }
    const next = data.meta?.next_token;
    if (!next) break;
    if (page === MAX_PAGES - 1 || postsCount >= MAX_POSTS) { continuation = next; break; }
    paginationToken = next;
  }
  const articles = [...records.values()].sort((a, b) => BigInt(a.id) > BigInt(b.id) ? -1 : BigInt(a.id) < BigInt(b.id) ? 1 : Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, MAX_ARTICLES);
  const feed = { schemaVersion: 1, updatedAt: now.toISOString(), articles };
  await putFeed(kv, feed);
  // Commit progress only after public content is durable; a failed checkpoint is safe to replay.
  await kv.put(SYNC_KEY, JSON.stringify(continuation ? { sinceId, nextToken: continuation, newestId } : { sinceId: newestId ?? sinceId, nextToken: null, newestId: null }));
  return { synced: true, count: articles.length };
}

async function handle(request, env, ctx) {
  const url = new URL(request.url);
  if (url.pathname === '/api/x-articles' && request.method === 'GET') {
    const feed = await readFeed(env);
    return Response.json(feed, { headers: { 'cache-control': FEED_TTL, 'x-content-type-options': 'nosniff' } });
  }
  if (url.pathname.startsWith('/api/x-articles')) return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } });
  return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
}

export default {
  fetch: handle,
  async scheduled(controller, env, ctx) { ctx.waitUntil(syncArticles(env).then(result => { if (!result.synced) console.warn('X article sync not configured; serving cached articles.'); }).catch(() => console.error('X article sync failed; serving cached articles.'))); }
};
