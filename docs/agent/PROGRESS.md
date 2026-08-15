# Progress Log

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

## 2026-08-16 00:22:15 CST - RHSA-Centric Data Layer (Phase C1+C2) — N:M Advisory-to-CVE Mapping
- Completed **Task 10 Phase C1+C2: RHSA-Centric Data Layer** (spec: `docs/agent/specs/rhsa-centric-data-layer.md`).
- Root problem: data layer was CVE-first and discarded N:M relationship between RHSA advisories and CVEs in three places: (1) `src/adapters/redhat.ts` kept only advisoriesList[0], demoting rest to decorative rawPayload.all_advisories; (2) `src/services/cveService.ts` read only advisory_cve_map[0]; (3) nothing queried FROM advisories.
- Solution: `src/adapters/redhat.ts` parse() now emits one NormalizedAdvisoryItem per RHSA in advisoriesList, each with its own errata URL and fixed versions tied to that advisory. New `src/services/advisoryService.ts` with AdvisoryService.fetchAdvisories() queries FROM advisories joining advisory_cve_map → cves, returning every CVE each advisory fixes with aggregated/deduped product_impacts and unioned fixed_versions. Refactored `src/services/cveService.ts` to iterate ALL mappings, merging product_impacts and unioning fixed_versions across all.
- Deduplication added: advisoriesList wrapped in Array.from(new Set(...)) to prevent duplicate errata IDs from upstream.
- TDD red→green: 3 new unit tests (`redhatMultiAdvisory.test.ts`), 3 new unit tests (`advisoryCentric.test.ts`).
- Review: route:reviewer PASS with 2 RISK findings. RISK 1 (duplicate advisories from upstream) fixed inline via deduplication. RISK 2 (affected_products fallback hardcodes 'Enterprise System') accepted as open low-priority risk, recorded in BUG_FIX.md (revisit if/when multi-vendor dataset expands).
- Also discovered and recorded OPEN BUG: webhook alerting has never worked in production (WebhookService only dispatches to manually registered configs, registerWebhook() is never called in production code, only in E2E test).
- Verification: npm test 64/64 passed, npm run build clean. Phase C3a (dashboard) in progress; Phase C3b (detail views) planned.

