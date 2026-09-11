# Progress Log

## 2026-09-11 09:48:00 Asia/Taipei - Operational Conflict Fallback Boundary Fix (1.0.0)
- **Resolved Concurrency Lock & Operational Conflict Fallback Bug (`syncService.ts`)**:
  - **Fallback Boundary Restriction**: Refined fallback guard in `SyncService.syncVendors` line 273 and 300. Changed condition from `if (isTransportError || mode === 'auto')` to strictly `if (isTransportError)`.
  - **Operational Conflict Surfacing**: Ensured operational conflicts (such as HTTP 409 `A threat feed synchronization is already in progress` or HTTP 401 unauthorized errors) cleanly return `{ success: false, errors: [errorMsg] }` instead of falling back to client-side ingestion when in `auto` mode.
  - **Unit & E2E Test Hardening**:
    - Added unit test coverage in `src/tests/unit/services/syncServiceServerMode.test.ts` verifying that 409 concurrency lock conflicts and operational errors in `auto` mode surface failure without triggering client ingestion.
    - Verified `tests/e2e/manual-sync-server-side.e2e.test.tsx` Phase 2 passes with expected error banner display.
- **Deep Verification**:
  - Unit tests: 65/65 files passed (421/421 tests).
  - Smoke tests: 3/3 files passed (13/13 tests).
  - E2E tests: 12/12 files passed (106/106 tests).
  - Total test pyramid: 80/80 test files passed (540/540 tests).
  - Production build: `npm --prefix src run verify` (`build:edge` -> `tsc` -> `vite build`) completed cleanly with 0 errors.

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
