# Spec: webhook-admin Edge Function + server-side alert dispatch

> **STATUS: DEFERRED — NOT IMPLEMENTED.** Parked on 2026-08-16 by user
> direction ("先把核心功能處理完畢") to prioritise the RHSA-centric core.
> The accompanying test file `webhookConfigServiceAdmin.test.ts` was removed
> to keep the suite green; recreate it from the Test charter below when this
> is picked up. **Problem 2 below (webhook alerting is dead in production) is
> a real, still-open bug** — see `docs/agent/BUG_FIX.md`.

## Task

Two coupled problems, fixed together because both require moving webhook
handling to the server:

**Problem 1 (security).** `public.webhook_configs` stores Discord/Slack/Telegram
webhook URLs, which are credential-equivalent (anyone holding one can post to
that channel). The table currently has a public `SELECT ... USING (true)` RLS
policy, so anyone with the anon/publishable key — which is embedded in the
frontend bundle and therefore public — can read every stored webhook URL.
`src/services/webhookConfigService.ts` also inserts/deletes directly with the
anon key.

**Problem 2 (dead feature).** Webhook alerting has never worked in production.
`WebhookService` (`src/services/webhook.ts`) only ever dispatches to configs
added via `registerWebhook()`, and that method is called **nowhere in
production code** — only in `src/tests/e2e/webhook-alert-flow.e2e.test.ts:12`.
In production, `SyncService` constructs an empty `WebhookService`, hands it to
`IngestionEngine`, and `notifyAll()` loops over an empty array. Configured
webhooks are saved to Supabase and then never read at dispatch time. Tests pass
only because the E2E test registers a config by hand first.

Fix: all webhook reads, writes, and dispatches move server-side into Edge
Functions using the service-role key. Webhook URLs must never be sent to the
browser.

## Contract

### New Edge Function: `src/supabase/functions/webhook-admin/index.ts`

Same skeleton as the existing `src/supabase/functions/sync-cve/index.ts` —
read that file first and match its structure: CORS headers, `OPTIONS`
short-circuit, service-role client from `SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY`, outer try/catch returning
`{ success: false, error }` with HTTP 500, and **every** Supabase
`.select()`/`.insert()`/`.delete()` call must check its returned `error` and
throw when truthy (do not silently swallow — this matches the hardening
already applied to `sync-cve`).

`POST` with JSON body `{ action, ... }`. Supported actions:

**`list`** — select all rows from `webhook_configs` ordered by `created_at`
descending. Respond `{ success: true, webhooks: [...] }` where every row has
its `webhook_url` **masked** before being returned. Masking rule: keep the
origin and a short prefix of the path, replace the rest with `***`. Implement
as: given a URL string, return `<origin>/***` (e.g.
`https://discord.com/api/webhooks/123/secret` → `https://discord.com/***`).
If the URL fails to parse, return the literal string `***`. Never return the
raw URL from any action.

**`create`** — body also has `name`, `platform`, `webhook_url`, `min_severity`,
`is_active`. Validate: `platform` must be one of `discord`, `telegram`,
`slack`; `webhook_url` must parse as a URL with an `https:` protocol;
`min_severity` must be one of `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`. On
validation failure respond HTTP 400 `{ success: false, error: "<reason>" }`.
On success insert the row (storing the **real** URL) and respond
`{ success: true, webhook: <the inserted row, with webhook_url masked> }`.

**`delete`** — body also has `id`. Delete that row. Respond `{ success: true }`.

**`test`** — body also has `id`. Load that row (real URL, server-side only),
build a canned test payload for its platform, `POST` it to the stored URL, and
respond `{ success: true, delivered: <boolean> }` where `delivered` reflects
whether the outbound POST returned an ok status. Never include the URL in the
response. If no row matches `id`, respond HTTP 404
`{ success: false, error: "Webhook not found" }`.

Any other/missing `action`: HTTP 400 `{ success: false, error: "Unsupported action" }`.

### Extend Edge Function: `src/supabase/functions/sync-cve/index.ts`

After the existing persistence steps succeed and **before** building the
success response, dispatch real alerts (this is the fix for Problem 2):

1. Select active webhook configs: `webhook_configs` where `is_active = true`.
   If none, skip dispatch entirely.
2. For each CVE in the request's `cves` array whose `severity` is `CRITICAL`
   or `HIGH`, and for each active config whose `min_severity` rank is met by
   that CVE's severity, POST an alert payload to that config's URL.
   Severity ranking: `CRITICAL`=4, `HIGH`=3, `MEDIUM`=2, `LOW`=1, `UNKNOWN`=0;
   dispatch only when `severityRank(cve) >= severityRank(config.min_severity)`
   (same rule as `src/services/webhook.ts:24-30`).
3. Find the advisory for each CVE via the request's `mappings` array (match
   `mapping.cve_id` to the cve's client-local `id`, then `mapping.advisory_id`
   to the advisory's client-local `id`) so the alert can include the advisory
   id, title, and url. If no advisory matches, still dispatch using the CVE's
   own fields and omit advisory-specific ones.
4. Alert dispatch must never fail the request: wrap the whole dispatch block in
   its own try/catch, and wrap each individual outbound POST in a try/catch so
   one unreachable webhook cannot abort the rest. Count successes.
5. Include `alertsDispatched: <count>` in the existing success response body
   alongside the current fields. Do not otherwise change the response shape.

**Payload format.** Deno cannot resolve this project's `@/` path alias, so do
not try to import `src/formatters/`. Write minimal inline payload builders in
the edge function, one per platform, matching the shape each service expects:
Discord → `{ content: string }` (or an `embeds` array if you prefer, but keep
it simple and valid); Slack → `{ text: string }`; Telegram →
`{ text: string, parse_mode: 'HTML' }` — note Telegram's real API also needs a
`chat_id`, so if the stored URL does not already encode one, just POST the
text payload and let `delivered` reflect the result. Include at minimum: CVE
id, severity, CVSS score when present, advisory id and URL when known, and a
one-line summary. This intentionally duplicates a little formatting logic
rather than sharing `src/formatters/` across the Node/Deno boundary — that
duplication is accepted; do not refactor `src/formatters/`.

### Frontend: `src/services/webhookConfigService.ts`

Rewrite all four methods to call `supabase.functions.invoke('webhook-admin', { body: { action, ... } })`:

- `fetchWebhooks()` → `action: 'list'`; return `data.webhooks` mapped to
  `WebhookConfig[]` (the `webhook_url` will already be masked — keep it as-is,
  it is display-only now). On `error`, `console.warn` and return `[]` (match
  the current failure behaviour).
- `createWebhook(webhook)` → `action: 'create'` plus the webhook fields.
  Return the returned (masked) webhook, or `null` on error.
- `deleteWebhook(id)` → `action: 'delete', id`. Return `true`/`false`.
- `testWebhook(webhook)` → `action: 'test', id: webhook.id`. Return
  `data?.delivered === true`. It must **not** POST to the webhook URL from the
  browser, and must not import or use `WebhookService`.

Remove the now-unused `private webhookDispatcher` field and the
`@/services/webhook` import from this file.

### Frontend: `src/services/syncService.ts`

`SyncService` currently constructs `new WebhookService()` and passes it into
`IngestionEngine`, which is what produced the silent no-op dispatch. Since
dispatch is now server-side, stop wiring it: remove the
`private webhookService = new WebhookService()` field and the
`{ webhookService: this.webhookService }` argument, constructing
`new IngestionEngine()` with no options in both `syncVendors()` and
`fetchAndIngestQuery()`. Remove the now-unused `@/services/webhook` import.

Do **not** delete `src/services/webhook.ts` or change `src/engine/ingestion.ts`
— `IngestionEngine`'s `webhookService` option stays optional and the existing
E2E test keeps using it directly. Only stop wiring it in production.

## Files
- `src/supabase/functions/webhook-admin/index.ts` (new)
- `src/supabase/functions/sync-cve/index.ts` (extend with dispatch step)
- `src/services/webhookConfigService.ts` (rewrite the four methods)
- `src/services/syncService.ts` (unwire WebhookService only)
- `src/tests/unit/services/webhookConfigServiceAdmin.test.ts` (already written
  and currently RED — make it pass; do not weaken its assertions)

Do not touch: `src/services/webhook.ts`, `src/formatters/*`,
`src/engine/ingestion.ts`, `src/types/index.ts`, any page or component, any
SQL migration file, `src/tests/e2e/*`.

## Verify
From `src/`: `npm run test:unit -- webhookConfigServiceAdmin` must pass, then
`npm test` (full suite, currently 58 passing) must still pass, then
`npm run build` must succeed. Report the exact output of all three.

## Non-goals
- Do not add authentication/login. It is understood and accepted that without
  auth anyone can still *call* these edge functions to create/delete configs;
  the goal here is that stored webhook URLs can no longer be *read* out.
- Do not change the RLS policies yourself — the main session applies the
  migration after reviewing this change.
- Do not deploy the edge functions — the main session deploys and live-verifies.
- Do not touch the CVE/RHSA data-model work (separate follow-up task).

## Test charter
| Case | Expected outcome | Layer / file |
| --- | --- | --- |
| `fetchWebhooks()` calls edge function `action: 'list'`, never `.from('webhook_configs')` | invoke called, no direct table read | unit / `webhookConfigServiceAdmin.test.ts` |
| `createWebhook()` calls edge function `action: 'create'` | invoke called with matching body | unit / `webhookConfigServiceAdmin.test.ts` |
| `deleteWebhook(id)` calls edge function `action: 'delete'` with the id | invoke called with matching body | unit / `webhookConfigServiceAdmin.test.ts` |
| `testWebhook()` dispatches server-side, browser never POSTs the URL | invoke called with `action: 'test'`; `global.fetch` not called | unit / `webhookConfigServiceAdmin.test.ts` |
