# Progress Log

## 2026-10-11 13:40:00 Asia/Taipei - Sortable Columns in the Explorer Tables
- **Request**: sort by CVE, affected product and published date.
- **Change**: `utils/tableSort.ts` (stable sort, numeric collation so `CVE-2026-9999` < `CVE-2026-10000`, empty values last in both directions, first click on a date column = newest first). `CveTable` sorts CVE id / affected product / published date (advisory mode: Target CVEs / date) and returns to page 1 on a sort change; `AdvisoryTable` (Explorer default view, Dashboard) sorts Fixed CVEs / affected products / published date. Multi-value columns sort by their first entry, the one the row displays. Unsorted until a header is clicked, so existing order is unchanged. Headers set `aria-sort`.
- **Verification**: new tests `tests/unit/utils/tableSort.test.ts`, `tests/unit/components/tableSorting.test.tsx` (red first). Unit 681/681, e2e 129/129, build clean. Not checked in a browser with live data.
- **Released as 1.7.0** (2026-10-11, user request: commit to dev and merge to main), together with the BUG-036 fix. Gate `npm run verify`: 118 files / 828 tests pass, build clean.

## 2026-10-09 02:07:21 Asia/Taipei - 1.6.0 Released; Production Load Outage Fixed in DB (BUG-036)
- **1.6.0** (redesign phase 1) released: `main` = `dev` = `4ba7551`, tag and GitHub Release `1.6.0`; Cloudflare Pages serves it (bundle content checked). Release config is now `.claude/release.config.json` (ship + versioning; `askBeforeRelease: false` per the user's delegation).
- **Outage found while verifying 1.6.0**: production `explorer_dataset(true)` needed 3.2 s against anon's 3 s statement timeout (data doubled since 1.5.0), so the site could not load data; unrelated to 1.6.0. Fix: migration `20261009000000_explorer_dataset_dedupe_arrays.sql` (expand each distinct impact array once; function-level `statement_timeout = '15s'`). Byte-identical output and ~2.4x speed-up proven in PGlite on production-sized synthetic data (`src/supabase/checks/explorer-dataset-equivalence.mjs`).
- **Deployed**: dev (verified 200, 1.6 s upstream) and production (`db push` succeeded). **Production not verified**: the agent's permission policy blocked further production calls. `dev` is at `1.6.1-dev.1`; the 1.6.1 release (main push) is pending the same permission.
- **Also**: BUG-035 (Nutanix smoke) fixed; Cloudflare SPA fallback confirmed; dev preview at https://dev.vuln-beacon.pages.dev.

