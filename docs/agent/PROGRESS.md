# Progress Log

## 2026-09-07 18:56:07 CST - UI Navigation Consolidation & Role-Gated Access (1.0.0-dev.5)
- **Completed Frontend Navigation Reorganization & Access Control Hardening**:
  - **R1 — Navigation & Access Boundary Consolidation**:
    - Removed `Sync Monitor` and `Webhooks & Config` from public sidebar; consolidated into 4-tab authenticated Admin Console (Webhooks, Sync Monitor, Log Query, System Health).
    - Hidden vendor quick-nav sidebar while Admin Console active; vendor views remain accessible via Dashboard vendor tiles.
  - **R2 — Role-Gated Manual Sync**:
    - Fixed security defect: `ExplorerPage.handleFetchDirectly` called `syncService.fetchAndIngestQuery` with no authentication check, allowing unauthenticated visitors to perform live vendor fetch and persist CVE data. Now gated via `isAuthenticated` prop; control not rendered and handler returns early for unauthenticated users.
    - `VendorPage` forwards same prop to embedded `ExplorerPage`.
    - Fixed spec compliance: Dashboard empty-state "Sync All Feeds Now" navigates to Admin Console, opening login modal when signed out (no longer calls `handleManualSync` directly).
    - Added regression test: `src/tests/unit/pages/explorerDirectFetchGate.test.tsx` (4 tests).
  - **R3 — Vendor-Neutral Nomenclature**:
    - Replaced vendor-biased user-facing text across MetricCards, AdvisoryTable, AdvisoryDetailDrawer, CveTable, CveDetailDrawer, CveFilterBar, ExplorerPage, DashboardPage, and VendorPage.
    - Data identifiers (vendor codes, advisory_id values, errata fields, adapter ids, API paths, DB columns, VendorIcon codes) deliberately preserved.
  - **R4 — Header & Sidebar** (previously implemented):
    - Header GitHub repository link and Sidebar version footer via new `src/config/version.ts`.
  - **Additional Quality Work**:
    - Fixed severity filter label/control association in `CveFilterBar`.
    - Realigned 6 stale tests encoding pre-R1/R3 behavior without weakening coverage (`App.test.tsx`, `appSyncError.test.tsx`, `advisoryDashboard.test.tsx`, `CveTable.test.tsx`, `Sidebar.test.tsx`, `version.test.ts`, plus precision fix to `real-world-scenarios.e2e.test.tsx` Scenario 3).
    - Version assertions now compare against `APP_VERSION` instead of hardcoded literals.
    - Added `.claude/version.config.json`.
- **Verification**: All 70 test files (448 tests) passed 100%; `npm --prefix src run build` clean; `npx tsc --noEmit` clean.

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
