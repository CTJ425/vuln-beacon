# Progress Log

## 2026-09-07 15:15:00 Asia/Taipei - Log Observability & Supabase Auth Backstage System
- **Completed Log Observability & Admin Backstage System**:
  - **Database Migration & Cloud Deployment**:
    - Created `src/supabase/migrations/20260907000000_add_sync_log_details.sql` adding `details JSONB DEFAULT '{}'::jsonb` to `vendor_sync_logs` with GIN and btree index.
    - Pushed migration to remote Supabase dev database (`egofadbvftmbwodjneoy`) using user token.
    - Updated `sync-cve` and `scheduled-sync` Edge Functions to record structured `details` metadata and deployed to Supabase Cloud runtime.
  - **Core Observability & Sync Service**:
    - Updated `VendorSyncLog` type and `IngestionResult` to capture execution metrics, endpoints, and error stack traces.
    - Updated `SyncService.ts` to query and pass `details` during manual sync, scheduled sync, and query ingestion.
  - **Admin Backstage Portal (`AdminPage`)**:
    - Gated Admin entry via `AdminLoginModal` requiring Supabase credentials (`supabase.auth.signInWithPassword`) only upon clicking the Admin Console. Public pages remain unauthenticated.
    - Implemented 3 core administrative capabilities:
      1. **Webhook Settings**: Configured webhooks integration (Discord, Slack, Telegram), connection testing, deletion, and minimum severity threshold.
      2. **Log Data Query**: Added `AdminLogQuery` component supporting status filtering (`SUCCESS`, `FAILED`, `PARTIAL_SUCCESS`, `RUNNING`), vendor filtering, keyword search on errors/details, JSON export, and full observability modal.
      3. **API & Supabase Operation Status**: Added `SystemHealthMonitor` checking PostgreSQL database latency, GoTrue Auth service, S3 Storage bucket availability, Edge Function runtime, and external vendor feeds (Red Hat CSAF).
  - **UI Log Inspector**:
    - Implemented `LogDetailModal` and added "Log Details" column with "Inspect" trigger button to `SyncLogTable`.
- **Verification**: All 61 test files (325 tests) passed 100% across Unit, Smoke, and E2E; `npm --prefix src run build` built cleanly in 7.20s.

## 2026-09-05 09:17:00 Asia/Taipei - Adversarial Review Fixes: Chunking Timeout Optimization & Auth Robustness
- **Fixed critical defect and robustness gaps identified during adversarial review**:
  - **O(N) Incremental Chunk Byte Calculation in `syncService.ts`**:
    - Replaced O(N^2) repeated `JSON.stringify` / `TextEncoder().encode()` of candidate chunks with incremental byte counting and WeakMap item size caching in `buildPersistChunks`.
    - Eliminated Vitest 5000ms test timeouts where `tests/unit/services/syncServiceChunking.test.ts` previously timed out and failed 5 tests.
  - **Auth Header Robustness in `functionAuth.ts` and `sync-cve`**:
    - Avoided emitting malformed `Authorization: Bearer ` header when token/key is absent in `getFunctionHeaders()`.
    - Added support for case-insensitive `bearer ` prefix in `sync-cve` edge function authentication handler.
  - **Nested Error Object Extraction in `extractErrorMessage()`**:
    - Supported nested `errorBody.error.message` structures in `extractErrorMessage()`.
  - **Test Suite Completeness**:
    - Added test coverage for empty token handling, nested error objects, and lowercase bearer authorization.
    - Added `.order()` and `.range()` mock chaining to avoid noisy console warnings in unit tests.
- **Verification**: Full test suite (`npm --prefix src test`) passes 100% (53 files, 300 tests); `npm --prefix src run build` passes cleanly.
