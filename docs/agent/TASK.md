# Active Tasks

Open entries only; completed tasks live in `TASK_ARCHIVE.md`.

## Release 1.3.0 follow-ups (user action)

- [ ] **Grant the admin role** on `vuln-beacon` and `vuln-beacon-dev`. Since 1.3.0 the backstage and every `sync-cve` write require `app_metadata.role = 'admin'`; until this runs nobody can sign in to the Admin Console. SQL is in `src/supabase/migrations/20260925000000_admin_role_access.sql` (header). Sign out and in afterwards to refresh the JWT. Review `auth.users` for accounts created while signup was open (disabled 2026-09-25).
- [ ] **Reset the scheduler vault secrets** on both projects with `select public.set_scheduled_sync_vault_secrets('<https://<ref>.supabase.co/functions/v1/scheduled-sync>', '<service-role key>')`. Prod returns 401 (key mismatch) and dev has no secrets, so no scheduled sync has run since 2026-09-11. After the next tick, a mismatch now shows up in `vendor_sync_logs` as `Scheduled sync request rejected: ... HTTP 401`.
- [ ] **Run the database behaviour check** for the 1.3.0 SQL (`upsert_cves` merge rules, sync lease, `webhook_configs` RLS, tick HTTP-error logging) on `vuln-beacon-dev`; the agent was not permitted to execute it. The block rolls back and ends with `ALL_OK` when every assertion holds. Script: `src/supabase/checks/release-1.3.0.sql`.

## Open

- [ ] **Explorer loads every CVE and advisory with full product impacts on page load** (`src/services/cveService.ts`, `src/services/advisoryService.ts`). Current volume is small (dev 2026-09-26: 188 CVEs, 51 advisories, 335 mappings, 318 kB of mapping JSON), so this is deferred. The fix is server-side pagination and search for Explorer, Dashboard and Vendor pages together with BUG-006 (advisory-level product impacts); revisit when the list query becomes measurable.

## Self-Hosted Deployment Network Topology

- [ ] **Task 11a: Network Layer Only — No Code Change** — Implement Cloudflare Tunnel + Caddy reverse proxy with path prefix (`/supabase`). Ref: `docs/agent/specs/self-host-deployment-topology.md` (design points D1–D4).
- [ ] **Open Item: Live Preview Verification Pending** — Acceptance criterion not yet met: live verification against the preview instance at `http://10.8.22.99:3002/` (per `.agents/ORIGINAL_REQUEST.md` R5) has not been performed. Port unreachable (connection refused) from development container; awaiting network access or deployment confirmation.
