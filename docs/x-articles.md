# X Article showcase and daily sync

The personal site shows one lead Article and up to five recent entries, with the remaining inventory accessible through a native “Older articles” disclosure. All nine verified Articles are retained, using real published titles, covers, dates and excerpts. Passionately Curious and Medium remain separate. The bundled HTML and `public/x-articles.json` provide the complete verified nine-article baseline without JavaScript; one same-origin `/api/x-articles` request reconciles newer cached content per visit. Both the Worker and browser merge snapshots with the verified baseline, so an older three-entry cache cannot hide the recovered records. The browser preserves an opened archive and keyboard focus during late reconciliation. API errors, malformed/empty responses and unsafe links retain the baseline. This does not embed X or poll X from a visitor's browser. Images are loaded from X's public image CDN, not the authenticated X API.

## Runtime and schedule

The existing `tugrul-site` Worker serves static assets normally and runs code for `/api/x-articles` paths. `GET /api/x-articles` returns a validated public snapshot from Workers KV, or the bundled seed if storage is absent/corrupt/unavailable. HTTP cache headers advertise a 60-second browser and five-minute shared-cache lifetime; the durable snapshot itself is in KV. There is no public refresh endpoint, so visitors cannot trigger billed provider reads.

`wrangler.jsonc` declares one daily Cron Trigger: `0 9 * * *` (09:00 UTC). Building or running locally does not activate a production schedule. No paid Workers configuration or paid-plan upgrade is included. Free-plan CPU limits still need confirmation on the deployed runtime; local workerd tests and a deploy dry-run are not a production CPU measurement.

The `ARTICLES_KV` binding uses Wrangler automatic provisioning instead of a fabricated namespace ID. On an authorized deployment, Wrangler can create/reuse the namespace. The deployment token must allow Workers KV provisioning as well as Worker deployment. Verify that permission before merging into an auto-deploying branch.

Private KV keys:

- `x-articles:feed`: validated public feed (schema 1, at most 100 entries / 256 KB).
- `x-articles:oauth`: access token, rotated refresh token and access expiry. Never exposed by a route.
- `x-articles:sync-state`: independent fresh-discovery and historical-pagination watermarks, continuation tokens and completion state. Never exposed by a route.

## Incremental discovery and cost bounds

The account is fixed to `90198388` (`@Tugrul_Guner`). The sync excludes replies/retweets and requests Article metadata with `expansions=article.cover_media`. Article IDs come from their actual expanded Article URLs; the publishing Post ID is a separate value.

Each run requests at most three pages of 20 Posts: the existing 60-returned-Post ceiling is unchanged. While history is incomplete, fresh discovery runs first with at most two pages; one page is reserved for a separate historical traversal. Once history is exhausted, fresh discovery can use all three pages. Bootstrap uses the newest known publishing Post as the fresh `since_id` boundary, and an independent stable `until_id` boundary immediately below that Post for history, covering gaps as well as earlier Articles. Existing checkpoints migrate to add a history track without advancing their unseen fresh pages.

After a complete fresh traversal, the highest observed Post ID (including ordinary posts) becomes the next `since_id`. Genuine zero-result responses are valid. Historical pagination stops only when the provider has no next token. A historical failure preserves its progress, does not prevent publishing newly found Articles, and is retried on a later run; an expired historical token is reset within the same historical boundary without skipping content. Both cursors commit only after feed publication. A capped fresh backlog can delay later fresh records, but older-history traversal never consumes its reserved discovery budget.

Newly returned records update their existing Article entry and retain an existing valid cover if X omits it. This is incremental discovery, not a daily full audit of old content: edits/deletions to old Posts not returned by the incremental API are not automatically reconciled. A deliberate rescan of edits/deletions requires resetting the appropriate sync checkpoint; do not describe every old Article as continuously verified.

Typical one-page discovery returns at most 20 Posts, and often fewer. Billing is per returned resource, including non-Article posts. The cap is a request/resource bound, not a dollar limit. See [X pricing](https://docs.x.com/x-api/getting-started/pricing) for Owned Read eligibility and current rates; use the provider's account spending limit as the hard billing backstop. Website visits do not cause X API reads. Workers/KV free allowances are shared with other account usage.

## Secure production activation

Local `xurl` authentication is not automatically available inside a deployed Worker. Never read/copy its credential file through an agent or put tokens in chat. After the feature is approved for deployment, provision a dedicated confidential OAuth 2.0 app authorization for the intended account with `tweet.read users.read offline.access`. Obtain its refresh token through the provider's authorization flow outside the agent session.

Enter the following Worker secrets interactively, outside chat:

```sh
npx wrangler secret put X_CLIENT_ID
npx wrangler secret put X_CLIENT_SECRET
npx wrangler secret put X_REFRESH_TOKEN
```

These commands modify the deployed Worker; do not run them as part of an unapproved build. The first successful refresh stores the rotated refresh token privately in KV. Access tokens are reused until near expiry. Do not share one rotating refresh-token chain with another consumer such as local xurl. If configuration is absent, Cron makes no provider calls and serves the seed/last successful snapshot. OAuth renewal is covered by deterministic tests, but has not been live-provisioned for production.

Failures retain last successful content and produce fixed, credential-free Worker log messages. Provider requests reject redirects, have a 15-second fetch deadline, and stream at most 512 KB before parsing JSON. There is no public metered admin route. Local credential files are ignored by git.

## Verification and operation

```sh
npm ci
npx playwright install chromium
npm run check
npm run articles:build  # deploy dry-run only; no publication or provisioning
npm run preview        # local assets, Worker and KV
```

The suite exercises actual workerd HTTP routes, native local KV writes/readback, the scheduled callback with absent secrets, provider-response validation, OAuth rotation, incremental cursor durability, and responsive browser behavior. Unit provider fixtures are labeled tests; `tests/fixtures/x-article-real-provider.json` preserves sanitized captured metadata with no fabricated Article IDs.

The corrected inventory was verified through five provider-available timeline pages: 454 returned Posts, nine unique Articles with matching covers, and no final continuation token. This is the provider-available timeline, not a claim about material outside provider retention. A sanitized fixture retains the nine Article records and ordinary Post IDs for an end-to-end pagination replay: starting from the former three-item seed, bounded sync recovers all nine and terminates history without increasing the read ceiling. These recorded-provider tests do not claim live Cloudflare OAuth activation. Before calling automatic production sync operational, verify secure authorization, a successful scheduled invocation, and a later published Article appearing at the public endpoint and page.

Run `npm run articles:seed` after updating the verified `public/x-articles.json` baseline. The generator replaces only the bounded Article section and CI rejects drift between that JSON and no-JavaScript HTML. It escapes source text, including inert baseline JSON embedded for safe browser reconciliation. The static no-JavaScript baseline is deliberately a bundled snapshot. New daily entries appear through the cached JSON endpoint and browser reconciliation, not through a daily rewrite of source HTML. Clicks on static and refreshed article links use `x_article_clicked` with public Article ID, destination and `surface=x_articles`; marked links suppress duplicate autocapture. No credentials, private text or campaign query strings are captured.
