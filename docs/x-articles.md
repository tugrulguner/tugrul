# X Article showcase and daily sync

The personal site shows one lead article and up to five recent entries, with the remainder accessible through an “Older articles” disclosure. The bundled seed contains 12 verified X articles; four have verified Substack counterparts. Each story appears once with its original X date. Paired stories link primarily to Substack and offer a separate X reading action. Both destinations work in static HTML without JavaScript. Passionately Curious and Medium remain separate and unchanged. One same-origin `/api/articles` request reconciles newer cached content; visitors never trigger provider requests. Images use X's public image CDN.

## Runtime and schedule

The profile presents AI and agentic-systems writing as one shelf. `worker/substack-pairs.json` is the sole editable pairing manifest. After manually publishing a cross-post in Substack's official editor, confirm the X Article ID and the exact canonical Substack URL, then add `{ "xArticleId": "…", "substackUrl": "https://tugrulguner.substack.com/p/…" }`. Run `npm run articles:seed` to regenerate both the static shelf and the Worker module, then `npm run check`; CI rejects generated-module drift. Commit/deploy this data with the site. New pairings require this explicit step: RSS does not automatically match titles, add unselected posts, or publish between platforms. Unknown RSS entries, including the older science posts, are excluded.

The daily handler independently checks the official `https://tugrulguner.substack.com/feed` and updates only declared pairs in `substack:feed`. Saxes parses XML locally; it is a parsing library, not a Substack integration service. DTDs are forbidden, redirects rejected, time limited to 10 seconds, and streamed bytes capped at 512 KB. RSS status/title/check timestamps are stored separately from the X snapshot. `substackAvailable` means present in the current rolling RSS window, not whether the article URL is live. Absence from that window retains the verified reading link and last-known title; source failures retain the previous cache. Corrupt cache falls back to the declared pairings.

`GET /api/articles` serves the combined cached/bundled snapshot; `GET /api/x-articles` preserves its original X-only schema. Neither performs an external fetch. There is no public refresh route. Public readers never trigger paid X reads or Substack ingestion.


`wrangler.jsonc` declares one daily Cron Trigger: `0 14 * * *` (09:00 EST / 14:00 UTC, fixed UTC−05:00 year-round; this does not shift with daylight saving time). Building or running locally does not activate a production schedule. No paid Workers configuration or paid-plan upgrade is included. Free-plan CPU limits still need confirmation on the deployed runtime; local workerd tests and a deploy dry-run are not a production CPU measurement.

The `ARTICLES_KV` binding uses Wrangler automatic provisioning instead of a fabricated namespace ID. On an authorized deployment, Wrangler can create/reuse the namespace. The deployment token must allow Workers KV provisioning as well as Worker deployment. Verify that permission before merging into an auto-deploying branch.

Private KV keys:

- `x-articles:feed`: validated public feed (schema 1, at most 100 entries / 256 KB).
- `x-articles:oauth`: optional legacy user OAuth access/refresh tokens and expiry; not read or written in app-only Bearer mode. Never exposed by a route.
- `x-articles:sync-state`: independent fresh-discovery and historical-pagination watermarks, continuation tokens and completion state. Never exposed by a route.

## Incremental discovery and cost bounds

Discovery uses only `GET https://api.x.com/2/tweets/search/all` with the fixed query `from:Tugrul_Guner url:"https://x.com/i/article/" -is:retweet -is:reply`, requesting Article metadata and `expansions=article.cover_media`. It does not call the ordinary account timeline or fall back to scanning it when search fails. The query is fixed in server code; rename it deliberately if the author changes handle. X documents Article draft/publish endpoints, not an account-Article listing endpoint. Article IDs come from their actual expanded Article URLs; the publishing Post ID is a separate value.

Each run requests at most three pages of 20 matching Posts: the existing 60-returned-Post ceiling is unchanged. While history is incomplete, fresh discovery runs first with at most two pages; one page is reserved for a separate historical traversal. Once history is exhausted, fresh discovery can use all three pages. Bootstrap uses the newest known publishing Post as the fresh `since_id` boundary, and an independent stable `until_id` boundary immediately below that Post for older search matches. Search pagination uses `next_token`, not the timeline API’s `pagination_token`. Private checkpoints are tagged `source=article-search-v1`; incompatible timeline cursors and watermarks are discarded while the validated feed/baseline is retained. The replacement search checkpoints commit only after successful content publication.

After a complete fresh traversal, the highest observed Post ID (including matching references without Article metadata) becomes the next `since_id`. Genuine zero-result responses are valid. Historical pagination stops only when the provider has no next token. A historical failure preserves its progress, does not prevent publishing newly found Articles, and is retried on a later run; an expired historical token is reset within the same historical boundary without skipping content. Both cursors commit only after feed publication. A capped fresh backlog can delay later fresh records, but older-history traversal never consumes its reserved discovery budget.

Newly returned records update their existing Article entry and retain an existing valid cover if X omits it. This is incremental discovery, not a daily full audit of old content: edits/deletions to old Posts not returned by the incremental API are not automatically reconciled. A deliberate rescan of edits/deletions requires resetting the appropriate sync checkpoint; do not describe every old Article as continuously verified.

Typical one-page discovery returns at most 20 matching Posts, and often fewer or zero. Search can include duplicate shares or ordinary references; validate Article metadata, deduplicate canonical Article IDs, and do not let an older matching reference overwrite newer publication metadata. Billing is per returned resource, not unique Article. The cap is a request/resource bound, not a dollar limit. Search may not qualify for discounted timeline Owned Read pricing: verify current [X pricing](https://docs.x.com/x-api/getting-started/pricing) and use the provider’s account spending limit as the hard billing backstop. Website visits do not cause X API reads. Workers/KV free allowances are shared with other account usage.

## Secure production activation

### Preferred: one app-only Bearer secret

Public Article search supports app-only Bearer authentication. Reuse the existing X developer app; a separate app, OAuth browser callback, Client ID/Secret pair and user refresh token are not required for this mode. Obtain its **app-only Bearer Token** from the app's Keys and Tokens section or your password manager—not an API Key, OAuth Client ID, or the rotating user access token managed by xurl. Avoid regenerating/revoking a token used by other consumers without checking first.

After the Bearer-capable Worker is approved and deployed, enter the value in Cloudflare's encrypted secret form or run the following **in your own terminal, outside the agent/chat**, from this repository:

```sh
npx wrangler secret put X_BEARER_TOKEN --name tugrul-site
npx wrangler secret list --name tugrul-site
```

The first command modifies the deployed Worker and prompts for the secret; never place the value inline in a command, commit it, paste it into chat, or read it from `~/.xurl` through an agent. The second command verifies names/types only. Use a Worker **Secret**, not a plaintext environment variable. Do not URL-decode, re-encode or trim the token in application code; paste the exact token value without surrounding whitespace.

When `X_BEARER_TOKEN` is configured, it takes precedence. The Worker neither reads nor writes `x-articles:oauth`, calls the OAuth token endpoint, nor falls back to user OAuth if the Bearer is rejected. Empty, non-string, whitespace-containing or oversized explicit Bearer configuration fails closed with credential-free logging. A revoked/invalid token leaves the last successful feed intact. The token remains in the Worker secret store, not KV, the browser or public feed. Rotate it deliberately if revoked or compromised; there is no user-token refresh chain in this mode.

Actual app-only provider authorization remains an activation gate until the real secret is installed and a provider-backed Worker run succeeds. Existing local xurl/OAuth integration evidence does not prove the app-only token's access or billing eligibility.

### Optional legacy OAuth compatibility

If `X_BEARER_TOKEN` is absent, the original user-context OAuth path remains supported with private `X_CLIENT_ID`, `X_CLIENT_SECRET` and `X_REFRESH_TOKEN` secrets. It persists rotated access/refresh tokens and expiry in `x-articles:oauth`. Do not share another consumer's rotating refresh-token chain. These legacy credentials are not needed for the preferred app-only setup, and this update does not delete them or their private KV value. Removing the Bearer secret re-enables this fallback if legacy credentials are present.

If neither authentication method is configured, Cron makes no provider calls and serves the seed/last successful snapshot. Secret creation is a separate authorized operation, not part of a build/dry-run.

Failures retain last successful content and produce fixed, credential-free Worker log messages. Provider requests use Worker-supported `redirect: manual` and reject every non-2xx response (including redirects), have a 15-second fetch deadline, and stream at most 512 KB before parsing JSON. There is no public metered admin route. Local credential files are ignored by git.

## Verification and operation

```sh
npm ci
npx playwright install chromium
npm run check
npm run articles:build  # deploy dry-run only; no publication or provisioning
npm run preview        # local assets, Worker and KV
```

The suite exercises actual workerd HTTP routes, native local KV writes/readback, the scheduled callback with absent secrets, provider-response validation, app-only Bearer precedence/privacy, optional OAuth rotation, incremental cursor durability, and responsive browser behavior. Unit provider fixtures are labeled tests; `tests/fixtures/x-article-real-provider.json` preserves sanitized captured metadata with no fabricated Article IDs.

The corrected inventory was verified through five provider-available timeline pages: 454 returned Posts, nine unique Articles with matching covers, and no final continuation token. This is the provider-available timeline, not a claim about material outside provider retention. A separate real full-archive search probe matched the same nine Articles using nine returned Posts across three response pages, including the terminal empty page. Sanitized search captures drive a replay starting from the old three-item seed, recovering all nine via eight older matching records without scanning the 445 irrelevant ordinary Posts. A live local signing-adapter test also exercised the actual sync functions: nine Articles retained, historical search completed, then one incremental search returning zero new Posts. Matching references/duplicates can make returned-Post counts differ by query/page size; that local run returned 11 historical matches, not nine unique new Articles. These probes do not claim live Cloudflare Worker OAuth activation. Before calling automatic production sync operational, verify secure authorization, a successful scheduled invocation, and a later published Article appearing at the public endpoint and page.

Run `npm run articles:seed` after updating the verified `public/x-articles.json` baseline. The generator replaces only the bounded Article section and CI rejects drift between that JSON and no-JavaScript HTML. It escapes source text, including inert baseline JSON embedded for safe browser reconciliation. The static no-JavaScript baseline is deliberately a bundled snapshot. New daily entries appear through the cached JSON endpoint and browser reconciliation, not through a daily rewrite of source HTML. Clicks on static and refreshed article links use `x_article_clicked` with public Article ID, destination and `surface=x_articles`; marked links suppress duplicate autocapture. No credentials, private text or campaign query strings are captured.
