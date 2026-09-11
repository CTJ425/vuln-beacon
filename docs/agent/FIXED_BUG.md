# Historical Bug Fixes

---

### BUG-021: Production Sync Failure Due to Missing Edge Functions, Unapplied Migrations, and ON CONFLICT DO UPDATE Batch Collision — FIXED
- **Date**: Opened 2026-09-11, fixed 2026-09-11 (1.0.0)
- **Severity**: CRITICAL
- **Location**: `src/supabase/functions/sync-cve/index.ts`, `src/supabase/functions/scheduled-sync/index.ts`, `src/adapters/nutanix.ts`, `src/engine/ingestion.ts`, `src/services/syncService.ts`, `src/App.tsx`, `/usr/local/bin/supabase-vuln`
- **Root Cause**:
  1. **Missing Edge Functions on Prod Project**: Production Supabase project (`baizoisgkgwqccqjwnxg`) had zero Edge Functions deployed. When the frontend triggered sync, `POST /functions/v1/sync-cve` preflight returned 404 with CORS failure, throwing `FunctionsFetchError: Failed to send a request to the Edge Function`.
  2. **Unapplied Production Migrations**: All 8 database migrations had never been pushed to `baizoisgkgwqccqjwnxg` (missing `vendors`, `cves`, `advisories`, `advisory_cve_map`, and `advisory-documents` bucket).
  3. **Batch Collision in ON CONFLICT DO UPDATE**: Upstream Nutanix vendor feeds contain multiple CVE entries for the same CVE ID within a single advisory payload. When batch upserting into `advisory_cve_map`, PostgreSQL threw `ERROR: ON CONFLICT DO UPDATE command cannot affect row a second time` because identical `(advisory_id, cve_id)` pairs existed in the same batch statement.
  4. **Fallback Bypass in App.tsx**: `App.tsx` called `syncVendors(undefined, { mode: currentUser ? 'server' : 'auto' })`. When an administrator was logged in, `mode` was forced to `'server'`, bypassing the `mode === 'auto'` error fallback in `syncService.ts` and leaking `FunctionsFetchError` directly to the UI.
  5. **Missing Executable CLI in Non-Interactive Shells**: `supabase-vuln` was defined only as a shell function in `.bashrc`, failing with exit code 127 in non-interactive subshells.
- **Fix**:
  1. Applied all 8 database migrations to production via `supabase db push --include-all`. Configured Supabase Vault secrets (`scheduled_sync_url`, `scheduled_sync_key`).
  2. Deployed both `sync-cve` and `scheduled-sync` Edge Functions to production and dev Supabase projects.
  3. Deduplicated CVE entries per advisory in `nutanix.ts`, deduplicated mappings and CVEs in `ingestion.ts`, and deduplicated batch upsert entities (`uniqueCves`, `uniqueAdvisories`, `dedupedMappings`) in both `sync-cve/index.ts` and `scheduled-sync/index.ts`.
  4. Updated `App.tsx` to pass `mode: 'auto'`, which prioritizes server-side sync when authenticated while ensuring graceful fallback to client ingestion if the Edge Function network request fails. Refined `syncService.ts` to strictly gate fallback on `isTransportError` (network / 404 / FunctionsFetchError), guaranteeing that operational conflicts (such as HTTP 409 sync lock conflicts or HTTP 401 errors) surface failure directly instead of triggering unintended client ingestion.
  5. Provisioned `/usr/local/bin/supabase-vuln` and `/usr/local/bin/supabase-stock` executable scripts in `$PATH`.
  6. Added regression unit tests in `nutanix.test.ts`, `ingestionNewCveCount.test.ts`, and `syncServiceServerMode.test.ts`.
- **Status**: ✅ FIXED (2026-09-11 09:48:00 CST)

---

### BUG-020: Scheduled Sync Concurrency Lock Gap, Stale knownCveIds Duplicate Alerts, and PostgREST Joined CVE Array Fragility — FIXED
- **Date**: Opened 2026-09-09, fixed 2026-09-09 (1.0.0)
- **Severity**: HIGH
- **Location**: `src/supabase/functions/scheduled-sync/index.ts`, `src/services/advisoryService.ts`, `src/components/explorer/CveDetailDrawer.tsx`, `src/components/sync/LogDetailModal.tsx`, `src/components/sync/ScheduleSettings.tsx`
- **Root Cause**:
  1. `src/supabase/functions/scheduled-sync/index.ts` failed to acquire or release the mutual exclusion transactional lock (`try_acquire_sync_lock(7425001)`). Scheduled sync and admin manual sync (`sync-cve`) could execute concurrently, causing race conditions and conflicting sync log rows.
  2. Inside the scheduled sync vendor loop, newly ingested CVEs were not appended to `knownCveIds`. When multiple vendors were due in the same tick and shared CVEs (e.g. Red Hat and Nutanix), subsequent vendors treated the shared CVE as newly discovered, erroneously inflating `new_items_count` and dispatching duplicate webhook alerts.
  3. `src/services/advisoryService.ts` assumed `map.cves` was always an object (`const cve = map.cves;`), failing to extract CVEs when PostgREST returned single-element array joins.
  4. Copy timeout confirmation handlers across drawers/modals (`CveDetailDrawer.tsx`, `LogDetailModal.tsx`, `ScheduleSettings.tsx`) used unmanaged `setTimeout`, risking unmount state updates.
- **Fix**:
  1. In `scheduled-sync/index.ts`, acquired `try_acquire_sync_lock(7425001)` before loop execution and released via `release_sync_lock(7425001)` in an outer `finally` block, guaranteeing mutual exclusion.
  2. In `scheduled-sync/index.ts`, propagated newly ingested CVE IDs to `knownCveIds` after each vendor run.
  3. In `advisoryService.ts`, unwrapped `cve = Array.isArray(map.cves) ? map.cves[0] : map.cves`.
  4. Added `copyTimerRef` and `useEffect` cleanup across `CveDetailDrawer`, `LogDetailModal`, and `ScheduleSettings`.
- **Status**: ✅ FIXED (2026-09-09 17:45:00 CST)

---

### BUG-019: Rules-of-Hooks Latent Violation and Unhandled Clipboard/Mock Relation Crashes — FIXED
- **Date**: Opened 2026-09-09, fixed 2026-09-09 (1.0.0)
- **Severity**: MEDIUM
- **Location**: `src/components/explorer/CveDetailDrawer.tsx`, `src/App.tsx`, `src/services/syncService.ts`, `src/services/cveService.ts`, `src/components/sync/ScheduleSettings.tsx`
- **Root Cause**:
  1. `CveDetailDrawer.tsx` had `realAdvisories` `useMemo` placed after early return `if (!item) return null;`, violating React Rules of Hooks when transitioning between null and selected items ("Rendered more hooks than during previous render" / "Rendered fewer hooks than expected").
  2. `App.tsx` invoked `setTimeout(() => setSyncMessage(null), 5000)` without tracking timers or clearing them on unmount. During test teardown or component unmount, the timer fired on the Node.js event loop after JSDOM was torn down, causing `ReferenceError: window is not defined` uncaught exceptions.
  3. `syncService.ts` called `this.webhookService.clearWebhooks()` in `loadWebhooks()` without optional chaining or null checking, throwing unhandled exceptions if the service was not initialized.
  4. `cveService.ts` assumed joined foreign key `m.advisories` was always an object, but PostgREST can return either a single object or an array when multiple joins occur.
  5. `ScheduleSettings.tsx` strictly required `supabase.co` in `getScheduledSyncUrl()`, breaking self-hosted Supabase instances.
- **Fix**:
  1. In `CveDetailDrawer.tsx`, moved all hooks (`realAdvisories`, `primaryAdvisory`) above any conditional returns, guaranteeing invariant hook execution count across null and populated item transitions.
  2. In `App.tsx`, managed `syncMessage` auto-dismiss via a `useEffect` with `clearTimeout` on unmount, removing unhandled timer leaks.
  3. In `syncService.ts`, added optional chaining `this.webhookService?.clearWebhooks?.()`.
  4. In `cveService.ts`, normalized joined relations with robust unwrapping helpers (`resolveAdvisory`, `resolveVendor`).
  5. In `ScheduleSettings.tsx`, accepted any valid `http://` or `https://` prefix for self-hosted instances.
- **Status**: ✅ FIXED (2026-09-09 17:25:00 CST)

---

### BUG-011: Unauthenticated Direct Vendor Fetch via Explorer Page — FIXED
- **Date**: Opened 2026-09-07, fixed 2026-09-07 (1.0.0-dev.5)
- **Severity**: HIGH
- **Location**: `src/pages/ExplorerPage.tsx`, `src/pages/VendorPage.tsx`
- **Root Cause**: `ExplorerPage.handleFetchDirectly` called `syncService.fetchAndIngestQuery` with no authentication check. The control was rendered for every visitor (including unauthenticated ones), and when clicked, initiated a live vendor fetch and persisted CVE/advisory/mapping data directly to Supabase via the `sync-cve` Edge Function. The Edge Function had no per-request auth validation for this action, allowing public write access to production data.
- **Fix**: Added `isAuthenticated` prop to `ExplorerPage`; control not rendered and handler returns early for unauthenticated users. `VendorPage` forwards same `isAuthenticated` prop to embedded `ExplorerPage`. Fixed spec compliance: Dashboard empty-state "Sync All Feeds Now" now navigates to Admin Console opening login modal when signed out instead of calling `handleManualSync` directly. Added regression test: `src/tests/unit/pages/explorerDirectFetchGate.test.tsx` (4 tests verifying control visibility and handler early-exit).
- **Status**: ✅ FIXED (2026-09-07 18:56:07 CST)

---

### BUG-010: Edge Function Chunk Crash, Missing Health Check, Admin Tab Reset & Session Invalidation — FIXED
- **Date**: Opened 2026-09-07, fixed 2026-09-07 (1.0.0-dev.4)
- **Severity**: HIGH
- **Location**: `src/supabase/functions/sync-cve/index.ts`, `src/components/admin/SystemHealthMonitor.tsx`, `src/App.tsx`, `src/components/admin/AdminLogQuery.tsx`, `src/components/admin/AdminLoginModal.tsx`, `src/components/sync/LogDetailModal.tsx`
- **Root Cause**:
  1. `sync-cve/index.ts` blindly accessed `syncMeta.status` during chunked persistence without checking if `syncMeta` existed, causing `TypeError: Cannot read properties of undefined (reading 'status')` and HTTP 500 crashes on intermediate chunks.
  2. `sync-cve` lacked an action branch for `health_check`, causing HTTP 400 'Unsupported action' rejections. Concurrently, `SystemHealthMonitor.tsx` did not check `{ data, error }` returned from `invoke`, resulting in false-positive operational status reporting.
  3. `App.tsx` passed root `loadData` to `AdminPage.onRefreshLogs`, causing a full-page loading spinner to unmount the backstage portal and reset the user's active tab state on every log refresh.
  4. `App.tsx` lacked an unauthenticated route guard effect on the `admin` nav state, allowing unauthenticated UI rendering if a session expired mid-session.
  5. `AdminLoginModal.tsx` hung silently without displaying an error if authentication succeeded but `session` was null (e.g., unconfirmed email).
  6. `AdminLogQuery.tsx` lacked table pagination, loading all logs into DOM at once.
- **Fix**:
  1. Added `if (syncMeta && syncMeta.status)` guard in `sync-cve` and deployed to Supabase Cloud runtime.
  2. Added `action === 'health_check'` endpoint in `sync-cve` and updated `SystemHealthMonitor.tsx` to properly inspect invoke data/error and enforce request timeout.
  3. Added dedicated `handleRefreshLogs` with `isRefreshingLogs` spinner in `App.tsx`, preserving admin tab state during background log refreshes.
  4. Added route guard in `App.tsx` redirecting to dashboard when `currentNav.section === 'admin' && !currentUser`.
  5. Added explicit error messages for null session scenarios in `AdminLoginModal.tsx`.
  6. Added `TablePagination` to `AdminLogQuery.tsx` and resilient clipboard fallback in `LogDetailModal.tsx`.
- **Status**: ✅ FIXED (2026-09-07)

### BUG-001: Webhook Alerting Never Dispatches in Production — FIXED
- **Date**: Opened 2026-08-16, fixed 2026-09-05
- **Severity**: HIGH
- **Location**: `src/services/syncService.ts`, `src/services/webhookConfigService.ts`, `src/supabase/functions/sync-cve/index.ts`, `src/supabase/migrations/20260905000000_security_and_reliability_fixes.sql`
- **Root Cause**: WebhookService was only registered in E2E tests, and browser direct writes/tests triggered CORS issues on Slack endpoints while exposing permissive public write access on `webhook_configs`.
- **Fix**: (1) Tightened RLS on `webhook_configs` to authenticated and service_role only. (2) Added server-side webhook proxy actions (`test_webhook`, `create_webhook`, `delete_webhook`) to `sync-cve` Edge Function. (3) Routed `fetchAndIngestQuery` through `loadWebhooks()` to dispatch alerts on on-demand queries. (4) Added SSRF protection via `isSafeDestinationUrl()`.
- **Status**: ✅ FIXED (2026-09-05)

---

### BUG-002: affected_products Fallback Hardcodes Product Name — FIXED
- **Date**: Opened 2026-08-16, fixed 2026-09-05
- **Severity**: LOW
- **Location**: `src/services/advisoryService.ts`
- **Root Cause**: Plain-string `affected_products` fallback hardcoded `product_name` as `'Enterprise System'` instead of using the joined vendor name.
- **Fix**: Changed fallback to `(row.vendors as { name?: string } | null)?.name || 'Enterprise System'`.
- **Status**: ✅ FIXED (2026-09-05)

---

### BUG-005: Per-chunk transient failure aborts the whole vendor run / Diagnostic reporting — FIXED
- **Date**: Opened 2026-08-28, fixed 2026-09-05
- **Severity**: LOW
- **Location**: `src/services/syncService.ts`
- **Root Cause**: When chunk error occurred, unadulterated error messages were not cleanly preserved across manual sync chunk boundaries.
- **Fix**: Preserved exact chunk error strings directly without distortion while keeping chunked execution bounded by `PERSIST_CHUNK_MAX_BYTES`.
- **Status**: ✅ FIXED (2026-09-05)

---

### BUG-007: Supabase Mock Missing `.range()` on `select()` Result — FIXED
- **Date**: Opened 2026-08-29, fixed 2026-09-05
- **Severity**: LOW (test-quality gap)
- **Location**: `src/tests/unit/services/syncServicePersist.test.ts`
- **Root Cause**: The Supabase mock in `syncServicePersist.test.ts` lacked `.range()` and `.order()` chained mock methods on `select()`.
- **Fix**: Added chained `.range()` and `.order()` implementations to mock query builder.
- **Status**: ✅ FIXED (2026-09-05)

---

### R1: Wall-Clock Limit on Full CSAF Ingest in One Edge Function Invocation — FIXED
- **Date**: Opened 2026-08-28, fixed 2026-09-05
- **Severity**: MEDIUM
- **Location**: `src/adapters/redhat-csaf.ts`
- **Root Cause**: Unbounded concurrent CSAF advisory fetches risked Edge Runtime memory limit (150MB) and 25s wall-clock timeout.
- **Fix**: Bounded `fetchAdvisories` to concurrent batches of 5 requests max (`BATCH_SIZE = 5`).
- **Status**: ✅ FIXED (2026-09-05)

---

### R2: Failed Runs Do Not Retry; Later Scheduled Slot Waits for Next Due Time — FIXED
- **Date**: Opened 2026-08-28, fixed 2026-09-05
- **Severity**: LOW
- **Location**: `src/supabase/functions/scheduled-sync/index.ts`
- **Root Cause**: `last_scheduled_run_at` was updated even when vendor ingest failed, preventing retry within the schedule window.
- **Fix**: Only successful vendors in `ran` advance `last_scheduled_run_at`. Vendors in `failed` are not stamped, allowing subsequent ticks within the 10-minute tolerance window to retry.
- **Status**: ✅ FIXED (2026-09-05)

---

### R5: Double vendor_sync_logs Insert Failure Leaves Vendor Orphaned in Response Arrays — FIXED
- **Date**: Opened 2026-08-28, fixed 2026-09-05
- **Severity**: LOW
- **Location**: `src/supabase/functions/scheduled-sync/index.ts`
- **Root Cause**: Scheduled sync response only tracked `ran`, `skipped`, and `logs`. Failed vendors disappeared from response arrays if log insert failed.
- **Fix**: Added explicit `failed` array to response payload tracking vendor code and error message.
- **Status**: ✅ FIXED (2026-09-05)

---

### BUG-018: Vendor schedule migration not applied to live database — FIXED
- **Date**: Opened 2026-08-29, fixed 2026-08-31
- **Severity**: HIGH (feature blocking; schedule UI completely non-functional)
- **Location**: `src/supabase/migrations/20260828000000_vendor_schedule.sql`
- **Root Cause**: Migration `20260828000000_vendor_schedule.sql` contained an invalid PostgreSQL CHECK constraint using a subquery (`SELECT 1 FROM unnest(schedule_times)...`), triggering `SQLSTATE 0A000: cannot use subquery in check constraint` when applied to PostgreSQL 15+. As a result, migrations were blocked and schedule columns did not exist on the live database.
- **Fix**: Replaced inline subquery with an `IMMUTABLE` helper function `public.validate_schedule_times(TEXT[])` that evaluates the regex format check. Successfully pushed all database migrations (`20260815000000`, `20260816000000`, `20260816010000`, `20260828000000`) and deployed Edge Functions (`sync-cve`, `scheduled-sync`) to Supabase Cloud (`vuln-beacon-dev`).
- **Files Changed**: `src/supabase/migrations/20260828000000_vendor_schedule.sql`.
- **Verification**: `supabase db push` succeeded; `supabase migration list` confirms all 4 migrations applied remotely; `supabase functions deploy` deployed `sync-cve` & `scheduled-sync`; `curl` verified HTTP 200 response on `sync-cve` endpoint; REST API query verified `vendors` table with `schedule_enabled` column populated; `npm run test:unit` & `npm run build` clean.

---

### BUG-017: Sync error reason hidden when Edge Function invoke fails — FIXED
- **Date**: Opened 2026-08-29, fixed 2026-08-29
- **Severity**: HIGH (failure diagnostics inaccessible; prevented troubleshooting of real causes)
- **Location**: `src/services/syncService.ts`, `src/App.tsx`, `src/tests/unit/services/syncServiceErrorSurface.test.ts` (new), `src/tests/unit/components/appSyncError.test.tsx` (updated)
- **Root Cause**: Two independent defects: (1) `SyncService.syncVendors()` surfaced failure reason only through the `vendor_sync_logs` row that the `sync-cve` Edge Function writes and returns. When the `supabase.functions.invoke` call itself failed, no row was written, `newLogs` came back empty, and `App.tsx` `handleManualSync` fell back to generic "Sync failed: one or more vendor feeds could not be ingested" — even though the real error message was in `err?.message`. (2) The per-vendor `catch` block's `supabase.functions.invoke` call inside it was unguarded, so a rejecting invoke propagated out of `syncVendors()` instead of being collected.
- **Fix**: (1) `syncVendors()` now returns optional `errors?: string[]`, collecting the in-memory reason for every vendor that did not succeed — at most one entry per vendor, the ingest reason winning over any transport error that follows it (tracked via per-iteration `recordedError` flag). (2) Catch block's invoke wrapped in its own try/catch and logged via `console.error`. (3) `App.tsx` `handleManualSync` message priority: persisted `error_message` → `result.errors?.[0]` → unchanged generic string.
- **Files Changed**: `src/services/syncService.ts`, `src/App.tsx`, `src/tests/unit/services/syncServiceErrorSurface.test.ts` (new, 4 tests), `src/tests/unit/components/appSyncError.test.tsx` (2 tests added).
- **Tests**: New: `tests/unit/services/syncServiceErrorSurface.test.ts` (4 tests for error collection in syncVendors). Updated: `tests/unit/components/appSyncError.test.tsx` (+2 tests for message priority in handleManualSync).
- **Verification**: `npm run test:unit` — 44 files, 247 tests, all passing. `npm run build` — clean (pre-existing chunk-size warning only). Lane 1 with review: route:reviewer returned FAIL on duplicate `errors` entry → fixed in one round → re-verified green.

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

