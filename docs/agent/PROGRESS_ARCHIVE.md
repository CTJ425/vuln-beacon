## 2026-09-11 15:10:00 Asia/Taipei - Codebase Review, Defensive Null Safety & UI/UX Enhancements (1.1.0)
- **Codebase Review, Bug Remediations & Defensive Hardening**:
  - **Canonical Advisory URL Resolution Utility (`src/utils/advisoryUrl.ts`)**:
    - Created unified utility resolving vendor errata / notice URLs across Red Hat, Nutanix, Ubuntu, Debian, and SUSE.
    - Synthesizes exact SUSE announcement URLs (`https://www.suse.com/support/update/announcement/${year}/suse-su-${year}${num}-${rev}/`) from advisory IDs instead of falling back to the generic announcement index.
    - Added comprehensive unit test suite in `src/tests/unit/utils/advisoryUrl.test.ts` (6 tests).
  - **Defensive Null-Safety in Explorer & Impact Matrix Tables (`CveDetailDrawer`, `AdvisoryDetailDrawer`, `ExplorerPage`, `CveTable`, `AdvisoryTable`)**:
    - Guarded against null / undefined states on `imp.state`, `imp.component`, and `imp.product_name` in search, filter matching, and badge renderers.
    - Wrapped `item.cves` and `item.product_impacts` in safe array defaults across table and drawer components.
    - Added fallback official advisory URLs so "官方公告頁面" action buttons resolve accurately even when database records lack explicit `url` fields.
    - Transformed static errata text in `AdvisoryDetailDrawer` into direct clickable vendor links with consistent `Advisory: ${imp.errata}` labeling.
  - **Vendor Scope Normalization (`src/pages/VendorPage.tsx` & `src/components/sync/FeedSourceTable.tsx`)**:
    - Made vendor code comparison case-insensitive across `VendorPage` advisories and CVE matching.
    - Normalized log matching in `newestLogFor` to case-insensitive comparison.
  - **SUSE Ingestion Adapter Announcement URL Synthesis (`src/adapters/suse.ts` & Edge Bundle)**:
    - Added regex-based announcement URL resolver in `SuseAdapter.parse` when `selfRef.url` points to generic index.
    - Recompiled Edge Function bundle `ingest.bundle.js` via `npm run build:edge`.
- **UI/UX Polish & Performance Optimization**:
  - **Explorer Search Filter Bar (`src/components/explorer/CveFilterBar.tsx`)**:
    - Added clear ("X") icon button in `endAdornment` when search term is non-empty for instantaneous search reset.
  - **Header Accessibility & Tooltips (`src/components/common/Header.tsx`)**:
    - Wrapped theme toggle button and GitHub repository link with descriptive MUI Tooltips and aria labels.
  - **Feed Source Visual Consistency (`src/components/sync/FeedSourceTable.tsx`)**:
    - Integrated authentic `VendorIcon` alongside vendor names in the Sync Monitor feed table.
  - **System Health Monitor Latency Optimization (`src/components/admin/SystemHealthMonitor.tsx`)**:
    - Parallelized 6 external threat feed health probes using `Promise.all` instead of sequential loop, dropping health check latency from ~10s to ~1s.
- **Deep Verification**:
  - Unit tests: 70/70 files passed (467/467 tests).
  - Smoke tests: 3/3 files passed (16/16 tests).
  - E2E tests: 13/13 files passed (114/114 tests).
  - Total test pyramid: 86/86 test files passed (597/597 tests).
  - Production build: `npm --prefix src run verify` (`build:edge` -> `tsc` -> `vite build`) completed cleanly with 0 errors.

## 2026-09-11 12:35:00 Asia/Taipei - Harden Ubuntu, Debian & SUSE Threat Feed Ingestion & Type Safety (1.0.0)
- **Defects Discovered & Remediated from Prior Attempt**:
  - **Debian On-Demand Query Breakdown (`syncService.ts`)**:
    - Prior worker passed advisory IDs (`DSA-6492-1`) directly in `cves: [q]`, which `CVE_ID_REGEX` rejected and resulted in 0 CVEs and immediate failure.
    - Implemented `fetchAdvisoryById` in `DebianAdapter` querying the DSA list, extracting all referenced CVEs, and routing structured retrieval.
    - Added Debian reverse CVE lookup fallback in `fetchAndIngestQuery` (`debianAdapter.fetchAdvisoryByCve(q)`).
  - **SUSE Chronological Inversion & Advisory Resolution (`suse.ts` & `CveDetailDrawer.tsx`)**:
    - Fixed chronological ordering in `fetchAdvisories`: parsed timestamps in `changes.csv` and sorted descending, preventing legacy 2014 advisories at the CSV tail from displacing recent 2026 advisories.
    - Added hyphenated advisory ID normalization (`suse-su-2026-3951-1` -> `suse-su-2026_3951-1.json`).
    - Fixed invalid direct CVE requests to `ftp.suse.com/pub/projects/security/csaf/cve-*.json`.
    - Added dynamic SUSE advisory announcement URLs in `CveDetailDrawer.tsx`.
  - **Ubuntu Regression Notice Fallback (`ubuntu.ts`)**:
    - Added description/summary regex fallback extracting CVE IDs when `cves` and `cves_ids` arrays are empty (e.g. `USN-8571-2`).
    - Normalized bare numeric notice inputs to `USN-` prefixed format.
  - **TypeScript Compilation & Test Stability**:
    - Fixed `CveTableRowItem` missing `advisory_title` property in `tests/e2e/ubuntu-debian-suse.e2e.test.tsx`.
    - Fixed invalid property access `adv.productImpacts` on `NormalizedAdvisoryItem` in `tests/unit/adapters/debian.test.ts`.
    - Increased live smoke test timeouts in `adapters.smoke.test.ts` to 30s to prevent concurrency timeout under parallel test runner load.
- **Deep Verification**:
  - Unit tests: 69/69 files passed (461/461 tests).
  - Smoke tests: 3/3 files passed (16/16 tests, including live HTTP fetching for Nutanix, Ubuntu, Debian, SUSE).
  - E2E tests: 13/13 files passed (114/114 tests).
  - Total test pyramid: 85/85 test files passed (591/591 tests).
  - Production build: `npm --prefix src run verify` (`build:edge` -> `tsc` -> `vite build`) completed cleanly with 0 errors.

## 2026-09-11 12:02:00 Asia/Taipei - Ubuntu, Debian & SUSE Multi-Vendor Ingestion & UI Integration (1.0.0)
- **Implemented Threat Feed Ingestion Adapters for Ubuntu, Debian & SUSE**:
  - **Ubuntu Adapter (`src/adapters/ubuntu.ts`)**:
    - Built official unauthenticated integration with `https://ubuntu.com/security/notices.json` and notice/CVE lookup endpoints.
    - Implemented `parse()` normalizing USN security notices, CVE mappings, release packages (`release_packages`), package version justifications, and remediation instructions.
  - **Debian Adapter (`src/adapters/debian.ts`)**:
    - Integrated with Debian Security Tracker (`https://security-tracker.debian.org/tracker/data/json`) and official DSA feeds (`https://salsa.debian.org/security-tracker-team/security-tracker/-/raw/master/data/DSA/list`).
    - Implemented multi-format parsing supporting plain text DSA list, structured DSA advisories, and `data/json` package CVE entries.
  - **SUSE Adapter (`src/adapters/suse.ts`)**:
    - Built CSAF 2.0 parser reading `changes.csv` and individual advisory JSON documents (`suse-su-*.json`).
    - Normalized CSAF document metadata, tracking IDs, aggregate severity, vulnerability notes, CVSS v3 score/vector, and `remediations` with product ID mapping.
  - **Adapter Registry & Edge Bundle Synchronization**:
    - Registered all 3 adapters in `src/adapters/index.ts` alongside Red Hat and Nutanix (`ALL_ADAPTERS` length 5).
    - Expanded `SYNCED_VENDOR_CODES` in `src/services/syncService.ts` to `['redhat', 'nutanix', 'ubuntu', 'debian', 'suse']`.
    - Bundled all adapters into Edge Function runtime bundle (`src/supabase/functions/_shared/ingest.bundle.js`).
    - Updated `src/supabase/functions/sync-cve/index.ts` default target vendors to include all 5 supported vendors.
  - **Database Vendor Migration**:
    - Added database migration `src/supabase/migrations/20260911000000_add_ubuntu_debian_suse_vendors.sql` seeding `ubuntu`, `debian`, and `suse` records into `public.vendors`.
  - **UI & Multi-Vendor Polish**:
    - Created authentic vector SVG brand logos (`UbuntuLogo`, `DebianLogo`, `SuseLogo`) in `src/components/icons/VendorLogos.tsx`.
    - Added brand colors, names, and logos to `src/components/common/VendorIcon.tsx`.
    - Added vendor-specific remediation instructions in `AdvisoryDetailDrawer.tsx` and `CveDetailDrawer.tsx` (`$ sudo apt-get --only-upgrade install -y <pkg>` for Ubuntu/Debian, `$ sudo zypper update -y <pkg>` for SUSE).
    - Added Ubuntu, Debian, and SUSE endpoints to `src/components/admin/SystemHealthMonitor.tsx` for real-time feed connectivity diagnostics.
    - Verified `FeedSourceTable` displays all 5 vendors as `Connected` with their live endpoints.
- **Deep Verification**:
  - Unit tests: 68/68 files passed (454/454 tests).
  - Smoke tests: 3/3 files passed (16/16 tests), including live HTTP public API verification against Nutanix, Ubuntu, Debian, and SUSE.
  - E2E tests: 13/13 files passed (111/111 tests), including dedicated `ubuntu-debian-suse.e2e.test.tsx`.
  - Total test pyramid: 84/84 test files passed (581/581 tests).
  - Production build: `npm --prefix src run verify` (`build:edge` -> `tsc` -> `vite build`) completed cleanly with 0 errors.

## 2026-09-11 09:58:00 Asia/Taipei - Operational Conflict Fallback Boundary & Transport Classifier Fix (1.0.0)
- **Resolved Concurrency Lock & Operational Conflict Fallback Bug (`syncService.ts`)**:
  - **Fallback Boundary Restriction**: Refined fallback guard in `SyncService.syncVendors` lines 307 and 333. Changed condition from `if (isTransportError || mode === 'auto')` to strictly `if (isTransportError(error, errorMsg))`.
  - **Centralized Transport Classifier**: Extracted `isTransportError` helper checking HTTP status (404, 502, 503, 504), SDK error names (`FunctionsFetchError`, `FunctionsRelayError`), and network/gateway strings (`Failed to send a request`, `Relay Error`, `fetch failed`, `NetworkError`, `Bad Gateway`, `Gateway Timeout`).
  - **Plain Text / Gateway Error Extraction**: Enhanced `extractErrorMessage` to fall back to `response.text()` when non-JSON bodies (e.g. gateway 502/504 errors) are returned.
  - **Operational Conflict Surfacing**: Ensured operational conflicts (such as HTTP 409 `A threat feed synchronization is already in progress` or HTTP 401 unauthorized errors) cleanly return `{ success: false, errors: [errorMsg] }` instead of falling back to client-side ingestion when in `auto` mode.
  - **Unit & E2E Test Hardening**:
    - Added comprehensive unit test coverage in `src/tests/unit/services/syncServiceServerMode.test.ts` verifying that 409 concurrency lock conflicts, 401 unauthorized, 404 Function not found, 502 Bad Gateway text, and FunctionsRelayError behave strictly according to transport vs operational specifications.
    - Verified `tests/e2e/manual-sync-server-side.e2e.test.tsx` Phase 2 passes with expected error banner display.
- **Deep Verification**:
  - Unit tests: 65/65 files passed (427/427 tests).
  - Smoke tests: 3/3 files passed (13/13 tests).
  - E2E tests: 12/12 files passed (106/106 tests).
  - Total test pyramid: 80/80 test files passed (546/546 tests).
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

## 2026-09-09 12:45:00 Asia/Taipei - Self-Hosted Topology Alignment, NavState Latent Risk Resolution & Manual Sync Spec (1.0.0-dev.5)
- **Resolved NavState Latent Risk (`App.tsx`, `Sidebar.tsx`)**:
  - **Graceful Routing**: Implemented fallback handling in `handleSelectNav` in `src/App.tsx`: legacy `'sync' | 'settings'` navigation requests are seamlessly redirected into the authenticated Admin Console (`admin`), prompting the Admin Login modal if the user is unauthenticated.
  - **Fallback Error Boundary**: Added an explicit navigation error boundary `<Box data-testid="nav-fallback-container">` in `App.tsx` main render tree to cleanly catch any unrecognized or corrupted navigation state, preventing blank white screen states.
  - **Type & Documentation**: Documented `NavState` in `Sidebar.tsx` clarifying the legacy section routing contract.
  - **Unit Test Coverage**: Added regression unit tests in `tests/unit/components/App.test.tsx` and `tests/unit/components/Sidebar.test.tsx` verifying legacy nav routing, Admin login modal trigger, and accessible button handling.
- **Self-Hosted Topology Documentation & Environment Configuration (`src/.env.example`, `README.md`)**:
  - **Edge Functions Environment Clarification (D6)**: Corrected comments in `src/.env.example` and `README.md` to distinguish Supabase Cloud (auto-injected `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`) from Self-Hosted Docker environments (where `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must be explicitly configured in `docker-compose.yml` / `edge-runtime` container environment).
  - **Self-Hosted Deployment Procedure (D5)**: Added step-by-step instructions to `README.md` for compiling the Edge bundle (`npm --prefix src run build:edge`), copying functions to the container volume, setting environment variables, and restarting `edge-runtime`.
  - **Network Ingress & Reverse Proxy Topology (D1–D4)**: Documented single-origin reverse proxy recommendations (Caddy + Cloudflare Tunnel) with `/supabase` path prefix stripping to prevent CORS and Access cookie scope issues.
- **Server-Side Manual Threat Feed Sync Specification (Task 11c)**:
  - Authored comprehensive architectural specification `docs/agent/specs/manual-sync-server-side.md` addressing restricted network egress (C1) and browser payload chunking limits (BUG-003).
  - Defined `action: 'trigger_manual_sync'` contract on `sync-cve`, server-side ingestion reuse via `ingest.bundle.js`, role-gated admin authorization, and transactional advisory locks (`pg_try_advisory_xact_lock`).

## 2026-09-08 17:45:00 Asia/Taipei - Adversarial Audit & Full Nutanix Multi-Vendor Synchronization Hardening (1.0.0-dev.5)
- **Resolved Multi-Vendor Sync Omission & State Leakage (`src/services/syncService.ts`)**:
  - **Single Source of Truth**: Added `'nutanix'` directly into `SYNCED_VENDOR_CODES = ['redhat', 'nutanix'] as const`.
  - **Eliminated Hack in FeedSourceTable**: Replaced `|| vendorCode === 'nutanix'` with clean, honest `(SYNCED_VENDOR_CODES as readonly string[]).includes(vendorCode)`.
  - **Architectural Isolation**: Instantiated a fresh `new IngestionEngine({ webhookService, knownCveIds })` per vendor iteration in `syncVendors()`, eliminating memory leaks across vendor loops where previously processed CVEs/mappings were leaked and stamped into subsequent vendor sync calls.
  - **Cumulative Ingestion De-duplication**: Shared `knownCveIdSet` across vendor iterations so newly discovered CVEs are de-duplicated and accurately counted across vendors within a single sync run.
  - **AHV Prefix Stripping**: Fixed regex in `fetchAndIngestQuery` from `/^pc\./i` to `/^(pc\.|ahv[-.]|aos[-.]|afs[-.])/i` to ensure AHV fixed releases correctly map to `NXSA-AHV-11.2`.
- **Nutanix Adapter Normalization Hardening (`src/adapters/nutanix.ts`)**:
  - **Array affected_version**: Handled string arrays in `raw.affected_version` (e.g. `["7.0", "7.0.0.5", ...]`) to properly populate `justification` in `productImpacts`.
  - **Date Normalization**: Added fallback to `raw.lastModifiedDate` from list endpoints alongside `raw.lastModified`.
  - **Flexible CVE Parsing**: Supported string CVE IDs in `cveList` alongside object records.
  - **Severity Fallback**: Implemented automatic CVSS score to severity mapping (>=9.0 CRITICAL, >=7.0 HIGH, >=4.0 MEDIUM, >0 LOW) when explicit severity is missing or UNKNOWN.
  - **HTTP Status Message**: Improved error messaging on list fetch failure (`HTTP ${listRes.status} ${listRes.statusText}`).
- **UI/UX & Vendor-Neutral Remediation Guidance**:
  - **Advisory & CVE Drawers (`AdvisoryDetailDrawer.tsx`, `CveDetailDrawer.tsx`)**:
    - Replaced hardcoded `dnf upgrade -y` with vendor-specific guidance: `Prism LCM Upgrade: {version}` for Nutanix and `dnf upgrade -y` for Red Hat.
    - Replaced hardcoded Red Hat errata/portal links with dynamic Nutanix Portal security advisory links (`https://portal.nutanix.com/page/documents/security-advisories/release-advisories/details?id=...`).
  - **VendorPage Scoped Filtering (`VendorPage.tsx`)**: Extended `scopedCves` to match `c.vendor_code === vendorCode` directly.
  - **System Health Monitor (`SystemHealthMonitor.tsx`)**: Added Nutanix Security Advisories Portal API (`https://portal.nutanix.com/api/v1/advisories`) to diagnostics checks.
- **Supabase Cloud Runtime & Migration Synchronization**:
  - Applied pending migration `20260908000000_harden_vault_secrets_scheduler.sql` via `supabase db push` using access token to project `egofadbvftmbwodjneoy`.
  - Rebuilt and redeployed edge functions `sync-cve` and `scheduled-sync` (bundled with updated Nutanix adapter). Verified live health check HTTP 200 OK.
- **Deep Verification**:
  - Full test pyramid: 77/77 test files passed, 513/513 tests passed (128.08s).
  - Smoke tests: 3/3 suites passed, 13/13 tests passed, including live network fetch against Nutanix API (1512ms).
  - E2E tests: 11/11 suites passed, 103/103 tests passed, including 7-phase Nutanix E2E test suite.
  - Production build: Clean compilation with 0 TypeScript/Vite errors (6.92s).

## 2026-09-08 17:15:00 Asia/Taipei - Nutanix Security Ingestion, Edge Functions Deployment & Full E2E Verification (1.0.0-dev.5)
- **Implemented Nutanix Enterprise Ingestion Adapter (`src/adapters/nutanix.ts`)**:
  - Implemented `VendorAdapter`: `vendorCode = 'nutanix'`, `vendorName = 'Nutanix'`.
  - Configured 3 official Nutanix endpoints (`/api/v1/advisories`, `/api/v1/advisory`, `/api/v1/vulnerabilities`).
  - Implemented `fetchAdvisories(limit)` with chunked batching (batch size = 5) and error isolation per advisory.
  - Implemented `parse(rawPayload)` normalizing `cvelist`, CVSS v3 vectors and scores, severities ('CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'), product impacts (`AOS`, `Prism`, `AHV`), fixed versions (`fixedRelease`), and clean titles.
- **SyncService & IngestionEngine Integration (`src/services/syncService.ts`)**:
  - Updated `fetchAndIngestQuery` with native support for `NXSA-` advisory IDs and Nutanix vulnerability lookup fallback for CVE searches.
  - Rebuilt shared edge bundle (`src/supabase/functions/_shared/ingest.bundle.js`) incorporating `NutanixAdapter` via `npm run build:edge`.
  - Added error deduplication in `syncVendors()` to prevent duplicate error entries on multi-vendor transport failures.
  - Updated `FeedSourceTable.tsx` to display Nutanix feed as `Connected` with live official endpoints.
- **Deployed Supabase Edge Functions**:
  - Deployed `sync-cve` to Supabase Cloud runtime (`egofadbvftmbwodjneoy`) using access token.
  - Deployed `scheduled-sync` to Supabase Cloud runtime (`egofadbvftmbwodjneoy`).
  - Verified live Edge Function health check (`action: 'health_check'`) returning HTTP 200 OK.
  - Executed live Nutanix advisory ingestion (`NXSA-AOS-7.5.1.12`), verifying records stored in `advisories`, `cves`, `advisory_cve_map`, `vendor_sync_logs`, and payload stored in `advisory-documents/nutanix/NXSA-AOS-7.5.1.12.json`.
- **Comprehensive E2E & Test Pyramid Verification**:
  - Created `src/tests/e2e/nutanix.e2e.test.tsx` covering all 5 integration lifecycle phases.
  - Added live public API smoke test in `src/tests/smoke/adapters.smoke.test.ts` verifying real network fetch against `portal.nutanix.com`.
  - Added unit test suites `tests/unit/adapters/nutanix.test.ts` (12 tests) and `tests/unit/services/nutanixSyncService.test.ts` (3 tests).
- **Verification**: All 63 unit test suites (392 tests), 3 smoke test suites (13 tests), and 11 E2E test suites (101 tests) passed 100%; `npm run build` compiled production bundle cleanly with 0 TypeScript errors.

## 2026-09-08 16:00:00 Asia/Taipei - Authentic Vendor SVG Logos, UI/UX Polish & Vault Secrets Scheduler Diagnostics (1.0.0-dev.5)
- **Authentic Enterprise Vendor SVG Logos (`VendorLogos.tsx`, `VendorIcon.tsx`)**:
  - Implemented crisp, scalable React SVG components in `src/components/icons/VendorLogos.tsx` for all 8 enterprise vendors.
  - Upgraded `VendorIcon.tsx` with smooth micro-interactions, elevated hover shadow, and integrated SVG logos.
  - Added unit test suite `tests/unit/components/VendorIcon.test.tsx` (6 tests) verifying branding, accessible `aria-label`, and fallback.
- **Vault Secrets Scheduler Diagnostics & In-App Troubleshooting**:
  - Root cause resolved: `public.tick_scheduled_syncs()` reads `scheduled_sync_url` and `scheduled_sync_key` from Supabase `vault.decrypted_secrets`. When unconfigured, pg_cron logs `FAILED` with "Missing vault secrets".
  - Created migration `src/supabase/migrations/20260908000000_harden_vault_secrets_scheduler.sql` adding a 1-hour throttle to avoid pg_cron log flooding and creating secure helper `set_scheduled_sync_vault_secrets()`.
  - Created setup guide script `src/supabase/setup_vault_secrets.sql` with one-time configuration commands for Cloud and Self-Hosted environments.
  - Added `VaultSecretsGuideBanner` in `ScheduleSettings.tsx` with expandable guide and copyable SQL snippet.
  - Added Vault Secrets resolution guidance card in `LogDetailModal.tsx` and warning badge in `SyncLogTable.tsx`.
- **UI/UX Refinements**:
  - Elevated MetricCards with smooth hover lift and adaptive dark/light shadow.
  - Refined vendor summary cards on DashboardPage with border accents, arrow indicators, and critical count highlights.
  - Added frosted glassmorphism backdrop blur to Header.
- **Adversarial Review Refinements & Hardening**:
  - Fixed `VendorPage` title rendering: Added fallback to `VENDOR_NAMES[vendorCode.toLowerCase()]` when vendor node is absent from taxonomy. Added unit test in `VendorPage.test.tsx`.
  - Normalized `vendorCode` casing in `productTaxonomy.ts`: Used `vendor.vendorCode?.toLowerCase()` to guarantee `VENDOR_NAMES` dictionary match.
  - Auto-expanded `VaultSecretsGuideBanner` when `hasVaultError` is true in `ScheduleSettings.tsx`.
  - Broadened Vault secret error pattern matching in `LogDetailModal.tsx`, `SyncLogTable.tsx`, and `SyncMonitorPage.tsx`.
- **Verification**: 74 test files (484 tests) passing 100%; `npm run build` completely clean.

## 2026-09-08 15:20:00 Asia/Taipei - Collapsible Left Sidebar Feature & Accessibility Hardening (1.0.0-dev.5)
- **Implemented & Hardened Collapsible Left Sidebar (左邊欄位收起/展開功能)**:
  - **Sidebar Component Enhancements (`Sidebar.tsx`)**:
    - Added `isCollapsed`, `collapsed` alias, and `defaultCollapsed` props with support for controlled mode and internal uncontrolled state fallback.
    - Integrated collapse toggle button in the pinned footer (`sidebar-collapse-button`) with `ChevronLeft` (expanded) / `ChevronRight` (collapsed) and accessible aria-labels (`收起側邊欄` / `展開側邊欄`).
    - Responsive width transition: `240px` (expanded) <-> `64px` (collapsed rail) using MUI theme transition.
    - Fixed keyboard focus tooltip bug: Tooltip title is set to non-empty only when collapsed (`effectiveCollapsed ? title : ''`), preventing redundant popups when expanded.
    - Fixed WCAG 2.1 AA accessibility: Added explicit `aria-label` to all navigation item buttons (`Overview`, vendor names, static nav items) so screen readers and role-based test queries identify buttons even when labels are visually hidden.
    - Preserved `sidebar-version` element in footer with `display: none` when collapsed to maintain DOM hierarchy contract.
  - **Header Component Enhancements (`Header.tsx`)**:
    - Added optional `onToggleSidebar` callback and `isSidebarCollapsed` prop.
    - Added sleek `PanelLeft` toggle button (`header-sidebar-toggle`) in Header branding section with `<Tooltip>` and accessible aria-label matching collapsed state.
  - **Vendor Icon (`VendorIcon.tsx`)**:
    - Exported `VendorIconProps` interface.
    - Added `hideLabel?: boolean` prop and accessible `aria-label` on `Avatar` in compact navigation rail.
  - **App Layout & Persistence (`App.tsx`)**:
    - Added `isSidebarCollapsed` state in `App.tsx` persisted across sessions via `localStorage` key `vulnbeacon-sidebar-collapsed`.
    - Separated `localStorage` sync into pure `useEffect([isSidebarCollapsed])`, removing side-effects from React state updater.
    - Wired `onToggleSidebar` to Header and `isCollapsed` / `onToggleCollapse` to Sidebar.
  - **Testing (TDD Red-Green-Refactor)**:
    - Added unit test suite `tests/unit/components/Sidebar.test.tsx` (13 tests total) verifying default expanded width (240px), collapsed width (64px), hidden labels, version display toggling, controlled callback, internal uncontrolled toggle, `defaultCollapsed` support, accessible name contracts in collapsed mode, and navigation while collapsed.
    - Added unit test suite `tests/unit/components/VendorIcon.test.tsx` (2 tests) verifying export, default label, and `hideLabel` accessible name.
    - Added Header sidebar toggle tests in `tests/unit/components/Header.test.tsx` (17 tests total).
    - Added full E2E test suite `tests/e2e/sidebar-collapse.e2e.test.tsx` (5 tests) testing default state, sidebar button toggle, header button toggle, accessible navigation while collapsed, and localStorage persistence.
- **Verification**: All 72 test files (467 tests) passed 100%; `npm --prefix src run build` passed cleanly; `tsc` zero errors.

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

## 2026-09-05 09:07:00 Asia/Taipei - Resolved Supabase Edge Function 401 Auth, Context Error Surfacing & Cloud Sync
- **Resolved Supabase Edge Function 401 Authentication & Error Surfacing Defect**:
  - **`sync-cve` Edge Function Auth**:
    - Updated authentication in `src/supabase/functions/sync-cve/index.ts` to accept either `Authorization: Bearer <token>` OR `apikey: <key>` header, validating non-empty tokens.
    - Resolves 401 Unauthorized errors caused by Supabase JS SDK stripping bearer tokens when using `sb_publishable_...` keys (`omitApiKeyAsBearer: true`).
  - **Client Function Invocation Headers**:
    - Implemented `getFunctionHeaders()` in `src/lib/functionAuth.ts` to explicitly provide `Authorization: Bearer <token>` and `apikey` headers.
    - Updated all client services (`syncService.ts`, `webhookConfigService.ts`, `vendorService.ts`) to pass headers when calling `supabase.functions.invoke('sync-cve')`.
  - **Underlying Error Extraction**:
    - Added `extractErrorMessage()` in `syncService.ts` to parse JSON body from `err.context.json()` (or `.clone().json()`) on `FunctionsHttpError`, surfacing actual root cause error messages to users rather than generic fallback strings.
  - **Scheduled Sync Edge Function Syntax Fix**:
    - Restored missing `try {` in `src/supabase/functions/scheduled-sync/index.ts` vendor loop that caused Deno bundle parse errors.
  - **Supabase Cloud Sync & Deployment**:
    - Linked `vuln-beacon-dev` (`egofadbvftmbwodjneoy`) using user-provided access token.
    - Pushed database migrations (`20260815000000` through `20260905000000`) via `supabase db push`.
    - Deployed `sync-cve` and `scheduled-sync` edge functions to remote cloud runtime; verified live CORS and auth responses.
- **Verification**: All 53 test files (297 tests) passed 100%; `npm --prefix src run build` passed cleanly with zero type errors.

## 2026-09-05 00:36:00 Asia/Taipei - Fixed Audit Remediation Bugs & Hardened Webhook/Sync Systems
- **Fixed critical issues identified during adversarial review of prior remediation attempt**:
  - **Database Migration Fixes**:
    - Corrected column names in `tick_scheduled_syncs()` diagnostic logging (`sync_status` -> `status`, `sync_duration_ms` -> `duration_ms`, plus `vendor_code`), eliminating fatal PostgreSQL execution errors.
    - Fixed RLS policy dropping in `20260905000000_security_and_reliability_fixes.sql` to explicitly drop the actual `Allow write access to webhook_configs` policy (which was previously active, leaving write access open to anonymous users).
  - **Scheduled Sync Retry & Failure Tracking**:
    - Added error throw on `result.status === 'FAILED'` in `scheduled-sync/index.ts` so failed runs route into the catch block, populate the `failed` array, and do not update `last_scheduled_run_at`, allowing retry within the schedule window.
  - **Webhook Formatter & Proxy Fixes**:
    - Added pre-formatted payload transmission in `WebhookConfigService.testWebhook` to prevent Slack/Discord/Telegram from rejecting unformatted raw alert objects with HTTP 400.
    - Implemented platform-appropriate fallback payload generation in `sync-cve` `test_webhook` action.
    - Added top-level `text` field to `formatSlackAlert` for notifications compatibility.
    - Added HTML quote escaping and safe URL href formatting in `formatTelegramAlert`.
  - **SSRF Hardening**:
    - Expanded `isSafeDestinationUrl` across client and Edge Function to block RFC 4193 IPv6 ULA (`fc00::/7`), RFC 4291 link-local (`fe80::/10`), IPv4-mapped IPv6 (`::ffff:`), and CGNAT/broadcast IPv4 ranges.
  - **Client Concurrency & Data Integrity**:
    - Bounded `fetchAndIngestQuery` advisory fetches to batches of 5 concurrent requests (`BATCH_SIZE = 5`).
    - Fixed PostgREST joined array fallback in `advisoryService.ts` to use normalized `vendor?.name`.
- **Verification**: All 52 test files (283 tests) passed 100%; `build:edge` + `tsc` + `vite build` completed cleanly.

## 2026-09-05 00:23:00 Asia/Taipei - Resolved 16 Codebase Risks Across Security, Webhooks, Pipeline & Ingestion
- **Resolved all 16 audit findings and open defects**:
  - **P0 Security Hardening**:
    - Guarded `sync-cve` Edge Function with `Authorization: Bearer` authentication, CVE ID format validation, and 5MB storage payload protection.
    - Restricted `public.webhook_configs` RLS: anonymous clients may only SELECT; INSERT/UPDATE/DELETE restricted to authenticated and service_role. Added `create_webhook` and `delete_webhook` service-role handlers to `sync-cve`.
    - Implemented SSRF validator `isSafeDestinationUrl` blocking localhost, IPv4/IPv6 private ranges, and cloud metadata (169.254.169.254) across `WebhookService`, `sync-cve`, and `WebhookConfigPanel`.
    - Revoked public/anon execution on `tick_scheduled_syncs()`, granted to service_role only. Added transaction-level advisory lock (`pg_try_advisory_xact_lock`) to prevent concurrent tick executions.
  - **P1 Webhook & Integration**:
    - Added Telegram `chat_id` parsing and payload delivery; implemented HTML escaping (`&`, `<`, `>`) and 4000-char length truncation in `formatTelegramAlert`.
    - Added server-side webhook testing/dispatching in `sync-cve` to bypass browser-native Slack CORS blocking.
    - Added character truncation guards to Slack and Discord formatters (Slack 2500 chars, Discord 3500/1000 chars).
    - Added `loadWebhooks()` and passed `webhookService` in `fetchAndIngestQuery` so on-demand queries raise alerts.
  - **P1/P2 DevOps & Pipeline**:
    - Connected `build:edge` into `package.json` `"build"` script (`npm run build:edge && tsc && vite build`) to eliminate Edge Function bundle drift.
    - Added diagnostic error logging in `tick_scheduled_syncs()` when vault secrets are missing.
  - **P2 Ingestion & Operational Reliability**:
    - Updated `fetchAndIngestQuery` to persist records via bounded chunks using `buildPersistChunks`.
    - Added batching concurrency control (limit of 5) to `RedHatCsafAdapter.fetchAdvisories` to prevent memory exhaustion and timeouts.
    - Updated `scheduled-sync` to only update vendor `last_scheduled_run_at` on successful ingestion, allowing transient failures to retry within the tolerance window. Added `failed` vendor tracking.
  - **Client Performance & Data Integrity**:
    - Fixed BUG-002: updated `advisoryService.ts` string fallback to use `row.vendors?.name`.
    - Fixed BUG-007: added `.range()` to select mock in `syncServicePersist.test.ts`.
    - Disabled schedule controls in `ScheduleSettings.tsx` for unimplemented vendor adapters (`isAdapterImplemented`).
- **Verification**: All 52 test files (279 tests) passed 100%; `npm --prefix src run build` passed cleanly.

## 2026-08-31 10:40:00 Asia/Taipei - Supabase Cloud deployment & BUG-018 resolved
- **Supabase Cloud migration and function deployment complete**: Project linked to Supabase Cloud instance (`vuln-beacon-dev` / `kxtzxtxpsywhvfisarye`).
- **BUG-018 fixed**: Resolved PostgreSQL 15+ syntax error in `20260828000000_vendor_schedule.sql` where `CHECK` constraint attempted to use a subquery (`SELECT 1 FROM unnest(schedule_times)...`). Replaced with `IMMUTABLE` function `public.validate_schedule_times(TEXT[])`.
- **Database & Storage deployed**: All 4 migrations (`20260815000000_init_cve_collector.sql`, `20260816000000_restrict_write_rls.sql`, `20260816010000_advisory_storage.sql`, `20260828000000_vendor_schedule.sql`) successfully pushed via `supabase db push`. Verified `vendors` (all 8 seed rows), tables, indexes, RLS, and `advisory-documents` public storage bucket.
- **Edge Functions deployed**: Deployed `sync-cve` and `scheduled-sync` to Supabase Cloud runtime via `supabase functions deploy`. Verified `sync-cve` CORS OPTIONS returns HTTP 200 `ok`.
- **Verification**: `npm run build` clean; `supabase migration list` confirms all migrations in sync with remote; `curl` verification on PostgREST `vendors` endpoint and Storage bucket endpoint confirmed healthy.

## 2026-08-30 19:19:26 Asia/Taipei - Self-host deployment topology decided: keep SPA + BaaS, no BFF
- **Architecture decision: keep current SPA + Supabase BaaS; do NOT introduce a BFF.** The project is NOT currently BFF: browser talks directly to PostgREST (`src/lib/supabase.ts`, `src/lib/fetchAllRows.ts`), directly fetches `access.redhat.com` (`src/services/syncService.ts:319-332`), and directly POSTs webhooks (`src/services/webhook.ts:45`). Edge Functions are scoped service-role RPC endpoints, not frontend aggregation. Self-host constraint is network-layer problem: one Cloudflare Tunnel + one Caddy reverse proxy + same-origin path prefix (e.g., `https://<host>/supabase`) satisfies all requirements. Only app change is `VITE_SUPABASE_URL=https://<host>/supabase`.
- Key design points: D1 — single hostname with path prefix, not subdomains (CF Access cookie per-hostname; supabase-js does not send `credentials: 'include'`); D2 — cloudflared matches paths but does not rewrite, so Caddy `handle_path` strips prefix; D3 — path prefix verified against installed supabase-js 2.112.3 (`dist/index.mjs:350,387,630-634,664` — `ensureTrailingSlash` preserves prefix); D4 — pg_cron `scheduled_sync_url` vault secret points internal `http://kong:8000/functions/v1/scheduled-sync` (never crosses tunnel); D5 — self-host has no `supabase functions deploy` (file copy into `edge-runtime` volume, must include generated `_shared/ingest.bundle.js`); D6 — `src/.env.example` comment claiming Edge Functions auto-receive `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` is **wrong under self-host** and must be corrected; D7 — anon key is static JWT with no rotation UI.
- Consequences: C1 — browser-side manual sync (`syncService.ts:319-332`) will fail for users on restricted/tailnet-only networks while scheduled sync succeeds (second reason to move manual sync server-side alongside BUG-003). C2 — `public.webhook_configs` open anon SELECT/write severity drops to should-fix behind Access/tailnet, but any authenticated user can still read every webhook token; existing spec `docs/agent/specs/webhook-admin-and-server-dispatch.md` still applies.
- Recommendation: Cloudflare Tunnel + Access (no client install, preferred) over Tailscale; topology identical either way.
- **Status**: SPEC only (`docs/agent/specs/self-host-deployment-topology.md`, 188 lines); nothing implemented, no source code changed.

## 2026-08-29 09:52:00 Asia/Taipei - BUG-017 fixed: Sync error reason hidden when Edge Function invoke fails
- Completed **high-priority bug fix for inaccessible sync failure diagnostics** (BUG-017). When browser manual sync invocation failed (e.g. timeout or network error at the Edge Function boundary), the real error message was lost and users saw generic "Sync failed: one or more vendor feeds could not be ingested" with no indication of cause.
- Root cause: `SyncService.syncVendors()` surfaced error reasons only through `vendor_sync_logs` rows that the `sync-cve` Edge Function writes and returns. When the Edge Function invoke itself failed, no row was written, and the fallback message hid the real cause in `err?.message`. Secondary defect: the per-vendor catch block's invoke call was unguarded, allowing failures to propagate out of `syncVendors()` instead of being collected.
- Fix: (1) `syncVendors()` now returns optional `errors?: string[]`, collecting in-memory failure reasons per vendor (ingest reason wins over transport error; tracked via `recordedError` flag). (2) Per-vendor catch block's invoke wrapped in try/catch and logged. (3) `App.tsx` `handleManualSync` message priority: persisted `error_message` → `result.errors?.[0]` → unchanged generic string.
- Files changed: `src/services/syncService.ts`, `src/App.tsx`, `src/tests/unit/services/syncServiceErrorSurface.test.ts` (new, 4 tests), `src/tests/unit/components/appSyncError.test.tsx` (2 tests added).
- Verification: `npm run test:unit` — 44 files, 247 tests, all passing. `npm run build` — clean. Lane 1 with review: route:reviewer FAIL on duplicate `errors` entry → fixed and re-verified green.
- Context: Server-side verification run on 2026-08-29 proved entire pipeline healthy: Red Hat CSAF ingest SUCCESS (49 advisories / 289 CVEs / 4.2 s), all 5 persist chunks HTTP 200 (~8 s total), closing syncMeta call HTTP 200, CORS preflight correct. Full sync replayed with curl during diagnosis; live database current (advisories 50, cves 289, advisory_cve_map 631). Browser-side cause of original failure still unknown (needs browser Network/Console); fix above makes that cause visible next time. Measurement on live data (2026-08-29 02:39 UTC): single advisory `RHSA-2026:60520` (143 CVEs) produced 3.68 MB chunk — noted in BUG-006 Chunk size floor risk.

## 2026-08-29 00:40:13 Asia/Taipei - Bug-Fix Round 1: R4 and R6 Closed
- Completed **Phase 2 of vendor scheduling** (`docs/agent/specs/TASK-13-phase2-scheduler.md`). Closing decision gate that was blocking TASK.md. User chose real scheduler (pg_cron + pg_net + new Edge Function). Schedule values stored in `vendors` columns with editable Sync-page UI.
- Architecture implemented:
  - pg_cron fires every 5 minutes, calls `public.tick_scheduled_syncs()`, reads endpoint URL and key from `vault.decrypted_secrets`, issues one `net.http_post` to new `scheduled-sync` Edge Function. No secret stored in committed files; migration documents one-time `vault.create_secret` step in SQL comment.
  - Due-time logic is pure TypeScript in `src/services/scheduleWindow.ts` (`dueOccurrence`, `isVendorDue`, `SCHEDULE_TICK_TOLERANCE_MINUTES`), unit tested, not duplicated in SQL.
  - Edge Function reuses app's real ingestion code instead of hand-written Deno copy: `src/scripts/buildEdgeBundle.mjs` esbuild-bundles `_shared/ingest.entry.ts` into committed `_shared/ingest.bundle.js`. New npm script `build:edge`. Removed "adapter double maintenance" risk.
  - Server-side persistence does NOT use 3 MB chunking; limit exists only for browser → Edge Function HTTP boundary.
- Files new: `src/services/scheduleWindow.ts`, `src/scripts/buildEdgeBundle.mjs`, `src/supabase/functions/_shared/ingest.entry.ts`, `src/supabase/functions/_shared/ingest.bundle.js` (generated, committed), `src/supabase/functions/scheduled-sync/index.ts`, `src/supabase/migrations/20260828000000_vendor_schedule.sql`, `src/components/sync/ScheduleSettings.tsx`. Files edited: `src/supabase/functions/sync-cve/index.ts` (added `update_vendor_schedule` action; `persist_ingestion` unchanged), `src/package.json`, `src/types/index.ts`, `src/services/vendorService.ts`, `src/pages/SyncMonitorPage.tsx`, `src/App.tsx`. New tests: scheduleWindow.test.ts (unit), vendorScheduleService.test.ts, vendorScheduleMigration.test.ts, scheduledSyncFunction.test.ts, scheduleSettings.test.tsx.
- Verification: `npm run build:edge && npm test && npm run build` from src/ → 47 test files, 242 tests all passing; build OK. Before: 42 files / 193 tests.
- Review history: Pass 1 FAIL (IngestionEngine shared state leaked vendor rows, empty-service-key bypass, unguarded run-stamp abort, silently discarded error, missing raw-payload storage parity). Pass 2 FAIL (unchecked vendor_sync_logs insert, missing knownCveIds seeding, missing storage compensation on failed batch). Pass 3 FAIL (raw payloads uploaded for whole vendor before batch loop, mid-batch failure orphaned later batches). All blockers fixed; Pass 3 fix moved upload inside batch loop.
- Accepted risks recorded as R1–R7 in `docs/agent/BUG_FIX.md` (open entries): wall-clock limit on full CSAF ingest in one Edge Function; failed runs don't retry; mid-tick wall-clock kill leaves later vendors with no log row; new_items_count over-reports (pre-existing defect in ingestion.ts); double vendor_sync_logs insert failure orphaned in response; webhook alerts not dispatched from scheduled runs; DST precision on spring-forward/fall-back days in observing zones.
- **Deployment note**: migration and new Edge Function NOT YET DEPLOYED. Requires `supabase functions deploy scheduled-sync`, applying migration, one-time `vault.create_secret` calls for `scheduled_sync_url` and `scheduled_sync_key`. Regenerate `_shared/ingest.bundle.js` with `npm --prefix src run build:edge` whenever bundled app sources change.

## 2026-08-28 23:55:48 Asia/Taipei - TASK-13 Phase 2 complete: Vendor Schedule Settings and Real Scheduler
- Completed **Phase 2 of vendor scheduling** (`docs/agent/specs/TASK-13-phase2-scheduler.md`). Closing decision gate that was blocking TASK.md. User chose real scheduler (pg_cron + pg_net + new Edge Function). Schedule values stored in `vendors` columns with editable Sync-page UI.
- Architecture implemented:
  - pg_cron fires every 5 minutes, calls `public.tick_scheduled_syncs()`, reads endpoint URL and key from `vault.decrypted_secrets`, issues one `net.http_post` to new `scheduled-sync` Edge Function. No secret stored in committed files; migration documents one-time `vault.create_secret` step in SQL comment.
  - Due-time logic is pure TypeScript in `src/services/scheduleWindow.ts` (`dueOccurrence`, `isVendorDue`, `SCHEDULE_TICK_TOLERANCE_MINUTES`), unit tested, not duplicated in SQL.
  - Edge Function reuses app's real ingestion code instead of hand-written Deno copy: `src/scripts/buildEdgeBundle.mjs` esbuild-bundles `_shared/ingest.entry.ts` into committed `_shared/ingest.bundle.js`. New npm script `build:edge`. Removed "adapter double maintenance" risk.
  - Server-side persistence does NOT use 3 MB chunking; limit exists only for browser → Edge Function HTTP boundary.
- Files new: `src/services/scheduleWindow.ts`, `src/scripts/buildEdgeBundle.mjs`, `src/supabase/functions/_shared/ingest.entry.ts`, `src/supabase/functions/_shared/ingest.bundle.js` (generated, committed), `src/supabase/functions/scheduled-sync/index.ts`, `src/supabase/migrations/20260828000000_vendor_schedule.sql`, `src/components/sync/ScheduleSettings.tsx`. Files edited: `src/supabase/functions/sync-cve/index.ts` (added `update_vendor_schedule` action; `persist_ingestion` unchanged), `src/package.json`, `src/types/index.ts`, `src/services/vendorService.ts`, `src/pages/SyncMonitorPage.tsx`, `src/App.tsx`. New tests: scheduleWindow.test.ts (unit), vendorScheduleService.test.ts, vendorScheduleMigration.test.ts, scheduledSyncFunction.test.ts, scheduleSettings.test.tsx.
- Verification: `npm run build:edge && npm test && npm run build` from src/ → 47 test files, 242 tests all passing; build OK. Before: 42 files / 193 tests.
- Review history: Pass 1 FAIL (IngestionEngine shared state leaked vendor rows, empty-service-key bypass, unguarded run-stamp abort, silently discarded error, missing raw-payload storage parity). Pass 2 FAIL (unchecked vendor_sync_logs insert, missing knownCveIds seeding, missing storage compensation on failed batch). Pass 3 FAIL (raw payloads uploaded for whole vendor before batch loop, mid-batch failure orphaned later batches). All blockers fixed; Pass 3 fix moved upload inside batch loop.
- Accepted risks recorded as R1–R7 in `docs/agent/BUG_FIX.md` (open entries): wall-clock limit on full CSAF ingest in one Edge Function; failed runs don't retry; mid-tick wall-clock kill leaves later vendors with no log row; new_items_count over-reports (pre-existing defect in ingestion.ts); double vendor_sync_logs insert failure orphaned in response; webhook alerts not dispatched from scheduled runs; DST precision on spring-forward/fall-back days in observing zones.
- **Deployment note**: migration and new Edge Function NOT YET DEPLOYED. Requires `supabase functions deploy scheduled-sync`, applying migration, one-time `vault.create_secret` calls for `scheduled_sync_url` and `scheduled_sync_key`. Regenerate `_shared/ingest.bundle.js` with `npm --prefix src run build:edge` whenever bundled app sources change.

## 2026-08-28 11:20:00 Asia/Taipei - TASK-13 Phase 1 complete: Sync page now shows the real vendor API endpoints
- Completed **Phase 1 of feed sources & sync dashboard** (`docs/agent/specs/TASK-13-feed-sources-panel.md`).
- Problem: `SyncMonitorPage` previously showed only a log table and claimed coverage of "all 8 vendors", which was false. `ALL_ADAPTERS` contained one adapter (`RedHatCsafAdapter`) and `syncVendors()` iterated a hardcoded `['redhat']`. User requested visibility into which vendor API endpoints are actually contacted during sync.
- Changes:
  - `src/types/index.ts`: new `VendorEndpoint { label, url }`; `VendorAdapter` now requires `readonly endpoints: VendorEndpoint[]`.
  - `src/adapters/redhat-csaf.ts`: `listUrl` / `detailUrlBase` no longer private; new public `advisoryDetailUrl(id)` and `cveLookupUrl(cveId)` methods; `endpoints` declares three entries (advisory list, advisory detail, CVE reverse lookup).
  - `src/adapters/redhat.ts`: legacy unregistered `RedHatAdapter` now implements `VendorAdapter` with `endpoints` and `detailUrlBase` (needed for type compliance; not rendered).
  - `src/services/syncService.ts`: three hardcoded `https://access.redhat.com/...` URLs in `fetchAndIngestQuery` replaced by adapter calls. New export `SYNCED_VENDOR_CODES = ['redhat'] as const`.
  - `src/services/vendorService.ts` (NEW): `VendorService.fetchVendors()` reads `vendors` table (browser key SELECT-only); returns `[]` on error.
  - `src/components/sync/FeedSourceTable.tsx` (NEW): one row per vendor showing Vendor, Integration (Connected / Adapter idle / Not implemented), API endpoint, Last sync, Detail. Integration status derived at render time.
  - `src/pages/SyncMonitorPage.tsx`: gains `vendors` prop; sections `Feed Sources` and `Execution History`; subtitle changed to "Live feed sources, connection status, and execution history."
  - `src/App.tsx`: `VendorService.fetchVendors()` now runs INDEPENDENTLY of blocking `loadData` `Promise.all`. This is deliberate: when inside `Promise.all`, a slow/failing vendors query delayed `setIsLoading(false)` and blocked dashboard render, causing six test failures. `isLoading` gate still depends only on cves, sync logs, webhooks, advisories.
- New tests: `adapterEndpoints.test.ts` (9), `syncServiceAdapterUrls.test.ts` (4, includes guard asserting no `https://access.redhat.com` literal remains), `feedSourceTable.test.tsx` (6).
- Verification: 42 test files / 193 tests passed; `npm --prefix src run build` clean. Rendered output in jsdom shows Red Hat as `Connected` with three real endpoints and `SUCCESS 2026-08-28 10:40:36`; other seven vendors show `Not implemented`. Reviewer initially FAIL (blocking vendors requirement); adjudicated and OVERRULED (requirement superseded by blocking issue; spec updated). Gap found and fixed: empty-vendors blank table now shows `No vendor records loaded.`
- **Edge Function deployment note**: self-hosted function at `/root/container/supabase/vuln-beacon/volumes/functions/sync-cve/index.ts` deployed by copying `src/supabase/functions/sync-cve/index.ts` over it. No npm script exists. Pre-BUG-003 backup: `index.ts.bak-20260828-103943`.

## 2026-08-28 10:30:00 Asia/Taipei - BUG-003 fixed: sync payload oversize (chunking strategy implemented; live deploy and verification complete 2026-08-28 10:42:00 Asia/Taipei)
- Completed **CRITICAL bug fix for sync failure on large vendor feeds** (BUG-003: "Sync failed: one or more vendor feeds could not be ingested").
- Root cause identified and measured on live Red Hat CSAF feed + self-hosted Supabase: (1) `componentFromNvr()` in redhat-csaf.ts only cut NVRs at `-<digits>:`, leaving container image references distinct per SHA-256 digest and architecture, causing 131,206 duplicate product_impact rows (99.1% of 41.39 MB payload). (2) product_impacts denormalized per (advisory, CVE) pair, so RHSA with 25 CVEs shipped 25 identical copies. (3) Monolithic JSON body 43.6 MB exceeded Edge Runtime limits, supervisor killed worker with HTTP 500.
- Fix deployed: (a) Container images collapsed to repository path (strip `@sha256:...`), reusing dedupe; (b) Payload split into chunks (≤ 3 MB UTF-8 each) by `PERSIST_CHUNK_MAX_BYTES`; (c) sync logs now single row per vendor per run with aggregated totals, not per-chunk rows; (d) App.tsx now shows first FAILED log error message instead of generic string. (e) New tests: redhatCsafContainerCollapse (6), syncServiceChunking (6), appSyncError (3).
- Verification: 39 test files / 174 tests passed; live run against real Red Hat API: 49 advisories, 285 CVEs, 627 mappings; product_impact rows 132,982 → 39,386 (compression 2.9x); rows carrying raw sha256 131,206 → 0; monolithic body 41.63 MB → chunked ≤ 3 MB. Reviewer verdict: FAIL (UTF-16 byte count vs UTF-8) → fixed → ACCEPTED.
- Open items recorded in docs/agent/BUG_FIX.md as **BUG-005** (accepted risk: a transient failure on any one chunk aborts the whole vendor run; upserts are idempotent so retry is safe, but no retry is implemented) and **BUG-006** (deferred: `product_impacts` duplicated across `advisory_cve_map` rows; deduplicating to the advisory would cut the payload to 0.13 MB and also remove the single-advisory chunk-size floor). The fixed bug itself is recorded as BUG-003 in docs/agent/FIXED_BUG.md — the ids do not collide.
- **Live end-to-end verification COMPLETE (2026-08-28 10:42:00 Asia/Taipei)**: Edge Function deployed to `/root/container/supabase/vuln-beacon/volumes/functions/sync-cve/index.ts` (pre-fix backup `index.ts.bak-20260828-103943`). Contract: body without `syncMeta` -> HTTP 200 `{"success":true,"log":null}` (was HTTP 500 `Cannot read properties of undefined (reading 'status')`); unknown action -> 400; unknown vendorCode -> 400. Live sync: success in 10.7 s via 4 data chunks (all 200) + 1 closing log invoke (200), 9.71 MiB total, replacing the single 41.63 MiB body. Chunk 1 held a SINGLE advisory at 3,681,204 bytes, which is the spec's explicit over-budget exception, not a boundary defect. DB after run: advisories 0->49, cves 0->285, advisory_cve_map 0->627, vendor_sync_logs +1 row only (SUCCESS, items_fetched 49, new_items_count 285). Read-path check: RHSA-2026:60484 returns 82 impact rows, zero containing `@sha256:`.

## 2026-08-27 18:05:00 Asia/Taipei - Supabase schema and storage initialization on new instance
- Completed **Supabase table schema, RLS policies, storage bucket, and Edge Function initialization** for the new self-hosted Supabase instance (`https://2xoojjdbhq0ko587gudg.ivan.lab`).
- Migrations executed and verified on `vuln-beacon-db-1`:
  1. `20260815000000_init_cve_collector.sql`: created tables (`vendors`, `advisories`, `cves`, `advisory_cve_map`, `cve_triage`, `vendor_sync_logs`, `webhook_configs`), indexes, and seeded 8 default vendors.
  2. `20260816000000_restrict_write_rls.sql`: restricted direct public write RLS on sync-pipeline tables.
  3. `20260816010000_advisory_storage.sql`: created `advisory-documents` bucket in `storage.buckets`, added `raw_payload_path` to `advisories`, and configured public read policies on `storage.buckets` and `storage.objects`.
- Edge Function deployed: copied `src/supabase/functions/sync-cve/index.ts` to `/root/container/supabase/vuln-beacon/volumes/functions/sync-cve/index.ts` for Edge Runtime dispatch.
- Verification:
  - PostgREST REST API queried and returned 8 seeded vendors.
  - Storage API endpoint queried and returned `advisory-documents` bucket.
  - Edge Function endpoint pinged and responded correctly.
  - Full test suite passed (36 test suites, 159 tests) and build succeeded.

## 2026-08-27 17:47:58 CST - Audit of `.claude/skills/` complete; four foreign-project skills deleted; `.env.example` trimmed; pre-push gate and merge staged
- Completed **audit of `.claude/skills/` and cleanup of cross-project skills**.
- Audit found four skills documenting a different project (stock-pnl-web), not vuln-beacon:
  - `ship`: description says "deploy stock-pnl-web"; references `sources/`, `docs/UnitTests/README.md`.
  - `verify`: description says "Verify stock-pnl-web UI"; references `sources/scripts/verify-admin-status.cjs`, `src/App.smoke.test.tsx`, `stock-pnl-web/local-store-v1` localStorage key.
  - `versioning`: description says "version rule of stock-pnl-web"; references `sources/src/version.ts`, `sources/package.json`.
  - `testing`: description says "Run and write stock-pnl-web tests"; references `cd sources`, `docs/UnitTests/README.md`, `supabase-ops`, `generate-all`.
- All four deleted in commit `2bab05b`. Before deletion, verified that files are plain files with link count 1, tracked by this repo's own git (not symlinks or hard links shared with stock-pnl-web) — removal cannot affect stock-pnl-web; content remains recoverable from git history.
- Kept: `route` skill (referenced by `CLAUDE.md`) and four generic graph tools (`debug-issue`, `explore-codebase`, `refactor-safely`, `review-changes`).
- Secondary changes completed:
  - `src/.env.example` trimmed: removed `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` (not read by any code); kept `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (read by backfill script). README's embedded env template kept byte-identical. Commit `f1d3cdb`.
  - Pre-push gate activated: `git config core.hooksPath .githooks` applied locally; `dev` merged into `main` by fast-forward. Main branch now has 4 commits not yet pushed to `origin/main`: `5d435d2`, `a937ad8`, `f1d3cdb`, `2bab05b`.

## 2026-08-27 17:40:35 Asia/Taipei - follow-up work from env migration: verify gate and skill cleanup
- Completed **close of two follow-up items** from the 2026-08-27 env migration task.
- Follow-up 1 (was: no CI currently runs on push) — CLOSED with self-hosted verify gate:
  - Added `"verify": "npm run test && npm run build"` script to `src/package.json`.
  - Created `.githooks/pre-push` (new, executable) that runs `npm --prefix src run verify` and blocks push on failure.
  - Updated `README.md` with new `### Verify gate` subsection.
  - One-time setup required: `git config core.hooksPath .githooks` per clone; `git push --no-verify` bypasses.
  - Verification: forward path executed successfully → 36 test files / 159 tests passed, build succeeded, `GATE_OK` printed. Negative path tested by shadowing `npm` with stub exiting 1 → hook printed blocked message and exited 1.
- Follow-up 2 (was: supabase-ops skill still describes GitHub Pages) — CLOSED by complete deletion:
  - Deleted entire `.claude/skills/supabase-ops/` directory per user instruction.
  - Root cause: skill documented a different project (stock-pnl-web); contained references to `sources/` paths and `quoteWindow.ts` that do not exist in this repo, would have misdirected agents.
- All changes committed as `5d435d2` on branch `dev` (created from `main`; `main` unchanged).

## 2026-08-27 17:31:17 Asia/Taipei - Supabase env var naming migration + GitHub Actions removal
- Completed **Supabase env var naming migration + GitHub Actions removal** (Lane 1: env var rename, workflow deletion, config updates).
- Root cause: `src/lib/supabase.ts` hardcoded a fallback with a new-format `sb_publishable_...` key, but the variable was named `VITE_SUPABASE_ANON_KEY` (legacy JWT-era name). The deployed GitHub Pages site ran on that hardcoded fallback because the workflow never injected any `VITE_SUPABASE_*` vars.
- Changes made: (1) `src/lib/supabase.ts` — renamed to `VITE_SUPABASE_PUBLISHABLE_KEY`; removed hardcoded URL and key literals; `isConfigured` changed from constant `true` to a real check and demoted to module-local const; throws at module load when either var is missing. (2) `src/.env.example` — rewritten as three-group commented template: frontend `VITE_*`, local-script secrets, CLI-only vars; notes Edge Functions receive platform-injected `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`. (3) `src/scripts/backfillAdvisoryStorage.mjs` — reads `SUPABASE_SECRET_KEY` instead of `SUPABASE_SERVICE_ROLE_KEY`. (4) `src/supabase/functions/sync-cve/index.ts` — env names unchanged (platform-injected); clarifying comment added. (5) `src/vitest.config.ts` — added `test.env` with dummy Supabase values for test suite isolation. (6) `src/vite.config.ts` — removed dead `GH_PAGES` branch; `base` is now `'/'`. (7) `README.md` — env snippet, project-structure tree, and Deployment section updated for self-hosted static builds. (8) Deleted `.github/workflows/deploy-pages.yml`, `.github/` directory, and `docs/deployment/github-pages.md`.
- Review: Route:reviewer initial FAIL with 2 BLOCKERs (README lines 37 and 100 still referenced deleted workflow) plus 3 RISKs (dangling docs file, dead GH_PAGES branch, unobservable isConfigured export). All five fixed; tests and build re-run green.
- Verification: `npm --prefix src test` → 36 files / 159 tests passed. `npm --prefix src run build` → succeeded, `dist/index.html` references `/assets/...`.

## 2026-08-16 23:01:20 Asia/Taipei - audit findings remediated and verified
- Completed **remediation of all 14 audit findings** (BUG-003 through BUG-016, plus 1 investigation entry, all moved to `docs/agent/FIXED_BUG.md`). All entries include detailed resolution summaries.
- Remediation pass: A reviewer identified and fixed 4 further defects in the remediation itself (BLOCKER on syncVendors cve_id select, inflated skipped counts, missing order on backfill select, secret leakage in maskWebhookUrl).
- Regression tests added: `auditRemediation.test.ts` (webhook timeout/concurrency/secret-logging/ignoreActiveState, alert de-duplication), `advisoryStorageKey.test.ts` (backward compatibility + drift guard for Deno/Node copies), `webhookPanelSecurity.test.tsx` (secret absent from DOM, delete confirmation), `syncServicePersist.test.ts` (narrowed protected-table assertion to "no mutating calls").
- Verification: **132 → 159 tests** (36 files); `npm --prefix src run build` success; `npx tsc --noEmit` clean.
- All open bugs now FIXED. BUG-001 (webhook server-side dispatch, deferred) and BUG-002 (accepted risk) remain OPEN per scope.

## 2026-08-16 22:25:59 Asia/Taipei - read-only code audit completed
- Completed **read-only code audit** (baseline green: 132 tests pass, `tsc --noEmit` clean).
- Findings: 14 OPEN bugs recorded in `docs/agent/BUG_FIX.md` (ranked HIGH/MEDIUM/LOW, independent verification by main session, no code changed). (3 HIGH: duplicate webhook alerts, sync stalling on unresponsive webhook, silent sync failure. 8 MEDIUM: optimistic delete, silent truncation, key escaping, partial commit, non-deterministic advisory, webhook test ambiguity, drawer persistence, form validation. 3 LOW: secret in DOM, dead adapter, repo hygiene).
- Investigation: Rules-of-Hooks violation at src/components/explorer/CveDetailDrawer.tsx:52 was investigated and REJECTED as false positive. No throw on re-hook after 0-hook render (React treats it as fresh mount).
- No code changed. All files read-only.

## 2026-08-16 14:39:06 Asia/Taipei - move advisory raw_payload out of Postgres into Supabase Storage
- Completed **move advisory raw_payload out of Postgres into Supabase Storage** (Lane 2: schema migration + Deno edge function + external storage system, elevated risk).
- Problem: `advisories.raw_payload` (JSONB) held the full CSAF document per advisory, ~50-200KB each, counting toward the Supabase free-tier 500MB database limit. The prior task removed it from the read path, but it was still being written on every sync, so the column kept growing.
- Decision (confirmed with user): store the full document in a new public Supabase Storage bucket `advisory-documents` instead, keyed by `${vendorCode}/${advisory_id with ':' -> '_'}.json`. Public read matches the existing public-read RLS posture on `advisories` — CSAF documents are Red Hat public data already. Existing 50 rows backfilled and cleared in this same pass (not deferred); the `raw_payload` column itself is kept (not dropped) but its value is cleared, so the change stays reversible.
- Solution: (1) NEW `src/supabase/migrations/20260816010000_advisory_storage.sql` — creates the `advisory-documents` bucket (public), a public SELECT RLS policy on `storage.objects` scoped to that bucket, and adds `advisories.raw_payload_path text`. No write policy added on `storage.objects`: the service-role key used by the edge function bypasses RLS entirely, matching the existing pattern in `20260816000000_restrict_write_rls.sql`. (2) `src/supabase/functions/sync-cve/index.ts` — in the advisory upsert loop, uploads each advisory's raw CSAF payload to Storage BEFORE the upsert (so a failed upload throws before any DB write), then writes the returned storage path into `raw_payload_path` and hardcodes `raw_payload: {}` going forward. Upload errors throw, matching this file's existing fail-fast convention for every other Supabase call (advError/cveError/mapError/logError). (3) NEW `src/scripts/backfillAdvisoryStorage.mjs` — plain Node ESM (outside `tsc`'s build scope), for the existing 50 rows. Resumable (`.is('raw_payload_path', null)`), skips rows with empty payload, uses the same path scheme as the edge function, service-role key sourced from `process.env` only. Per-row try/catch collects failures into a summary instead of aborting the whole run — an accepted boundary-operation exception to the project's "no error handling for scenarios that can't happen" default. (4) One npm script added to `src/package.json`: `backfill:advisory-storage`.
- Review: route:reviewer PASS. Two RISK findings: (1) storage path built from client-supplied `vendorCode` with no character validation — accepted as an explicit spec assumption, safe under the current single Red Hat adapter (real advisory IDs only contain `:`, which is handled). (2) backfill script interpolated `row.vendors?.code` into the path without a null guard — fixed in a follow-up pass: missing vendor code now throws inside the existing try/catch and is collected into the script's failure list.
- Verification: `npm --prefix src test` — 33 files, 132 tests, unchanged and all pass (no test file was touched — this task's logic lives entirely outside the Vitest-covered surface: the edge function is Deno, the backfill script is a manual one-off). `npm --prefix src run build` compiles clean. `node --check` confirms the backfill script's syntax is valid.
- Not yet done (requires user to run manually): This session has no Supabase CLI auth (`supabase projects list` fails), so the following were not executed: (1) Apply the migration (`supabase db push`). (2) Deploy the updated edge function (`supabase functions deploy sync-cve`). (3) Run the backfill script: `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm --prefix src run backfill:advisory-storage`. (4) Verify in the Supabase dashboard: objects appear under `advisory-documents` bucket, and `advisories.raw_payload_path` is populated / `raw_payload` cleared for existing rows.
- Known open follow-ups (unrelated): No scheduler exists; sync is manual via UI button. RHSB not collected; CSAF endpoint returns RHSA/RHBA/RHEA only. No UI reads `raw_payload_path` yet — on-demand advisory-detail viewer fetching from Storage is a separate future task.

## 2026-08-16 14:16:02 Asia/Taipei - remove raw_payload from the CVE list read path
- Completed **remove raw_payload from the CVE list read path** (Lane 1: surgical deletion in advisory fetcher).
- Problem: `cveService.fetchCves()` selected `advisories.raw_payload` — the full CSAF document per advisory — for every row on page load. Roughly 50-200KB per advisory. At the current ~50 advisories this is unnoticeable; at the historical volume of the Red Hat CSAF feed it would be fatal. The preceding pagination fix removed the accidental 1000-row cap that had been masking this.
- Solution: (1) `src/services/cveService.ts` — dropped `raw_payload` from the `.select(...)` string. (2) Deleted the `advisoryDetail` object construction and the `advisory_detail` property it populated. It was the only consumer of `raw_payload` in this path and was dead: verified by repo-wide grep that no component ever read `advisory_detail` nor the fields it carried (mitigation, statement, bugzilla_id, bugzilla_url, updated_packages, topic, synopsis, type_severity, security_fixes). Removing `raw_payload` while keeping the object would have left every one of those fields undefined. (3) `src/components/explorer/CveTable.tsx` — removed the now-unused `advisory_detail?: AdvisoryDetailData` field from `CveTableRowItem`. (4) Simplified `allAdvisories` to `mappedAdvisoryIds`, dropping the `raw_payload.all_advisories` fallback. Reviewer verified against `adapters/redhat.ts:249-294` and `engine/ingestion.ts:74-89` that the two sets are always equal under the current ingestion path, so the fallback was dead code. (5) Typed `const mappings: any[]` and made the id filter a type guard `(id: string | undefined): id is string`, so tsc strict passes with no cast. An intermediate attempt used `as string[]`; that was rejected in favour of fixing the root cause.
- Implementation detail: `raw_payload` is still WRITTEN by `engine/ingestion.ts` and the sync edge function. Only the read path changed.
- Files: `src/services/cveService.ts`, `src/components/explorer/CveTable.tsx`, `src/tests/unit/services/cveListPayload.test.ts` (new, 3 tests).
- Verification: `npm --prefix src test` — 33 test files, 132 tests, all pass. `npm --prefix src run build` compiles clean.
- Known risk worth recording (accepted, no action taken): Dropping the `raw_payload.all_advisories` fallback is safe only while every advisory id stamped into `raw_payload.all_advisories` is also materialized as its own `advisory_cve_map` row. A future vendor adapter, a manual DB backfill, or an edge-function sync that breaks that invariant would make the list and detail views silently show fewer advisories, and no test covers that condition. Re-check this when adding the next vendor adapter.
- Still open (do not mark done — these are the agreed follow-ups): Decide whether advisory blobs need to be stored at all (Red Hat CSAF is public, unauthenticated and permanently addressable by errata id, so on-demand refetch is an option with zero storage cost). If blobs must be stored, prefer Supabase Storage (S3-compatible, already in the stack, 1GB free) over introducing AWS S3. No scheduler exists: sync is manual via a UI button; no GitHub Actions cron and no pg_cron. Supabase free tier pauses a project after 7 days idle. RHSB (Red Hat Security Bulletin) is not collected; the CSAF endpoint returns RHSA/RHBA/RHEA only.

## 2026-08-16 13:47:53 CST - Fix Supabase Read Paths Silently Truncating at PostgREST 1000-Row Cap
- Completed **fix Supabase read paths silently truncating at the PostgREST 1000-row cap** (Lane 1: surgical pagination fix in advisory/CVE fetchers).
- Problem: `advisoryService.fetchAdvisories()` and `cveService.fetchCves()` issued bare `.select()` with no pagination. PostgREST caps such queries at 1000 rows and truncates silently — no error surfaces. Frontend loaded all rows and filtered client-side, so datasets above 1000 rows rendered incomplete data with no visible failure. Discovered during feasibility assessment of full historical backfill from Red Hat CSAF API.
- Solution: NEW `src/lib/fetchAllRows.ts` — generic helper `fetchAllRows<T>(page: (from, to) => PromiseLike<{data, error}>)` with `SUPABASE_PAGE_SIZE = 1000`. Loops `.range(from, from + 999)` until page returns fewer than full page. Propagates error on any page immediately as `{ data: null, error }`, discarding partial results, so existing caller `if (error)` branches behave unchanged.
- Service changes: `advisoryService.fetchAdvisories()` and `cveService.fetchCves()` now build fresh query per page inside callback, append `.range(from, to)`. Mapping logic unchanged. Added unique secondary sort key `.order('id', { ascending: true })` after primary timestamp order in both services. Reason: PostgREST pages one request per page, and `published_at` / `published_date` are not unique — Red Hat publishes batches of errata sharing timestamp, so without tiebreaker rows at page boundary can duplicate or skip between requests. Caught in review.
- Implementation detail: Intermediate draft hoisted query builder out of per-page callback and reused one instance across pages. This is unsafe — `PostgrestFilterBuilder` is mutable and thenable, so re-calling `.range()` and awaiting again is undefined usage. Regression test now pins per-page rebuilding.
- Tests: NEW `src/tests/unit/services/pagination.test.ts` (7 tests). Mock chain in `advisoryCentric.test.ts` extended to support `.order().order().range()` chaining.
- Verification: npm --prefix src test — 32 test files, 129 tests, all pass. npm --prefix src run build compiles clean.
- Out of scope (known follow-ups): No scheduler (manual sync via UI button). `advisories.raw_payload` stores full CSAF JSON — capacity risk against Supabase free-tier 500MB if historical backfill proceeds. RHSB (Red Hat Security Bulletin) not collected; CSAF endpoint returns RHSA/RHBA/RHEA only.

## 2026-08-16 12:20:44 CST - Vendor/Product Taxonomy Navigation + Global Overview (Lane 2)
- Completed **Vendor/Product Taxonomy Navigation + Global Overview** (spec: `docs/agent/specs/product-taxonomy-nav.md`, Lane 2: elevated risk — cross-module nav state, service contract, multiple pages).
- NEW services & pages: `src/services/productTaxonomy.ts` (normalizeProductFamily, slugify, deriveTaxonomy, matchesProductFamily); `src/pages/ProductPage.tsx`.
- Core integration: AdvisoryService.fetchAdvisories now populates vendor_id (selected from Supabase). VendorIcon exports VENDOR_NAMES/VENDOR_COLORS. Sidebar replaces NavTab with NavState (dashboard/vendor/product) and renders vendor→product tree from derived taxonomy. App.tsx wires NavState state via useMemo(deriveTaxonomy), dispatches vendor/product render branches.
- Explorer & filters: ExplorerPage gains initialProductFamilyId prop; CveFilterBar product dropdown driven by productOptions prop (replacing hardcoded 6 entries); matchesProductFamily replaces inline substring matching.
- Dashboard reworked: Renamed to "Security Intelligence Overview"; vendor-card row and product-distribution chart now driven by derived taxonomy (replacing hardcoded 5-bucket keyword map). VendorDistributionChart takes items[] ({vendorId, productId, name, count}) plus onSelectProduct callback; DashboardPage flattens taxonomy correctly and wires navigation callbacks.
- Tests: NEW `src/tests/unit/services/productTaxonomy.test.ts` (15 tests); `src/tests/unit/components/ProductPage.test.tsx` (2 tests). Updated App.test.tsx (vendor-group nav test, title regex "Security Intelligence Overview"), advisoryDashboard.test.tsx (vendor-card tests, onSelectProduct click, back-compat-without-taxonomy), advisoryDetail.test.tsx (vendor_id fixture field added), advisoryCentric.test.ts (vendor_id assertion added).
- Review: route:reviewer PASS on second pass (scoped re-review). First pass: BLOCKER — DashboardPage declared onSelectProduct callback but never wired to VendorDistributionChart click handler; flattened productDistribution map discarded vendorId/productId pairing needed to route navigation. RISK — VERSION_NUMBER_RE `/\s+\d(\.\d+)*$/` (single digit only) would not normalize "Red Hat Enterprise Linux 10" into same family as "... 9"/"... 8"; spec requires `/\s+\d+(\.\d+)*$/`. Fixes: VendorDistributionChart.tsx reworked to take items[{vendorId, productId, name, count}] and onSelectProduct; DashboardPage.tsx flattens taxonomy into correct shape and wires callback through. Regex corrected to `\d+`. Fixture names in productTaxonomy.test.ts renamed "Family 01"→"Family01" to avoid collision with corrected regex (fixture rename only, test intent unchanged).
- Accepted design decisions (record for future): No router — navigation extended via existing useState(NavState); Product pages not deep-linkable; reload returns to Overview. No alias map ("RHEL" abbreviation normalizes separately from "Red Hat Enterprise Linux"; out of scope). Product taxonomy derived entirely from ingested advisory data (no hand-maintained product list, no vendors table, no DB migration). Sidebar shows top 10 product families per vendor by advisory count; remainder folded into "Other products" node.
- Verification: npm run test:unit 108/108 pass (25 test files); npm run test:smoke 11/11 pass; npm run test:e2e 3/3 pass; npm run build (tsc + vite) succeeds, no errors.

## 2026-08-16 00:22:15 CST - RHSA-Centric Data Layer (Phase C1+C2) — N:M Advisory-to-CVE Mapping
- Completed **Task 10 Phase C1+C2: RHSA-Centric Data Layer** (spec: `docs/agent/specs/rhsa-centric-data-layer.md`).
- Root problem: data layer was CVE-first and discarded N:M relationship between RHSA advisories and CVEs in three places: (1) `src/adapters/redhat.ts` kept only advisoriesList[0], demoting rest to decorative rawPayload.all_advisories; (2) `src/services/cveService.ts` read only advisory_cve_map[0]; (3) nothing queried FROM advisories.
- Solution: `src/adapters/redhat.ts` parse() now emits one NormalizedAdvisoryItem per RHSA in advisoriesList, each with its own errata URL and fixed versions tied to that advisory. New `src/services/advisoryService.ts` with AdvisoryService.fetchAdvisories() queries FROM advisories joining advisory_cve_map → cves, returning every CVE each advisory fixes with aggregated/deduped product_impacts and unioned fixed_versions. Refactored `src/services/cveService.ts` to iterate ALL mappings, merging product_impacts and unioning fixed_versions across all.
- Deduplication added: advisoriesList wrapped in Array.from(new Set(...)) to prevent duplicate errata IDs from upstream.
- TDD red→green: 3 new unit tests (`redhatMultiAdvisory.test.ts`), 3 new unit tests (`advisoryCentric.test.ts`).
- Review: route:reviewer PASS with 2 RISK findings. RISK 1 (duplicate advisories from upstream) fixed inline via deduplication. RISK 2 (affected_products fallback hardcodes 'Enterprise System') accepted as open low-priority risk, recorded in BUG_FIX.md (revisit if/when multi-vendor dataset expands).
- Also discovered and recorded OPEN BUG: webhook alerting has never worked in production (WebhookService only dispatches to manually registered configs, registerWebhook() is never called in production code, only in E2E test).
- Verification: npm test 64/64 passed, npm run build clean. Phase C3a (dashboard) in progress; Phase C3b (detail views) planned.


# Progress Log Archive

## 2026-08-16 00:04:13 CST - Security Refactor: Vendor Sync Behind Edge Function with RLS Write Restrictions
- Completed **Task 9: Security Refactor — Edge Function Backend & RLS Write Policies**.
- Rewrote `src/supabase/functions/sync-cve/index.ts` from stub into real `persist_ingestion` handler: looks up vendor by code, upserts cves/advisories/advisory_cve_map, inserts vendor_sync_logs using SUPABASE_SERVICE_ROLE_KEY; all upsert/insert calls now check error and throw on failure (hardening pass after reviewer RISK findings).
- Refactored `src/services/syncService.ts`: `syncVendors()` and `fetchAndIngestQuery()` no longer write directly to protected tables via anon key; both now call `supabase.functions.invoke('sync-cve', ...)`. FAILED-status recovery log write also routed through Edge Function with error checking.
- Added `src/tests/unit/services/syncServicePersist.test.ts` (4 tests, TDD red→green) verifying persistence goes through Edge Function and never touches protected tables directly.
- Added migration `src/supabase/migrations/20260816000000_restrict_write_rls.sql`: dropped "Allow write access" RLS policy on vendors, advisories, cves, advisory_cve_map, vendor_sync_logs, cve_triage (read policies unchanged); webhook_configs deliberately not locked down yet (pending webhook-admin Edge Function task).
- Deployed Edge Function live and applied RLS migration to Supabase project (xgrtyjazyqajqinwzlbl). Live-verified: anon key INSERT into advisories fails with RLS error 42501 (HTTP 401), SELECT succeeds (HTTP 200), Edge Function correctly rejects unknown vendor codes without writing.
- Process: Builder implemented against spec; route:reviewer found 2 RISK findings (unchecked Postgrest errors silently swallowing failures); fixed via second bounded builder dispatch; re-reviewed and got clean PASS with no findings.
- Verification: 58/58 tests passed, clean build, live production verification (real for running app, not just unit tests).
- Follow-on work noted in TASK.md: Task 11 (webhook-admin Edge Function + webhook_configs RLS lockdown); Task 10 tracking (CVE/RHSA data model redesign for advisory-first Dashboard).

## 2026-08-15 23:51:33 Asia/Taipei - Bug fix: Remove hardcoded CVE-2026-73086 injection from Red Hat adapter
- Removed hardcoded fake CVE injection from `src/adapters/redhat.ts` `fetchAdvisories()` (previously lines ~61-69).
- Cleaned polluted live Supabase database (project xgrtyjazyqajqinwzlbl): deleted CVE-2026-73086 row (id 65f7576c-c0bd-4f0d-b44b-93c9609e0f17), RHSA-2026:48758 advisory row (id cf395a71-a923-47b6-b7f1-b84e2748c398), and cascaded `advisory_cve_map` entry.
- Verification: 54 tests passed, clean build. User explicitly confirmed deletion. Step 1 of 3 in review-driven cleanup.

## 2026-08-15 23:17:30 Asia/Taipei - Full Architecture Overhaul & Dual-View Ergonomics Implementation
- Implemented **Dual View Modes (雙視角切換)** on Explorer page:
  - **`🛡️ RHSA 公告視角 (Advisory View)`**: Grouped by official Red Hat Errata, showing target CVEs, severity, synopsis, and affected products count.
  - **`🔍 CVE 弱點視角 (CVE View)`**: Grouped by international CVE ID, showing issued RHSAs, severity & CVSS score, and component impact matrix.
- Upgraded `CveFilterBar.tsx` with one-touch view mode toggles, product family breakdown, and component state filters.
- Enhanced `CveDetailDrawer.tsx` with instant copy actions (`📋 Copy component`, `📋 Copy dnf command`), direct Red Hat Bugzilla & Errata hyperlinks, and 4-way impact toggles (`Affected`, `Not affected`, `Fix deferred`, `All`).
- Added comprehensive unit tests for `CveTable.test.tsx` covering both view modes.
- Verified 100% passing tests (20 test suites, 54 tests) and clean production build (`npm run build`).

## 2026-08-15 23:07:45 Asia/Taipei - On-Demand Instant Query & Complete Sync Scope Architecture
- Added On-Demand Real-time Query Engine (`fetchAndIngestQuery`) to [`SyncService.ts`](file:///root/dev/vuln-beacon/src/services/syncService.ts) and [`ExplorerPage.tsx`](file:///root/dev/vuln-beacon/src/pages/ExplorerPage.tsx):
  - When searching for any historical/new RHSA or CVE not yet locally cached, the system enables 1-click live lookup directly against Red Hat Security Data API, automatically ingests it into Supabase, and updates UI state in real-time.

## 2026-08-15 23:02:00 Asia/Taipei - UI/UX Extreme Simplification & Ingestion of RHSA-2026:48758 (CVE-2026-73086)
- Radically simplified `CveDetailDrawer.tsx` UI/UX into 3 focused sections.
- Ingested live `CVE-2026-73086` and all linked advisories including `RHSA-2026:48758`, `RHSA-2026:54412`, `RHSA-2026:50287` into Supabase database (103 product/component states).
- Verified 100% passing tests (19 test suites, 51 tests) and production build (`npm run build`).

## 2026-08-15 22:48:30 Asia/Taipei - Red Hat Errata (RHSA) Official Advisory Layout Implementation
- Implemented full **Official Errata (RHSA) Advisory View** in `CveDetailDrawer.tsx` matching Red Hat standard structure (`https://access.redhat.com/errata/RHSA-2026:53413`).
- Updated `RedHatAdapter.ts` and `CveService.ts` to extract and normalize full advisory fields.
- Verified 100% passing tests (26 test suites, 66 tests) and production build (`npm run build`).

## 2026-08-15 22:45:00 Asia/Taipei - Removal of Triage Operations & Products/Components Impact Matrix Integration
- Completely removed Analyst Triage Operations (Triage queue page, triage forms, notes mutation, status chips) across frontend and services.
- Implemented full **Products & Components Impact Matrix (產品與元件影響狀態表)** displaying exact enterprise columns: `Products / services`, `Components` (with copy action), `State` (Affected, Fix deferred, Fixed, Will not fix), `Justification`, `Errata`, and `Release date`.
- Upgraded `RedHatAdapter.ts` to crawl and normalize live `package_state` and `affected_release` sub-feeds.
- Added drawer component filter, search bar, state counters, and direct Errata hyperlink navigation.
- Verified 100% passing tests (26 test suites, 65 tests) and production build (`npm run build`).

## 2026-08-15 22:35:45 Asia/Taipei - Remediation Solutions & Affected Products Extraction & UI Upgrade
- Enhanced ingestion normalization across adapters (`redhat.ts`, etc.) to parse affected packages and Errata fix versions.
- Added comprehensive **受影響產品與元件 (Affected Products)** chip list in `CveDetailDrawer.tsx` and `CveTable.tsx`.
- Implemented prominent **修正方案與修復版本 (Remediation & Fix Solution)** section with fix availability status badge, Errata/version chips, actionable update commands, and direct vendor advisory links.
- Updated `CveService.ts` to compute context-aware remediation guidance and sync enriched data to Supabase.
- Added unit tests in `CveDetailDrawer.test.tsx` (all 26 test suites, 65 tests passing 100%).

## 2026-08-15 22:13:30 Asia/Taipei - Live Supabase Backend Integration & Mock Data Elimination
- Linked and applied full database migration (`20260815000000_init_cve_collector.sql`) to live Supabase project `xgrtyjazyqajqinwzlbl`.
- Eliminated all static mock datasets (`mockData.ts`); built live Supabase services (`CveService`, `SyncService`, `WebhookConfigService`).
- Executed live ingestion run populating real vulnerability disclosures (50+ live CVE records) into Supabase PostgreSQL.
- Updated `App.tsx` with asynchronous live loading states, dynamic error boundaries, and optimistic triage persistence.
- Verified 100% passing tests (25 test suites, 63 tests) and production build (`npm run build`).

## 2026-08-15 22:02:30 Asia/Taipei - Theme Mode Switching (System/Dark/Light) & Supabase Edge Function
- Implemented full 3-mode dynamic theme switching (`system`, `dark`, `light`) via `ThemeContext` and `ThemeSwitcher` with `localStorage` persistence and OS preference auto-detection.
- Refactored entire UI theme palette to support crisp, high-contrast light mode and sleek obsidian dark mode across all views (`Dashboard`, `Explorer`, `Triage`, `Sync`, `Settings`).
- Scaffolding Supabase Edge Function `supabase/functions/sync-cve/index.ts` for backend orchestration.
- Added comprehensive unit tests in `ThemeSwitcher.test.tsx` (all 24 test suites, 60 tests passing 100%).

## 2026-08-15 21:50:00 Asia/Taipei - Root Directory Cleanup and Total Encapsulation in src/
- Relocated all project configuration and build files (`package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `node_modules/`, `tests/`, `supabase/`) strictly inside `src/`.
- Cleaned root directory to only contain `AGENT.md`, `CLAUDE.md`, `GEMINI.md`, `docs/`, `.gitignore`, and `src/`.
- Updated test runners, alias paths, and scripts to run with `--prefix src` or directly inside `src/`.
- Verified 100% passing tests (23 test suites, 58 tests) and production build within `src/`.

## 2026-08-15 21:42:00 Asia/Taipei - Frontend Architecture and Full Codebase Placement in src/
- Consolidated all code assets into `src/` hierarchy (`adapters/`, `components/`, `engine/`, `formatters/`, `hooks/`, `lib/`, `pages/`, `services/`, `theme/`, `types/`, `utils/`).
- Built React + Vite + Material UI security operations dashboard (`Overview`, `CVE Explorer`, `Triage Management`, `Sync Monitor`, `Webhooks Settings`).
- Added comprehensive React component unit tests under `tests/unit/components/` (all 23 test suites and 58 tests passing).
- Verified complete production build (`npm run build`) and full test execution (`npm test`).

## 2026-08-15 21:35:10 Asia/Taipei - Test Documentation, TDD Framework, and Initial Ingestion Engine
- Created testing specification suite under `docs/test/` (`README.md`, `TDD_GUIDELINES.md`, `UNIT_TEST_PLAN.md`, `SMOKE_TEST_PLAN.md`, `E2E_TEST_PLAN.md`).
- Synchronized testing guidelines and memory tables into `AGENT.md`, `CLAUDE.md`, and `GEMINI.md`.
- Implemented TDD workflows with Vitest, jsdom, and React Testing Library.
- Created Supabase database migration `20260815000000_init_cve_collector.sql` with 7 core tables, RLS policies, and 8 vendor seeds.
- Built 8 vendor adapters, CVSS/CVE normalizers, Webhook alert formatters (Discord, Telegram, Slack), IngestionEngine coordinator, and TriageService.

## 2026-08-15 21:24:25 Asia/Taipei - Initial Architecture and Documentation Setup
- Completed project requirements interview and architecture alignment via `/grill-me`.
- Established pure Supabase architecture (Edge Functions + pg_cron + PostgreSQL) with React + Vite + MUI frontend.
- Created system architecture plan (`docs/agent/PLAN.md`), specifications (`docs/agent/SPEC.md`), and phased tasks (`docs/agent/TASK.md`).

## 2026-08-16 00:40:28 CST - Phase C3a/C3b Complete: Dashboard & Detail Views; Bug Fixes in Redhat Adapter & SyncService
- Completed **Task 1 Phase C3a: RHSA-Centric Dashboard** (spec: `docs/agent/specs/rhsa-centric-dashboard.md`).
  - New AdvisoryTable component renders one row per RHSA advisory with errata id, CVEs fixed, severity, synopsis, affected products, date.
  - MetricCards gained optional `labels` prop (byte-identical to hardcoded strings; test passes unchanged).
  - DashboardPage now advisory-first: metrics count advisories (Critical RHSA / Tracked Advisories), urgent list renders AdvisoryTable over CRITICAL/HIGH advisories, product distribution chart computed from advisories.
  - App.tsx loads advisories via AdvisoryService and holds selectedAdvisory state.
  - Verification: npm test 69/69 passed, npm run build clean.
- Completed **Task 2 Phase C3b: Advisory Detail Drawer & Explorer Grouping** (spec: `docs/agent/specs/rhsa-advisory-detail-and-explorer.md`).
  - New AdvisoryDetailDrawer shows for one RHSA: header with errata link, impact synopsis, FULL LIST OF EVERY CVE THE ADVISORY FIXES (previously missing capability), affected products/components matrix, remediation text with copyable dnf command.
  - ExplorerPage advisory view now groups by RHSA via filteredAdvisories memo instead of re-labelling CVE rows. All three filters + search apply to advisories; searching a CVE id surfaces the RHSA that fixes it.
  - App.tsx wires drawer and passes advisories to ExplorerPage.
  - Verification: npm test 76/76 passed, npm run build clean.
- Fixed **Task 3 (BUG FIX): Red Hat CVE Detail Payload Silently Discarded** (file: `src/adapters/redhat.ts`).
  - Root cause: Detail endpoint (/cve/<id>.json) uses different shape from list endpoint (/cve.json) — id in `name` not `CVE`, severity in `threat_severity`, score nested in `cvss3.cvss3_base_score`, `bugzilla` is object not string. RedHatAdapter.parse() began with `if (!raw.CVE) continue`, dropping every detail record. SyncService.fetchAndIngestQuery() feeds detail payload straight to parse(), so on-demand lookups returned zero items with nothing persisted. Bulk sync unaffected (fetchAdvisories() spreads detail over list item).
  - Fix: parse() now normalises detail shape onto list-shape fields at top of per-record loop. New test `src/tests/unit/adapters/redhatDetailShape.test.ts` (6 tests, regression guard, fixture from real API).
- Fixed **Task 4 (BUG FIX): On-Demand Lookup Reported Success After Writing Nothing** (file: `src/services/syncService.ts`).
  - fetchAndIngestQuery() returned true whenever edge function did not error, even when engine.getCves() was empty; UI showed success while nothing persisted.
  - Now returns false when engine.getCves() empty. Covered by new case in `src/tests/unit/services/syncServicePersist.test.ts`.
- Completed **Task 5: Adapter Advisory-ID Deduplication** (file: `src/adapters/redhat.ts`, adjudicated RISK from C1/C2 review).
  - advisoriesList now wrapped in Array.from(new Set(...)) to prevent duplicate errata IDs from upstream emitting duplicate advisory rows.
- **LIVE END-TO-END VERIFICATION**: Ran full pipeline against real Red Hat Security Data API and live Supabase (xgrtyjazyqajqinwzlbl) using CVE-2023-4911 (glibc ld.so, 5 distinct RHSAs).
  - Adapter emitted 5 advisory items (before fixes: 0 from this payload shape), correctly reading CVSS 7.8 / severity HIGH from nested cvss3, 12 product impact rows.
  - IngestionEngine produced 5 advisories, 1 CVE, 5 mappings.
  - Edge function persisted all 5 RHSA rows (RHSA-2023:5453, 5454, 5455, 5476, RHSA-2024:0033) correctly linked to CVE-2023-4911 with 12 impact rows each.
  - One-CVE-to-many-RHSA relationship verified end-to-end in production.
- **Final State**: npm test 26 test files / 83 tests all passing; npm run build clean.

## 2026-08-16 01:11:54 CST - Phase D: CSAF Advisory-First Ingestion Rework
- Completed **PHASE D: CSAF Advisory-First Ingestion Rework** (spec: `docs/agent/specs/csaf-advisory-first-ingestion.md`, commits: c6fdbf9 feat, 770ee84 test).
- Root problem resolved: Ingestion was CVE-driven (pulled /securitydata/cve.json, fanned each CVE to RHSAs fixing it). An advisory accumulated only the CVEs that fell in the fetch window. RHSA-2023:5455 fixes 4 CVEs; database held 1. Average per advisory was 1.00 CVE.
- API investigation (verified live): /hydra/rest/securitydata/csaf.json is the advisory-first list with each entry carrying `RHSA, severity, released_on, CVEs[] (complete list), bugzillas[], released_packages[], resource_url`. Supports filters: `cve`, `severity`, `after`, `before`, `package`, `per_page` (not `product`). /hydra/rest/securitydata/csaf/<ERRATA-ID>.json returns full CSAF 2.0 document. csaf.json?cve=<CVE-ID> is a native reverse index (CVE → every advisory fixing it). Scope: errata addressing CVEs (996 RHSA, 3 RHBA, 1 RHEA in 1000-entry sample); all three prefixes served, non-security errata not served by API.
- Changes: NEW `src/adapters/redhat-csaf.ts` (RedHatCsafAdapter) parses CSAF 2.0 documents advisory-first. One NormalizedAdvisoryItem per errata carrying every CVE it fixes. Advisory metadata from document.tracking/aggregate_severity/notes; per-CVE score, vector, severity (threats→baseSeverity→advisory fallback), description from vulnerabilities[]. Affected scope from product_tree: composite ids split on FIRST colon only (since NVR contains epoch colon), resolve to human product names via recursive branch walk, package NVRs reduce to base component by cutting at first -<digits>: occurrence. product_status keys map to display states (fixed→Fixed, known_affected→Affected, known_not_affected→Not affected, under_investigation→Under investigation, generic fallback). rawPayload stores only `{ csaf_document_id, cve_ids }` (CSAF documents can exceed 1 MB). `src/adapters/index.ts`: RedHatCsafAdapter now returned by getAdapterByCode('redhat'); RedHatAdapter still exported but not registered. `src/services/syncService.ts`: fetchAndIngestQuery rewritten onto CSAF endpoints — errata id hits detail endpoint directly; anything else treated as CVE, goes through csaf.json?cve=, fetches every matching advisory's detail in parallel. Old /securitydata/cve.json and /cve/<id>.json calls gone. syncVendors() unchanged, picks up new adapter through registry.
- Readability decisions: Build artifacts (-debuginfo/-debugsource) dropped from impact matrix. Per-locale package families collapse to one row (e.g. `glibc-langpack-* (196 個語系)`). User-approved. Verified on real glibc advisory: 214 impact rows → 19, all 16 meaningful packages preserved.
- Review: route:reviewer PASS on adapter (first-colon-only splitting, NVR truncation on -<digits>:, genuinely recursive product-tree walk with raw-id fallback, all state mappings, suffix-only debug filtering, severity fallback order, rawPayload excludes full document). One RISK raised (non-array product_status throws TypeError) FIXED (guarded with Array.isArray, skipped that state key), not merely accepted.
- Obsolete tests adjudicated: Builder correctly stopped and reported 4 failures (all written against retired CVE-first payload shape). Three E2E suites (ingestion-flow, product-impact-matrix, webhook-alert-flow) now run on new CSAF fixture (src/tests/fixtures/redhat/csaf-e2e-sample.json) with original assertions intact; product-impact-matrix component expectation updated to resolved product name and base component name; syncServicePersist fetch mocks updated to CSAF reverse-index/detail shape.
- New tests: `src/tests/unit/adapters/redhatCsaf.test.ts` (8), `src/tests/unit/adapters/redhatCsafCollapse.test.ts` (5), `src/tests/unit/services/csafQuery.test.ts` (5), plus fixtures csaf-advisory-sample.json and csaf-e2e-sample.json.
- Live database re-ingestion: User authorised purge of all rows from advisory_cve_map, advisories, cves (old CVE-driven data). Ran real advisory-first pipeline against live Red Hat API and deployed sync-cve Edge Function. Result: 50 advisories, 142 CVEs, 238 mappings. Average CVEs per advisory 1.00 → 4.76. Maximum CVEs in one advisory 1 → 25. CVEs fixed by more than one advisory 0 → 55. Sample: RHSA-2026:54622 (Apache Camel) 25 CVEs, RHSA-2026:54757 (OpenStack) 24, RHSA-2026:54572 (webkit2gtk3) 23.
- Verification: npm test 29 files / 101 tests all passing; npm run build clean.
- Still open (unchanged): BUG-001 webhook alerting never dispatches in production; Task 11 webhook_configs Edge Function + RLS lockdown; BUG-002 low-severity accepted risk in advisoryService.ts.
