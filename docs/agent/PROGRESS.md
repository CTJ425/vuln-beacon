# Progress Log

## 2026-09-22 14:43:12 Asia/Taipei - Cisco / VMware Frontend UI Coverage
- **Cisco / VMware UI wiring (Lane 1 — COMPLETED)**:
  - Problem: Cisco and VMware adapters ingested data (1.2.0), but the frontend had no vendor-specific UI. Cisco rendered the generic fallback logo; advisories/CVEs without a vendor join were inferred as `redhat` (Red Hat `dnf/yum` solution text); the CVE detail drawer linked Cisco/VMware CVEs to `access.redhat.com`; System Health Monitor listed no Cisco/VMware feeds.
  - Ubuntu and Debian were already wired in all the same UI surfaces; no change needed.
  - Changes: added `CiscoLogo` (`src/components/icons/VendorLogos.tsx`) and `case 'cisco'` (`src/components/common/VendorIcon.tsx`); `cisco-sa-*` → `cisco` and `VMSA-*` → `vmware` inference plus vendor-specific solution text in `src/services/advisoryService.ts` and `src/services/cveService.ts`; Cisco/VMware official link via `getAdvisoryUrl` in `src/components/explorer/CveDetailDrawer.tsx`; Cisco CSAF and Broadcom VMware feeds in `src/components/admin/SystemHealthMonitor.tsx`.
  - Tests: new `src/tests/unit/components/ciscoVmwareUi.test.tsx` (8 tests; red 8/8 before, green after).
  - **Verification**: `npm --prefix src test` 92 files / 668 passed / 0 failed; `npm --prefix src run build` succeeded.
  - **Reviewer**: skipped under risk policy (red-green covered; no persisted state, auth, boundary, or control-flow change).
  - **Known gaps (not done)**: drawers show no copy-command block for Cisco/VMware (no package-manager command applies); `src/tests/e2e/vendor-logos-and-vault-guide.e2e.test.tsx:93` mocks `SYNCED_VENDOR_CODES` with 5 vendors (stale).
  - **Completed**: 2026-09-22 14:43:12 Asia/Taipei.

- **Supabase deployment catch-up (2026-09-22 16:30 Asia/Taipei — COMPLETED)**:
  - Root cause of missing Ubuntu/Debian/SUSE/Cisco data: migrations `20260911000000_add_ubuntu_debian_suse_vendors` and `20260913000000_add_cisco_vendor` were never applied (no vendor rows), and `sync-cve` / `scheduled-sync` were last deployed 2026-09-11 (before the Cisco/VMware adapters). Dev also lacked `20260909000000_server_side_sync_lock`.
  - Applied pending migrations via `supabase db push` to `vuln-beacon-dev` (egofadbvftmbwodjneoy) and `vuln-beacon` (baizoisgkgwqccqjwnxg); prod was dry-run first.
  - Deployed functions with `supabase functions deploy sync-cve scheduled-sync --use-api --no-verify-jwt`. `--use-api` is required (local bundling fails under podman: "entrypoint path does not exist"). `--no-verify-jwt` preserves the existing `verify_jwt=false`; the CLI default would switch it to true.
  - Verified on both projects: migrations 20260909/20260911/20260913 present; vendors ubuntu, debian, suse, cisco, vmware present. Dev: sync-cve v8, scheduled-sync v7. Prod: sync-cve v3, scheduled-sync v4. All verify_jwt=false.
  - **Open**: first data sync not yet run (manual sync needs admin login in UI); dev scheduled sync fails with "Missing vault secrets: scheduled_sync_url or scheduled_sync_key not configured"; prod has no sync log after 2026-09-11 (scheduler cause not investigated).

- **Release 1.2.1 and scheduler diagnosis (2026-09-22 — IN PROGRESS)**:
  - Version bumped to `1.2.1` in `src/package.json`, `src/package-lock.json`, `src/config/version.ts`. Sidebar made sticky so the version label stays visible.
  - Verification: unit 77 files / 539 passed; e2e 13 files / 112 passed; smoke 3 files / 18 passed; build succeeded.
  - Scheduler diagnosis: pg_cron job `vuln-beacon-scheduled-sync` runs every 5 minutes on both projects, but no scheduled sync succeeded after 2026-09-11. Prod: `scheduled-sync` returns 401 because vault `scheduled_sync_key` does not equal the runtime `SUPABASE_SERVICE_ROLE_KEY` (legacy service_role JWT); the 401 is not written to `vendor_sync_logs`. Dev: vault secrets missing.
  - Open: vault secrets must be reset to the legacy service_role key on both projects (user action; agent secret-store writes are blocked by auto mode). `origin/dev` has commit `62c384a` not on `main`, so `dev` was not synced to `main`.

## 2026-09-14 23:12:06 Asia/Taipei - UI/UX Hardening: Mobile Horizontal Overflow, Page States, & Bundle Code Splitting

- **UX-1: Mobile Horizontal Overflow Fix (COMPLETED)**:
  - Root cause: `<main>` Box in App.tsx is a flex child beside fixed-width Sidebar (`flexShrink: 0`, 240/64px) but had no `minWidth: 0`. Flex item defaults to `min-width: auto`, preventing shrink below content width. Explorer tables declare `minWidth: 700`, widening `main` past viewport and producing document-level horizontal scrolling. MUI `TableContainer` ships `overflow-x: auto`, so wrapper was never the problem.
  - Change: added `minWidth: 0` and responsive padding `p: { xs: 2, sm: 3.5 }` (was flat `p: 3.5`) to the `<main>` Box.
  - Files: `src/App.tsx`.
  - Test added: `src/tests/e2e/responsive-layout.e2e.test.tsx` (1 test, red before / green after).
  - Lane 0 justification: file region and root cause in main-session context from audit; fix was single sx property; verification command named before editing.
  - **Completed**: 2026-09-14 23:12:06 Asia/Taipei.

- **UX-2: Unified Page States & Missing Error State (COMPLETED)**:
  - Root cause: `loadData` in App.tsx caught failed initial load and only called `console.error`. Set no error state, so unreachable Supabase rendered same "Database initialized, sign in and run first ingestion" prompt as genuinely empty database — operator instructed to run sync when real fault was connectivity.
  - Change: new presentational `PageState` component (variants loading / empty / error, `data-testid="page-state-<variant>"`), plus `loadError` state in App.tsx cleared on every `loadData` entry and set in existing catch. Render precedence in `<main>` is loading -> error -> empty, mutually exclusive. Error state offers `Retry` button calling `loadData`; dashboard content below not blanked. All existing copy kept verbatim.
  - Files: `src/components/common/PageState.tsx` (new), `src/App.tsx`.
  - Tests added: `src/tests/e2e/page-state.e2e.test.tsx` (3 tests, red before / green after).
  - Reviewer verdict: PASS with one RISK (R12: partial-failure masking in `loadData`'s single `Promise.all`; see BUG_FIX.md).
  - **Completed**: 2026-09-14 23:12:06 Asia/Taipei.

- **UX-4: Bundle Code Splitting (COMPLETED after Reviewer FAIL round 1)**:
  - Change: `React.lazy` + Suspense for ExplorerPage, VendorPage, AdminPage, AdminLoginModal, CveDetailDrawer, AdvisoryDetailDrawer; DashboardPage stays eager. Added `build.rollupOptions.output.manualChunks` splitting `react-vendor` and `mui-vendor`.
  - Files: `src/App.tsx`, `src/vite.config.ts`.
  - Reviewer verdict round 1: FAIL, 2 blockers —
    - (a) both drawers rendered unconditionally inside Suspense, so `lazy()` resolved modules on first render: chunks downloaded on initial load, `minHeight: 300` spinner box appeared in document flow under main content on every page load.
    - (b) all three overlays shared one Suspense boundary, so AdminLoginModal suspending would hide already-open drawer behind fallback.
  - Fix applied: per-drawer mount latches (`hasOpenedCveDrawer`, `hasOpenedAdvisoryDrawer`) never unmount on close, preserving MUI close transition; three independent Suspense boundaries with `fallback={null}` for overlays; `LazyFallback` retained only for lazy-pages boundary.
  - Reviewer verdict round 2: PASS — verified by direct code read; both blockers resolved.
  - Measured result: largest single chunk 950.78 kB -> 361.63 kB. Initial eager payload index 361.63 + mui-vendor 346.90 + react-vendor 143.38 = 851.9 kB raw (~250 kB gzip), down from 950.78 kB / 271.24 kB gzip (~100 kB raw / 21 kB gzip less on first paint). On-demand chunks (~100 kB total: AdminPage 54.18, ExplorerPage 14.86, CveDetailDrawer 13.15, AdvisoryDetailDrawer 9.57, AdminLoginModal 2.92, VendorPage 1.85). Vite 500 kB chunk warning no longer fires.
  - **Completed**: 2026-09-14 23:12:06 Asia/Taipei.

- **Test Adaptation (main session)**:
  - `src/tests/e2e/vendor-logos-and-vault-guide.e2e.test.tsx:136,169` — `screen.getByLabelText(/Email/i)` changed to `await screen.findByLabelText(/Email/i)` in both tests. AdminLoginModal now code-split, entering DOM a tick after Admin Console click. Surfaced intermittent failure after UX-4.
  - **Completed**: 2026-09-14 23:12:06 Asia/Taipei.

- **Verification**:
  - `npm test` (from src/): 93 test files, 664 tests, all passing.
  - `npm run build`: exits 0, no chunk-size warning.

## 2026-09-13 23:28:39 Asia/Taipei - VMware / Broadcom Vendor Adapter & Release 1.2.0 Finalization
- **VMware / Broadcom Adapter (Task 32 — COMPLETED)**:
  - Implemented full `VendorAdapter` compliance for `vmware` vendor ingesting VMware Security Advisories (VMSA) from the public Broadcom support-portal API (`POST https://support.broadcom.com/web/ecx/security-advisory/-/securityadvisory/getSecurityAdvisoryList`, segment=VC, no authentication).
  - CVSS scores and vectors enriched from NVD API 2.0 with strict sequential (non-batched) fetching due to rate-limit sensitivity (429 under concurrency); NVD used for enrichment only, severity ground truth remains Broadcom.
  - Added `src/adapters/vmware.ts`, `src/tests/unit/adapters/vmware.test.ts` (21 tests), fixtures (vmware-advisory-list-sample.json, nvd-cve-sample.json).
  - Updated `src/adapters/index.ts`, `src/services/syncService.ts` (SYNCED_VENDOR_CODES now 7 vendors), `src/utils/advisoryUrl.ts`, `src/supabase/functions/_shared/ingest.bundle.js` (build:edge output), plus six tests re-pointed from vmware to dell as the unimplemented exemplar.
  - No database migration: `vmware` vendor row already seeded in initial migration.
  - **Verification**: unit 75 files / 530 passed / 0 failed; smoke 18 passed including live Broadcom fetch; build succeeded. Live `fetchAdvisories(5)` returned 5 advisories and 14 CVEs with 0 malformed CVE ids and correct UTC dates.
  - **Reviewer verdict**: PASS.
  - **Accepted Risks**: (1) NVD enrichment coverage low without API key (~12% at 20-advisory sync, ~50 CVEs); user accepted for now (Broadcom severity always correct, CVSS scores additive). (2) No retry on Broadcom list fetch (matches sibling adapters, not unique).
  - **Completed**: 2026-09-13 23:28:39 Asia/Taipei.

- **Release 1.2.0 — Multi-Vendor Adapter Expansion**:
  - Finalized version bump to `1.2.0` in `src/package.json`, `src/package-lock.json`, `src/config/version.ts` (pre-set by main session).
  - Documented both Cisco CSAF adapter (Task 31, committed as 6bf576e) and VMware/Broadcom adapter (Task 32) in comprehensive release notes.
  - Vendor coverage: 5 working adapters → 7 (redhat, nutanix, ubuntu, debian, suse, cisco, vmware).
  - Updated `CHANGELOG.md` with 1.2.0 entry covering Added/Changed/Fixed across both adapters.
  - Recorded both adapters' accepted risks (Cisco incomplete product trees, VMware NVD coverage low) in `BUG_FIX.md`.
  - **Completed**: 2026-09-13 23:28:39 Asia/Taipei.
