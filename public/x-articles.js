(() => {
  'use strict';
  const section = document.getElementById('x-articles');
  if (!section) return;
  const safeUrl = (value, article = false) => {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
      return article ? url.hostname === 'x.com' && /^\/i\/article\/[0-9]+\/?$/.test(url.pathname) : url.hostname === 'pbs.twimg.com' && /^\/media\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/i.test(url.pathname);
    } catch { return false; }
  };
  const validDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value));
  const safeSubstack = value => {
    try { const u = new URL(value); return typeof value === 'string' && u.origin === 'https://tugrulguner.substack.com' && !u.username && !u.password && !u.port && !u.search && !u.hash && /^\/p\/[a-z0-9-]{1,180}$/.test(u.pathname) && u.href === value; }
    catch { return false; }
  };
  const validate = (payload) => {
    if (!payload || payload.schemaVersion !== 1 || !Array.isArray(payload.articles)) return [];
    const seen = new Set();
    return payload.articles.filter((item) => {
      if (!item || typeof item.id !== 'string' || !/^\d{15,20}$/.test(item.id) || seen.has(item.id) ||
          typeof item.title !== 'string' || !item.title.trim() || item.title.length > 240 ||
          typeof item.excerpt !== 'string' || !item.excerpt.trim() || item.excerpt.length > 1200 ||
          !validDate(item.publishedAt) || !safeUrl(item.url, true) || new URL(item.url).pathname !== `/i/article/${item.id}`) return false;
      if (item.substackUrl !== undefined && !safeSubstack(item.substackUrl)) return false;
      if (item.cover && (!safeUrl(item.cover.url) || typeof item.cover.alt !== 'string' ||
          !Number.isInteger(item.cover.width) || item.cover.width < 1 || item.cover.width > 10000 ||
          !Number.isInteger(item.cover.height) || item.cover.height < 1 || item.cover.height > 10000)) return false;
      seen.add(item.id); return true;
    }).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 100);
  };
  let baseline = [];
  try { baseline = validate(JSON.parse(section.querySelector('[data-article-baseline]')?.textContent || 'null')); } catch { /* existing HTML stays usable */ }
  const excerptLabel = (value) => {
    const text = value.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim();
    if (/[.!?…]$/.test(text)) return text;
    const sentence = text.match(/^[\s\S]*[.!?](?=\s)/)?.[0];
    return sentence && sentence.length >= 60 ? sentence : text.replace(/\s+\S*$/, '') + '…';
  };
  const dateLabel = (date) => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(date));
  const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text !== undefined) node.textContent = text; return node; };
  const articleLink = (article, text, cls, platform = 'primary') => { const a = el('a', [cls, 'ph-no-autocapture'].filter(Boolean).join(' '), text); const url = platform !== 'x' && article.substackUrl ? article.substackUrl : article.url; a.href = url; a.dataset.posthogEvent = url === article.url ? 'x_article_clicked' : 'substack_article_clicked'; a.dataset.posthogContent = article.id; a.dataset.posthogSurface = url === article.url ? 'x_articles' : 'ai_articles'; return a; };
  const readingLinks = article => { const actions = el('div', 'article-reading-links'); if (article.substackUrl) actions.append(articleLink(article, 'Read on Substack ↗', 'x-read-link')); actions.append(articleLink(article, 'Read on X ↗', 'x-read-link', 'x')); return actions; };
  const makeImage = (article, decorative = false) => {
    if (!article.cover) return null;
    const img = el('img', decorative ? '' : 'x-cover'); img.src = article.cover.url; img.alt = decorative ? '' : article.cover.alt;
    img.width = article.cover.width; img.height = article.cover.height; img.loading = 'lazy';
    img.addEventListener('error', () => img.closest('.x-cover-link, .x-recent-cover')?.remove(), { once: true });
    return img;
  };
  const makeTime = (article) => { const time = el('time', '', dateLabel(article.publishedAt)); time.dateTime = article.publishedAt; return time; };
  const render = (articles) => {
    if (!articles.length) return;
    const active = document.activeElement;
    const archiveWasOpen = section.querySelector('.x-archive')?.open ?? false;
    const summaryWasFocused = active === section.querySelector('.x-archive summary');
    const layout = el('div', 'x-article-layout');
    const featured = el('article', 'x-featured'); featured.dataset.articleId = articles[0].id;
    if (articles[0].cover) { const cover = articleLink(articles[0], '', 'x-cover-link'); cover.setAttribute('aria-label', `Read ${articles[0].title}`); const img = makeImage(articles[0]); if (img) cover.append(img); featured.append(cover); }
    const copy = el('div', 'x-featured-copy'); copy.append(makeTime(articles[0]));
    const heading = el('h4'); heading.append(articleLink(articles[0], articles[0].title)); copy.append(heading, el('p', '', excerptLabel(articles[0].excerpt)), readingLinks(articles[0])); featured.append(copy); layout.append(featured);
    if (articles.length > 1) {
      const list = el('ol', 'x-recent');
      for (const article of articles.slice(1, 6)) {
        const item = el('li'); item.dataset.articleId = article.id;
        if (article.cover) { const cover = articleLink(article, '', 'x-recent-cover'); cover.tabIndex = -1; cover.setAttribute('aria-hidden', 'true'); const img = makeImage(article, true); if (img) cover.append(img); item.append(cover); }
        const body = el('div'); body.append(makeTime(article)); const heading = el('h4'); heading.append(articleLink(article, article.title)); body.append(heading, el('p', '', excerptLabel(article.excerpt)), readingLinks(article)); item.append(body); list.append(item);
      }
      layout.append(list);
    }
    section.querySelector('.x-article-layout')?.replaceWith(layout);
    section.querySelector('.x-archive')?.remove();
    if (articles.length > 6) {
      const archive = el('details', 'x-archive'); archive.open = archiveWasOpen;
      archive.append(el('summary', '', 'Older articles'));
      const list = el('ol', 'x-archive-list');
      for (const article of articles.slice(6)) {
        const item = el('li'); item.dataset.articleId = article.id;
        item.append(makeTime(article), articleLink(article, article.title), readingLinks(article)); list.append(item);
      }
      archive.append(list); section.append(archive);
    }
    if (active && !active.isConnected) {
      const replacement = summaryWasFocused ? section.querySelector('.x-archive summary') : [...section.querySelectorAll('a')].find(link => link.href === active.href && link.textContent === active.textContent);
      replacement?.focus({ preventScroll: true });
    }
    section.dataset.feedState = 'live';
  };
  fetch('/api/articles', { headers: { Accept: 'application/json' }, cache: 'no-store' })
    .then((response) => { if (!response.ok) throw new Error('Article feed unavailable'); return response.json(); })
    .then((payload) => {
      const articles = validate(payload);
      if (!articles.length) return;
      const records = new Map(baseline.map(article => [article.id, article]));
      for (const article of articles) records.set(article.id, { ...article, ...(baseline.find(a => a.id === article.id)?.substackUrl && !article.substackUrl ? { substackUrl: baseline.find(a => a.id === article.id).substackUrl } : {}) });
      render([...records.values()].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 100));
    })
    .catch(() => { section.dataset.feedState = 'seed'; });
})();
