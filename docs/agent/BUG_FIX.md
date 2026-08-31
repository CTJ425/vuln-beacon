# Open Bugs

## BUG-001: Webhook Alerting Never Dispatches in Production
- **Status**: OPEN (2026-08-16)
- **Severity**: HIGH (feature completely non-functional in production)
- **Location**: `src/services/webhook.ts` (WebhookService constructor, registerWebhook method, IngestionEngine integration in src/services/syncService.ts)
- **Root Cause**: WebhookService only dispatches to configs added via registerWebhook(). That method is called nowhere in production code — only in `src/tests/e2e/webhook-alert-flow.e2e.test.ts:12`. In production, SyncService constructs an empty WebhookService, hands it to IngestionEngine, and notifyAll() loops over an empty array. Webhooks saved in Settings are never read at dispatch time.
- **Impact**: Webhook alerting is completely non-functional in production. E2E test passes only because it registers a config by hand first.
- **Expected Fix**: Spec written (docs/agent/specs/webhook-admin-and-server-dispatch.md) covering: (1) webhook-admin Edge Function for CRUD operations using service-role key, (2) webhook URLs moved server-side (so anon key can no longer read them), (3) IngestionEngine queries webhook_configs table and dispatches to all configured webhooks at sync completion.
- **Deferral Note**: DEFERRED per user direction to prioritise RHSA-centric core first. Phase B2 (webhook-admin Edge Function) blocked pending this fix.

## BUG-002: affected_products Fallback Hardcodes Product Name (Low-Priority Risk)
- **Status**: OPEN / ACCEPTED RISK (2026-08-16, found during Phase C1+C2 review)
- **Severity**: LOW (no present-day impact; future multi-vendor concern)
- **Location**: `src/services/advisoryService.ts` (AdvisoryService.fetchAdvisories, plain-string affected_products fallback)
- **Description**: In src/services/advisoryService.ts the plain-string affected_products fallback hardcodes product_name as 'Enterprise System', whereas src/services/cveService.ts uses the joined vendor name in the same position. The advisory-first query deliberately omits the vendors join. This creates an inconsistency in product naming between advisory-first and CVE-first views.
- **Impact**: Limited to future multi-vendor datasets where affected_products holds plain strings (objects) rather than already-parsed objects. In current Red Hat-only dataset, object path is used, so no present-day visible difference between the two queries.
- **Recommendation**: Revisit if/when second vendor is ingested and affected_products data model changes. Accept for now as low-priority risk.

## BUG-005: Per-chunk transient failure aborts the whole vendor run
- **Status**: OPEN / ACCEPTED RISK (2026-08-28, discovered during BUG-003 sync-payload oversize fix)
- **Severity**: LOW / ACCEPTED RISK
- **Location**: `src/services/syncService.ts` persist loop (syncVendors method, chunk-persist loop)
- **Description**: SyncService.syncVendors() now splits ingestions into chunks and issues N Edge Function invokes instead of 1. Any single chunk persist invoke that fails aborts the remaining chunks and marks the whole vendor run FAILED, even though earlier chunks have already persisted to the database.
- **Impact**: A run is now N invokes instead of 1, and any one failing invoke aborts the remaining chunks. Since upserts are idempotent, a retry of the whole vendor is safe; no automatic retry is implemented. A transient failure (e.g. Edge Runtime timeout on chunk 5 of 8) leaves chunks 1–4 persisted but the sync marked FAILED, with no partial-success indication. No transient chunk failure was observed in the live run of 2026-08-28 10:42:00 Asia/Taipei (4 data chunks, all HTTP 200).
- **Recommendation**: No automatic retry logic currently implemented. Revisit if live runs show transient chunk failures (e.g. timeouts on large chunks, network flake). A future fix would wrap each chunk invoke in retry logic or split into even smaller chunks. Accept for now as low-priority risk. Note: BUG-006 (product_impacts deduplication) would also remove the chunk size floor, further bounding this failure mode.

## BUG-006: product_impacts duplicated across advisory_cve_map rows
- **Status**: OPEN (2026-08-28, discovered during BUG-003 sync-payload oversize fix)
- **Severity**: LOW (high payload waste; deferred for schema impact; now also bounds BUG-003 (fixed) chunk size floor)
- **Location**: `src/adapters/redhat-csaf.ts` (advisory parsing), `src/services/advisoryService.ts`, `src/services/cveService.ts` (read paths)
- **Description**: `product_impacts` is advisory-level data (the set of products and their states affected by an advisory) but is stored denormalized in the schema: one copy per (advisory_id, cve_id) pair in the `advisory_cve_map` table. When an RHSA fixes multiple CVEs, identical `product_impacts` data is repeated once per CVE. Example: RHSA-2026:54622 fixes 25 CVEs → 25 identical copies of the same product/component impact list.
- **Impact**: Significant payload overhead. Live measurement on 49 advisories (2026-08-29 02:39 UTC): product_impact rows 39,386 total; if normalized to advisory-level storage, would compress to ~1,000 rows (measured 9.65 MB → ~0.13 MB). Current design treats each CVE's row as independent, so deduplication requires schema change and updates to all read paths (advisoryService, cveService, queries). **Chunk size floor risk**: Live verification on 2026-08-29 shows Chunk 1 reached 3.68 MB (`RHSA-2026:60520` with 143 mappings / 143 CVEs). The chunker cannot split below one advisory, so if a single advisory ever exceeds the Edge Runtime worker limit, the original oversize failure returns. Deduplicating product_impacts to advisory-level storage would remove this floor, further bounding the BUG-003 failure mode.
- **Recommendation**: Deferred. Deduplicating to advisory-level storage requires: (1) new schema column for impacts on advisories table or separate impacts lookup table, (2) backfill/migration, (3) updates to AdvisoryService.fetchAdvisories and CveService.fetchCves to join/aggregate from new location. Not urgent (current impact is unused IO, not functional bug). Revisit when payload size remains a concern post-chunking or when read performance becomes measurable bottleneck. Chunk size floor risk makes this also relevant for preventing future oversize failures on large single advisories.

## R1: Wall-Clock Limit on Full CSAF Ingest in One Edge Function Invocation
- **Status**: OPEN / ACCEPTED RISK (2026-08-28, TASK-13 Phase 2 decision)
- **Severity**: MEDIUM (deployment-blocking if observed; currently unobserved)
- **Location**: `src/supabase/functions/scheduled-sync/index.ts` (full vendor ingest), `src/engine/ingestion.ts` (adapter work)
- **Description**: Scheduled syncs invoke the Edge Function with `scheduled-sync` route, which fetches and ingests a full vendor's feed in one execution. The Edge Runtime enforces a wall-clock execution limit (typically 25-30 seconds). A full Red Hat CSAF ingest involving all advisories and CVE detail fetches may exceed this limit and be killed mid-run with an uncaught timeout.
- **Impact**: A large or slow vendor feed could timeout and mark the scheduled run FAILED, leaving no partial-success indication.
- **Recommendation**: Monitor live scheduled runs. If timeouts occur, split fetching from ingest (fetch once, ingest in smaller chunks) or implement Edge Function timeout handling with graceful degradation. Accept for now as observed risk only if live runs fail. User consciously chose pg_cron design despite this risk.

## R2: Failed Runs Do Not Retry; Later Scheduled Slot Waits for Next Due Time
- **Status**: OPEN / ACCEPTED RISK (2026-08-28, TASK-13 Phase 2 decision)
- **Severity**: LOW (operational convenience, not functional bug)
- **Location**: `src/supabase/functions/scheduled-sync/index.ts` (sets `last_scheduled_run_at` on any completion), `src/services/scheduleWindow.ts` (dueOccurrence logic)
- **Description**: `last_scheduled_run_at` is stamped whenever `public.tick_scheduled_syncs()` executes, regardless of success or failure. If a scheduled sync fails, the next tick sees the timestamp has advanced, marking the vendor not-due until the next scheduled interval expires (e.g. 1 day for daily sync). No automatic retry is triggered.
- **Impact**: A transient failure (Edge Runtime timeout, network flake, service error) leaves the sync in failed state until the next scheduled time. Manual re-trigger via browser UI is available but not automatic.
- **Recommendation**: Related to BUG-005 (per-chunk failure aborts vendor). Future retry logic could wrap the Edge Function invoke or extend scheduleWindow to detect recent failures. Accept for now; revisit if live runs show chronic failures. Note: existing BUG-005 already accepted per-chunk failure for browser manual syncs, so this is not new risk surface.

## R3: Mid-Tick Wall-Clock Kill Leaves Later Vendors with No Log Row
- **Status**: OPEN / ACCEPTED RISK (2026-08-28, TASK-13 Phase 2 decision)
- **Severity**: LOW (logging/observability only, not data loss)
- **Location**: `src/supabase/functions/scheduled-sync/index.ts` (vendor loop), `src/engine/ingestion.ts` (per-vendor orchestration)
- **Description**: `public.tick_scheduled_syncs()` iterates all due vendors in a loop, invoking `net.http_post` to scheduled-sync Edge Function for each. If wall-clock timeout fires between vendor N and vendor N+1, the Edge Function terminates and postgres function exits. Vendors N+1 onward are never invoked. For vendors that were never attempted, no `vendor_sync_logs` row is created at all.
- **Impact**: Log queries show those vendors were `skipped` (because they don't appear in any response array: ran/skipped/logs), but the absence is silent — no explicit FAILED entry, no indication a tick was cut short. Requires server-side console trace or monitoring the tick duration to detect the pattern.
- **Recommendation**: Implement per-vendor timeout guard or edge-case logging to record vendors that were due but never attempted. For now, monitoring tick execution time and final log counts is the mitigation. Accept as low-priority observability gap.

## BUG-007: Supabase Mock Missing `.range()` on `select()` Result
- **Status**: OPEN / TEST-QUALITY GAP (2026-08-29, found during R4/R6 fix review)
- **Severity**: LOW (test-quality gap, not production defect; behaviour is covered by other tests)
- **Location**: `tests/unit/services/syncServicePersist.test.ts` (Supabase mock `select()`)
- **Description**: The Supabase mock in syncServicePersist.test.ts lacks a `.range()` method on its `select()` result. When `fetchKnownCveIds()` calls `select().range()` in production, the test mock throws. The exception is silently swallowed by `fetchKnownCveIds()` own try/catch (designed to degrade on error), so this file never exercises the actual known-CVE-id read path.
- **Impact**: No regression catch if the query is broken (wrong table, wrong column, logic error). Behaviour itself IS covered by `tests/unit/services/syncServiceWebhookLoad.test.ts` and `tests/unit/engine/ingestionNewCveCount.test.ts`, which have proper mocks. This is a gap in coverage depth of one specific test file, not a gap in test pyramid.
- **Recommendation**: Add `.range()` mock to Supabase select result, or accept as low-priority test-coverage gap. The two new tests added for R4/R6 fixes already cover the production behaviour.

## R5: Double vendor_sync_logs Insert Failure Leaves Vendor Orphaned in Response Arrays
- **Status**: OPEN / ACCEPTED RISK (2026-08-28, TASK-13 Phase 2 decision)
- **Severity**: LOW (observability only; not data loss)
- **Location**: `src/supabase/functions/scheduled-sync/index.ts` (vendor loop response), `src/supabase/functions/sync-cve/index.ts` (persist_ingestion action, vendor_sync_logs writes)
- **Description**: scheduled-sync Edge Function collects vendor results in three response arrays: ran (successful), skipped (scheduled timeout), logs (successful log writes). When the vendor_sync_logs insert fails twice (once on the immediate persist, once on the delayed log-write), the vendor appears in none of these arrays. Only a server-side console trace records the error.
- **Impact**: Response query shows fewer vendors than actually attempted. Silent failure of observability/logging path. Data (CVEs, advisories) may or may not persist depending on where the error occurred (before or after upsert).
- **Recommendation**: Implement explicit failure logging to response or return a fourth array (`failed`) with error reasons. Accept for now as low-priority observability gap.

## R7: DST Precision Loss on Spring-Forward and Fall-Back Days in Observing Timezones
- **Status**: OPEN / ACCEPTED RISK (2026-08-28, TASK-13 Phase 2 decision)
- **Severity**: LOW (minor precision loss, once or twice per year)
- **Location**: `src/services/scheduleWindow.ts` (dueOccurrence function, timezone offset lookup)
- **Description**: dueOccurrence resolves a local wall-clock time to UTC by looking up the timezone offset once at the current timestamp. On the day a timezone observes spring-forward or fall-back (DST transition), the offset changes during the day. A lookup at 6 AM on the transition day returns the pre-transition offset, so a sync scheduled for 2 AM (which fell back to 1 AM or is ambiguous) will resolve to an incorrect UTC time.
- **Impact**: On DST transition days, a sync scheduled for the ambiguous or spring-forward hour will run approximately 1 hour off from the intended local time. This happens approximately twice per year (spring-forward and fall-back) in observing timezones.
- **Recommendation**: Implement DST-aware timezone math using a library like `date-fns-tz` or `luxon` that handles DST transitions correctly. For now, the default timezone is Asia/Taipei (no DST), so this risk is muted in production. Accept if the user's configured timezone has DST; revisit if user reports schedule skew on transition days.
