# Progress Log

## 2026-10-09 01:17:26 Asia/Taipei - UI/UX Redesign Phase 1: URL Routing, i18n, Design Tokens
- **Context**: whole-app redesign planned with the user; product record in `PRODUCT.md`, direction contract in `.impeccable/surfaces/src-app-tsx.md` (category standard; bar Snyk/Wiz + GitHub Security Advisories; dark primary). Phases in `TASK.md`.
- **Routing**: `react-router@7.18.4` (`BrowserRouter`). `lib/routes.ts` maps `/`, `/explorer`, `/vendors/:code`, `/admin[/:tab]` (webhooks|sync|logs|health), `/advisories/:id`, `/cves/:id`. Detail URLs open the existing drawers over the page they came from (history state `background`); a deep link opens over the overview; closing steps back. Sidebar items are real links. `/admin` waits for the first session check, then prompts sign-in for signed-out visitors.
- **i18n**: `i18n/` (own provider, no dependency): `en` source catalog + `zh-TW`, typed keys, `{placeholder}` fill, locale from storage → browser language, sets `<html lang>`. Header has an EN/中 switch. Shell strings only so far; page content moves in phases 3–4.
- **Tokens**: `theme/tokens.ts` (opaque hex, both modes: grounds, text, indigo accent, 4-step severity scale, 7 vuln-state tones); `theme/theme.ts` rebuilt on them (CssBaseline: selection, focus ring, scrollbars, color-scheme). Severity/Status/State badges read tones from the theme.
- **Verification**: full suite 811 tests, 809 pass; the 2 failures are live-network smoke tests (Nutanix also fails on unchanged HEAD; Ubuntu is flaky). `npm run build` clean. Shell screenshots (dark/light, desktop/mobile, 404) taken against a placeholder Supabase URL, so no live data was rendered.
- **Not verified**: Cloudflare SPA fallback for deep links (hosting config is not in the repo).

## 2026-09-26 09:44:02 Asia/Taipei - Dataset Browser Cache & Compact Format (1.5.0)
- **Cache**: `lib/explorerDataset.ts` stores each successful load in IndexedDB (`CACHE_FORMAT` versioned). The app shows the cached dataset through `CveService.fromDataset` / `AdvisoryService.fromDataset` until live data arrives, and a ref stops a late cache read from overwriting live rows. Services now propagate load errors so cached rows survive a failed load; the post-sync reload has its own error message.
- **Compact format**: `explorer_dataset(p_compact boolean DEFAULT false)`. The no-argument md5 is unchanged on dev (`8bd78f…`) and prod (`8d3f84…`). Compact output rebuilds all mappings identically. Prod savings: JSON −4.7%, gzip −3.2% (4,843 mappings send `null`).
- **Verification**: `npm --prefix src run verify` → 108 files / 756 tests passed, build clean; `fake-indexeddb` was added as a dev dependency for real IndexedDB tests.
- **Not measured**: the time to first render from cache in a real browser. It is expected to be near-instant (the load is local), but the agent cannot open the deployed site.

