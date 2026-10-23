# Science newsletter presentation

The Writing section contains three independent publication shelves. **Passionately Curious** identifies the science newsletter only. X Articles and Medium personal essays are siblings, not sections of the newsletter.

The newsletter uses the same paper/serif/terracotta editorial vocabulary as X Articles: one lead issue with a full real cover and a compact recent-issue list. Its subscription action stays next to the publication heading, above the issues on desktop and mobile. All three published issues remain available without JavaScript.

## Verified source

`public/science-issues.json` is the curated source. The three records were verified against Beehiiv's published-post inventory and individual post metadata: published status, free audience, web visibility, exact title/subtitle, scheduled publication timestamp, canonical URL and thumbnail asset. No drafts, subscriber data or editor links are included.

The canonical slug `when-learning-happens-all-at-oncest` is intentional: preserve the provider's actual URL rather than correcting its spelling. Existing analytics content identifiers remain unchanged.

`public/newsletter/*.webp` contains local 1280×720 derivatives of the actual published thumbnails. The renderer preserves the complete 16:9 cover, including embedded labels, without an authenticated browser request to Beehiiv.

This is a presentation redesign and a bundled snapshot, **not a new daily Beehiiv ingestion service**. It does not change the existing X sync implementation, schedule, authentication, private KV or secret setup.

## Generate and verify

```sh
npm run science:seed
npm run science:check
npm run check
npm run articles:build
```

The deterministic generator replaces only the marked science section. CI rejects drift from the source and tests escaping and unchanged adjacent X/essay markup. Browser checks exercise all newsletter click events, no-JavaScript content, sibling publication identities, complete covers, subscription placement, 44px headline/CTA targets and layouts at 320, 390, 768 and 1440px. Narrow screens use compact recent entries; their full published subtitles remain in the source/HTML.
