# VulnBeacon

Enterprise CVE (Common Vulnerabilities & Exposures) collection, tracking, and triage dashboard tool supporting multi-vendor security advisories across **Red Hat (CSAF)**, **Nutanix**, **Ubuntu (USN)**, **Debian (DSA & Security Tracker)**, **SUSE (CSAF 2.0)**, **Cisco (CSAF)**, and **VMware / Broadcom (VMSA)**. VulnBeacon ingests standardized security data, stores normalized advisories in Supabase, and exposes a filterable web explorer plus multi-channel webhook alert integrations.

## Features

- Multi-vendor threat feed ingestion (Red Hat, Nutanix, Ubuntu, Debian, SUSE, Cisco, VMware) via Supabase Edge Functions
- Store full advisory documents in Supabase Storage with normalized relational metadata in PostgreSQL
- Explore, filter, and inspect CVEs and advisories through an accessible React dashboard with product impact matrix
- Vendor/product taxonomy navigation with authentic vendor brand logos
- Multi-channel webhook alerts (Discord, Slack, Telegram) with severity threshold filtering
- Unified vulnerability state classification across diverse vendor terminologies
- Sync monitor and backstage administrative controls, restricted to accounts granted the admin role

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, MUI (Material-UI), Emotion
- **Backend**: Supabase (Postgres, Auth, Storage, Deno Edge Functions)
- **Testing**: Vitest, Testing Library (unit / smoke / e2e pyramid)

## Project Structure

```
vuln-beacon/
├── docs/               # Agent memory, specs, and test plans
│   ├── agent/          # Progress log, tasks, bugs, specs, changelog
│   └── test/           # Test strategy and execution guides
├── src/
│   ├── components/     # React UI (explorer, dashboard, settings, sync, common)
│   ├── pages/           # Page routes (Dashboard, Explorer, Vendor, Admin, Settings, SyncMonitor)
│   ├── services/         # Business logic (CVE/advisory fetching, sync, webhooks, taxonomy)
│   ├── adapters/         # Vendor feed parsers (Red Hat, Nutanix, Ubuntu, Debian, SUSE, Cisco, VMware)
│   ├── engine/            # Ingestion pipeline (normalize, queue alerts, persist runs)
│   ├── supabase/          # DB migrations + Deno edge functions (sync-cve, scheduled-sync)
│   ├── scripts/           # One-off Node utilities (e.g. Supabase Storage backfill)
│   ├── types/             # TypeScript type definitions
    └── tests/             # Unit / smoke / e2e test suites
```

## Getting Started

### Prerequisites

- Node.js 18 or later (the minimum for Vite 6 and Vitest 3)
- A Supabase project

### Setup

```bash
git clone https://github.com/CTJ425/vuln-beacon.git
cd vuln-beacon/src
npm install
```

Create `src/.env` with your Supabase credentials (see `src/.env.example`):

```
# Frontend (Vite) — inlined into the client bundle at build time, public by design.
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=

# Local scripts only (e.g. `npm run backfill:advisory-storage`) — secret, never commit.
SUPABASE_URL=
SUPABASE_SECRET_KEY=

# Edge Functions:
# - Supabase Cloud: runtime automatically injects SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
# - Self-Hosted (Docker): environment variables are NOT automatically injected;
#   both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY MUST be set in the edge-runtime
#   container environment (e.g. in docker-compose.yml).
```

`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` must be present in the
environment when you run `npm run build`, because Vite inlines them into the
bundle at build time. The app throws on startup if either one is missing.

### Admin access

The Admin Console and every write through the `sync-cve` Edge Function require
an account whose `app_metadata.role` is `admin`. Users cannot set
`app_metadata` themselves, so grant it once per project in the SQL editor:

```sql
update auth.users
   set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'
 where email = '<admin email>';
```

Sign out and back in afterwards so the session token carries the role. Keep
email signup disabled in Supabase Auth; accounts are created by an operator.

### Development

```bash
npm run dev        # start Vite dev server (http://localhost:3000)
npm run build       # type-check and build for production
npm run preview     # preview the production build
```

## Testing

All source code and tests live in `src/`. See `docs/test/README.md` for the full testing framework and TDD guidelines.

```bash
npm --prefix src test              # run all tests
npm --prefix src run test:unit     # unit tests
npm --prefix src run test:smoke    # smoke tests
npm --prefix src run test:e2e      # end-to-end tests
npm --prefix src run test:coverage # coverage report
```

### Verify gate

`verify` runs the full test suite plus the production build. It is the single
entry point any CI runner should call:

```bash
npm --prefix src run verify
```

A committed `pre-push` hook runs the same gate before every push. Activate it
once per clone:

```bash
git config core.hooksPath .githooks
```

Use `git push --no-verify` to bypass the gate.

## Deployment

The app is a static bundle, self-hosted. Build it with `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` present in the environment, then serve `src/dist/`
from any static web server:

```bash
npm --prefix src run build   # outputs to src/dist/
```

The build assumes it is served from the domain root (`/`). To serve it from a
subpath instead, set `base` in `src/vite.config.ts`.

### Self-Hosted Edge Functions Deployment

When running self-hosted Supabase with Docker and `edge-runtime`:

1. **Build shared edge bundle**:
   Whenever vendor adapters, parsers, or engine code changes, compile the bundle:
   ```bash
   npm --prefix src run build:edge
   ```
   This outputs the bundled ingestion logic to `src/supabase/functions/_shared/ingest.bundle.js`.

2. **Deploy function files to edge-runtime volume**:
   Copy the `src/supabase/functions` directory directly into the mounted volume of your `edge-runtime` container (e.g. `/root/volumes/edge-runtime/functions`).

3. **Configure container environment**:
   Unlike Supabase Cloud, self-hosted `edge-runtime` containers do not automatically inject platform credentials. You must explicitly configure environment variables in `docker-compose.yml`:
   ```yaml
   edge-runtime:
     environment:
       - SUPABASE_URL=http://kong:8000
       - SUPABASE_SERVICE_ROLE_KEY=<YOUR_SERVICE_ROLE_KEY>
   ```

4. **Restart edge-runtime service**:
   ```bash
   docker compose restart edge-runtime
   ```

### Network Topology & Ingress

For non-public self-hosted deployments (e.g., accessed via Cloudflare Tunnel or Tailscale), use a single-origin reverse proxy (such as Caddy) with a `/supabase` path prefix:
- Front-end SPA served at `/`
- Supabase Kong gateway routed via `handle_path /supabase/* { reverse_proxy kong:8000 }`
- Point `VITE_SUPABASE_URL` to `https://your-domain.example.com/supabase`

See `docs/agent/specs/self-host-deployment-topology.md` for complete architecture diagrams and Caddyfile/Cloudflare Tunnel templates.


## Documentation

- `docs/agent/PROGRESS.md` — latest project status
- `docs/agent/TASK.md` — active tasks
- `docs/agent/specs/` — architecture and feature specifications
- `docs/test/README.md` — testing framework and execution guide

## Versioning

This project does not use a `v` prefix (e.g. `1.0.0`). `main` holds release versions (`x.x.x`); `dev` branches use `x.x.x-dev.N`.
