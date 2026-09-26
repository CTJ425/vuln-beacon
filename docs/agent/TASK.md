# Active Tasks

Open entries only; completed tasks live in `TASK_ARCHIVE.md`.

## Open

- [ ] **Deploy the 1.3.x frontend build** to the self-hosted static host (location not recorded in the repo). Until then the old build runs against the new backend: public pages work; the admin login works for the admin account.

- [ ] **Explorer loads every CVE and advisory with full product impacts on page load** (`src/services/cveService.ts`, `src/services/advisoryService.ts`). Current volume is small (dev 2026-09-26: 188 CVEs, 51 advisories, 335 mappings, 318 kB of mapping JSON), so this is deferred. The fix is server-side pagination and search for Explorer, Dashboard and Vendor pages together with BUG-006 (advisory-level product impacts); revisit when the list query becomes measurable.

## Self-Hosted Deployment Network Topology

- [ ] **Task 11a: Network Layer Only — No Code Change** — Implement Cloudflare Tunnel + Caddy reverse proxy with path prefix (`/supabase`). Ref: `docs/agent/specs/self-host-deployment-topology.md` (design points D1–D4).
- [ ] **Open Item: Live Preview Verification Pending** — Acceptance criterion not yet met: live verification against the preview instance at `http://10.8.22.99:3002/` (per `.agents/ORIGINAL_REQUEST.md` R5) has not been performed. Port unreachable (connection refused) from development container; awaiting network access or deployment confirmation.
