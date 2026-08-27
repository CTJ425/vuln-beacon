# Progress Log

## 2026-08-27 17:40:35 Asia/Taipei - follow-up work from env migration: verify gate and skill cleanup
- Completed **close of two follow-up items** from the 2026-08-27 env migration task.
- Follow-up 1 (was: no CI currently runs on push) — CLOSED with self-hosted verify gate:
  - Added `"verify": "npm run test && npm run build"` script to `src/package.json`.
  - Created `.githooks/pre-push` (new, executable) that runs `npm --prefix src run verify` and blocks push on failure.
  - Updated `README.md` with new `### Verify gate` subsection.
  - One-time setup required: `git config core.hooksPath .githooks` per clone; `git push --no-verify` bypasses.
  - Verification: forward path executed successfully → 36 test files / 159 tests passed, build succeeded, `GATE_OK` printed. Negative path tested by shadowing `npm` with stub exiting 1 → hook printed blocked message and exited 1.
- Follow-up 2 (was: supabase-ops skill still describes GitHub Pages) — CLOSED by complete deletion:
  - Deleted entire `.claude/skills/supabase-ops/` directory per user instruction.
  - Root cause: skill documented a different project (stock-pnl-web); contained references to `sources/` paths and `quoteWindow.ts` that do not exist in this repo, would have misdirected agents.
- New open item identified:
  - `.claude/skills/testing/SKILL.md:27` still contains a dangling reference to the now-deleted `supabase-ops` skill in a table row: "Edge HTTP / cron wiring | Pure unit + **DEV** `generate-all` smoke (`supabase-ops`)". File has not been audited; may describe the other project and requires cleanup.
- All changes committed as `5d435d2` on branch `dev` (created from `main`; `main` unchanged).

## 2026-08-27 17:31:17 Asia/Taipei - Supabase env var naming migration + GitHub Actions removal
- Completed **Supabase env var naming migration + GitHub Actions removal** (Lane 1: env var rename, workflow deletion, config updates).
- Root cause: `src/lib/supabase.ts` hardcoded a fallback with a new-format `sb_publishable_...` key, but the variable was named `VITE_SUPABASE_ANON_KEY` (legacy JWT-era name). The deployed GitHub Pages site ran on that hardcoded fallback because the workflow never injected any `VITE_SUPABASE_*` vars.
- Changes made: (1) `src/lib/supabase.ts` — renamed to `VITE_SUPABASE_PUBLISHABLE_KEY`; removed hardcoded URL and key literals; `isConfigured` changed from constant `true` to a real check and demoted to module-local const; throws at module load when either var is missing. (2) `src/.env.example` — rewritten as three-group commented template: frontend `VITE_*`, local-script secrets, CLI-only vars; notes Edge Functions receive platform-injected `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`. (3) `src/scripts/backfillAdvisoryStorage.mjs` — reads `SUPABASE_SECRET_KEY` instead of `SUPABASE_SERVICE_ROLE_KEY`. (4) `src/supabase/functions/sync-cve/index.ts` — env names unchanged (platform-injected); clarifying comment added. (5) `src/vitest.config.ts` — added `test.env` with dummy Supabase values for test suite isolation. (6) `src/vite.config.ts` — removed dead `GH_PAGES` branch; `base` is now `'/'`. (7) `README.md` — env snippet, project-structure tree, and Deployment section updated for self-hosted static builds. (8) Deleted `.github/workflows/deploy-pages.yml`, `.github/` directory, and `docs/deployment/github-pages.md`.
- Review: Route:reviewer initial FAIL with 2 BLOCKERs (README lines 37 and 100 still referenced deleted workflow) plus 3 RISKs (dangling docs file, dead GH_PAGES branch, unobservable isConfigured export). All five fixed; tests and build re-run green.
- Verification: `npm --prefix src test` → 36 files / 159 tests passed. `npm --prefix src run build` → succeeded, `dist/index.html` references `/assets/...`.

