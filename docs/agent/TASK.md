# Active Tasks

## Current Work Stream: Ingestion Engine & Frontend Triage Dashboard

- [x] **Task 1: Core Project Scaffolding, Testing Framework & Database Setup**
  - [x] Initialize React + Vite + TypeScript + Vitest setup.
  - [x] Create Supabase migration SQL scripts (`supabase/migrations/20260815000000_init_cve_collector.sql`) with tables, indexes, RLS policies, and vendor seed data.
  - [x] Create comprehensive testing documentation (`docs/test/` with README, TDD Guidelines, Unit, Smoke, E2E plans).
  - [x] Synchronize memory and TDD standards across `AGENT.md`, `CLAUDE.md`, and `GEMINI.md`.
  - **Verification**: `npm run test:smoke` passed; database migration valid; test pyramid established.

- [x] **Task 2: Vendor Ingestion Adapters & Normalization Engine (TDD Completed)**
  - [x] Implement individual vendor adapters for 8 enterprise vendors:
    - [x] `adapters/redhat.ts`
    - [x] `adapters/vmware.ts`
    - [x] `adapters/nutanix.ts`
    - [x] `adapters/dell.ts`
    - [x] `adapters/hpe.ts`
    - [x] `adapters/netapp.ts`
    - [x] `adapters/veeam.ts`
    - [x] `adapters/cohesity.ts`
  - [x] Implement CVSS calculation and standard CVE normalizers (`utils/cvss.ts`, `utils/cve-normalizer.ts`).
  - [x] Implement IngestionEngine coordinator (`engine/ingestion.ts`) with sync log tracking.
  - **Verification**: `npm run test:unit` passed (13 unit test files, 35 tests).

- [x] **Task 3: Webhook Notification Engine & Formatters (TDD Completed)**
  - [x] Implement WebhookService dispatcher (`services/webhook.ts`).
  - [x] Implement payload formatters for Discord, Telegram, and Slack (`formatters/`).
  - [x] Implement E2E webhook alert trigger verification.
  - **Verification**: `npm run test:e2e` passed (ingestion, webhook dispatch, triage lifecycle).

- [x] **Task 4: Frontend Development (React + MUI Dashboard & Triage Interface)**
  - [x] Build Overview Dashboard (metrics, critical alerts, vendor breakdown).
  - [x] Build CVE Explorer (search, multi-vendor filtering, severity filters, sorting, pagination).
  - [x] Build Advisory Detail & Triage Drawer (status update, assignees, internal notes).
  - [x] Build Sync Monitor & Manual Trigger page.
  - [x] Build Webhook Settings page.
  - [x] Add dynamic theme switching: `system` / `dark` / `light` with `ThemeSwitcher`, `ThemeContext`, and `localStorage` persistence.
  - **Verification**: All views render responsive UI and pass UI component tests (`App.test.tsx`, `MetricCards.test.tsx`, `ThemeSwitcher.test.tsx`).

- [x] **Task 5: End-to-End Integration & Verification**
  - [x] End-to-end integration tests: Ingestion -> Webhook -> Dashboard -> Triage.
  - [x] Scaffold Supabase Edge Function (`supabase/functions/sync-cve/index.ts`).
  - [x] Full production build & test pyramid verification (`npm test` and `npm run build`).
  - **Verification**: Complete flow executes successfully end-to-end (24 test suites, 60 tests passed 100%).

- [x] **Task 6: Live Supabase Backend Integration & Real Ingestion Pipeline**
  - [x] Link project and apply database migration to live Supabase instance (`https://xgrtyjazyqajqinwzlbl.supabase.co`).
  - [x] Delete static mock datasets; build live data services (`cveService.ts`, `syncService.ts`, `webhookConfigService.ts`).
  - [x] Execute live multi-vendor sync directly populating live CVE records and sync logs into Supabase.
  - [x] Wire live reactive loading, optimistic triage updates, and webhook configuration management.
  - **Verification**: 25 test suites, 63 tests passing 100%; Vite production build successful.

- [x] **Task 8: Removal of Triage Operations & Products/Components Impact Matrix**
  - [x] Delete all Analyst Triage Operations (Triage queue navigation, status forms, analyst notes, and legacy triage files).
  - [x] Implement enterprise **Products & Components Impact Matrix** with columns: `Products / services`, `Components`, `State`, `Justification`, `Errata`, `Release date`.
  - [x] Upgrade crawler to extract detailed `package_state` and `affected_release` component lists.
  - [x] Add component-level search, copy actions, state filter tabs (`Affected`, `Fix deferred`, `Fixed`), and Errata hyperlinks.
  - **Verification**: 26 test suites, 65 tests passing 100%; Vite production build clean.

- [x] **Task 9: Security Refactor — Edge Function Backend & RLS Write Policies**
  - [x] Move all Supabase write operations behind Edge Function with service-role key.
  - [x] Tighten Row-Level Security (RLS) write policies to enforce granular permissions.
  - [x] Update sync services to use Edge Function endpoints (webhook handlers use Edge Function for advisory persistence, pending webhook-admin Edge Function task).
  - **Verification**: 58/58 tests passed; clean build; live production verified: anon key RLS restrictions enforced (INSERT fails with 42501), Edge Function validates vendor codes before writing. Completed 2026-08-16 00:04:13 CST.

- [x] **Task 12: Supabase env var naming migration + GitHub Actions removal**
  - [x] Rename `VITE_SUPABASE_ANON_KEY` to `VITE_SUPABASE_PUBLISHABLE_KEY` throughout codebase; remove hardcoded fallback key from module.
  - [x] Rewrite `.env.example` template with three sections: frontend vars, local-script secrets, platform-injected Edge Function vars.
  - [x] Update build config (`vite.config.ts`, `vitest.config.ts`) for self-hosted static builds and test isolation.
  - [x] Delete GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) and associated documentation.
  - [x] Update `README.md` environment setup and deployment sections for self-hosted builds.
  - **Verification**: `npm --prefix src test` 36 files / 159 tests passed; `npm --prefix src run build` clean; reviewer pass on fixes to 2 BLOCKERs (README references) and 3 RISKs (dangling file, dead branch, unobservable export).
  - **Completed**: 2026-08-27 17:31:17 Asia/Taipei.

- [x] **Task 11: Webhook Settings & Admin Controls — Edge Function Backend & RLS Write Policies (Phase B2)**
  - [x] Implement webhook proxy handler in `sync-cve` Edge Function for webhook create/delete/test operations using service-role key.
  - [x] Apply RLS write policy restrictions to `webhook_configs` table (migration `20260905000000_security_and_reliability_fixes.sql`).
  - [x] Update `webhookConfigService.ts` to route all mutations and tests through `sync-cve` Edge Function.
  - [x] Verify webhook management UI works correctly with backend Edge Function (bypasses browser CORS on Slack, blocks SSRF).
  - **Verification**: 52 test files, 279 tests passing; clean build. Completed 2026-09-05 Asia/Taipei.

- [x] **Task 13 Phase 1: Feed Sources Panel — Vendor API Endpoint Visibility (COMPLETED)**
  - [x] Implement `VendorEndpoint { label, url }` type and add `readonly endpoints: VendorEndpoint[]` to `VendorAdapter`.
  - [x] Expose adapter endpoint URLs (advisory list, detail, CVE lookup) in `RedHatCsafAdapter`.
  - [x] Create `VendorService.fetchVendors()` to read `vendors` table.
  - [x] Create `FeedSourceTable` component showing vendor, integration status, endpoint URLs, and last sync time.
  - [x] Update `SyncMonitorPage` with `Feed Sources` section and real endpoint display.
  - [x] Move `vendors` fetch outside blocking `Promise.all` in `App.tsx` (discovered constraint: blocking vendors delayed isLoading gate).
  - **Verification**: 42 files / 193 tests passed; build clean. Rendered: Red Hat shows `Connected` with three endpoints; others show `Not implemented`.
  - **Completed**: 2026-08-28 11:20:00 Asia/Taipei.

- [x] **Task 13 Phase 2: Vendor Schedule Settings — UI & Edge Function Write Path (COMPLETED)**
  - [x] Build real scheduler (pg_cron + pg_net + new scheduled-sync Edge Function) that reads schedule values from vendors table columns.
  - [x] Implement `src/services/scheduleWindow.ts` with due-time logic (dueOccurrence, isVendorDue, SCHEDULE_TICK_TOLERANCE_MINUTES).
  - [x] Create scheduled-sync Edge Function that reuses app's real ingestion code via esbuild bundle.
  - [x] Add `update_vendor_schedule` action to sync-cve Edge Function for schedule writes.
  - [x] Create ScheduleSettings component for editable Sync-page UI.
  - [x] Implement migration 20260828000000_vendor_schedule.sql with pg_cron scheduling and vault secret documentation.
  - **Verification**: 47 test files, 242 tests all passing; build clean.
  - **Completed**: 2026-08-28 23:55:48 Asia/Taipei.
  - **Deployment note**: migration and scheduled-sync Edge Function NOT YET DEPLOYED. See PROGRESS.md entry for deployment steps.

- [x] **Task 14: Fix IngestionEngine.newCvesCount Over-Reporting**
  - [x] Fixed ingestion.ts to compute `isTrulyNew` (within-run dedup AND absent from knownCveIds).
  - [x] Fixed syncService to report engine's `newCvesCount` to sync log instead of hardcoded cves.length.
  - [x] Added private `fetchKnownCveIds()` helper for on-demand lookup path.
  - [x] New tests: `tests/unit/engine/ingestionNewCveCount.test.ts`.
  - **Completed**: 2026-08-29 00:40:13 Asia/Taipei.

- [x] **Task 15: Dispatch Webhook Alerts from Scheduled Runs**
  - [x] Implemented `SyncService.loadWebhooks()` to read and register active webhook configs.
  - [x] Added `WebhookService.clearWebhooks()` to rebuild registered set on each load.
  - [x] Updated scheduled-sync Edge Function to fetch webhook configs server-side with service-role client.
  - [x] New tests: `tests/unit/services/syncServiceWebhookLoad.test.ts`.
  - **Completed**: 2026-08-29 00:40:13 Asia/Taipei.

- [x] **Task 10: CVE/RHSA Data Model Redesign — Dashboard Reorganization (Phase C1+C2+C3a+C3b Complete; Bug Fixes 3–5 Complete)**
  - [x] **Phase C1+C2: RHSA-Centric Data Layer** (Completed 2026-08-16)
    - [x] Rewrote `src/adapters/redhat.ts` parse() to emit one NormalizedAdvisoryItem per RHSA in advisoriesList, each with its own errata URL and fixed versions tied to that specific advisory.
    - [x] Created `src/services/advisoryService.ts` with AdvisoryService.fetchAdvisories() querying FROM advisories joining advisory_cve_map → cves, returning AdvisoryRowItem[] with every CVE each advisory fixes, product_impacts aggregated/deduped, fixed_versions unioned.
    - [x] Refactored `src/services/cveService.ts` to iterate ALL advisory_cve_map mappings (not just [0]), merging product_impacts and unioning fixed_versions across all mappings.
    - [x] Added dedupication to advisoriesList via Array.from(new Set(...)) to prevent duplicate errata IDs from upstream producing duplicate advisory rows.
    - [x] TDD red→green: 3 new unit tests (redhatMultiAdvisory.test.ts), 3 new unit tests (advisoryCentric.test.ts). Verification: npm test 64/64 passed, npm run build clean.
  - [x] **Phase C3a: RHSA-Centric Dashboard** (Completed 2026-08-16)
    - [x] New AdvisoryTable component renders one row per RHSA advisory (errata id, CVEs fixed, severity, synopsis, affected products, date).
    - [x] MetricCards gained optional `labels` prop (defaults to hardcoded strings for backward compatibility; existing test passes).
    - [x] DashboardPage now advisory-first: metrics count advisories (Critical RHSA / Tracked Advisories), urgent list renders AdvisoryTable over CRITICAL/HIGH advisories, product distribution computed from advisories.
    - [x] App.tsx loads advisories via AdvisoryService and holds selectedAdvisory state.
    - [x] Verification: npm test 69/69 passed, npm run build clean.
  - [x] **Phase C3b: Advisory Detail Drawer & Explorer Grouping** (Completed 2026-08-16)
    - [x] New AdvisoryDetailDrawer shows errata header with link, impact synopsis, FULL LIST OF EVERY CVE THE ADVISORY FIXES (previously missing capability), affected products/components matrix, remediation text with copyable dnf command.
    - [x] ExplorerPage advisory view now groups by RHSA via filteredAdvisories memo instead of re-labelling CVE rows; all filters + search apply to advisories; searching a CVE id surfaces the RHSA that fixes it.
    - [x] App.tsx wires the drawer and passes advisories to ExplorerPage.
    - [x] Verification: npm test 76/76 passed, npm run build clean.
  - [x] **Task 3 (BUG FIX): Red Hat CVE Detail Payload Silently Discarded** (Completed 2026-08-16)
    - [x] File: `src/adapters/redhat.ts`. Root cause: detail endpoint uses different shape (id in `name` not `CVE`, severity in `threat_severity`, score nested in `cvss3.cvss3_base_score`). parse() dropped all detail records. SyncService.fetchAndIngestQuery() feeds detail payload to parse(), so on-demand lookups returned zero items.
    - [x] Fix: parse() normalises detail shape onto list-shape fields at top of per-record loop.
    - [x] New test: `src/tests/unit/adapters/redhatDetailShape.test.ts` (6 tests, regression guard, real API fixture).
  - [x] **Task 4 (BUG FIX): On-Demand Lookup Reported Success After Writing Nothing** (Completed 2026-08-16)
    - [x] File: `src/services/syncService.ts`. fetchAndIngestQuery() returned true whenever edge function did not error, even when engine.getCves() was empty; UI showed success while nothing persisted.
    - [x] Fix: Now returns false when engine.getCves() empty.
    - [x] Coverage: new case in `src/tests/unit/services/syncServicePersist.test.ts`.
  - [x] **Task 5: Adapter Advisory-ID Deduplication** (Completed 2026-08-16)
    - [x] File: `src/adapters/redhat.ts`. Adjudicated RISK from C1/C2 review. advisoriesList wrapped in Array.from(new Set(...)) to prevent duplicate errata IDs from upstream emitting duplicate advisory rows.
  - [x] **LIVE END-TO-END VERIFICATION** (Completed 2026-08-16)
    - [x] Ran full pipeline against real Red Hat Security Data API and live Supabase (xgrtyjazyqajqinwzlbl) using CVE-2023-4911 (glibc ld.so, 5 distinct RHSAs).
    - [x] Adapter emitted 5 advisory items (before fixes: 0 from this payload shape), correctly reading CVSS 7.8 / severity HIGH from nested cvss3, 12 product impact rows.
    - [x] IngestionEngine produced 5 advisories, 1 CVE, 5 mappings.
    - [x] Edge function persisted all 5 RHSA rows (RHSA-2023:5453, 5454, 5455, 5476, RHSA-2024:0033) correctly linked to CVE-2023-4911 with 12 impact rows each.
    - [x] One-CVE-to-many-RHSA relationship verified end-to-end in production.
    - [x] Final State: npm test 26 test files / 83 tests all passing; npm run build clean.
  - [x] **Phase D: CSAF Advisory-First Ingestion Rework** (Completed 2026-08-16)
    - [x] New `src/adapters/redhat-csaf.ts` (RedHatCsafAdapter) parses CSAF 2.0 documents advisory-first with one NormalizedAdvisoryItem per errata carrying every CVE it fixes. Advisory metadata from document.tracking/aggregate_severity/notes; per-CVE score, vector, severity with fallback chain (threats→baseSeverity→advisory), description from vulnerabilities[]. Product impacts resolved from product_tree via recursive branch walk with raw-id fallback; package NVRs reduced to base components; composite ids split on FIRST colon only. product_status keys mapped to display states. rawPayload stores only csaf_document_id and cve_ids (not full 1 MB+ documents).
    - [x] `src/adapters/index.ts`: RedHatCsafAdapter now registered as getAdapterByCode('redhat'); RedHatAdapter still exported.
    - [x] `src/services/syncService.ts`: fetchAndIngestQuery rewritten to CSAF endpoints (errata id → detail endpoint; CVE → csaf.json?cve= then parallel detail fetches). Old /securitydata/cve.json and /cve/<id>.json calls removed. syncVendors() unchanged.
    - [x] Readability: Build artifacts (-debuginfo/-debugsource) dropped; per-locale packages collapsed. Verified on glibc: 214 rows → 19 with all 16 meaningful packages preserved.
    - [x] Review PASS: first-colon splitting, NVR truncation, recursive product-tree walk, state mappings, debug filtering, severity fallback, rawPayload exclusion verified. One RISK (non-array product_status) FIXED with Array.isArray guard.
    - [x] Obsolete tests adjudicated: 4 failures (CVE-first shape) expected and fixed. Three E2E suites now run on new CSAF fixture (csaf-e2e-sample.json) with original assertions intact; component expectations updated.
    - [x] New tests: redhatCsaf.test.ts (8), redhatCsafCollapse.test.ts (5), csafQuery.test.ts (5).
    - [x] Live database re-ingestion: User-authorised purge of advisory_cve_map/advisories/cves. Ran advisory-first pipeline against live Red Hat API and Edge Function. Result: 50 advisories, 142 CVEs, 238 mappings. Average CVEs/advisory 1.00 → 4.76. Maximum 1 → 25. Cross-mapped advisories 0 → 55. Sample: RHSA-2026:54622 (Apache Camel, 25 CVEs), RHSA-2026:54757 (OpenStack, 24), RHSA-2026:54572 (webkit2gtk3, 23).
    - [x] Verification: npm test 29 files / 101 tests passing; npm run build clean.

## Current Work Stream: Self-Hosted Deployment Network Topology

- [ ] **Task 11a: Network Layer Only — No Code Change** — Implement Cloudflare Tunnel + Caddy reverse proxy with path prefix (`/supabase`). Ref: `docs/agent/specs/self-host-deployment-topology.md` (design points D1–D4).
- [x] **Task 11b: Fix ENV Example & Document Self-Host Edge Function Deploy** — Corrected `src/.env.example` and `README.md` comments regarding platform vs self-hosted Edge Function environment variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`). Documented manual Edge Function bundling (`build:edge`), volume deployment, and reverse proxy configuration (D5, D6). Ref: `docs/agent/specs/self-host-deployment-topology.md`.
- [x] **Task 11c: Move Browser Manual Sync Server-Side** — Relocate sync trigger from browser (`syncService.ts:319-332`) to Edge Function endpoint (`sync-cve` / `scheduled-sync`), allowing manual sync to succeed for tailnet-restricted users (C1). Implemented `action: 'trigger_manual_sync'`, PostgreSQL advisory lock `try_acquire_sync_lock`, server-side ingestion via `ingest.bundle.js`, and role-gated admin JWT validation. Ref: `docs/agent/specs/manual-sync-server-side.md`.
- [x] **Task 11d: Webhook Admin & Server Dispatch Edge Function** — Add Role-Based Access to webhook_configs table (C2); prevent unauthenticated SELECT/write. Proxy actions implemented in `sync-cve` Edge Function. Ref: `docs/agent/specs/webhook-admin-and-server-dispatch.md`.
- [x] **Task 24: Bug Hunting, Stability Remediation & 1.0.0 Production Release** — Discovered and fixed Rules-of-Hooks latent violation in `CveDetailDrawer.tsx` (reordered `realAdvisories` and `primaryAdvisory` hooks above early return), fixed unmounted notification timer leaks in `App.tsx` with dedicated `useEffect` cleanup, defended webhook service calls against uninitialized instances in `syncService.ts`, normalized PostgREST joined relation shapes in `cveService.ts`, and promoted versioning to `1.0.0` for merge to `main`.
  - **Verification**: 80/80 test files (531 tests) passing 100%; production build clean. Completed 2026-09-09 17:30:00 Asia/Taipei.

- [x] **Open Item: NavState Latent Risk** — Resolved in `Sidebar.tsx` and `App.tsx`: legacy `'sync' | 'settings'` sections are gracefully routed to the authenticated Admin Console, and an explicit fallback error boundary renders if an unrecognized navigation section is dispatched. Covered by regression unit tests in `App.test.tsx` and `Sidebar.test.tsx`.

- [ ] **Open Item: Live Preview Verification Pending** — Acceptance criterion not yet met: live verification against the preview instance at `http://10.8.22.99:3002/` (per `.agents/ORIGINAL_REQUEST.md` R5) has not been performed. Port unreachable (connection refused) from development container; awaiting network access or deployment confirmation.

## Completed Work Streams

- [x] **Task 16: Comprehensive Security & Reliability Audit Remediation (16 Findings)**
  - [x] P0.1 Auth token verification, CVE regex format validation, and 5MB payload ceiling in `sync-cve` Edge Function.
  - [x] P0.2 & P0.4 Revoke `tick_scheduled_syncs` from public/anon/auth, add `pg_try_advisory_xact_lock` concurrency lock, vault secrets check, and tighten `webhook_configs` RLS write policy.
  - [x] P0.3 SSRF guard (`isSafeDestinationUrl`) enforcing HTTPS and blocking loopback, RFC1918, RFC3927, RFC4193 addresses across all webhooks.
  - [x] P1.1 Telegram chat_id query extraction, HTML escaping, and 4000 char message truncation.
  - [x] P1.2 Slack webhook CORS proxy via `sync-cve` Edge Function.
  - [x] P1.3 Slack (2,500 char) and Discord (3,500 description / 1,000 field) payload truncation guards.
  - [x] P1.4 Dispatch webhooks on on-demand explorer queries (`loadWebhooks` in `fetchAndIngestQuery`).
  - [x] P1/P2.1 Edge Function build synchronization (`build:edge` before `tsc` and `vite build`).
  - [x] P2.1 Manual sync error reporting and unadulterated error diagnostics preservation.
  - [x] P2.2 Explorer query chunking using `buildPersistChunks`.
  - [x] P2.3 CSAF concurrent fetch bounded to batches of 5 requests max.
  - [x] P2.4 Scheduled sync retry on transient failure (`failed` vendor array, `last_scheduled_run_at` stamped only on success).
  - [x] UI & Data Integrity: vendor name fallback in `advisoryService`, unimplemented vendor disabled state in `ScheduleSettings`, Supabase select mock range/order chaining.
  - **Verification**: 52 test files, 283 tests all passing (100%); build clean.
- [x] **Task 17: Supabase Edge Function 401 Auth Fix & Detailed Error Diagnostic Surfacing**
  - [x] Fix 401 on `sync-cve`: update auth check to accept either `Authorization: Bearer <token>` or `apikey: <key>`, resolving Supabase SDK `omitApiKeyAsBearer` stripping on `sb_publishable_...` keys.
  - [x] Add `getFunctionHeaders()` in `src/lib/functionAuth.ts` and update `syncService.ts`, `webhookConfigService.ts`, and `vendorService.ts` to pass explicit Authorization headers.
  - [x] Add `extractErrorMessage()` in `syncService.ts` to unpack `err.context.json()` on `FunctionsHttpError` so underlying failure reasons reach the user.
  - [x] Restore missing `try {` block in `scheduled-sync/index.ts` vendor loop that broke Deno bundling.
  - [x] Link and deploy migrations & active functions (`sync-cve`, `scheduled-sync`) to cloud Supabase instance (`egofadbvftmbwodjneoy`).
  - [x] **Task 18: Log Observability Field & Supabase Authenticated Backstage Portal**
  - [x] Create database migration `20260907000000_add_sync_log_details.sql` adding `details` JSONB column with GIN/btree indexes to `vendor_sync_logs` table and deploy to Supabase Cloud runtime.
  - [x] Update `VendorSyncLog` domain model, `IngestionEngine`, and `SyncService` to capture structured execution metrics, endpoints, and error stack traces in `details`.
  - [x] Create `LogDetailModal` component and wire into `SyncLogTable` with an inspect action column.
  - [x] Create `AdminLoginModal` with Supabase authentication (`signInWithPassword`) and gate `AdminPage` navigation only upon clicking Admin Console; keep public CVE explorer and dashboards open.
  - [x] Create `AdminPage` with 3 core capabilities:
    1. **Webhook Settings**: Configured webhooks integration (Discord, Slack, Telegram), connection testing, deletion, and minimum severity threshold.
    2. **Log Data Query**: Added `AdminLogQuery` component supporting status filtering, vendor filtering, keyword search on errors/details, JSON export, and full observability modal.
    3. **API & Supabase Operation Status**: Added `SystemHealthMonitor` checking PostgreSQL database latency, GoTrue Auth service, S3 Storage bucket availability, Edge Function runtime, and external vendor feeds (Red Hat CSAF).
  - [x] Update Edge Functions `sync-cve` and `scheduled-sync` to persist `details` and deploy to Supabase Cloud runtime.
  - [x] Add unit and E2E test suites for Admin login, Admin page, Log query, Log modal, System health monitor, and migration schema.
  - **Verification**: 61 test files, 325 tests all passing (100%); build clean.
  - **Completed**: 2026-09-07 15:15:00 Asia/Taipei.

- [x] **Task 19: Adversarial Review Fixes: Edge Function Health Check, Chunk Guard, Backstage State & Session Redirection (1.0.0-dev.4)**
  - [x] Fix Edge Function crash on intermediate chunks: guard `vendor_sync_logs` write with `if (syncMeta && syncMeta.status)` in `sync-cve`.
  - [x] Add `health_check` endpoint to `sync-cve` Edge Function, deploy to live Supabase Cloud runtime, and verify live HTTP 200 response via curl.
  - [x] Fix `SystemHealthMonitor.tsx` to inspect invoke `{ data, error }`, preventing false-positive operational status, and enforce 6s timeout on external feed queries.
  - [x] Replace `loadData` with dedicated `handleRefreshLogs` callback in `App.tsx`, preserving active backstage tab on log refresh.
  - [x] Add route protection effect in `App.tsx` redirecting to dashboard if an admin session expires mid-session.
  - [x] Add informative error messages in `AdminLoginModal.tsx` for pending email confirmation or null session states.
  - [x] Add MUI `TablePagination` to `AdminLogQuery.tsx` and resilient clipboard copy fallback in `LogDetailModal.tsx`.
  - **Verification**: 61 test files, 331 tests all passing (100%); build clean.
  - **Completed**: 2026-09-07 15:30:00 Asia/Taipei.

- [x] **Task 20: UI Navigation Consolidation & Role-Gated Access (1.0.0-dev.5)**
  - [x] **R1 — Navigation & Access Boundary Consolidation**: Remove `Sync Monitor` and `Webhooks & Config` from public sidebar; consolidate into 4-tab authenticated Admin Console (Webhooks, Sync Monitor, Log Query, System Health). Hide vendor quick-nav sidebar while Admin Console active; vendor views remain accessible via Dashboard vendor tiles.
  - [x] **R2 — Role-Gated Manual Sync**: Fix security defect in `ExplorerPage.handleFetchDirectly` (no authentication check allowing unauthenticated visitors to perform live vendor fetch and persist CVE data). Gate via `isAuthenticated` prop; control not rendered and handler returns early for unauthenticated users. Forward prop to embedded `ExplorerPage` from `VendorPage`. Fix spec compliance: Dashboard empty-state "Sync All Feeds Now" navigates to Admin Console with login modal when signed out. Add regression test: `src/tests/unit/pages/explorerDirectFetchGate.test.tsx` (4 tests).
  - [x] **R3 — Vendor-Neutral Nomenclature**: Replace vendor-biased user-facing text across MetricCards, AdvisoryTable, AdvisoryDetailDrawer, CveTable, CveDetailDrawer, CveFilterBar, ExplorerPage, DashboardPage, and VendorPage. Preserve data identifiers (vendor codes, advisory_id, errata, adapter ids, API paths, DB columns, VendorIcon codes).
  - [x] **R4 — Header & Sidebar** (previously implemented): Header GitHub repository link and Sidebar version footer via new `src/config/version.ts`.
  - [x] **Additional Quality**: Fix severity filter label/control association in `CveFilterBar`. Realign 6 stale tests encoding pre-R1/R3 behavior without weakening coverage. Version assertions now compare against `APP_VERSION` instead of hardcoded literals. Add `.claude/version.config.json`.
  - **Verification**: All 70 test files (448 tests) passed 100%; `npm --prefix src run build` clean; `npx tsc --noEmit` clean.
  - **Completed**: 2026-09-07 18:56:07 CST.

- [x] **Task 21: Collapsible Left Sidebar (1.0.0-dev.5)**
  - [x] Implement collapsible sidebar in `Sidebar.tsx`: responsive width transition (240px <-> 64px), collapse toggle button in footer (`sidebar-collapse-button`), right-placement `Tooltip` on navigation items when collapsed, and hidden labels.
  - [x] Support `hideLabel` in `VendorIcon.tsx` for compact navigation rail display.
  - [x] Add sidebar toggle button in `Header.tsx` (`header-sidebar-toggle`) with accessible aria-label matching collapsed state.
  - [x] Wire `isSidebarCollapsed` in `App.tsx` with `localStorage` persistence (`vulnbeacon-sidebar-collapsed`).
  - [x] Add unit tests in `Sidebar.test.tsx` (13 tests), `VendorIcon.test.tsx` (2 tests), and `Header.test.tsx` (17 tests).
  - [x] Add E2E tests in `tests/e2e/sidebar-collapse.e2e.test.tsx` (5 tests) verifying collapse, expand, header toggle, navigation while collapsed, and localStorage persistence.
  - **Verification**: All 72 test files (467 tests) passed 100%; `npm --prefix src run build` clean; `tsc` clean.
  - **Completed**: 2026-09-08 15:20:00 Asia/Taipei.

- [x] **Task 22: Authentic Vendor SVG Logos, UI/UX Optimization & Vault Secrets Scheduler Diagnostics (1.0.0-dev.5)**
  - [x] **Authentic Enterprise Vendor SVG Logos**:
    - Created pure vector React SVG components in `src/components/icons/VendorLogos.tsx` for 8 vendors: Red Hat (Fedora hat), NetApp (Gateway Arch), VMware (Virtualization blocks), Nutanix (Cloud Arc & Chevron), Dell (Circular badge with slanted 'E'), HPE (Element Green rectangle), Veeam (Twin chevron arrow), Cohesity (Diamond cluster node).
    - Integrated genuine SVG logos into `VendorIcon.tsx` with hover micro-animations and custom sizing.
    - Updated `VendorIcon.test.tsx` with 6 unit tests verifying brand SVG rendering and accessible names.
  - [x] **Vault Secrets Scheduler Diagnostics & Guide**:
    - Addressed "Missing vault secrets: scheduled_sync_url or scheduled_sync_key not configured" root cause in PostgreSQL `tick_scheduled_syncs()`.
    - Created migration `20260908000000_harden_vault_secrets_scheduler.sql` adding 1-hour error log throttling and stored procedure `set_scheduled_sync_vault_secrets()`.
    - Created standalone setup script `src/supabase/setup_vault_secrets.sql` covering Cloud and Self-Hosted configurations.
    - Added `VaultSecretsGuideBanner` in `ScheduleSettings.tsx` with copyable SQL template.
    - Added interactive resolution card in `LogDetailModal.tsx` and warning indicator in `SyncLogTable.tsx`.
  - [x] **UI/UX Polish**:
    - Added hover elevation, subtle shadows, and border highlights to MetricCards and Dashboard vendor summary cards.
    - Added frosted glassmorphism backdrop blur to Header.
  - [x] **Vendor Ingestion Feasibility & Risk Analysis**:
    - Delivered technical analysis comparing Nutanix, VMware (Broadcom), Dell, HPE, NetApp, Veeam, Cohesity feeds regarding anti-bot walls, CSAF readiness, version mapping, and data normalization.
  - **Verification**: 74 test files (484 tests) passed 100%; production build clean; unit, smoke, and E2E suites passing.
- [x] **Task 23: Nutanix Enterprise Ingestion Adapter, Supabase Edge Deployment & Full-Lifecycle E2E Verification (1.0.0-dev.5)**
  - [x] **Nutanix Adapter Implementation (`src/adapters/nutanix.ts`)**:
    - Implemented full `VendorAdapter` compliance (`vendorCode = 'nutanix'`, `vendorName = 'Nutanix'`).
    - Integrated 3 official Nutanix security endpoints:
      - Advisories list: `POST https://portal.nutanix.com/api/v1/advisories` (page, pageSize, sortColumn, sort).
      - Advisory detail: `GET https://portal.nutanix.com/api/v1/advisory?id={advisoryId}`.
      - Vulnerabilities search: `POST https://portal.nutanix.com/api/v1/vulnerabilities` (searchQuery, page, pageSize).
    - Added batched concurrency with error isolation (`batchSize = 5`) in `fetchAdvisories`.
    - Implemented `parse(rawPayload)` normalizing `cvelist`, CVSS v3 score/vector/severity ('CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'), product impacts (`AOS`, `Prism`, `AHV`), fixed releases, and synopsis.
  - [x] **Registry & Sync Service Integration**:
    - Registered `NutanixAdapter` in `src/adapters/index.ts` alongside Red Hat CSAF adapter.
    - Updated `src/types/index.ts` with optional `limit?: number` on `fetchAdvisories()`.
    - Extended `SyncService.fetchAndIngestQuery()` with native support for `NXSA-` advisory IDs and Nutanix vulnerability search fallback for CVE queries.
    - Preserved `SYNCED_VENDOR_CODES = ['redhat'] as const` to avoid breaking single-vendor chunking contract (BUG-003).
    - Updated `FeedSourceTable.tsx` so Nutanix displays as `Connected` with its 3 live endpoints.
  - [x] **Edge Function Bundling & Supabase Cloud Deployment**:
    - Bundled Nutanix adapter into `src/supabase/functions/_shared/ingest.bundle.js` with esbuild via `node scripts/buildEdgeBundle.mjs`.
    - Deployed `sync-cve` and `scheduled-sync` Edge Functions to cloud instance (`egofadbvftmbwodjneoy`) using Supabase access token.
    - Verified `health_check` endpoint returns HTTP 200 `{"success":true,"status":"ok"}`.
    - Verified live persistence of Nutanix advisory `NXSA-AOS-7.5.1.12` and CVE `CVE-2026-33416` into Supabase cloud PostgreSQL.
  - [x] **Unit, Smoke, and E2E Test Pyramid**:
    - Created unit tests: `src/tests/unit/adapters/nutanix.test.ts` (10 tests) and `src/tests/unit/services/nutanixSyncService.test.ts` (7 tests).
    - Updated smoke tests: `src/tests/smoke/adapters.smoke.test.ts` (added live Nutanix API fetch verification).
    - Created E2E integration test suite: `src/tests/e2e/nutanix.e2e.test.tsx` (5 comprehensive scenarios: Ingestion pipeline, Dashboard metrics, CVE & Advisory Explorer, Drawer impact matrix with copyable remediation commands, and Admin Sync Monitor live feed status).
  - **Verification**: All 63 unit test files (392 tests), 3 smoke suites (13 tests), 11 E2E suites (101 tests) passing 100%; production build clean.
  - **Completed**: 2026-09-08 17:15:00 Asia/Taipei.
