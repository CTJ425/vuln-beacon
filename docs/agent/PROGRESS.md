# Progress Log

## 2026-09-09 17:30:00 Asia/Taipei - Production Release 1.0.0 & Stability Remediation (1.0.0)
- **Resolved Latent Quality and Stability Bugs (BUG-019 & BUG-020)**:
  - **Scheduled Sync Concurrency Lock (`scheduled-sync/index.ts`) (BUG-020)**: Added PostgreSQL mutual exclusion advisory locking (`try_acquire_sync_lock` / `release_sync_lock` on lock id 7425001) to `scheduled-sync` Edge Function, preventing collisions with admin manual sync.
  - **Cross-Vendor knownCveIds Propagation (`scheduled-sync/index.ts`) (BUG-020)**: Propagated newly ingested CVE IDs to `knownCveIds` in the scheduled sync vendor loop, preventing duplicate webhook alerts on shared CVEs.
  - **PostgREST Join Normalization (`advisoryService.ts`) (BUG-020)**: Defensively unwrapped `cve = Array.isArray(map.cves) ? map.cves[0] : map.cves` to prevent silent CVE dropping on array-shaped relation joins.
  - **Unmount Timeout Cleanup (BUG-020)**: Managed copy feedback timeouts via `useRef` and unmount cleanup across `CveDetailDrawer.tsx`, `LogDetailModal.tsx`, and `ScheduleSettings.tsx`.
  - **Rules of Hooks Invariant Violation (`CveDetailDrawer.tsx`) (BUG-019)**: Discovered and resolved hook count mismatch where `realAdvisories` was placed after conditional return `if (!item) return null;`. Reordered all hooks above early exits, guaranteeing invariant hook execution count across null and populated item transitions.
  - **Unmounted Component Timer Leak (`App.tsx`) (BUG-019)**: Replaced unmanaged `setTimeout(() => setSyncMessage(null), 5000)` calls with a dedicated `useEffect` featuring `clearTimeout` on unmount, completely eliminating uncaught `ReferenceError: window is not defined` exceptions during environment teardown.
  - **PostgREST Join Normalization (`cveService.ts`) (BUG-019)**: Added `resolveAdvisory` and `resolveVendor` helpers to reliably handle both object and single-element array shapes returned by PostgREST joined foreign keys.
  - **SyncService Webhook Dispatch Defense (`syncService.ts`) (BUG-019)**: Added optional chaining `clearWebhooks?.()` and `registerWebhook?.()` to guard against uninitialized webhook service instances.
  - **Self-Hosted Supabase Compatibility (`ScheduleSettings.tsx`) (BUG-019)**: Allowed any valid `http://` or `https://` prefix for self-hosted instances rather than strictly mandating `.supabase.co`.
- **Version 1.0.0 Formal Promotion**:
  - Bumped version across `src/package.json`, `src/package-lock.json`, `src/config/version.ts` to `1.0.0`.
  - Updated `docs/agent/CHANGELOG.md` and `docs/agent/FIXED_BUG.md`.
- **Deep Verification**:
  - All 80 test files (533 tests) passed 100% (0 failures, 0 unhandled errors).
  - Production build (`build:edge` -> `tsc` -> `vite build`) completed cleanly with 0 errors.

## 2026-09-09 13:10:00 Asia/Taipei - Task 11c: Move Browser Manual Sync Server-Side (1.0.0)
- **Implemented Server-Side Manual Threat Feed Sync (`sync-cve`, `SyncService`, `App.tsx`)**:
  - **Edge Function `action: 'trigger_manual_sync'` (`src/supabase/functions/sync-cve/index.ts`)**:
    - Restricted to authenticated administrative users (`getUser` JWT token verification returning 401 on unauthenticated invocation, D2).
    - Added PostgreSQL advisory lock concurrency guard via `try_acquire_sync_lock(7425001)` returning HTTP 409 Conflict when an ingestion is already running (D3).
    - Executed server-side ingestion using `IngestionEngine` and `WebhookService` imported from `../_shared/ingest.bundle.js` (D1).
    - Implemented server-side batched upserts for CVEs, Advisories, Mappings, raw storage document archiving in `advisory-documents`, registered webhook dispatch, and `vendor_sync_logs` record emission.
  - **Database Migration (`src/supabase/migrations/20260909000000_server_side_sync_lock.sql`)**:
    - Created `public.try_acquire_sync_lock(p_lock_id bigint)` and `public.release_sync_lock(p_lock_id bigint)` stored procedures for transaction-safe advisory locking.
  - **Frontend SyncService & App Integration (`src/services/syncService.ts`, `src/App.tsx`)**:
    - Extended `syncVendors(vendorCodes, { mode: 'auto' | 'server' | 'client' })`: automatically uses server-side trigger when authenticated or explicit `server` mode, with transparent fallback for test/offline environments.
    - Updated `AdminPage.tsx` with controlled `activeTab` and `onTabChange` props; updated `App.tsx` with `adminTab` and `pendingAdminTab` routing so legacy `'sync'` navigation directly opens Admin Console Tab 1 (Sync Monitor).
- **Adversarial Audit & Test Fixes**:
  - Identified root cause of E2E failure in `src/tests/e2e/manual-sync-server-side.e2e.test.tsx`: `@supabase/supabase-js` defines `client.functions` as a dynamic getter creating new `FunctionsClient` instances on every access; spying on instance methods failed to intercept subsequent calls. Resolved by spying on `supabase.functions.constructor.prototype.invoke`.
  - Removed temporary debug logs in `src/App.tsx` and `src/services/syncService.ts`.
- **Deep Verification**:
  - Unit tests: 65/65 test files passed, 416/416 tests passed.
  - Smoke tests: 3/3 suites passed, 13/13 tests passed.
  - E2E tests: 12/12 suites passed, 106/106 tests passed, including `manual-sync-server-side.e2e.test.tsx` (Phase 1 server sync, Phase 2 HTTP 409 conflict, Phase 3 auth barrier).
  - Total test pyramid: 80/80 test files passed, 530/530 tests passed (136.99s).
  - Production build: `npm --prefix src run build` (`build:edge` -> `tsc` -> `vite build`) completed cleanly in 7.60s.
- **Self-Hosted Topology Documentation & Environment Configuration (`src/.env.example`, `README.md`)**:
  - **Edge Functions Environment Clarification (D6)**: Corrected comments in `src/.env.example` and `README.md` to distinguish Supabase Cloud (auto-injected `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`) from Self-Hosted Docker environments (where `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must be explicitly configured in `docker-compose.yml` / `edge-runtime` container environment).
  - **Self-Hosted Deployment Procedure (D5)**: Added step-by-step instructions to `README.md` for compiling the Edge bundle (`npm --prefix src run build:edge`), copying functions to the container volume, setting environment variables, and restarting `edge-runtime`.
  - **Network Ingress & Reverse Proxy Topology (D1–D4)**: Documented single-origin reverse proxy recommendations (Caddy + Cloudflare Tunnel) with `/supabase` path prefix stripping to prevent CORS and Access cookie scope issues.
- **Server-Side Manual Threat Feed Sync Specification (Task 11c)**:
  - Authored comprehensive architectural specification `docs/agent/specs/manual-sync-server-side.md` addressing restricted network egress (C1) and browser payload chunking limits (BUG-003).
  - Defined `action: 'trigger_manual_sync'` contract on `sync-cve`, server-side ingestion reuse via `ingest.bundle.js`, role-gated admin authorization, and transactional advisory locks (`pg_try_advisory_xact_lock`).
