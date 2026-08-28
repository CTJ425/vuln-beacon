# Historical Bug Fixes

---

### R6: Scheduled Runs Dispatch No Webhook Alerts — FIXED
- **Date**: Opened 2026-08-28, fixed 2026-08-29
- **Severity**: MEDIUM (feature gap; worse than recorded — affected both scheduled AND browser manual sync paths; critical CVEs not alerted)
- **Location**: `src/supabase/functions/scheduled-sync/index.ts`, `src/services/syncService.ts`, `src/services/webhook.ts`, `src/supabase/functions/_shared/ingest.entry.ts`, `src/supabase/functions/_shared/ingest.bundle.js`
- **Root Cause**: Three independent defects:
  1. `SyncService` created a `WebhookService` but never called `registerWebhook()`, and `App.tsx` fetched webhook configs into React state without handing them to `SyncService`. Manual browser syncs raised no alerts either.
  2. `scheduled-sync` Edge Function constructed `IngestionEngine` with `webhookService=undefined` (no registration path available server-side).
  3. A follow-on defect: `WebhookService` registration was append-only, so a webhook deleted or edited kept firing with its original snapshot for the rest of the page session (one `SyncService` instance per page load in `App.tsx`).
- **Fix**:
  1. New `SyncService.loadWebhooks()` — reads configs via `WebhookConfigService.fetchWebhooks()`, clears the registered set, registers only `is_active` configs, returns the count, never throws. Called first in `syncVendors()`.
  2. New `WebhookService.clearWebhooks()` — clears registered set so each load REBUILDS it (fixes the append-only snapshot bug).
  3. `src/supabase/functions/_shared/ingest.entry.ts` now re-exports `WebhookService`.
  4. `src/supabase/functions/scheduled-sync/index.ts` — reads active `webhook_configs` once per invocation with service-role client, inspects error and degrades to zero webhooks, passes `WebhookService` into every per-vendor `IngestionEngine`. Per-vendor construction preventing cross-vendor contamination is unchanged.
- **Files Changed**: `src/services/syncService.ts`, `src/services/webhook.ts`, `src/supabase/functions/_shared/ingest.entry.ts`, `src/supabase/functions/scheduled-sync/index.ts`, `src/supabase/functions/_shared/ingest.bundle.js` (regenerated).
- **Tests**: New: `tests/unit/services/syncServiceWebhookLoad.test.ts`. Updated: `tests/unit/services/syncServiceChunking.test.ts`, `tests/unit/services/syncServicePersist.test.ts`, `tests/unit/supabase/scheduledSyncFunction.test.ts`.
- **Verification**: `npm run build:edge && npm test && npm run build` from `src/` — 49 test files, 255 tests all passing; build OK.

### R4: new_items_count Over-Reports on Every Recurring Run — FIXED
- **Date**: Opened 2026-08-28 (pre-existing defect), fixed 2026-08-29
- **Severity**: MEDIUM (dashboard/reporting accuracy)
- **Location**: `src/engine/ingestion.ts`, `src/services/syncService.ts`
- **Root Cause**: Three independent defects:
  1. `IngestionEngine.newCvesCount` incremented only on within-run dedup, never consulted `knownCveIds` option set (which tracks CVEs from previous runs). It counted every touched CVE as "new" on each sync, even if seen before.
  2. `SyncService.syncVendors()` did not pass the engine's `newCvesCount` to sync log; instead hardcoded `newItemsCount: cves.length` (all fetched items, not just new ones).
  3. `SyncService.fetchAndIngestQuery()` on-demand lookup path built engine with no `knownCveIds` (no lookup) and sent no `newItemsCount` to Edge Function. Edge Function fallback counted every CVE as new.
- **Fix**:
  1. `src/engine/ingestion.ts` — compute `isTrulyNew` once per CVE (within-run dedup AND absent from `knownCveIds`), reuse for both the new `newCvesCount` and existing webhook gating (unchanged).
  2. `src/services/syncService.ts` — `syncVendors()` reports engine's `newCvesCount` to sync log.
  3. `src/services/syncService.ts` — new private `fetchKnownCveIds()` helper (extracted from `syncVendors()`; same paging, same degrade-to-empty-on-error). `fetchAndIngestQuery()` seeds `knownCveIds` and sends both `newItemsCount` and `itemsFetched` to Edge Function.
- **Impact**: Dashboard `new_items_count` now reflects true incremental growth. Existing browser manual sync fixed; scheduler path (which seeds `knownCveIds` correctly after TASK-13 Phase 2) also now fixed.
- **Files Changed**: `src/engine/ingestion.ts`, `src/services/syncService.ts`.
- **Tests**: New: `tests/unit/engine/ingestionNewCveCount.test.ts`. Updated: `tests/unit/services/syncServiceChunking.test.ts`, `tests/unit/services/syncServicePersist.test.ts`.
- **Verification**: `npm run build:edge && npm test && npm run build` from `src/` — 49 test files, 255 tests all passing; build OK.

### Bug ID: BUG-003 — Sync failed: one or more vendor feeds could not be ingested
- **Date**: 2026-08-28, fixed 2026-08-28
- **Severity**: CRITICAL
- **Location**: `src/adapters/redhat-csaf.ts`, `src/services/syncService.ts`, `src/supabase/functions/sync-cve/index.ts`, `src/App.tsx`
- **Root Cause**: `SyncService.syncVendors()` sent the whole ingestion as ONE `functions.invoke` body of 43.6 MB. The self-hosted Edge Runtime supervisor killed the worker and returned HTTP 500 `{"msg":"WorkerRequestCancelled: request has been cancelled by supervisor"}`. Of the 43.6 MB, `mappings` was 41.39 MB. Two causes: (1) `componentFromNvr()` in redhat-csaf.ts only cut NVRs at `-<digits>:`, so Red Hat container image ids (e.g. `registry.redhat.io/openshift4/ose-hypershift-rhel9@sha256:<64 hex>_arm64`) stayed distinct per digest and per architecture and the existing `seenKeys` dedupe never fired. 131,206 of 132,982 emitted product_impact rows (99.1% of payload bytes) were these. (2) `product_impacts` is advisory-level data stored per `advisory_cve_map` row, so an RHSA with 25 CVEs shipped 25 identical copies (NOT fixed — accepted risk, requires schema change). The generic UI string hid all of this; `vendor_sync_logs` was empty because the failure path could not write either.
- **Fix**: (1) `src/adapters/redhat-csaf.ts` — collapse container image references to repository path (strip `@sha256:...`), so dedupe removes per-arch and per-digest duplicates. (2) `src/services/syncService.ts` — split persist step into chunks of advisories bounded by `PERSIST_CHUNK_MAX_BYTES = 3_000_000` UTF-8 bytes. Data chunks carry no `syncMeta`; one final `syncMeta`-only call writes exactly one `vendor_sync_logs` row per vendor per run with run-total `itemsFetched` / `newItemsCount`. (3) `src/supabase/functions/sync-cve/index.ts` — `syncMeta` optional; absent: persist and return `{success:true, log:null}` HTTP 200, no log row; present: as before but `items_fetched` / `new_items_count` prefer run totals from `syncMeta`. (4) `src/App.tsx` — failed sync shows `error_message` of first FAILED log; fallback to original generic string when no message available.
- **Verification**: `npm --prefix src test` 39 files / 174 tests passed; `npm --prefix src run build` clean; live run against real Red Hat CSAF feed: 49 advisories, 285 CVEs, 627 mappings; product_impact rows 132,982 → 39,386; rows with raw sha256 digest 131,206 → 0; monolithic body 41.63 MB → 9.65 MB split into chunks ≤ 3 MB. Reviewer verdict: FAIL on first pass (1 BLOCKER on UTF-16 vs UTF-8 byte count) → fixed and re-verified → ACCEPTED. Live end-to-end verification 2026-08-28 10:42:00 Asia/Taipei: Edge Function deployed to /root/container/supabase/vuln-beacon/volumes/functions/sync-cve/index.ts (previous version backed up as index.ts.bak-20260828-103943). Contract checks against the running instance: body with no syncMeta -> HTTP 200 {"success":true,"log":null} (was HTTP 500 "Cannot read properties of undefined (reading 'status')"), unknown action -> 400, unknown vendorCode -> 400. Live sync run: success in 10.7 s via 4 data chunk invokes (all 200) plus 1 closing log invoke (200), 9.71 MiB total across 5 requests, replacing the single 41.63 MiB body. Chunk composition: 1 advisory / 143 mappings / 3,681,204 bytes; 20 / 220 / 2,552,382; 16 / 204 / 2,436,658; 12 / 60 / 1,516,391 — the first chunk exceeds PERSIST_CHUNK_MAX_BYTES because it holds a single advisory, which is the spec's explicit exception, not a boundary defect. Database after the run: advisories 0 -> 49, cves 0 -> 285, advisory_cve_map 0 -> 627, vendor_sync_logs 2 -> 3 with exactly ONE new row (status SUCCESS, items_fetched 49, new_items_count 285, error_message null). Read-path spot check: RHSA-2026:60484 returns 82 impact rows, sample component kernel-64k-debug-devel, zero rows containing @sha256:. Regression re-run after deployment: 39 files / 174 tests passed, build clean.
- **Status**: ✅ FIXED (2026-08-28)

---

### Bug ID: BUG-001 — Hardcoded fake CVE-2026-73086 injected into every Red Hat ingestion sync
- **Date**: 2026-08-15, fixed in 1.0.0-dev.1
- **Root Cause**: Code had unconditional hardcoded injection block in `src/adapters/redhat.ts` `fetchAdvisories()` (lines ~61-69) that force-added fabricated CVE record (CVE-2026-73086, RHSA-2026:48758/54412/50287) into every production sync run, indistinguishable from genuine Red Hat data, polluting the live Supabase database.
- **Fix**: Removed the hardcoded injection block from `src/adapters/redhat.ts`. Cleaned polluted live Supabase database (project xgrtyjazyqajqinwzlbl): deleted fake CVE-2026-73086 row (id 65f7576c-c0bd-4f0d-b44b-93c9609e0f17) and RHSA-2026:48758 advisory row (id cf395a71-a923-47b6-b7f1-b84e2748c398) with cascaded `advisory_cve_map` entry. Verified the advisory was not shared with any real CVE before deletion.
- **Status**: ✅ FIXED (1.0.0-dev.1)

### Bug ID: BUG-003 — Duplicate Webhook Alerts on Every Sync
- **Date**: 2026-08-16, fixed 2026-08-16
- **Severity**: HIGH
- **Location**: `src/engine/ingestion.ts:122`
- **Root Cause**: The CRITICAL/HIGH dispatch does not consult `isNew` (computed line 94). Worse, `IngestionEngine` is constructed per sync run, so the in-memory `this.cves` map always starts empty and `isNew` is always true. Every sync re-alerts every CRITICAL/HIGH CVE in the fetched window.
- **Fix**: webhook alerts now gated on "new to this run AND absent from knownCveIds"; IngestionEngine takes knownCveIds, syncVendors supplies already-persisted cve_ids via the paginated fetchAllRows helper; dispatch moved out of the per-CVE loop into a batched Promise.allSettled.
- **Status**: ✅ FIXED (2026-08-16)

### Bug ID: BUG-004 — Single Unresponsive Webhook Stalls Entire Sync
- **Date**: 2026-08-16, fixed 2026-08-16
- **Severity**: HIGH
- **Location**: `src/services/webhook.ts:35`, `src/services/webhook.ts:46`, `src/engine/ingestion.ts:123`
- **Root Cause**: `fetch` has no timeout/AbortController. `notifyAll` awaits each hook sequentially in a for-loop. Ingestion awaits `notifyAll` inside the per-CVE loop. One black-holed webhook URL blocks all later hooks and the whole ingestion, unbounded. Compounded by `catch {}` which swallows every delivery error with no logging.
- **Fix**: dispatch() now uses an AbortController with a 10s timeout cleared in finally; notifyAll dispatches concurrently via Promise.allSettled; the swallowing `catch {}` now logs config.id and platform only, never webhook_url.
- **Status**: ✅ FIXED (2026-08-16)

### Bug ID: BUG-005 — Silent Sync Failure Gives User No Feedback
- **Date**: 2026-08-16, fixed 2026-08-16
- **Severity**: HIGH
- **Location**: `src/App.tsx:72-74`, `src/App.tsx:92-97`
- **Root Cause**: `if (result.success)` has no `else`, so when `syncVendors()` resolves with success=false the UI shows no banner at all and the user believes the sync worked. Same class: `handleAddWebhook` silently does nothing when `createWebhook` returns null.
- **Fix**: syncVendors() now tracks allSucceeded and returns the real result instead of a hardcoded true; App.tsx surfaces a failure message for both a false sync result and a null createWebhook result.
- **Status**: ✅ FIXED (2026-08-16)

### Bug ID: BUG-006 — Optimistic Webhook Delete with No Rollback or Error Handling
- **Date**: 2026-08-16, fixed 2026-08-16
- **Severity**: MEDIUM
- **Location**: `src/App.tsx:99-102`
- **Root Cause**: The row is removed from state before `deleteWebhook(id)` is awaited; there is no try/catch and no rollback, so a failed delete leaves the UI misrepresenting server state until reload.
- **Fix**: handleDeleteWebhook captures the previous list, awaits inside try, restores it and shows an error on failure.
- **Status**: ✅ FIXED (2026-08-16)

### Bug ID: BUG-007 — Backfill Script Can Silently Truncate
- **Date**: 2026-08-16, fixed 2026-08-16
- **Severity**: MEDIUM
- **Location**: `src/scripts/backfillAdvisoryStorage.mjs:29-32`
- **Root Cause**: The select has no `.range()`/pagination and relies on the PostgREST default row cap (1000). If the unmigrated backlog exceeds the cap the script prints a clean summary while leaving rows un-migrated.
- **Fix**: backfill select is paginated with .range() plus a deterministic .order('id'), a zero-progress guard, and per-run distinct-id accounting so the printed totals are true.
- **Status**: ✅ FIXED (2026-08-16)

### Bug ID: BUG-008 — Storage Object Key Escapes Only ':'
- **Date**: 2026-08-16, fixed 2026-08-16
- **Severity**: MEDIUM
- **Location**: `src/supabase/functions/sync-cve/index.ts:87`, `src/scripts/backfillAdvisoryStorage.mjs:54`
- **Root Cause**: Key is built from advisory_id replacing only `:`. Any id containing `/` or `..` would write outside the intended vendor prefix. Both sites are consistent with each other (no split-brain).
- **Fix**: shared sanitiseAdvisoryKey helper in both runtimes; verified byte-identical to the legacy `:`->`_` key for realistic advisory ids so already-stored objects stay reachable, while neutralising `/`, `\` and `..`.
- **Status**: ✅ FIXED (2026-08-16)

### Bug ID: BUG-009 — Edge Function Partial-Commit Leaves Orphaned Storage Objects
- **Date**: 2026-08-16, fixed 2026-08-16
- **Severity**: MEDIUM
- **Location**: `src/supabase/functions/sync-cve/index.ts:86-97`
- **Root Cause**: If the DB upsert fails after a successful upload, the uploaded object is orphaned and earlier advisories in the same request stay committed.
- **Fix**: a failed DB upsert after a successful upload now removes the orphaned object best-effort, without masking or replacing the original error.
- **Status**: ✅ FIXED (2026-08-16)

### Bug ID: BUG-010 — Non-Deterministic Canonical Advisory for Multi-Advisory CVEs
- **Date**: 2026-08-16, fixed 2026-08-16
- **Severity**: MEDIUM
- **Location**: `src/services/cveService.ts:52`
- **Root Cause**: `mappings[0]` picks the displayed advisory_id/url/solution, but the embedded `advisory_cve_map` is selected with no nested `.order()`, so PostgREST gives no ordering guarantee and the displayed advisory can flip between fetches.
- **Fix**: mappings are sorted deterministically by advisory_id before picking the canonical advisory.
- **Status**: ✅ FIXED (2026-08-16)

### Bug ID: BUG-011 — testWebhook Cannot Distinguish "Disabled" from "Broken"
- **Date**: 2026-08-16, fixed 2026-08-16
- **Severity**: MEDIUM
- **Location**: `src/services/webhook.ts:28`
- **Root Cause**: `dispatch` returns false when `is_active` is false without issuing any request, so a "Test" on an inactive webhook reports failure identically to an unreachable URL.
- **Fix**: dispatch() accepts { ignoreActiveState } and testWebhook passes it, so a Test actually probes the URL; the severity floor still applies to normal alert traffic.
- **Status**: ✅ FIXED (2026-08-16)

### Bug ID: BUG-012 — Detail Drawers Persist Across Navigation
- **Date**: 2026-08-16, fixed 2026-08-16
- **Severity**: MEDIUM
- **Location**: `src/App.tsx:213-223`
- **Root Cause**: Both drawers are rendered outside the section switch and `selectedCve`/`selectedAdvisory` are not cleared when `currentNav` changes, so an open drawer stays on top of an unrelated page after using the sidebar.
- **Fix**: selectedCve and selectedAdvisory are cleared when currentNav changes.
- **Status**: ✅ FIXED (2026-08-16)

### Bug ID: BUG-013 — Webhook Form Lacks URL Validation and Delete Confirmation
- **Date**: 2026-08-16, fixed 2026-08-16
- **Severity**: MEDIUM
- **Location**: `src/components/settings/WebhookConfigPanel.tsx:136-145`, `src/components/settings/WebhookConfigPanel.tsx:217-223`
- **Root Cause**: Only HTML `required`, no URL-format check, so any non-empty string is persisted. Trash icon deletes immediately with no confirmation dialog.
- **Fix**: destination URL must parse and be https:, with an inline error; deletion now requires a confirming second click.
- **Status**: ✅ FIXED (2026-08-16)

### Bug ID: BUG-014 — Webhook URL Secret Rendered in Plain DOM Text
- **Date**: 2026-08-16, fixed 2026-08-16
- **Severity**: LOW
- **Location**: `src/components/settings/WebhookConfigPanel.tsx:193-195`
- **Root Cause**: Discord/Slack webhook URLs embed a secret token; the full value is in the DOM, only visually truncated with CSS.
- **Fix**: the webhook URL is masked to origin only — path, query and fragment are replaced, so the secret never reaches the DOM whatever the URL shape.
- **Status**: ✅ FIXED (2026-08-16)

### Bug ID: BUG-015 — Dead Adapter with Ambiguous vendorCode
- **Date**: 2026-08-16, fixed 2026-08-16
- **Severity**: LOW
- **Location**: `src/adapters/redhat.ts:52`, `src/adapters/redhat-csaf.ts:144`
- **Root Cause**: Both declare `vendorCode = 'redhat'`, but only RedHatCsafAdapter is in ALL_ADAPTERS. RedHatAdapter (300 lines) is unreachable; if ever registered, `getAdapterByCode` would silently resolve whichever comes first.
- **Fix**: adapters/index.ts now throws on duplicate vendorCode registration; RedHatAdapter stays exported but unregistered, documented, with 'redhat' still resolving to RedHatCsafAdapter.
- **Status**: ✅ FIXED (2026-08-16)

### Bug ID: BUG-016 — Repo Hygiene: Untracked but Unignored Infra Identifiers
- **Date**: 2026-08-16, fixed 2026-08-16
- **Severity**: LOW
- **Location**: `.gitignore`, `src/.env.example`
- **Root Cause**: `supabase/.temp/` is untracked but NOT gitignored and holds real infra identifiers. Also `src/.env.example` is missing while README documents the required variables.
- **Fix**: supabase/.temp/ added to .gitignore; src/.env.example created with variable names only.
- **Status**: ✅ FIXED (2026-08-16)

### Investigation: Rules-of-Hooks Violation Rejected as False Positive
- **Date**: 2026-08-16, investigated and closed
- **Location**: `src/components/explorer/CveDetailDrawer.tsx:52`
- **Finding**: A reported Rules-of-Hooks violation (early `return null` before useState/useMemo) was investigated. Executed reproduction test showed no throw, because React's renderWithHooks selects the mount dispatcher when `current.memoizedState === null`, so a 0-hook render followed by an N-hook render is treated as a fresh mount. The pattern is still lint-fragile and worth tidying, but it does not crash.
- **Status**: ✅ CLOSED (2026-08-16) — rejected as false positive

## Reviewer Pass Remediations (2026-08-16)
A reviewer pass on the remediation of BUG-003 through BUG-016 found and fixed 4 further defects:
- **(a) BLOCKER**: syncVendors read cve_id with a bare select subject to PostgREST's silent 1000-row cap, now using fetchAllRows.
- **(b) Inflated skipped counts**: re-selecting empty-payload rows in the backfill loop, now de-duplicated per-run.
- **(c) Missing .order()**: the paginated backfill select now includes deterministic `.order('id')`.
- **(d) Secret leakage in maskWebhookUrl**: previously revealed the first path segment, unsafe when the secret IS that segment, now masked to origin only.

New regression tests added:
- `src/tests/unit/services/auditRemediation.test.ts` — webhook timeout/concurrency/secret-logging/ignoreActiveState, and ingestion alert de-duplication.
- `src/tests/unit/services/advisoryStorageKey.test.ts` — storage-key backward compatibility plus a drift guard asserting the Deno and Node copies stay identical.
- `src/tests/unit/components/webhookPanelSecurity.test.tsx` — secret absent from DOM across URL shapes, delete confirmation.
- `src/tests/unit/services/syncServicePersist.test.ts` — protected-table assertion narrowed from "no .from() calls" to "no mutating calls", so the client may read cve_id while still being forbidden to write.

