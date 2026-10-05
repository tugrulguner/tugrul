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

## Deployment

```bash
npm run deploy
```

The Cloudflare Worker is `tugrul-site`; its custom domain is `tugrul.modepot.io`.
