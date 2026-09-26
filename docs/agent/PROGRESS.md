# Progress Log

## 2026-09-26 09:44:02 Asia/Taipei - Dataset Browser Cache & Compact Format (1.5.0)
- **Cache**: `lib/explorerDataset.ts` stores each successful load in IndexedDB (`CACHE_FORMAT` versioned). The app shows the cached dataset through `CveService.fromDataset` / `AdvisoryService.fromDataset` until live data arrives, and a ref stops a late cache read from overwriting live rows. Services now propagate load errors so cached rows survive a failed load; the post-sync reload has its own error message.
- **Compact format**: `explorer_dataset(p_compact boolean DEFAULT false)`. The no-argument md5 is unchanged on dev (`8bd78f…`) and prod (`8d3f84…`). Compact output rebuilds all mappings identically. Prod savings: JSON −4.7%, gzip −3.2% (4,843 mappings send `null`).
- **Verification**: `npm --prefix src run verify` → 108 files / 756 tests passed, build clean; `fake-indexeddb` was added as a dev dependency for real IndexedDB tests.
- **Not measured**: the time to first render from cache in a real browser. It is expected to be near-instant (the load is local), but the agent cannot open the deployed site.

## 2026-09-26 09:10:18 Asia/Taipei - Explorer Performance (#10) & Release 1.4.0
- **Measured first**: the old read on production was 5 requests, 3.73 MB gzip, 38.6 MB JSON and 8.1 s (anon over REST). 65,356 impact objects were sent, of which 2,556 are distinct per advisory. The earlier "318 kB, defer" call used `pg_column_size` (compressed storage) and was wrong.
- **Change**: `explorer_dataset()` RPC plus `lib/explorerDataset.ts`, which rebuilds the old row shapes and shares one request between the two services. The CVE table is paged at 50 rows. A hash-join rewrite cut DB time from about 1.7 s to 0.6 s (md5-identical output).
- **Result (production)**: 1 request, 0.89 MB gzip, 4.3 MB JSON, 3.1 s; `JSON.parse` about 220 ms → 16 ms. Equivalence: all 5,022 mappings rebuild identically.
- **Verification**: `npm --prefix src run verify` → 106 files / 742 tests passed, build clean.
- **Not changed (measured, negligible)**: engine mapping `findIndex` and Edge `knownCveIds.includes` (milliseconds at current volume), and an index on `advisory_cve_map(cve_id)` (the RPC reads full tables). Further ideas are in the HTML performance report.
