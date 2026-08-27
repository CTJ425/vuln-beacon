# VulnBeacon

CVE (Common Vulnerabilities & Exposures) collection, tracking, and dashboard tool focused on Red Hat Security Advisories (RHSA/RHBA/RHEA). VulnBeacon ingests CSAF (Common Security Advisory Framework) data, stores normalized advisories in Supabase, and exposes a filterable web explorer plus webhook alert integrations.

## Features

- Sync Red Hat Security Advisories (RHSA/RHBA/RHEA) via a Supabase Edge Function
- Store full CSAF advisory documents in Supabase Storage, with metadata in Postgres
- Explore, filter, and inspect CVEs and advisories through a React dashboard
- Vendor/product taxonomy navigation
- Webhook-based alert notifications
- Sync monitor page for tracking ingestion runs

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
│   ├── pages/           # Page routes (Explorer, Dashboard, Vendor, Settings, SyncMonitor)
│   ├── services/         # Business logic (CVE/advisory fetching, sync, webhooks, taxonomy)
│   ├── adapters/         # Vendor data parsers (Red Hat CVE + CSAF)
│   ├── engine/            # Ingestion pipeline (normalize, enrich, persist CVEs)
│   ├── supabase/          # DB migrations + Deno edge functions (sync-cve)
│   ├── scripts/           # One-off Node utilities (e.g. Supabase Storage backfill)
│   ├── types/             # TypeScript type definitions
    └── tests/             # Unit / smoke / e2e test suites
```

## Getting Started

### Prerequisites

- Node.js (see `src/package.json` for engine requirements)
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

# Edge Functions receive SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY automatically
# from the Supabase platform at runtime — do NOT set those here.
```

`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` must be present in the
environment when you run `npm run build`, because Vite inlines them into the
bundle at build time. The app throws on startup if either one is missing.

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

## Documentation

- `docs/agent/PROGRESS.md` — latest project status
- `docs/agent/TASK.md` — active tasks
- `docs/agent/specs/` — architecture and feature specifications
- `docs/test/README.md` — testing framework and execution guide

## Versioning

This project does not use a `v` prefix (e.g. `1.0.0`). `main` holds release versions (`x.x.x`); `dev` branches use `x.x.x-dev.N`.
