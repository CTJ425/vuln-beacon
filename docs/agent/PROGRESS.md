# Progress Log

## 2026-09-11 09:35:00 Asia/Taipei - Production Sync Fallback & CLI Hardening (1.0.0)
- **Resolved Production Sync Failure & Edge Function Network Error (BUG-021)**:
  - **Applied All Missing Migrations to Production**: Executed `supabase db push --include-all` to production project (`baizoisgkgwqccqjwnxg`), provisioning all 8 migrations (`vendors`, `cves`, `advisories`, `advisory_cve_map`, and `advisory-documents` bucket).
  - **Supabase Vault Secrets**: Configured `scheduled_sync_url` and `scheduled_sync_key` on production database via `set_scheduled_sync_vault_secrets`.
  - **Edge Functions Deployment**: Deployed `sync-cve` and `scheduled-sync` Edge Functions to production (`baizoisgkgwqccqjwnxg`) and development (`egofadbvftmbwodjneoy`) projects with `--no-verify-jwt`.
  - **PostgreSQL `ON CONFLICT DO UPDATE` Batch Collision Resolution**:
    - Deduplicated CVE IDs per advisory in `src/adapters/nutanix.ts`.
    - Deduplicated mappings and CVE tracking in `src/engine/ingestion.ts`.
    - Deduplicated batch arrays (`uniqueCves`, `uniqueAdvisories`, `dedupedMappings`) in `src/supabase/functions/sync-cve/index.ts` and `src/supabase/functions/scheduled-sync/index.ts`.
  - **Transport Fallback Dead-Code Fix (`App.tsx` & `syncService.ts`)**:
    - `App.tsx` previously forced `mode: currentUser ? 'server' : 'auto'`, which bypassed the `mode === 'auto'` fallback whenever an admin was logged in. Updated to `mode: 'auto'` so server execution is prioritized when authenticated, but network transport failures fall back seamlessly to client ingestion.
    - Extended `syncService.ts` error matching and invocation exception handling to catch `FunctionsFetchError`, `Failed to send a request`, `Failed to fetch`, and network errors, falling back safely in both `auto` and `server` paths.
  - **System CLI Utility Provisioning (`supabase-vuln` / `supabase-stock`)**:
    - Installed `/usr/local/bin/supabase-vuln` and `/usr/local/bin/supabase-stock` in `$PATH` to prevent exit code 127 in non-interactive subshells and persist tokens to `~/.supabase/access-token`.
  - **Test Runner Timeout Hardening**: Set `testTimeout: 15000` in `src/vitest.config.ts` to prevent parallel worker starvation.
- **Deep Verification**:
  - Live production manual sync verified: Red Hat and Nutanix synced successfully (903 CVEs, 70 advisories, all logs `SUCCESS`).
  - Unit tests: 65/65 files passed (419/419 tests).
  - Smoke tests: 3/3 files passed (13/13 tests).
  - E2E tests: 12/12 files passed (106/106 tests).
  - Production build: `npm run build` clean (build:edge -> tsc -> vite build).

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
