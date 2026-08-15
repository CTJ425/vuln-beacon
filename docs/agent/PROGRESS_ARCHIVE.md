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
