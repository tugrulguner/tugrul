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
  const validate = (payload) => {
    if (!payload || payload.schemaVersion !== 1 || !Array.isArray(payload.articles)) return [];
    const seen = new Set();
    return payload.articles.filter((item) => {
      if (!item || typeof item.id !== 'string' || !/^\d{15,20}$/.test(item.id) || seen.has(item.id) ||
          typeof item.title !== 'string' || !item.title.trim() || item.title.length > 240 ||
          typeof item.excerpt !== 'string' || !item.excerpt.trim() || item.excerpt.length > 1200 ||
          !validDate(item.publishedAt) || !safeUrl(item.url, true) || new URL(item.url).pathname !== `/i/article/${item.id}`) return false;
      if (item.cover && (!safeUrl(item.cover.url) || typeof item.cover.alt !== 'string' ||
          !Number.isInteger(item.cover.width) || item.cover.width < 1 || item.cover.width > 10000 ||
          !Number.isInteger(item.cover.height) || item.cover.height < 1 || item.cover.height > 10000)) return false;
      seen.add(item.id); return true;
    }).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 6);
  };
  const excerptLabel = (value) => {
    const text = value.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim();
    if (/[.!?…]$/.test(text)) return text;
    const sentence = text.match(/^[\s\S]*[.!?](?=\s)/)?.[0];
    return sentence && sentence.length >= 60 ? sentence : text.replace(/\s+\S*$/, '') + '…';
  };
  const dateLabel = (date) => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(date));
  const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text !== undefined) node.textContent = text; return node; };
  const articleLink = (article, text, cls) => { const a = el('a', [cls, 'ph-no-autocapture'].filter(Boolean).join(' '), text); a.href = article.url; a.dataset.posthogEvent = 'x_article_clicked'; a.dataset.posthogContent = article.id; a.dataset.posthogSurface = 'x_articles'; return a; };
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
    const layout = el('div', 'x-article-layout');
    const featured = el('article', 'x-featured'); featured.dataset.articleId = articles[0].id;
    if (articles[0].cover) { const cover = articleLink(articles[0], '', 'x-cover-link'); cover.setAttribute('aria-label', `Read ${articles[0].title}`); const img = makeImage(articles[0]); if (img) cover.append(img); featured.append(cover); }
    const copy = el('div', 'x-featured-copy'); copy.append(makeTime(articles[0]));
    const heading = el('h4'); heading.append(articleLink(articles[0], articles[0].title)); copy.append(heading, el('p', '', excerptLabel(articles[0].excerpt)), articleLink(articles[0], 'Read article ↗', 'x-read-link')); featured.append(copy); layout.append(featured);
    if (articles.length > 1) {
      const list = el('ol', 'x-recent');
      for (const article of articles.slice(1)) {
        const item = el('li'); item.dataset.articleId = article.id;
        if (article.cover) { const cover = articleLink(article, '', 'x-recent-cover'); cover.tabIndex = -1; cover.setAttribute('aria-hidden', 'true'); const img = makeImage(article, true); if (img) cover.append(img); item.append(cover); }
        const body = el('div'); body.append(makeTime(article)); const heading = el('h4'); heading.append(articleLink(article, article.title)); body.append(heading, el('p', '', excerptLabel(article.excerpt))); item.append(body); list.append(item);
      }
      layout.append(list);
    }
    section.querySelector('.x-article-layout')?.replaceWith(layout);
    section.dataset.feedState = 'live';
  };
  fetch('/api/x-articles', { headers: { Accept: 'application/json' }, cache: 'no-store' })
    .then((response) => { if (!response.ok) throw new Error('Article feed unavailable'); return response.json(); })
    .then((payload) => { const articles = validate(payload); if (articles.length) render(articles); })
    .catch(() => { section.dataset.feedState = 'seed'; });
})();
