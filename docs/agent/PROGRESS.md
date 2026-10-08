# Progress Log

## 2026-10-09 02:07:21 Asia/Taipei - 1.6.0 Released; Production Load Outage Fixed in DB (BUG-036)
- **1.6.0** (redesign phase 1) released: `main` = `dev` = `4ba7551`, tag and GitHub Release `1.6.0`; Cloudflare Pages serves it (bundle content checked). Release config is now `.claude/release.config.json` (ship + versioning; `askBeforeRelease: false` per the user's delegation).
- **Outage found while verifying 1.6.0**: production `explorer_dataset(true)` needed 3.2 s against anon's 3 s statement timeout (data doubled since 1.5.0), so the site could not load data; unrelated to 1.6.0. Fix: migration `20261009000000_explorer_dataset_dedupe_arrays.sql` (expand each distinct impact array once; function-level `statement_timeout = '15s'`). Byte-identical output and ~2.4x speed-up proven in PGlite on production-sized synthetic data (`src/supabase/checks/explorer-dataset-equivalence.mjs`).
- **Deployed**: dev (verified 200, 1.6 s upstream) and production (`db push` succeeded). **Production not verified**: the agent's permission policy blocked further production calls. `dev` is at `1.6.1-dev.1`; the 1.6.1 release (main push) is pending the same permission.
- **Also**: BUG-035 (Nutanix smoke) fixed; Cloudflare SPA fallback confirmed; dev preview at https://dev.vuln-beacon.pages.dev.

## 2026-10-09 01:17:26 Asia/Taipei - UI/UX Redesign Phase 1: URL Routing, i18n, Design Tokens
- **Context**: whole-app redesign planned with the user; product record in `PRODUCT.md`, direction contract in `.impeccable/surfaces/src-app-tsx.md` (category standard; bar Snyk/Wiz + GitHub Security Advisories; dark primary). Phases in `TASK.md`.
- **Routing**: `react-router@7.18.4` (`BrowserRouter`). `lib/routes.ts` maps `/`, `/explorer`, `/vendors/:code`, `/admin[/:tab]` (webhooks|sync|logs|health), `/advisories/:id`, `/cves/:id`. Detail URLs open the existing drawers over the page they came from (history state `background`); a deep link opens over the overview; closing steps back. Sidebar items are real links. `/admin` waits for the first session check, then prompts sign-in for signed-out visitors.
- **i18n**: `i18n/` (own provider, no dependency): `en` source catalog + `zh-TW`, typed keys, `{placeholder}` fill, locale from storage → browser language, sets `<html lang>`. Header has an EN/中 switch. Shell strings only so far; page content moves in phases 3–4.
- **Tokens**: `theme/tokens.ts` (opaque hex, both modes: grounds, text, indigo accent, 4-step severity scale, 7 vuln-state tones); `theme/theme.ts` rebuilt on them (CssBaseline: selection, focus ring, scrollbars, color-scheme). Severity/Status/State badges read tones from the theme.
- **Verification**: full suite 811 tests, 809 pass; the 2 failures are live-network smoke tests (Nutanix also fails on unchanged HEAD; Ubuntu is flaky). `npm run build` clean. Shell screenshots (dark/light, desktop/mobile, 404) taken against a placeholder Supabase URL, so no live data was rendered.
- **Not verified**: Cloudflare SPA fallback for deep links (hosting config is not in the repo).

