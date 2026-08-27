# Progress Log

## 2026-08-27 17:47:58 CST - Audit of `.claude/skills/` complete; four foreign-project skills deleted; `.env.example` trimmed; pre-push gate and merge staged
- Completed **audit of `.claude/skills/` and cleanup of cross-project skills**.
- Audit found four skills documenting a different project (stock-pnl-web), not vuln-beacon:
  - `ship`: description says "deploy stock-pnl-web"; references `sources/`, `docs/UnitTests/README.md`.
  - `verify`: description says "Verify stock-pnl-web UI"; references `sources/scripts/verify-admin-status.cjs`, `src/App.smoke.test.tsx`, `stock-pnl-web/local-store-v1` localStorage key.
  - `versioning`: description says "version rule of stock-pnl-web"; references `sources/src/version.ts`, `sources/package.json`.
  - `testing`: description says "Run and write stock-pnl-web tests"; references `cd sources`, `docs/UnitTests/README.md`, `supabase-ops`, `generate-all`.
- All four deleted in commit `2bab05b`. Before deletion, verified that files are plain files with link count 1, tracked by this repo's own git (not symlinks or hard links shared with stock-pnl-web) — removal cannot affect stock-pnl-web; content remains recoverable from git history.
- Kept: `route` skill (referenced by `CLAUDE.md`) and four generic graph tools (`debug-issue`, `explore-codebase`, `refactor-safely`, `review-changes`).
- Secondary changes completed:
  - `src/.env.example` trimmed: removed `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` (not read by any code); kept `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (read by backfill script). README's embedded env template kept byte-identical. Commit `f1d3cdb`.
  - Pre-push gate activated: `git config core.hooksPath .githooks` applied locally; `dev` merged into `main` by fast-forward. Main branch now has 4 commits not yet pushed to `origin/main`: `5d435d2`, `a937ad8`, `f1d3cdb`, `2bab05b`.

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
- All changes committed as `5d435d2` on branch `dev` (created from `main`; `main` unchanged).
