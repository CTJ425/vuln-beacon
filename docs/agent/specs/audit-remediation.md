# Spec: Audit Remediation (BUG-003 .. BUG-016)

Date: 2026-08-16 Asia/Taipei
Source: read-only audit recorded in `docs/agent/BUG_FIX.md`.
Scope: fix all audit findings. Do NOT attempt BUG-001 (webhook server-side dispatch,
deferred, needs its own Edge Function spec) or BUG-002 (accepted risk).

## Global rules

- TDD. Add a failing test first, then the fix. You MAY create new test files.
  You MUST NOT modify, weaken, or delete any existing test.
- Verify command for every builder: `npm --prefix src test`
- All 132 existing tests must still pass. Do not change public function signatures
  unless this spec says so.
- Do not reformat unrelated code.

## Contract: IngestionEngine alert de-duplication

`IngestionEngineOptions` gains one optional field:

```ts
export interface IngestionEngineOptions {
  webhookService?: WebhookService;
  knownCveIds?: Iterable<string>;   // CVE ids already persisted in the DB
}
```

- The constructor stores it as `private knownCveIds: Set<string>` (empty set when absent).
- A webhook alert for a CVE is dispatched only when the CVE is BOTH new to this run
  AND absent from `knownCveIds`.
- Omitting the option must preserve today's behaviour for existing tests.

---

## BUG-003 — Duplicate webhook alerts on every sync
File: `src/engine/ingestion.ts`

1. Gate the CRITICAL/HIGH dispatch (currently line ~122) on the de-dup rule above.
   The existing `isNew` value (line ~94) is necessary but NOT sufficient — the engine is
   constructed per run, so `isNew` alone is always true. Both conditions are required.
2. Move dispatch OUT of the per-CVE inner loop. Collect alert payloads into a local array
   during parsing, and after the item loop completes send them with a single
   `Promise.allSettled` batch so one slow hook cannot serialise the whole ingestion.
3. `newCvesCount` accounting must not change.

## BUG-004 — One unresponsive webhook stalls everything
File: `src/services/webhook.ts`

1. `dispatch()` — add an `AbortController` timeout of 10000 ms around `fetch`.
   Clear the timer in a `finally`.
2. Replace the bare `catch {}` (line ~41) with `catch (err)` that emits
   `console.warn('Webhook dispatch failed:', <url-safe identifier>, err)` and returns false.
   Do NOT log the full `webhook_url` — it contains a secret token. Log `config.id` and
   `config.platform` only.
3. `notifyAll()` — dispatch all hooks concurrently with `Promise.allSettled` instead of the
   sequential `for` loop. Keep the return type `Promise<number>` (count of successes).

## BUG-005 — False "sync succeeded" reporting
Files: `src/services/syncService.ts`, `src/App.tsx`

1. `syncVendors()` currently returns a hardcoded `success: true` (line ~104) even after the
   catch branch ran. Track a `let allSucceeded = true`, set it false in the catch branch and
   whenever `result.status === 'FAILED'`, and return that value.
2. `App.tsx` `handleManualSync` — add the missing `else` branch so a false result sets
   `setSyncMessage('Sync failed: ...')`.
3. `handleAddWebhook` (App.tsx ~line 92) — when `createWebhook` returns null, surface a
   failure message instead of silently doing nothing.

## BUG-006 — Optimistic delete with no rollback
File: `src/App.tsx` (`handleDeleteWebhook`, ~line 99)

Capture the previous list, remove optimistically, `await` inside `try`, and on failure
restore the captured list and set an error message.

## BUG-007 — Backfill can silently truncate
File: `src/scripts/backfillAdvisoryStorage.mjs`

Page the select with `.range(offset, offset + PAGE - 1)` (PAGE = 500) in a loop until a page
returns fewer than PAGE rows. Because each migrated row sets `raw_payload_path` (and so
leaves the `.is('raw_payload_path', null)` filter), re-query from offset 0 each iteration and
guard against an infinite loop when a page yields zero progress. Print the true total.

## BUG-008 — Storage key escapes only ':'
Files: `src/supabase/functions/sync-cve/index.ts` (~line 87),
       `src/scripts/backfillAdvisoryStorage.mjs` (~line 54)

BACKWARD COMPATIBILITY IS MANDATORY. Objects already uploaded use
`advisory_id.replace(/:/g, '_')`. The new sanitiser MUST produce a byte-identical key for
every id that contains only `[A-Za-z0-9._:-]`, so already-stored objects stay reachable.
Add handling only for characters that cannot appear in current data: strip/replace
path separators and traversal (`/`, `\`, and any `..` sequence). Apply the SAME helper in
both files so the two sites cannot drift.

## BUG-009 — Orphaned Storage object on partial commit
File: `src/supabase/functions/sync-cve/index.ts` (~lines 86-97)

When the DB upsert fails after a successful upload, remove the just-uploaded object
(`storage.from(bucket).remove([path])`) inside the error path, best-effort, before
propagating the original error. The original error must still be the one that surfaces.

## BUG-010 — Non-deterministic canonical advisory
File: `src/services/cveService.ts` (~lines 23-36, 52)

The embedded `advisory_cve_map` selection has no ordering, so `mappings[0]` is arbitrary.
Apply a deterministic order. Prefer a nested `.order()` on the embedded resource; if the
client rejects that, sort `mappings` in JS by a stable key (advisory_id ascending) before
picking `[0]`. Either way the chosen advisory must be reproducible across identical fetches.

## BUG-011 — testWebhook cannot distinguish disabled from broken
Files: `src/services/webhook.ts`, `src/services/webhookConfigService.ts`

`dispatch()` returns false for an inactive config without sending. Add an explicit way to
test regardless of `is_active` — e.g. `dispatch(config, alert, { ignoreActiveState = false })`
— and have `testWebhook` pass it, so a Test click actually probes the URL.
The severity filter must still apply to normal alert traffic.

## BUG-012 — Drawers persist across navigation
File: `src/App.tsx` (~lines 213-223)

When `currentNav` changes, clear `selectedCve` and `selectedAdvisory` so a drawer opened on
one page does not stay open over an unrelated page.

## BUG-013 — Webhook form: no URL validation, no delete confirmation
File: `src/components/settings/WebhookConfigPanel.tsx`

1. Validate the destination URL before submit: it must parse via `new URL()` and use
   protocol `https:`. Show an inline error and block submission otherwise.
2. The delete icon (~line 217) must require a confirmation step before calling
   `onDeleteWebhook`.

## BUG-014 — Webhook secret rendered in plain DOM text
File: `src/components/settings/WebhookConfigPanel.tsx` (~lines 193-195)

Render a masked form of the URL (e.g. origin + first path segment, remainder replaced with
`••••`). The full secret must not be present in the DOM.

## BUG-015 — Dead adapter with ambiguous vendorCode
Files: `src/adapters/index.ts`, `src/adapters/redhat.ts`

Both `RedHatAdapter` and `RedHatCsafAdapter` declare `vendorCode = 'redhat'`, but only the
CSAF one is registered, so `getAdapterByCode('redhat')` is ambiguous by luck alone.
Make the resolution explicit and non-ambiguous. Minimal acceptable fix: add a guard in
`getAdapterByCode` (or at registry construction) that throws/warns on duplicate vendorCode
registration, and document why `RedHatAdapter` stays exported but unregistered.
Do NOT delete `RedHatAdapter` and do NOT change which adapter handles `'redhat'` —
`SyncService.fetchAndIngestQuery` feeds it CSAF documents and must keep resolving to
`RedHatCsafAdapter`.

## BUG-016 — Repo hygiene
Files: `.gitignore` (repo root), new `src/.env.example`

1. Add `supabase/.temp/` to `.gitignore`. It currently holds real infra identifiers
   (project-ref, pooler-url) and is untracked but NOT ignored.
2. Create `src/.env.example` listing the variable NAMES with empty values:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`. No real values.
