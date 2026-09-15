# Progress Log

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
