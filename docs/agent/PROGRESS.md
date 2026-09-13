# Progress Log

## 2026-09-13 22:56:42 Asia/Taipei - Cisco CSAF Vendor Adapter & VMware/Broadcom Design (1.1.0)
- **Cisco CSAF Vendor Adapter (Task 31 — COMPLETED)**:
  - Implemented full `VendorAdapter` compliance for `cisco` vendor ingesting Cisco PSIRT advisories from the public CSAF 2.0 distribution at `https://www.cisco.com/.well-known/csaf/` (changes.csv index + per-advisory JSON; no authentication required).
  - Added 15 unit tests (`src/tests/unit/adapters/cisco.test.ts`), 3 fixture files (sample CSAF documents and changes.csv), and live smoke test verifying 202 product strings emitted with no raw `CSAFPID-` leaks.
  - Registered in `ALL_ADAPTERS` index; updated `SYNCED_VENDOR_CODES` to 6 vendors; regenerated `ingest.bundle.js` (Edge Function requirement).
  - Implemented advisory-level severity derivation (max of `cvss_v3.baseSeverity` across vulnerabilities); sorts `changes.csv` descending by timestamp before slicing (source is not strictly ordered).
  - **Accepted Risk**: Cisco CSAF advisories reference 2–8 product ids per advisory that appear nowhere in `product_tree` (e.g., `CSAFPID-tce-roomos-dos`). Adapter silently omits these ids from `affectedProducts`, `fixedVersions`, and `productImpacts` to prevent raw `CSAFPID-*` strings in user-facing output. Consequence: affected-product lists may be incomplete relative to source document.
  - **Verification**: 74 test files / 509 tests passed; smoke test live feed fetch; build succeeded.
  - **Completed**: 2026-09-13 22:56:42 Asia/Taipei.

- **VMware / Broadcom Adapter (Task 32 — OPEN, NOT STARTED)**:
  - Design finalized: list layer only via `POST https://support.broadcom.com/web/ecx/security-advisory/-/securityadvisory/getSecurityAdvisoryList` (no authentication; segment=VC covers 341+ VMware advisories as of 2026-09-13).
  - CVSS enrichment from NVD API 2.0 with acknowledged lag risk: `CVE-2026-59346` (Broadcom 2026-09-03, NVD still unresolved 2026-09-13). Design: severity from Broadcom field; NVD as enrichment only, never reverse. No HTML scraping.
  - Constraint: API `supportProducts` field arrives truncated; no detail endpoint exists. Therefore fixed versions and full affected-product lists unavailable.
  - `vmware` vendor row already seeded in `public.vendors`; only adapter code and registration needed (no new migration).
  - NVD rate-limit: 5 requests/30 seconds without API key; batch enrichment needs throttling.

## 2026-09-12 22:45:00 Asia/Taipei - Replace free-text schedule inputs with dropdown selects in ScheduleSettings (1.1.0)
- **Replace free-text schedule inputs with dropdown selects in ScheduleSettings**:
  - Added exported `TIME_OPTIONS` (48 entries, `00:00`–`23:30`, 30-minute grid).
  - Added exported `TIMEZONE_OPTIONS` (fixed IANA whitelist).
  - Schedule-times cell is now a MUI `Select multiple` rendering selected values as `Chip`s; timezone cell is a single `Select`.
  - Stored values outside the grid or the whitelist are merged into the option list so legacy data is never silently dropped.
  - Save now de-duplicates and sorts times ascending, and blocks an enabled schedule with zero times (`Select at least one time`).
  - Removed the now-unreachable comma-splitting and `TIME_FORMAT` / `Invalid time format` guard; `RowState.timesText: string` became `RowState.times: string[]`.
  - Discovered finding (not a bug): the "Sync Monitor" and "Webhooks & Config" sidebar entries were intentionally removed in commit `abb2f62` and consolidated into the authenticated Admin Console.
- **Files Changed**:
  - `src/components/sync/ScheduleSettings.tsx` (production)
  - `src/tests/unit/components/scheduleSettings.test.tsx` (tests, written first — TDD Red before dispatch)
- **Verification**:
  - `npm --prefix src test` — 89/89 test files, 622/622 tests passed.
  - `npm --prefix src run verify` — build:edge -> tsc -> vite build, clean.
  - Reviewer verdict: PASS.
