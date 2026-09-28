# Tugrul Guner

Source for [tugrul.modepot.io](https://tugrul.modepot.io/): Tugrul Guner’s personal story, selected open-source work, and professional profile.

## Local development

```bash
npm install
npm run check
npm run preview
```

## Resume updates

The initial site links to Tugrul’s verified LinkedIn profile. When a PDF resume is ready:

1. Add it as `public/tugrul-guner-resume.pdf`.
2. Add a “Download resume” link in the `#resume` section of `public/index.html`.
3. Update the professional chronology and rerun `npm run check`.

## Deployment

```bash
npm run deploy
```

The Cloudflare Worker is `tugrul-site`; its custom domain is `tugrul.modepot.io`.
