# Tugrul Guner

Source for [tugrul.modepot.io](https://tugrul.modepot.io/): Tugrul Guner’s professional chronology, open-source work, research record, newsletter, and downloadable resume.

## Local development

```bash
npm install
npm run check
npm run preview
```

## Profile sources

- Career source: `career-data.json` is the canonical structured record for role titles, employers, dates, locations, detailed website bullets, and deliberately concise resume bullets.
- Rebuild all generated profile surfaces with `npm run career:build` after editing it. This regenerates the detailed website timeline, `public/llms.txt` career section, public `career.json`, and the one-page PDF.
- `npm run career:check` detects stale generated career surfaces and validates the PDF's page count, role/date coverage, and outcomes. `npm run check` includes those gates and the website checks.
- Career document dependencies are pinned in `requirements-career.txt`. Deployment installs them and regenerates/checks the resume before publishing.
- Resume: `public/tugrul-guner-resume.pdf` (generated; do not edit directly)
- Google Scholar: `https://scholar.google.com.tr/citations?user=RznlT4AAAAAJ&hl=en`
- Newsletter: `https://tugrulguner.beehiiv.com/`

## X Article showcase

The Writing section uses a real-article seed and a cached Worker/KV feed, with bounded, Article-URL-filtered full-archive search once daily at 09:00 EST (14:00 UTC, fixed standard time) and independent older matching-history backfill within the same 60-Post cap. All verified entries remain accessible through the “Older articles” disclosure. Regenerate the no-JavaScript baseline with `npm run articles:seed`; CI checks it for drift. No paid Workers plan is configured. Production sync needs one encrypted `X_BEARER_TOKEN` secret from the existing X app; no new app or user OAuth flow is required. Local xurl login does not automatically provision it. The previous OAuth path remains optional compatibility. See [setup, cost bounds and verification](docs/x-articles.md). Run `npm run articles:check` and `npm run articles:build` before deployment.

## Deployment

```bash
npm run deploy
```

The Cloudflare Worker is `tugrul-site`; its custom domain is `tugrul.modepot.io`.
