# Changelog

## 1.0.0-dev.4 - 2026-09-07
### Fixed
- **Edge Function Intermediate Chunk Crash**: Wrapped `vendor_sync_logs` insertion in `if (syncMeta && syncMeta.status)` in `sync-cve`, preventing fatal `TypeError: Cannot read properties of undefined (reading 'status')` during multi-chunk ingestion payloads.
- **Edge Function Health Check**: Added explicit `action === 'health_check'` response to `sync-cve` edge function and deployed to live Supabase Cloud runtime (`egofadbvftmbwodjneoy`).
- **Health Diagnostics Reporting**: Updated `SystemHealthMonitor.tsx` to inspect invoke `{ data, error }`, preventing false-positive operational status, and added 6-second timeout to external feed checks.
- **Admin UI Unmount & Tab Reset on Log Refresh**: Replaced root `loadData` with dedicated `handleRefreshLogs` callback and `isRefreshingLogs` spinner in `App.tsx`, preserving active tab state in backstage.
- **Backstage Route Protection & Mid-Session Expiry**: Added route guard in `App.tsx` immediately redirecting unauthenticated users to the public dashboard if an admin session expires mid-session.
- **Admin Login Feedback**: Handled null session scenarios (such as unconfirmed email) with descriptive user error alerts in `AdminLoginModal.tsx`.
- **Admin Log Query Pagination**: Added MUI `TablePagination` (10, 25, 50, 100) to `AdminLogQuery.tsx` with automatic page reset on filter changes.
- **Log Detail Copy Fallback**: Added document-based clipboard fallback in `LogDetailModal.tsx` for non-secure contexts.

## 1.0.0-dev.3 - 2026-09-07
### Added
- **Log Observation Inspector & Field**: Added `details` JSONB column with GIN/btree indexes to `vendor_sync_logs` table (migration `20260907000000_add_sync_log_details.sql`).
- **Observability Inspector Modal**: Added `LogDetailModal` to inspect detailed execution metrics, API endpoints, failure traces, and one-click JSON copy from `SyncLogTable`.
- **Supabase-Authenticated Admin Backstage (`AdminPage`)**:
  - Gated access with `AdminLoginModal` requiring Supabase credentials (`supabase.auth.signInWithPassword`) only upon clicking the Admin Console in navigation. Public CVE pages remain completely unauthenticated.
  - **Webhook Settings**: Configured webhooks integration (Discord, Slack, Telegram), connection testing, deletion, and minimum severity threshold.
  - **Log Data Query**: Added `AdminLogQuery` component supporting status filtering (`SUCCESS`, `FAILED`, `PARTIAL_SUCCESS`, `RUNNING`), vendor filtering, keyword search on errors/details, JSON export, and full observability modal.
  - **API & Supabase Operation Status**: Added `SystemHealthMonitor` checking PostgreSQL database latency, GoTrue Auth service, S3 Storage bucket availability, Edge Function runtime, and external vendor feeds (Red Hat CSAF).
- **Edge Function Sync Logs**: Updated `sync-cve` and `scheduled-sync` Edge Functions to record structured `details` metadata and deployed to Supabase Cloud runtime (`egofadbvftmbwodjneoy`).
- **Test Pyramid**: Added 8 new unit and E2E test suites bringing total test suite to 61 test files (325 tests) passing 100%.

## 1.0.0-dev.2 - 2026-08-16
### Changed
- **Ingestion engine rewrite (Phase D)**: Converted from CVE-driven to advisory-first model. New `RedHatCsafAdapter` parses CSAF 2.0 documents with one advisory per errata carrying every CVE it fixes (previously averaged 1.00 CVE/advisory, now 4.76).
- Product impact matrix: Build artifacts (-debuginfo/-debugsource) now filtered out; per-locale package families collapsed (e.g. glibc-langpack variants).
- Adapter registration: `getAdapterByCode('redhat')` now returns RedHatCsafAdapter (advisory-first); RedHatAdapter still exported.
- Sync service: fetchAndIngestQuery rewritten to CSAF endpoints. Errata id hits detail endpoint directly; CVE goes through csaf.json?cve= reverse index then parallel detail fetches. Old /securitydata/cve.json and /cve/<id>.json calls removed.
### Fixed
- Non-array product_status in CSAF documents (guarded with Array.isArray, skipped if not array).
- E2E test fixtures updated to CSAF shape (csaf-e2e-sample.json).
### Added
- New unit test files: redhatCsaf.test.ts (8 tests), redhatCsafCollapse.test.ts (5 tests), csafQuery.test.ts (5 tests).
- New CSAF fixtures: csaf-advisory-sample.json, csaf-e2e-sample.json.
- Live database re-ingestion: 50 advisories, 142 CVEs, 238 mappings (upgraded from 50 advisories, 50 CVEs, 50 mappings in CVE-first model).

## 1.0.0-dev.1 - 2026-08-15
### Added
- Complete testing architecture in `docs/test/` (README, TDD Guidelines, Unit Test Plan, Smoke Test Plan, E2E Test Plan).
- Synchronized TDD guidelines and test memory paths in `AGENT.md`, `CLAUDE.md`, and `GEMINI.md`.
- Initial PostgreSQL migration `20260815000000_init_cve_collector.sql` with 7 tables, RLS policies, indexes, and 8 vendor seeds.
- Modular adapters for 8 vendors (RedHat, VMware, Nutanix, Dell, HPE, NetApp, Veeam, Cohesity).
- CVSS score normalizer, vector parser, and standard CVE extractor.
- Multi-channel Webhook formatters (Discord embed, Telegram HTML, Slack Block Kit).
- IngestionEngine coordinator and TriageService state manager.
- 49 unit, smoke, and E2E tests passing with 100% test success rate.

## 0.1.0-dev.1 - 2026-08-15
### Added
- Project initialized.
- System architecture and roadmap documentation (`docs/agent/PLAN.md`).
- System specifications document (`docs/agent/SPEC.md`).
- Phased task tracking breakdown (`docs/agent/TASK.md`).
