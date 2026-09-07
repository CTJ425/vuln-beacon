# Progress Log

## 2026-09-07 15:30:00 Asia/Taipei - Adversarial Review Fixes: Edge Function Health Check, Chunk Guard, Backstage State & Session Redirection (1.0.0-dev.4)
- **Resolved Critical Bugs & Quality Gaps in Backstage & Edge Runtime**:
  - **Edge Function Crash on Intermediate Chunks (`sync-cve`)**:
    - Wrapped `vendor_sync_logs` insertion in `if (syncMeta && syncMeta.status)` guard, preventing fatal unhandled `TypeError: Cannot read properties of undefined (reading 'status')` and HTTP 500 crashes during multi-chunk payload processing.
  - **Live Edge Function Health Check & Diagnostics Reporting**:
    - Added dedicated `action === 'health_check'` branch to `sync-cve` returning HTTP 200 `{ success: true, status: 'ok' }`.
    - Deployed updated `sync-cve` edge function to live Supabase Cloud project (`egofadbvftmbwodjneoy`) and verified live HTTP 200 response.
    - Fixed `SystemHealthMonitor.tsx` to inspect `{ data, error }` returned from `invoke`, preventing silent swallowing of Edge function HTTP errors and eliminating false-positive operational status.
    - Added `AbortController` timeout safeguard (6s) to external feed diagnostic requests in `SystemHealthMonitor`.
  - **Admin UI Backstage State & Usability**:
    - Replaced full-page loader in `App.tsx` during backstage log refresh with dedicated `handleRefreshLogs` callback and `isRefreshingLogs` spinner indicator, eliminating unwanted `AdminPage` unmounting and active tab resets.
    - Added MUI `TablePagination` (10, 25, 50, 100 rows per page) to `AdminLogQuery` with automatic page reset on filter changes, avoiding DOM overload on large log volumes.
    - Added non-secure context fallback and styled word-break/scroll bounds in `LogDetailModal` for large JSON payloads.
  - **Backstage Route Protection & Mid-Session Expiration**:
    - Added automatic route guard in `App.tsx` redirecting active unauthenticated sessions back to the public dashboard if an admin token expires or is revoked mid-session.
    - Handled null session state with user-facing warnings in `AdminLoginModal` when email confirmation is pending.
- **Verification**: All 61 test files (331 tests) passed 100% across Unit, Smoke, and E2E layers; `npm --prefix src run build` compiled production bundle cleanly in 7.55s.

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
