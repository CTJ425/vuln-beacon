# Progress Log

## 2026-09-26 08:35:54 Asia/Taipei - 1.3.0 Follow-ups & Release 1.3.1
- **SQL check (dev)**: `src/supabase/checks/release-1.3.0.sql` returned `ALL_OK` (rolled back). Covered: `upsert_cves` merge rules, sync lease, `webhook_configs` RLS for anon, non-admin and admin, and tick HTTP-error logging.
- **Admin**: each project has one account (`zrchen0425@gmail.com`); it was granted `app_metadata.role = 'admin'` on both. No accounts were created while signup was open.
- **Scheduler**: writing the legacy `service_role` key into Vault did not help, and ticks still got 401 (evidence in BUG-032). `scheduled-sync` now accepts `SCHEDULED_SYNC_SECRET`, set in both the function secrets and Vault. The 00:35 UTC tick returned 200 on both projects. No vendor was due in that window, so no data sync has run yet; the next windows are the enabled vendors' 12:30 / 18:30 Asia/Taipei times.
- **Verification**: `npm --prefix src run verify` → 104 files / 731 tests passed, build clean.
- **Open**: deploy the frontend build (host not recorded in the repo).

## 2026-09-26 01:01:39 Asia/Taipei - Codebase Review Remediation & Release 1.3.0
- **Scope**: every finding from the 2026-09-25 codebase review (security, data correctness, sync reliability, tests, docs), merged with `origin/dev` (`62c384a`, code splitting and page states) and released as `1.3.0`. Fixed items are BUG-022 to BUG-031 in `FIXED_BUG.md`.
- **Security**: `sync-cve` now requires an admin JWT or the service-role key for every action except `health_check`. Before this, any header value was accepted. Admin means `app_metadata.role = 'admin'` (`src/lib/adminAuth.ts`), and `webhook_configs` is readable and writable by admins only. Email signup disabled on both projects via the Management API (`disable_signup: true`).
- **Data**: `upsert_cves()` merges shared CVE rows. All three server write paths use `src/engine/persistIngestion.ts`. Alerts are sent only after a run is persisted, and at every severity (`min_severity` filters). CVEs list every vendor. `sync_leases` replaces the pooled advisory lock. Scheduler HTTP errors are logged by the tick.
- **Deploy**: 4 migrations (`20260925000000`–`20260925030000`) pushed and both functions deployed to `vuln-beacon-dev` (egofadbvftmbwodjneoy) and `vuln-beacon` (baizoisgkgwqccqjwnxg), `--use-api --no-verify-jwt`. Probes on both: `health_check` 200; `delete_webhook`, `update_vendor_schedule` and `trigger_manual_sync` with a fake bearer or no credentials → 401.
- **Verification**: `npm --prefix src run verify` → 104 files / 730 tests passed, build clean (no chunk-size warning). Suite also passes under `TZ=UTC`.
- **Not verified**: runtime behaviour of the new SQL (`upsert_cves` merge rules, lease, RLS, tick logging). The agent was not permitted to run the rolled-back check; the script is at `src/supabase/checks/release-1.3.0.sql`. The migrations applied without error on both projects.
- **Open (user action, see `TASK.md`)**: grant the admin role on both projects, because nobody can use the Admin Console until then. Reset the scheduler vault secrets, since no scheduled sync has run since 2026-09-11. Run the SQL check on dev. Explorer full-load (#10) is deferred with measurements in `TASK.md`.
- **Docs**: README (vendors, admin access, Node), SPEC and PLAN rewritten to match the code, TASK split into open-only `TASK.md` plus `TASK_ARCHIVE.md`, older progress moved to the archive.
