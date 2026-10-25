import { SaxesParser } from 'saxes';

const ORIGIN = 'https://tugrulguner.substack.com';
export const SUBSTACK_FEED_URL = `${ORIGIN}/feed`;
const ID = /^\d{15,20}$/;
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');

export function validateSubstackUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.origin === ORIGIN && !url.username && !url.password && !url.port && !url.search && !url.hash && /^\/p\/[a-z0-9-]{1,180}$/.test(url.pathname) && url.href === value;
  } catch { return false; }
}

export function validateManifest(manifest) {
  if (!Array.isArray(manifest) || manifest.length > 100) throw new Error('invalid pairing manifest');
  const ids = new Set(), urls = new Set();
  for (const pair of manifest) {
    if (!exactKeys(pair, ['xArticleId', 'substackUrl']) || typeof pair.xArticleId !== 'string' || !ID.test(pair.xArticleId) || !validateSubstackUrl(pair.substackUrl) || ids.has(pair.xArticleId) || urls.has(pair.substackUrl)) throw new Error('invalid pairing manifest');
    ids.add(pair.xArticleId); urls.add(pair.substackUrl);
  }
  return manifest;
}

// Read direct item metadata only. Description/content CDATA is never reparsed.
// Saxes checks well-formedness, entities and CDATA; DTDs are forbidden entirely.
export function parseSubstackFeed(xml, manifest, now = new Date()) {
  validateManifest(manifest);
  if (typeof xml !== 'string' || xml.length > 512000) throw new Error('RSS size invalid');
  const allowed = new Map(manifest.map(pair => [pair.substackUrl, pair]));
  const matched = new Map(), stack = [];
  let channels = 0, nodes = 0, item = null;
  const parser = new SaxesParser({ xmlns: false });
  parser.on('doctype', () => { throw new Error('DTD forbidden'); });
  parser.on('error', error => { throw error; });
  parser.on('opentag', node => {
    stack.push(node.name);
    if (++nodes > 20000 || stack.length > 64) throw new Error('RSS structure too large');
    if (stack.length === 1 && node.name !== 'rss') throw new Error('RSS root required');
    if (node.name === 'channel' && (stack.join('/') !== 'rss/channel' || ++channels !== 1)) throw new Error('invalid RSS channel');
    if (node.name === 'item') {
      if (stack.join('/') !== 'rss/channel/item') throw new Error('invalid RSS item');
      item = { fields: new Map() };
    }
    if (item && stack.length === 4 && ['title', 'link'].includes(node.name)) {
      if (item.fields.has(node.name)) throw new Error('duplicate RSS metadata');
      item.fields.set(node.name, '');
    }
  });
  const append = text => {
    if (!item || stack.length !== 4 || !['title', 'link'].includes(stack[3])) return;
    const key = stack[3], value = item.fields.get(key) + text;
    if (value.length > 4096) throw new Error('RSS metadata too long');
    item.fields.set(key, value);
  };
  parser.on('text', append);
  parser.on('cdata', append);
  parser.on('closetag', node => {
    if (node.name === 'item') {
      const url = (item.fields.get('link') || '').trim(), pair = allowed.get(url);
      if (pair) {
        if (matched.has(pair.xArticleId)) throw new Error('duplicate RSS publication');
        matched.set(pair.xArticleId, (item.fields.get('title') || '').trim().slice(0, 240));
      }
      item = null;
    }
    stack.pop();
  });
  parser.write(xml).close();
  if (channels !== 1) throw new Error('RSS channel required');
  const checkedAt = now.toISOString();
  return manifest.map(pair => ({ ...pair, title: matched.get(pair.xArticleId) || '', checkedAt, available: matched.has(pair.xArticleId) }));
}

export function validateCache(records, manifest) {
  validateManifest(manifest);
  if (!Array.isArray(records) || records.length > manifest.length) throw new Error('invalid RSS cache');
  const mapping = new Map(manifest.map(pair => [pair.xArticleId, pair.substackUrl])), seen = new Set();
  for (const record of records) {
    if (!exactKeys(record, ['xArticleId', 'substackUrl', 'title', 'checkedAt', 'available']) || typeof record.xArticleId !== 'string' || seen.has(record.xArticleId) || mapping.get(record.xArticleId) !== record.substackUrl || !validateSubstackUrl(record.substackUrl) || typeof record.title !== 'string' || record.title.length > 240 || typeof record.checkedAt !== 'string' || !Number.isFinite(Date.parse(record.checkedAt)) || typeof record.available !== 'boolean') throw new Error('invalid RSS cache');
    seen.add(record.xArticleId);
  }
  return records;
}

export function mergeSubstack(feed, rss, manifest) {
  validateCache(rss, manifest);
  if (!feed || !Array.isArray(feed.articles)) throw new Error('invalid article feed');
  const mapping = new Map(manifest.map(pair => [pair.xArticleId, pair.substackUrl]));
  const status = new Map(rss.map(record => [record.xArticleId, record]));
  return { ...feed, articles: feed.articles.map(article => {
    const url = mapping.get(article.id);
    if (!url) return article;
    const record = status.get(article.id);
    return { ...article, substackUrl: url, ...(record ? { substackTitle: record.title, substackAvailable: record.available, substackCheckedAt: record.checkedAt } : {}) };
  }) };
}
