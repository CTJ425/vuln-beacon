# Progress Log

## 2026-09-26 01:01:39 Asia/Taipei - Codebase Review Remediation & Release 1.3.0
- **Scope**: every finding from the 2026-09-25 codebase review (security, data correctness, sync reliability, tests, docs), merged with `origin/dev` (`62c384a`, code splitting and page states) and released as `1.3.0`. Fixed items are BUG-022 to BUG-031 in `FIXED_BUG.md`.
- **Security**: `sync-cve` now requires an admin JWT or the service-role key for every action except `health_check`. Before this, any header value was accepted. Admin means `app_metadata.role = 'admin'` (`src/lib/adminAuth.ts`), and `webhook_configs` is readable and writable by admins only. Email signup disabled on both projects via the Management API (`disable_signup: true`).
- **Data**: `upsert_cves()` merges shared CVE rows. All three server write paths use `src/engine/persistIngestion.ts`. Alerts are sent only after a run is persisted, and at every severity (`min_severity` filters). CVEs list every vendor. `sync_leases` replaces the pooled advisory lock. Scheduler HTTP errors are logged by the tick.
- **Deploy**: 4 migrations (`20260925000000`–`20260925030000`) pushed and both functions deployed to `vuln-beacon-dev` (egofadbvftmbwodjneoy) and `vuln-beacon` (baizoisgkgwqccqjwnxg), `--use-api --no-verify-jwt`. Probes on both: `health_check` 200; `delete_webhook`, `update_vendor_schedule` and `trigger_manual_sync` with a fake bearer or no credentials → 401.
- **Verification**: `npm --prefix src run verify` → 104 files / 730 tests passed, build clean (no chunk-size warning). Suite also passes under `TZ=UTC`.
- **Not verified**: runtime behaviour of the new SQL (`upsert_cves` merge rules, lease, RLS, tick logging). The agent was not permitted to run the rolled-back check; the script is at `src/supabase/checks/release-1.3.0.sql`. The migrations applied without error on both projects.
- **Open (user action, see `TASK.md`)**: grant the admin role on both projects, because nobody can use the Admin Console until then. Reset the scheduler vault secrets, since no scheduled sync has run since 2026-09-11. Run the SQL check on dev. Explorer full-load (#10) is deferred with measurements in `TASK.md`.
- **Docs**: README (vendors, admin access, Node), SPEC and PLAN rewritten to match the code, TASK split into open-only `TASK.md` plus `TASK_ARCHIVE.md`, older progress moved to the archive.

## 2026-09-22 14:43:12 Asia/Taipei - Cisco / VMware Frontend UI Coverage
- **Cisco / VMware UI wiring (Lane 1 — COMPLETED)**:
  - Problem: Cisco and VMware adapters ingested data (1.2.0), but the frontend had no vendor-specific UI. Cisco rendered the generic fallback logo; advisories/CVEs without a vendor join were inferred as `redhat` (Red Hat `dnf/yum` solution text); the CVE detail drawer linked Cisco/VMware CVEs to `access.redhat.com`; System Health Monitor listed no Cisco/VMware feeds.
  - Ubuntu and Debian were already wired in all the same UI surfaces; no change needed.
  - Changes: added `CiscoLogo` (`src/components/icons/VendorLogos.tsx`) and `case 'cisco'` (`src/components/common/VendorIcon.tsx`); `cisco-sa-*` → `cisco` and `VMSA-*` → `vmware` inference plus vendor-specific solution text in `src/services/advisoryService.ts` and `src/services/cveService.ts`; Cisco/VMware official link via `getAdvisoryUrl` in `src/components/explorer/CveDetailDrawer.tsx`; Cisco CSAF and Broadcom VMware feeds in `src/components/admin/SystemHealthMonitor.tsx`.
  - Tests: new `src/tests/unit/components/ciscoVmwareUi.test.tsx` (8 tests; red 8/8 before, green after).
  - **Verification**: `npm --prefix src test` 92 files / 668 passed / 0 failed; `npm --prefix src run build` succeeded.
  - **Reviewer**: skipped under risk policy (red-green covered; no persisted state, auth, boundary, or control-flow change).
  - **Known gaps (not done)**: drawers show no copy-command block for Cisco/VMware (no package-manager command applies); `src/tests/e2e/vendor-logos-and-vault-guide.e2e.test.tsx:93` mocks `SYNCED_VENDOR_CODES` with 5 vendors (stale).
  - **Completed**: 2026-09-22 14:43:12 Asia/Taipei.

- **Supabase deployment catch-up (2026-09-22 16:30 Asia/Taipei — COMPLETED)**:
  - Root cause of missing Ubuntu/Debian/SUSE/Cisco data: migrations `20260911000000_add_ubuntu_debian_suse_vendors` and `20260913000000_add_cisco_vendor` were never applied (no vendor rows), and `sync-cve` / `scheduled-sync` were last deployed 2026-09-11 (before the Cisco/VMware adapters). Dev also lacked `20260909000000_server_side_sync_lock`.
  - Applied pending migrations via `supabase db push` to `vuln-beacon-dev` (egofadbvftmbwodjneoy) and `vuln-beacon` (baizoisgkgwqccqjwnxg); prod was dry-run first.
  - Deployed functions with `supabase functions deploy sync-cve scheduled-sync --use-api --no-verify-jwt`. `--use-api` is required (local bundling fails under podman: "entrypoint path does not exist"). `--no-verify-jwt` preserves the existing `verify_jwt=false`; the CLI default would switch it to true.
  - Verified on both projects: migrations 20260909/20260911/20260913 present; vendors ubuntu, debian, suse, cisco, vmware present. Dev: sync-cve v8, scheduled-sync v7. Prod: sync-cve v3, scheduled-sync v4. All verify_jwt=false.
  - **Open**: first data sync not yet run (manual sync needs admin login in UI); dev scheduled sync fails with "Missing vault secrets: scheduled_sync_url or scheduled_sync_key not configured"; prod has no sync log after 2026-09-11 (scheduler cause not investigated).

- **Release 1.2.1 and scheduler diagnosis (2026-09-22 — IN PROGRESS)**:
  - Version bumped to `1.2.1` in `src/package.json`, `src/package-lock.json`, `src/config/version.ts`. Sidebar made sticky so the version label stays visible.
  - Verification: unit 77 files / 539 passed; e2e 13 files / 112 passed; smoke 3 files / 18 passed; build succeeded.
  - Scheduler diagnosis: pg_cron job `vuln-beacon-scheduled-sync` runs every 5 minutes on both projects, but no scheduled sync succeeded after 2026-09-11. Prod: `scheduled-sync` returns 401 because vault `scheduled_sync_key` does not equal the runtime `SUPABASE_SERVICE_ROLE_KEY` (legacy service_role JWT); the 401 is not written to `vendor_sync_logs`. Dev: vault secrets missing.
  - Open: vault secrets must be reset to the legacy service_role key on both projects (user action; agent secret-store writes are blocked by auto mode). `origin/dev` has commit `62c384a` not on `main`, so `dev` was not synced to `main`.
