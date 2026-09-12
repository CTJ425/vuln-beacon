# Progress Log

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

## 2026-09-11 16:15:00 Asia/Taipei - Version 1.1.0 Release Finalization & Documentation Sync (1.1.0)
- **Version 1.1.0 Release Finalization & Documentation Sync**:
  - Restored and configured `.claude/skills/versioning/SKILL.md` matching VulnBeacon project paths, semver standards, and release checklist.
  - Bumped application version to `1.1.0` in `src/package.json`, `src/package-lock.json`, and fallback in `src/config/version.ts`.
  - Updated `README.md` to highlight enterprise multi-vendor threat feed ingestion (Red Hat, Nutanix, Ubuntu, Debian, SUSE).
  - Authored comprehensive release notes for `1.1.0` in `docs/agent/CHANGELOG.md` covering all features, changes, and bug fixes since `1.0.0`.
  - Tracked Task 29 completion in `docs/agent/TASK.md`.
  - Created git tags `1.0.0` and `1.1.0` for verifiable release provenance.
- **Deep Verification**:
  - Unit tests: 73/73 files passed (484/484 tests).
  - Smoke tests: 3/3 files passed (16/16 tests).
  - E2E tests: 13/13 files passed (114/114 tests).
  - Total test pyramid: 89/89 test files passed (614/614 tests 100%).
  - Production build: `npm --prefix src run verify` (`build:edge` -> `tsc` -> `vite build`) completed cleanly with 0 errors.
