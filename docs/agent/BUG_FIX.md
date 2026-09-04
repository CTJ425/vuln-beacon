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
