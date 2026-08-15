# Active Tasks

## Current Work Stream: Ingestion Engine & Frontend Triage Dashboard

- [x] **Task 1: Core Project Scaffolding, Testing Framework & Database Setup**
  - [x] Initialize React + Vite + TypeScript + Vitest setup.
  - [x] Create Supabase migration SQL scripts (`supabase/migrations/20260815000000_init_cve_collector.sql`) with tables, indexes, RLS policies, and vendor seed data.
  - [x] Create comprehensive testing documentation (`docs/test/` with README, TDD Guidelines, Unit, Smoke, E2E plans).
  - [x] Synchronize memory and TDD standards across `AGENT.md`, `CLAUDE.md`, and `GEMINI.md`.
  - **Verification**: `npm run test:smoke` passed; database migration valid; test pyramid established.

- [x] **Task 2: Vendor Ingestion Adapters & Normalization Engine (TDD Completed)**
  - [x] Implement individual vendor adapters for 8 enterprise vendors:
    - [x] `adapters/redhat.ts`
    - [x] `adapters/vmware.ts`
    - [x] `adapters/nutanix.ts`
    - [x] `adapters/dell.ts`
    - [x] `adapters/hpe.ts`
    - [x] `adapters/netapp.ts`
    - [x] `adapters/veeam.ts`
    - [x] `adapters/cohesity.ts`
  - [x] Implement CVSS calculation and standard CVE normalizers (`utils/cvss.ts`, `utils/cve-normalizer.ts`).
  - [x] Implement IngestionEngine coordinator (`engine/ingestion.ts`) with sync log tracking.
  - **Verification**: `npm run test:unit` passed (13 unit test files, 35 tests).

- [x] **Task 3: Webhook Notification Engine & Formatters (TDD Completed)**
  - [x] Implement WebhookService dispatcher (`services/webhook.ts`).
  - [x] Implement payload formatters for Discord, Telegram, and Slack (`formatters/`).
  - [x] Implement E2E webhook alert trigger verification.
  - **Verification**: `npm run test:e2e` passed (ingestion, webhook dispatch, triage lifecycle).

- [x] **Task 4: Frontend Development (React + MUI Dashboard & Triage Interface)**
  - [x] Build Overview Dashboard (metrics, critical alerts, vendor breakdown).
  - [x] Build CVE Explorer (search, multi-vendor filtering, severity filters, sorting, pagination).
  - [x] Build Advisory Detail & Triage Drawer (status update, assignees, internal notes).
  - [x] Build Sync Monitor & Manual Trigger page.
  - [x] Build Webhook Settings page.
  - [x] Add dynamic theme switching: `system` / `dark` / `light` with `ThemeSwitcher`, `ThemeContext`, and `localStorage` persistence.
  - **Verification**: All views render responsive UI and pass UI component tests (`App.test.tsx`, `MetricCards.test.tsx`, `ThemeSwitcher.test.tsx`).

- [x] **Task 5: End-to-End Integration & Verification**
  - [x] End-to-end integration tests: Ingestion -> Webhook -> Dashboard -> Triage.
  - [x] Scaffold Supabase Edge Function (`supabase/functions/sync-cve/index.ts`).
  - [x] Full production build & test pyramid verification (`npm test` and `npm run build`).
  - **Verification**: Complete flow executes successfully end-to-end (24 test suites, 60 tests passed 100%).

- [x] **Task 6: Live Supabase Backend Integration & Real Ingestion Pipeline**
  - [x] Link project and apply database migration to live Supabase instance (`https://xgrtyjazyqajqinwzlbl.supabase.co`).
  - [x] Delete static mock datasets; build live data services (`cveService.ts`, `syncService.ts`, `webhookConfigService.ts`).
  - [x] Execute live multi-vendor sync directly populating live CVE records and sync logs into Supabase.
  - [x] Wire live reactive loading, optimistic triage updates, and webhook configuration management.
  - **Verification**: 25 test suites, 63 tests passing 100%; Vite production build successful.

- [x] **Task 8: Removal of Triage Operations & Products/Components Impact Matrix**
  - [x] Delete all Analyst Triage Operations (Triage queue navigation, status forms, analyst notes, and legacy triage files).
  - [x] Implement enterprise **Products & Components Impact Matrix** with columns: `Products / services`, `Components`, `State`, `Justification`, `Errata`, `Release date`.
  - [x] Upgrade crawler to extract detailed `package_state` and `affected_release` component lists.
  - [x] Add component-level search, copy actions, state filter tabs (`Affected`, `Fix deferred`, `Fixed`), and Errata hyperlinks.
  - **Verification**: 26 test suites, 65 tests passing 100%; Vite production build clean.

- [x] **Task 9: Security Refactor — Edge Function Backend & RLS Write Policies**
  - [x] Move all Supabase write operations behind Edge Function with service-role key.
  - [x] Tighten Row-Level Security (RLS) write policies to enforce granular permissions.
  - [x] Update sync services to use Edge Function endpoints (webhook handlers use Edge Function for advisory persistence, pending webhook-admin Edge Function task).
  - **Verification**: 58/58 tests passed; clean build; live production verified: anon key RLS restrictions enforced (INSERT fails with 42501), Edge Function validates vendor codes before writing. Completed 2026-08-16 00:04:13 CST.

- [ ] **Task 11: Webhook Settings & Admin Controls — Edge Function Backend & RLS Write Policies (Phase B2)**
  - [ ] Implement `webhook-admin` Edge Function handler for webhook create/delete/update operations using service-role key.
  - [ ] Apply RLS write policy restrictions to `webhook_configs` table (currently allows direct browser writes via anon key).
  - [ ] Update `webhookConfigService.ts` to route all mutations through `webhook-admin` Edge Function.
  - [ ] Verify webhook management UI works correctly with backend Edge Function (no browser direct writes).
  - **Status**: Planned follow-on item (step 2 of 2, Phase B2, blocked on Task 9 completion).

- [x] **Task 10: CVE/RHSA Data Model Redesign — Dashboard Reorganization (Phase C1+C2+C3a+C3b Complete; Bug Fixes 3–5 Complete)**
  - [x] **Phase C1+C2: RHSA-Centric Data Layer** (Completed 2026-08-16)
    - [x] Rewrote `src/adapters/redhat.ts` parse() to emit one NormalizedAdvisoryItem per RHSA in advisoriesList, each with its own errata URL and fixed versions tied to that specific advisory.
    - [x] Created `src/services/advisoryService.ts` with AdvisoryService.fetchAdvisories() querying FROM advisories joining advisory_cve_map → cves, returning AdvisoryRowItem[] with every CVE each advisory fixes, product_impacts aggregated/deduped, fixed_versions unioned.
    - [x] Refactored `src/services/cveService.ts` to iterate ALL advisory_cve_map mappings (not just [0]), merging product_impacts and unioning fixed_versions across all mappings.
    - [x] Added dedupication to advisoriesList via Array.from(new Set(...)) to prevent duplicate errata IDs from upstream producing duplicate advisory rows.
    - [x] TDD red→green: 3 new unit tests (redhatMultiAdvisory.test.ts), 3 new unit tests (advisoryCentric.test.ts). Verification: npm test 64/64 passed, npm run build clean.
  - [x] **Phase C3a: RHSA-Centric Dashboard** (Completed 2026-08-16)
    - [x] New AdvisoryTable component renders one row per RHSA advisory (errata id, CVEs fixed, severity, synopsis, affected products, date).
    - [x] MetricCards gained optional `labels` prop (defaults to hardcoded strings for backward compatibility; existing test passes).
    - [x] DashboardPage now advisory-first: metrics count advisories (Critical RHSA / Tracked Advisories), urgent list renders AdvisoryTable over CRITICAL/HIGH advisories, product distribution computed from advisories.
    - [x] App.tsx loads advisories via AdvisoryService and holds selectedAdvisory state.
    - [x] Verification: npm test 69/69 passed, npm run build clean.
  - [x] **Phase C3b: Advisory Detail Drawer & Explorer Grouping** (Completed 2026-08-16)
    - [x] New AdvisoryDetailDrawer shows errata header with link, impact synopsis, FULL LIST OF EVERY CVE THE ADVISORY FIXES (previously missing capability), affected products/components matrix, remediation text with copyable dnf command.
    - [x] ExplorerPage advisory view now groups by RHSA via filteredAdvisories memo instead of re-labelling CVE rows; all filters + search apply to advisories; searching a CVE id surfaces the RHSA that fixes it.
    - [x] App.tsx wires the drawer and passes advisories to ExplorerPage.
    - [x] Verification: npm test 76/76 passed, npm run build clean.
  - [x] **Task 3 (BUG FIX): Red Hat CVE Detail Payload Silently Discarded** (Completed 2026-08-16)
    - [x] File: `src/adapters/redhat.ts`. Root cause: detail endpoint uses different shape (id in `name` not `CVE`, severity in `threat_severity`, score nested in `cvss3.cvss3_base_score`). parse() dropped all detail records. SyncService.fetchAndIngestQuery() feeds detail payload to parse(), so on-demand lookups returned zero items.
    - [x] Fix: parse() normalises detail shape onto list-shape fields at top of per-record loop.
    - [x] New test: `src/tests/unit/adapters/redhatDetailShape.test.ts` (6 tests, regression guard, real API fixture).
  - [x] **Task 4 (BUG FIX): On-Demand Lookup Reported Success After Writing Nothing** (Completed 2026-08-16)
    - [x] File: `src/services/syncService.ts`. fetchAndIngestQuery() returned true whenever edge function did not error, even when engine.getCves() was empty; UI showed success while nothing persisted.
    - [x] Fix: Now returns false when engine.getCves() empty.
    - [x] Coverage: new case in `src/tests/unit/services/syncServicePersist.test.ts`.
  - [x] **Task 5: Adapter Advisory-ID Deduplication** (Completed 2026-08-16)
    - [x] File: `src/adapters/redhat.ts`. Adjudicated RISK from C1/C2 review. advisoriesList wrapped in Array.from(new Set(...)) to prevent duplicate errata IDs from upstream emitting duplicate advisory rows.
  - [x] **LIVE END-TO-END VERIFICATION** (Completed 2026-08-16)
    - [x] Ran full pipeline against real Red Hat Security Data API and live Supabase (xgrtyjazyqajqinwzlbl) using CVE-2023-4911 (glibc ld.so, 5 distinct RHSAs).
    - [x] Adapter emitted 5 advisory items (before fixes: 0 from this payload shape), correctly reading CVSS 7.8 / severity HIGH from nested cvss3, 12 product impact rows.
    - [x] IngestionEngine produced 5 advisories, 1 CVE, 5 mappings.
    - [x] Edge function persisted all 5 RHSA rows (RHSA-2023:5453, 5454, 5455, 5476, RHSA-2024:0033) correctly linked to CVE-2023-4911 with 12 impact rows each.
    - [x] One-CVE-to-many-RHSA relationship verified end-to-end in production.
    - [x] Final State: npm test 26 test files / 83 tests all passing; npm run build clean.
  - [x] **Phase D: CSAF Advisory-First Ingestion Rework** (Completed 2026-08-16)
    - [x] New `src/adapters/redhat-csaf.ts` (RedHatCsafAdapter) parses CSAF 2.0 documents advisory-first with one NormalizedAdvisoryItem per errata carrying every CVE it fixes. Advisory metadata from document.tracking/aggregate_severity/notes; per-CVE score, vector, severity with fallback chain (threats→baseSeverity→advisory), description from vulnerabilities[]. Product impacts resolved from product_tree via recursive branch walk with raw-id fallback; package NVRs reduced to base components; composite ids split on FIRST colon only. product_status keys mapped to display states. rawPayload stores only csaf_document_id and cve_ids (not full 1 MB+ documents).
    - [x] `src/adapters/index.ts`: RedHatCsafAdapter now registered as getAdapterByCode('redhat'); RedHatAdapter still exported.
    - [x] `src/services/syncService.ts`: fetchAndIngestQuery rewritten to CSAF endpoints (errata id → detail endpoint; CVE → csaf.json?cve= then parallel detail fetches). Old /securitydata/cve.json and /cve/<id>.json calls removed. syncVendors() unchanged.
    - [x] Readability: Build artifacts (-debuginfo/-debugsource) dropped; per-locale packages collapsed. Verified on glibc: 214 rows → 19 with all 16 meaningful packages preserved.
    - [x] Review PASS: first-colon splitting, NVR truncation, recursive product-tree walk, state mappings, debug filtering, severity fallback, rawPayload exclusion verified. One RISK (non-array product_status) FIXED with Array.isArray guard.
    - [x] Obsolete tests adjudicated: 4 failures (CVE-first shape) expected and fixed. Three E2E suites now run on new CSAF fixture (csaf-e2e-sample.json) with original assertions intact; component expectations updated.
    - [x] New tests: redhatCsaf.test.ts (8), redhatCsafCollapse.test.ts (5), csafQuery.test.ts (5).
    - [x] Live database re-ingestion: User-authorised purge of advisory_cve_map/advisories/cves. Ran advisory-first pipeline against live Red Hat API and Edge Function. Result: 50 advisories, 142 CVEs, 238 mappings. Average CVEs/advisory 1.00 → 4.76. Maximum 1 → 25. Cross-mapped advisories 0 → 55. Sample: RHSA-2026:54622 (Apache Camel, 25 CVEs), RHSA-2026:54757 (OpenStack, 24), RHSA-2026:54572 (webkit2gtk3, 23).
    - [x] Verification: npm test 29 files / 101 tests passing; npm run build clean.



