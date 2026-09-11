# Progress Log

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

## 2026-09-11 15:35:00 Asia/Taipei - Codebase Adversary Audit, State Collision Fix & Multi-Vendor UX Hardening (1.1.0)
- **Defects Discovered & Remediated from Adversary Review**:
  - **Critical Component State Filter Collision (`src/pages/ExplorerPage.tsx`)**:
    - Discovered that filtering by `AFFECTED` was matching all items with `Not affected` because `'notaffected'.includes('affected')` was `true`. Vice versa, filtering by `NOT_AFFECTED` matched `Affected`.
    - Extracted dedicated classifier `matchesImpactState` and `isAffectedState` in `src/utils/statusUtils.ts` backed by 6 unit tests (`src/tests/unit/utils/statusUtils.test.ts`), eliminating substring collisions across multi-vendor terminology.
    - Added dedicated Explorer page unit test suite (`src/tests/unit/pages/ExplorerPage.test.tsx`, 3 tests) explicitly validating state isolation between Affected and Not affected.
  - **Advisory URL Resolver Hardening (`src/utils/advisoryUrl.ts`)**:
    - Fixed URL double-wrapping when advisory field already contains a full `http://` or `https://` URL.
    - Added native CVE identifier (`CVE-YYYY-NNNN`) resolution to vendor trackers (Red Hat, Ubuntu, Debian, SUSE, Nutanix) and CVE.org fallback.
    - Added SUSE Recommended Updates (`SUSE-RU-`) announcement pattern matching in both `getAdvisoryUrl` and `SuseAdapter` (`src/adapters/suse.ts`).
    - Fixed arbitrary unclassified strings returning broken Red Hat errata URLs by returning safe empty string when no vendor matches.
    - Extended unit test suite in `src/tests/unit/utils/advisoryUrl.test.ts` (9 tests).
  - **Unified State Badge Component (`src/components/common/StateBadge.tsx`)**:
    - Consolidated duplicated `getStateBadge` implementations in `CveDetailDrawer.tsx` and `AdvisoryDetailDrawer.tsx`.
    - Added visual styling for `Will not fix`, `Under investigation`, `Resolved`, `Released`, `Open`, `Needed`, and safe fallback for unknown / empty states.
  - **Interactive CVE Links & Memory Leak Prevention in Drawers (`AdvisoryDetailDrawer.tsx` & `CveDetailDrawer.tsx`)**:
    - Elevated static CVE IDs in `AdvisoryDetailDrawer` into interactive external links to canonical vendor security trackers.
    - Fixed timer leak in `AdvisoryDetailDrawer.tsx` by using `copyTimerRef` and unmount cleanup.
    - Added dedicated unit test suite for `AdvisoryDetailDrawer` (`src/tests/unit/components/AdvisoryDetailDrawer.test.tsx`, 5 tests).
  - **Feed Source & Health Monitor Reliability**:
    - Fixed case-sensitive vendor code comparison in `FeedSourceTable.tsx`'s `integrationChip`.
    - Ensured probe timeout in `SystemHealthMonitor.tsx` is cleared in a `finally` block to prevent timer leaks.
    - Added accessible `labelId` / `id` to `CveFilterBar` selects and `aria-label` to table action buttons.
- **Deep Verification**:
  - Unit tests: 73/73 files passed (484/484 tests).
  - Smoke tests: 3/3 files passed (16/16 tests).
  - E2E tests: 13/13 files passed (114/114 tests).
  - Total test pyramid: 89/89 test files passed (614/614 tests 100%).
  - Production build: `npm --prefix src run verify` (`build:edge` -> `tsc` -> `vite build`) completed cleanly with 0 errors in 7.68s.

