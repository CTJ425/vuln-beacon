# Changelog

## 1.2.0 - 2026-09-13
### Added
- **Cisco CSAF Vendor Adapter (Task 31)**: Implemented `CiscoAdapter` (`src/adapters/cisco.ts`) parsing Cisco PSIRT advisories from the public CSAF 2.0 distribution at `https://www.cisco.com/.well-known/csaf/` (changes.csv index plus per-advisory JSON; no authentication required). Added 15 unit tests (`src/tests/unit/adapters/cisco.test.ts`) and 3 fixture files. Registered in `ALL_ADAPTERS` index; updated `SYNCED_VENDOR_CODES` to 6 vendors; regenerated `ingest.bundle.js`. Implemented advisory-level severity derivation (max of `cvss_v3.baseSeverity` across vulnerabilities).
- **VMware / Broadcom Vendor Adapter (Task 32)**: Implemented `VmwareAdapter` (`src/adapters/vmware.ts`) ingesting VMware Security Advisories (VMSA) from the public Broadcom support-portal API (`POST https://support.broadcom.com/web/ecx/security-advisory/-/securityadvisory/getSecurityAdvisoryList`, segment=VC, no authentication). Added 21 unit tests (`src/tests/unit/adapters/vmware.test.ts`) and fixtures (sample Broadcom advisory list and NVD API responses). CVSS scores and vectors enriched from NVD API 2.0 with sequential (non-batched) fetching due to rate-limit sensitivity. Registered in `ALL_ADAPTERS` and updated `SYNCED_VENDOR_CODES` to 7 vendors.
- **Seventh Working Vendor Adapter**: Vendor coverage expanded from 5 (redhat, nutanix, ubuntu, debian, suse) to 7 with addition of Cisco CSAF and VMware/Broadcom adapters.

### Changed
- **NVD Enrichment Strategy for VMware Adapter**: Implemented sequential (non-batched) CVE enrichment from NVD API 2.0 to address rate-limiting sensitivity (5 requests/30 seconds without API key; 429 under concurrency). Broadcom severity field remains ground truth; NVD used for enrichment only, never reverse.
- **Test Suite Hardening**: Updated 6 test files that previously hardcoded vendor lists from 5 to 6/7 vendors (redhat, nutanix, ubuntu, debian, suse, cisco, vmware). Re-pointed 3 tests (`adapterEndpoints.test.ts`, `feedSourceTable.test.tsx`, `scheduleSettings.test.tsx`) from `vmware` exemplar to `dell` (still seeded without adapter) to preserve unimplemented-adapter test coverage.

### Fixed
- (No breaking bugs fixed in this release; accepted risks recorded in BUG_FIX.md)

## 1.1.0 - 2026-09-11
### Added
- **Ubuntu Threat Feed Ingestion (Task 26)**: Implemented `UbuntuAdapter` (`src/adapters/ubuntu.ts`) parsing Ubuntu Security Notices (USN), affected packages, CVE associations, CVSS metrics, and canonical announcement links.
- **Debian Security Tracker Ingestion (Task 26)**: Implemented `DebianAdapter` (`src/adapters/debian.ts`) with multi-format parsing for DSA advisory lists and Debian Security Tracker JSON feeds.
- **SUSE CSAF 2.0 Ingestion (Task 26)**: Implemented `SuseAdapter` (`src/adapters/suse.ts`) parsing CSAF 2.0 documents, reverse chronological index resolution from `changes.csv`, and exact announcement URL synthesis for `suse-su-` and `suse-ru-` (Recommended Updates).
- **Multi-Vendor Identity Logos**: Added vector SVG components in `VendorLogos.tsx` and `VendorIcon.tsx` for Ubuntu, Debian, and SUSE.
- **Unified State Badge Component (Task 28)**: Created `StateBadge.tsx` and centralized state classification utilities in `src/utils/statusUtils.ts` (`matchesImpactState`, `isAffectedState`), standardizing 10+ multi-vendor component vulnerability statuses (`Affected`, `Not affected`, `Fixed`, `Fix deferred`, `Will not fix`, `Under investigation`, `Resolved`, `Released`, `Open`, `Needed`).
- **Canonical Advisory URL Resolution (`src/utils/advisoryUrl.ts`)**: Built unified advisory URL generator with native CVE lookup across Red Hat, Ubuntu, Debian, SUSE, Nutanix, and CVE.org fallback.
- **Interactive CVE Links in Drawers**: Converted static CVE chips in `AdvisoryDetailDrawer.tsx` to clickable external links routing directly to vendor and NVD/CVE.org security databases.
- **Database Migration**: Added `20260911000000_add_ubuntu_debian_suse_vendors.sql` seeding `ubuntu`, `debian`, and `suse` vendor records, configurations, and adapter targets.
- **Versioning Skill**: Restored `.claude/skills/versioning/SKILL.md` aligned with VulnBeacon's semver guidelines, release checklists, and branch synchronization rules.

### Changed
- **Explorer Search & Filter Performance**: Added instantaneous search reset button in `CveFilterBar.tsx`, case-insensitive vendor scoping, and defensive null-safety guards across all product impact matrices.
- **Health Check Probe Optimization**: Parallelized external threat feed health probes using `Promise.all` in `SystemHealthMonitor.tsx`, reducing health check latency from ~10s to ~1s.
- **Accessibility Compliance (A11y)**: Added `labelId` and `id` bindings to filter selects in `CveFilterBar.tsx` and descriptive `aria-label` attributes to table actions in `CveTable.tsx` and `AdvisoryTable.tsx`.

### Fixed
- **Explorer Component State Filter Collision (Task 28)**: Resolved critical substring collision where `'notaffected'.includes('affected')` caused `AFFECTED` and `NOT_AFFECTED` filters to overlap.
- **Batch Deduplication & Conflict Handling in Edge Ingestion (BUG-021)**: Resolved PostgreSQL unique constraint collisions in `sync-cve` and `scheduled-sync` by deduplicating batch upserts (`uniqueCves`, `uniqueAdvisories`, `dedupedMappings`).
- **Transport Error Classification & Client Fallback**: Restricted client-side ingestion fallback exclusively to network transport failures, preventing operational conflicts from masking edge runtime status.
- **Timer & Memory Leaks**: Fixed unmount timers in `AdvisoryDetailDrawer.tsx` (`copyTimerRef`) and guaranteed probe timeout cancellation in `SystemHealthMonitor.tsx` via `finally` block.
- **Advisory URL Double-Wrapping**: Fixed redundant URL encoding when advisory identifiers are already full canonical URLs.

## 1.0.0 - 2026-09-09
### Added
- **Server-Side Manual Threat Feed Sync (Task 11c)**: Moved manual sync trigger from client browser to Edge Function endpoint (`action: 'trigger_manual_sync'` in `sync-cve`), supporting tailnet-restricted environments with PostgreSQL advisory locking (`try_acquire_sync_lock`) and admin role verification.
- **Nutanix Enterprise Ingestion Adapter (Task 23)**: Added full `VendorAdapter` implementation (`src/adapters/nutanix.ts`) querying official Nutanix security endpoints, parsing CVSS v3, product impacts (AOS, Prism, AHV), and normalized advisories into `ALL_ADAPTERS` and `SYNCED_VENDOR_CODES`.
- **Authentic Vendor SVG Logos & Vault Secrets Guide (Task 22)**: Added pure React vector SVG components in `VendorLogos.tsx` for 8 enterprise vendors, elevated hover micro-interactions in `VendorIcon.tsx`, and introduced `VaultSecretsGuideBanner` with in-app troubleshooting for missing PostgreSQL vault secrets.
- **Collapsible Left Sidebar (Task 21)**: Added responsive collapse/expand rail (240px <-> 64px) with accessible tooltip, footer toggle, header panel button, and `localStorage` persistence.
- **Vendor-Neutral Nomenclature (R3)**: Replaced vendor-biased user-facing text across the public UI with neutral wording. `MetricCards` labels (`Critical Advisories`, `Tracked Advisories`), `AdvisoryTable`, `AdvisoryDetailDrawer` (`Advisory` column, `查看安全公告`), `CveTable` headers (`公告編號 (Advisory ID)`, `關聯安全公告 (Advisory)`) and chips (`公告待發布`), `CveDetailDrawer`, `CveFilterBar` placeholder, `ExplorerPage` subtitle and fetch messages, `DashboardPage`, and `VendorPage`. Data identifiers (vendor codes, `advisory_id` values, `errata` fields, adapter ids, API paths, DB columns) are unchanged.
- **Application Version Surface**: Added `src/config/version.ts` exporting `APP_VERSION`, `APP_NAME` and `getDisplayVersion()`, sourced from `src/package.json`, rendered in the Sidebar footer.
- **Header GitHub Repository Link (R4)**: Replaced the notification bell with a GitHub link to `https://github.com/CTJ425/vuln-beacon`.
- **Version Config**: Added `.claude/version.config.json` describing tag prefix, branches, changelog path and version sync files.

### Changed
- **Navigation & Access Boundary Consolidation (R1)**: Removed `Sync Monitor` and `Webhooks & Config` from the public sidebar. Both now live inside the authenticated Admin Console alongside Log Query and System Health as a 4-tab console.
- **Sidebar Vendor Quick-Nav**: Hidden while the Admin Console is active; vendor views remain reachable from the Dashboard vendor tiles.
- **Dashboard Empty State**: The first-sync call to action no longer triggers a sync. It navigates to the Admin Console, opening the login modal when signed out.

### Fixed
- **Scheduled Sync Concurrency Lock & De-duplication Guard (BUG-020)**: Added PostgreSQL mutual exclusion advisory locking (`try_acquire_sync_lock` / `release_sync_lock`) to `scheduled-sync` Edge Function to prevent concurrency collisions with manual sync, and propagated newly ingested CVE IDs to `knownCveIds` within the vendor loop to eliminate duplicate webhook alerts.
- **PostgREST Joined CVE Foreign Key Normalization (BUG-020)**: Normalized `map.cves` in `src/services/advisoryService.ts` to cleanly handle single-element array joins from PostgREST.
- **Unmount Timeout Cleanup (BUG-020)**: Added `copyTimerRef` cleanup on unmount across `CveDetailDrawer.tsx`, `LogDetailModal.tsx`, and `ScheduleSettings.tsx`.
- **Rules of Hooks Latent Violation in CveDetailDrawer (BUG-019)**: Reordered `useMemo` hooks in `src/components/explorer/CveDetailDrawer.tsx` above all conditional returns, guaranteeing invariant hook execution count across null and populated item transitions.
- **App Notification Timer Leaks & Teardown Exceptions (BUG-019)**: Managed `syncMessage` auto-dismiss via dedicated `useEffect` with `clearTimeout` on unmount in `src/App.tsx`, resolving unhandled `window is not defined` errors during environment teardown.
- **SyncService Webhook Dispatch Safety (BUG-019)**: Added optional chaining `clearWebhooks?.()` and `registerWebhook?.()` to guard against uninitialized webhook service instances in `src/services/syncService.ts`.
- **PostgREST Join Normalization (BUG-019)**: Added `resolveAdvisory` and `resolveVendor` helpers in `src/services/cveService.ts` to reliably handle both object and single-element array shapes returned by PostgREST joined foreign keys.
- **Self-Hosted Supabase URL Support (BUG-019)**: Updated `ScheduleSettings.tsx` to accept any valid `http://` or `https://` prefix for self-hosted instances rather than strictly mandating `.supabase.co`.
- **Unauthenticated Vendor Sync via Explorer (R2, security)**: `ExplorerPage.handleFetchDirectly` called `syncService.fetchAndIngestQuery`, performing a live vendor fetch and persisting advisories, CVEs and mappings through the `sync-cve` edge function, with no authentication check on a page mounted for every visitor. The control is now rendered only for authenticated admins and the handler returns early when unauthenticated. Covered by `tests/unit/pages/explorerDirectFetchGate.test.tsx`.
- **Manual Sync Trigger Scope (R2)**: Manual vendor synchronization is now present and operable only inside the authenticated Admin Console.
- **Vendor View Auth Threading**: `VendorPage` now forwards `isAuthenticated` to the `ExplorerPage` it embeds, so an authenticated admin reaching Explorer through a vendor tile keeps the direct-fetch capability.
- **Severity Filter Accessibility**: Associated the severity filter label with its form control in `CveFilterBar`.
- **Brittle Version Assertions**: Test assertions on the displayed version now compare against `APP_VERSION` instead of a hardcoded literal.

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
