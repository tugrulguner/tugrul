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
    if (!post?.article || typeof post.article !== 'object') continue;
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

function sortedArticles(records) {
  return [...records.values()].sort((a, b) => BigInt(a.id) > BigInt(b.id) ? -1 : BigInt(a.id) < BigInt(b.id) ? 1 : Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, MAX_ARTICLES);
}
function includeArticles(records, articles) {
  for (const incoming of articles) {
    const old = records.get(incoming.id);
    records.set(incoming.id, { ...incoming, cover: incoming.cover ?? old?.cover ?? null });
  }
}
async function readFeed(env) {
  let baseline = EMPTY(), cached = null;
  try {
    const response = await env.ASSETS?.fetch(new Request('https://assets.invalid/x-articles.json'));
    if (response?.ok) {
      const raw = await response.text();
      if (raw.length <= MAX_FEED_BYTES) { const value = JSON.parse(raw); if (validFeed(value)) baseline = value; }
    }
  } catch { /* the private cache remains independently usable */ }
  try {
    const raw = await env.ARTICLES_KV?.get(FEED_KEY);
    if (raw && raw.length <= MAX_FEED_BYTES) { const value = JSON.parse(raw); if (validFeed(value)) cached = value; }
  } catch { /* serve the bundled inventory */ }
  if (!cached) return baseline;
  const newer = Date.parse(cached.updatedAt) >= Date.parse(baseline.updatedAt) ? cached : baseline;
  const older = newer === cached ? baseline : cached;
  const records = new Map(); includeArticles(records, older.articles); includeArticles(records, newer.articles);
  return { schemaVersion: 1, updatedAt: newer.updatedAt, articles: sortedArticles(records) };
}

async function putFeed(kv, feed) {
  const encoded = JSON.stringify(feed);
  if (encoded.length > MAX_FEED_BYTES || !validFeed(feed)) throw new Error('feed validation failed');
  await kv.put(FEED_KEY, encoded);
}

async function jsonFetch(fetcher, url, init, label) {
  const response = await fetcher(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(15_000) });
  if (!response.ok) { const error = new Error(`${label} request failed (${response.status})`); error.status = response.status; throw error; }
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
  const previous = await readFeed(env);
  const accessToken = await getAccessToken(env, kv, fetcher, now);
  if (!accessToken) return { synced: false, reason: 'credentials unavailable' };
  const records = new Map(previous.articles.map(a => [a.id, a]));
  const isId = value => typeof value === 'string' && /^\d{15,20}$/.test(value);
  const isCursor = value => typeof value === 'string' && value.length > 0 && value.length <= 2048;
  let state = {};
  try { const raw = await kv.get(SYNC_KEY); if (raw && raw.length <= 8192) { const parsed = JSON.parse(raw); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) state = parsed; } } catch { /* conservatively replay, never skip unseen content */ }
  const newestKnown = previous.articles.reduce((id, article) => !id || BigInt(article.postId) > BigInt(id) ? article.postId : id, null);
  let paginationToken = isCursor(state.nextToken) ? state.nextToken : null;
  let sinceId = isId(state.sinceId) ? state.sinceId : paginationToken ? null : newestKnown;
  let newestId = isId(state.newestId) ? state.newestId : null;
  let historyDone = state.historyDone === true;
  let historyToken = isCursor(state.historyToken) ? state.historyToken : null;
  // Start history immediately below the newest baseline Post, covering gaps as well as older entries.
  let historyUntilId = isId(state.historyUntilId) ? state.historyUntilId : newestKnown ?? sinceId;
  let historyDeferred = false;
  let requestCount = 0, returnedPosts = 0;
  const fetchPage = async ({ since, until, token }) => {
    if (requestCount >= MAX_PAGES || returnedPosts + PAGE_SIZE > MAX_POSTS) throw new Error('Timeline run budget exhausted');
    requestCount++;
    const url = new URL('https://api.x.com/2/users/90198388/tweets');
    url.searchParams.set('max_results', String(PAGE_SIZE));
    url.searchParams.set('exclude', 'replies,retweets');
    url.searchParams.set('tweet.fields', 'article,created_at,entities');
    url.searchParams.set('expansions', 'article.cover_media');
    url.searchParams.set('media.fields', 'url,alt_text,width,height');
    if (since) url.searchParams.set('since_id', since);
    if (until) url.searchParams.set('until_id', until);
    if (token) url.searchParams.set('pagination_token', token);
    const data = await jsonFetch(fetcher, url, { headers: { authorization: 'Bearer ' + accessToken } }, 'Timeline');
    if (!data.meta || typeof data.meta !== 'object' || Array.isArray(data.meta) || (!Array.isArray(data.data) && !(data.data === undefined && data.meta.result_count === 0)) || (data.meta.next_token !== undefined && !isCursor(data.meta.next_token))) throw new Error('Timeline response invalid');
    const posts = data.data ?? [];
    if (posts.length > PAGE_SIZE || posts.some(post => !post || !isId(post.id))) throw new Error('Timeline post bounds invalid');
    returnedPosts += posts.length;
    const next = data.meta.next_token ?? null;
    if (next && next === token) throw new Error('Timeline pagination did not advance');
    return { posts, media: Array.isArray(data.includes?.media) ? data.includes.media : [], next };
  };
  const foregroundPages = historyDone ? MAX_PAGES : MAX_PAGES - 1;
  for (let page = 0; page < foregroundPages; page++) {
    const data = await fetchPage({ since: sinceId, token: paginationToken });
    for (const post of data.posts) if (!newestId || BigInt(post.id) > BigInt(newestId)) newestId = post.id;
    includeArticles(records, normalizeFeed(data.posts, data.media, now).articles);
    paginationToken = data.next;
    if (!paginationToken) break;
  }
  if (!historyUntilId) historyUntilId = newestId;
  if (!historyDone && historyUntilId) {
    try {
      const data = await fetchPage({ until: historyUntilId, token: historyToken });
      includeArticles(records, normalizeFeed(data.posts, data.media, now).articles);
      historyToken = data.next;
      historyDone = !historyToken;
    } catch (error) {
      // Never starve fresh discovery because a historical cursor/provider failed.
      historyDeferred = true;
      if (error.status === 400 && historyToken) historyToken = null;
    }
  } else if (!historyUntilId) historyDone = true;
  const articles = sortedArticles(records);
  await putFeed(kv, { schemaVersion: 1, updatedAt: now.toISOString(), articles });
  // Both progress tracks commit only after all successfully discovered content is durable.
  await kv.put(SYNC_KEY, JSON.stringify({ sinceId: paginationToken ? sinceId : newestId ?? sinceId, nextToken: paginationToken, newestId: paginationToken ? newestId : null, historyUntilId, historyToken, historyDone }));
  return { synced: true, count: articles.length, historyDeferred };
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
  async scheduled(controller, env, ctx) { ctx.waitUntil(syncArticles(env).then(result => { if (!result.synced) console.warn('X article sync not configured; serving cached articles.'); else if (result.historyDeferred) console.warn('X article history deferred; fresh discovery remains available.'); }).catch(() => console.error('X article sync failed; serving cached articles.'))); }
};
