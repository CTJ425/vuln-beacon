# Open Bugs

## BUG-006: product_impacts duplicated across advisory_cve_map rows
- **Status**: OPEN (2026-08-28, discovered during BUG-003 sync-payload oversize fix)
- **Severity**: LOW (high payload waste; deferred for schema impact; now also bounds BUG-003 (fixed) chunk size floor)
- **Location**: `src/adapters/redhat-csaf.ts` (advisory parsing), `src/services/advisoryService.ts`, `src/services/cveService.ts` (read paths)
- **Description**: `product_impacts` is advisory-level data (the set of products and their states affected by an advisory) but is stored denormalized in the schema: one copy per (advisory_id, cve_id) pair in the `advisory_cve_map` table. When an RHSA fixes multiple CVEs, identical `product_impacts` data is repeated once per CVE. Example: RHSA-2026:54622 fixes 25 CVEs → 25 identical copies of the same product/component impact list.
- **Impact**: Significant payload overhead. Live measurement on 49 advisories (2026-08-29 02:39 UTC): product_impact rows 39,386 total; if normalized to advisory-level storage, would compress to ~1,000 rows (measured 9.65 MB → ~0.13 MB). Current design treats each CVE's row as independent, so deduplication requires schema change and updates to all read paths (advisoryService, cveService, queries). **Chunk size floor risk**: Live verification on 2026-08-29 shows Chunk 1 reached 3.68 MB (`RHSA-2026:60520` with 143 mappings / 143 CVEs). The chunker cannot split below one advisory, so if a single advisory ever exceeds the Edge Runtime worker limit, the original oversize failure returns. Deduplicating product_impacts to advisory-level storage would remove this floor, further bounding the BUG-003 failure mode.
- **Recommendation**: Deferred. Deduplicating to advisory-level storage requires: (1) new schema column for impacts on advisories table or separate impacts lookup table, (2) backfill/migration, (3) updates to AdvisoryService.fetchAdvisories and CveService.fetchCves to join/aggregate from new location. Not urgent (current impact is unused IO, not functional bug). Revisit when payload size remains a concern post-chunking or when read performance becomes measurable bottleneck. Chunk size floor risk makes this also relevant for preventing future oversize failures on large single advisories.

## R3: Mid-Tick Wall-Clock Kill Leaves Later Vendors with No Log Row
- **Status**: OPEN / ACCEPTED RISK (2026-08-28, TASK-13 Phase 2 decision)
- **Severity**: LOW (logging/observability only, not data loss)
- **Location**: `src/supabase/functions/scheduled-sync/index.ts` (vendor loop), `src/engine/ingestion.ts` (per-vendor orchestration)
- **Description**: `public.tick_scheduled_syncs()` iterates all due vendors in a loop, invoking `net.http_post` to scheduled-sync Edge Function for each. If wall-clock timeout fires between vendor N and vendor N+1, the Edge Function terminates and postgres function exits. Vendors N+1 onward are never invoked. For vendors that were never attempted, no `vendor_sync_logs` row is created at all.
- **Impact**: Log queries show those vendors were `skipped` (because they don't appear in any response array: ran/skipped/logs), but the absence is silent — no explicit FAILED entry, no indication a tick was cut short. Requires server-side console trace or monitoring the tick duration to detect the pattern.
- **Recommendation**: Implement per-vendor timeout guard or edge-case logging to record vendors that were due but never attempted. For now, monitoring tick execution time and final log counts is the mitigation. Accept as low-priority observability gap.

## R7: DST Precision Loss on Spring-Forward and Fall-Back Days in Observing Timezones
- **Status**: OPEN / ACCEPTED RISK (2026-08-28, TASK-13 Phase 2 decision)
- **Severity**: LOW (minor precision loss, once or twice per year)
- **Location**: `src/services/scheduleWindow.ts` (dueOccurrence function, timezone offset lookup)
- **Description**: dueOccurrence resolves a local wall-clock time to UTC by looking up the timezone offset once at the current timestamp. On the day a timezone observes spring-forward or fall-back (DST transition), the offset changes during the day. A lookup at 6 AM on the transition day returns the pre-transition offset, so a sync scheduled for 2 AM (which fell back to 1 AM or is ambiguous) will resolve to an incorrect UTC time.
- **Impact**: On DST transition days, a sync scheduled for the ambiguous or spring-forward hour will run approximately 1 hour off from the intended local time. This happens approximately twice per year (spring-forward and fall-back) in observing timezones.
- **Recommendation**: Implement DST-aware timezone math using a library like `date-fns-tz` or `luxon` that handles DST transitions correctly. For now, the default timezone is Asia/Taipei (no DST), so this risk is muted in production. Accept if the user's configured timezone has DST; revisit if user reports schedule skew on transition days.

## R8: Cisco CSAF Incomplete Affected-Product Lists Due to Missing Product IDs
- **Status**: OPEN / ACCEPTED RISK (2026-09-13, TASK-31 decision)
- **Severity**: LOW (data completeness; user-facing consequence is incomplete product impact lists, not functional failure)
- **Location**: `src/adapters/cisco.ts` (advisory parsing, product id resolution)
- **Description**: Cisco CSAF advisories reference product ids (e.g., `CSAFPID-278404`) in vulnerabilities array that appear nowhere in the `product_tree` section. Example: `cisco-sa-tce-roomos-dos-9V9jrC2q` has 81 referenced product ids; 2 are missing from product_tree. Another: `cisco-sa-hardening-iosxr-qg64NcM` references 265 ids; 1 is missing. The adapter cannot resolve these ids to actual product names/versions, so resolves them to nothing.
- **Impact**: Affected-product lists in the VulnBeacon UI for Cisco advisories may be incomplete relative to the source Cisco document. The adapter silently omits unresolved ids from `affectedProducts`, `fixedVersions`, and `productImpacts` to prevent raw `CSAFPID-*` strings from appearing in user-facing output. Consequence: a user viewing a Cisco advisory may see fewer affected products than listed in the original Cisco CSAF document.
- **Recommendation**: Accepted. Leaking raw `CSAFPID-*` identifiers into the UI is worse than incomplete product lists (confusing to users). If Cisco fixes the product_tree completeness, or if a mapping table of missing ids to product names becomes available, revisit to enhance the product list completeness.

## R9: NVD Enrichment Coverage Low Without API Key
- **Status**: OPEN / ACCEPTED RISK (2026-09-13, TASK-32 decision)
- **Severity**: MEDIUM (enrichment-quality, not data-loss)
- **Location**: `src/adapters/vmware.ts` (CVE enrichment loop), NVD API 2.0 rate-limiting
- **Description**: The National Vulnerability Database (NVD) rate-limit without an API key is 5 requests per 30 seconds. NVD enrichment for VMware adapter runs strictly sequentially (not batched) due to 429 failures under concurrency. Measured on 5 advisories / 14 CVEs: 6 of 14 were enriched before hitting rate-limit. At a 20-advisory sync (~50 CVEs), coverage would be approximately 12%. Cisco CSAF, Debian, Red Hat CSAF, and other adapters do not use NVD enrichment; this risk is specific to VMware adapter.
- **Impact**: CVSS scores and vectors from NVD available for only ~12% of CVEs at scale, resulting in incomplete enrichment on the user dashboard. Broadcom's own `severity` field is always correct and serves as the ground truth; NVD scores are additive information. User decision 2026-09-13: accept for now given data quality vs quota tradeoff.
- **Options for mitigation**: (1) Throttle requests to ~6 seconds between fetches (slowest run time, minimal implementation); (2) Obtain NVD API key (50 req/30s quota, requires user setup via Supabase vault secrets); (3) Enrich only CVEs lacking a score in the database (best fix, requires ingestion-layer state not available to adapter today).
- **Recommendation**: Accepted for now. Revisit if user obtains NVD API key or if ingestion layer gains CVE deduplication state.

## R10: No Retry on Broadcom Advisory List Fetch
- **Status**: OPEN / ACCEPTED RISK (2026-09-13, TASK-32 decision)
- **Severity**: LOW (transient failures; retry would increase reliability but is orthogonal to adapter logic)
- **Location**: `src/adapters/vmware.ts` (fetchAdvisories method, Broadcom list API call)
- **Description**: The VMware adapter fetches the advisory list from Broadcom's `POST https://support.broadcom.com/web/ecx/security-advisory/-/securityadvisory/getSecurityAdvisoryList` endpoint once per sync run with no retry on transient failure. A single network failure, timeout, or temporary 5xx error causes the entire vmware sync to fail for that scheduled run.
- **Impact**: A transient network blip or Broadcom API maintenance window during a scheduled vmware sync causes the sync to report FAILED and emit no CVEs from that run. No alerts are generated, but the sync log shows failure. Affects vmware vendor only; other vendors are unaffected.
- **Recommendation**: Accepted. This matches every sibling adapter in the codebase (redhat, nutanix, ubuntu, debian, suse, cisco) which also have no retry loop on the primary list fetch. Retry logic is not unique to vmware and would be a cross-cutting concern better addressed as a framework enhancement to all adapters together, not in this change.
