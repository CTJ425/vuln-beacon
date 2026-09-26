# Progress Log

## 2026-09-26 09:10:18 Asia/Taipei - Explorer Performance (#10) & Release 1.4.0
- **Measured first**: the old read on production was 5 requests, 3.73 MB gzip, 38.6 MB JSON and 8.1 s (anon over REST). 65,356 impact objects were sent, of which 2,556 are distinct per advisory. The earlier "318 kB, defer" call used `pg_column_size` (compressed storage) and was wrong.
- **Change**: `explorer_dataset()` RPC plus `lib/explorerDataset.ts`, which rebuilds the old row shapes and shares one request between the two services. The CVE table is paged at 50 rows. A hash-join rewrite cut DB time from about 1.7 s to 0.6 s (md5-identical output).
- **Result (production)**: 1 request, 0.89 MB gzip, 4.3 MB JSON, 3.1 s; `JSON.parse` about 220 ms → 16 ms. Equivalence: all 5,022 mappings rebuild identically.
- **Verification**: `npm --prefix src run verify` → 106 files / 742 tests passed, build clean.
- **Not changed (measured, negligible)**: engine mapping `findIndex` and Edge `knownCveIds.includes` (milliseconds at current volume), and an index on `advisory_cve_map(cve_id)` (the RPC reads full tables). Further ideas are in the HTML performance report.

## 2026-09-26 08:35:54 Asia/Taipei - 1.3.0 Follow-ups & Release 1.3.1
- **SQL check (dev)**: `src/supabase/checks/release-1.3.0.sql` returned `ALL_OK` (rolled back). Covered: `upsert_cves` merge rules, sync lease, `webhook_configs` RLS for anon, non-admin and admin, and tick HTTP-error logging.
- **Admin**: each project has one account (`zrchen0425@gmail.com`); it was granted `app_metadata.role = 'admin'` on both. No accounts were created while signup was open.
- **Scheduler**: writing the legacy `service_role` key into Vault did not help, and ticks still got 401 (evidence in BUG-032). `scheduled-sync` now accepts `SCHEDULED_SYNC_SECRET`, set in both the function secrets and Vault. The 00:35 UTC tick returned 200 on both projects. No vendor was due in that window, so no data sync has run yet; the next windows are the enabled vendors' 12:30 / 18:30 Asia/Taipei times.
- **Verification**: `npm --prefix src run verify` → 104 files / 731 tests passed, build clean.
- **Docs correction**: deployment docs assumed a self-hosted frontend behind Caddy. In fact the frontend is on Cloudflare (deployed from `main`) and the backend on Supabase Cloud. README, `.env.example`, SPEC and PLAN were corrected; the self-host spec is marked superseded; three self-host tasks were dropped (see `TASK_ARCHIVE.md`).
