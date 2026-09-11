# Progress Log

## 2026-09-11 12:02:00 Asia/Taipei - Ubuntu, Debian & SUSE Multi-Vendor Ingestion & UI Integration (1.0.0)
- **Implemented Threat Feed Ingestion Adapters for Ubuntu, Debian & SUSE**:
  - **Ubuntu Adapter (`src/adapters/ubuntu.ts`)**:
    - Built official unauthenticated integration with `https://ubuntu.com/security/notices.json` and notice/CVE lookup endpoints.
    - Implemented `parse()` normalizing USN security notices, CVE mappings, release packages (`release_packages`), package version justifications, and remediation instructions.
  - **Debian Adapter (`src/adapters/debian.ts`)**:
    - Integrated with Debian Security Tracker (`https://security-tracker.debian.org/tracker/data/json`) and official DSA feeds (`https://salsa.debian.org/security-tracker-team/security-tracker/-/raw/master/data/DSA/list`).
    - Implemented multi-format parsing supporting plain text DSA list, structured DSA advisories, and `data/json` package CVE entries.
  - **SUSE Adapter (`src/adapters/suse.ts`)**:
    - Built CSAF 2.0 parser reading `changes.csv` and individual advisory JSON documents (`suse-su-*.json`).
    - Normalized CSAF document metadata, tracking IDs, aggregate severity, vulnerability notes, CVSS v3 score/vector, and `remediations` with product ID mapping.
  - **Adapter Registry & Edge Bundle Synchronization**:
    - Registered all 3 adapters in `src/adapters/index.ts` alongside Red Hat and Nutanix (`ALL_ADAPTERS` length 5).
    - Expanded `SYNCED_VENDOR_CODES` in `src/services/syncService.ts` to `['redhat', 'nutanix', 'ubuntu', 'debian', 'suse']`.
    - Bundled all adapters into Edge Function runtime bundle (`src/supabase/functions/_shared/ingest.bundle.js`).
    - Updated `src/supabase/functions/sync-cve/index.ts` default target vendors to include all 5 supported vendors.
  - **Database Vendor Migration**:
    - Added database migration `src/supabase/migrations/20260911000000_add_ubuntu_debian_suse_vendors.sql` seeding `ubuntu`, `debian`, and `suse` records into `public.vendors`.
  - **UI & Multi-Vendor Polish**:
    - Created authentic vector SVG brand logos (`UbuntuLogo`, `DebianLogo`, `SuseLogo`) in `src/components/icons/VendorLogos.tsx`.
    - Added brand colors, names, and logos to `src/components/common/VendorIcon.tsx`.
    - Added vendor-specific remediation instructions in `AdvisoryDetailDrawer.tsx` and `CveDetailDrawer.tsx` (`$ sudo apt-get --only-upgrade install -y <pkg>` for Ubuntu/Debian, `$ sudo zypper update -y <pkg>` for SUSE).
    - Added Ubuntu, Debian, and SUSE endpoints to `src/components/admin/SystemHealthMonitor.tsx` for real-time feed connectivity diagnostics.
    - Verified `FeedSourceTable` displays all 5 vendors as `Connected` with their live endpoints.
- **Deep Verification**:
  - Unit tests: 68/68 files passed (454/454 tests).
  - Smoke tests: 3/3 files passed (16/16 tests), including live HTTP public API verification against Nutanix, Ubuntu, Debian, and SUSE.
  - E2E tests: 13/13 files passed (111/111 tests), including dedicated `ubuntu-debian-suse.e2e.test.tsx`.
  - Total test pyramid: 84/84 test files passed (581/581 tests).
  - Production build: `npm --prefix src run verify` (`build:edge` -> `tsc` -> `vite build`) completed cleanly with 0 errors.

## 2026-09-11 09:58:00 Asia/Taipei - Operational Conflict Fallback Boundary & Transport Classifier Fix (1.0.0)
- **Resolved Concurrency Lock & Operational Conflict Fallback Bug (`syncService.ts`)**:
  - **Fallback Boundary Restriction**: Refined fallback guard in `SyncService.syncVendors` lines 307 and 333. Changed condition from `if (isTransportError || mode === 'auto')` to strictly `if (isTransportError(error, errorMsg))`.
  - **Centralized Transport Classifier**: Extracted `isTransportError` helper checking HTTP status (404, 502, 503, 504), SDK error names (`FunctionsFetchError`, `FunctionsRelayError`), and network/gateway strings (`Failed to send a request`, `Relay Error`, `fetch failed`, `NetworkError`, `Bad Gateway`, `Gateway Timeout`).
  - **Plain Text / Gateway Error Extraction**: Enhanced `extractErrorMessage` to fall back to `response.text()` when non-JSON bodies (e.g. gateway 502/504 errors) are returned.
  - **Operational Conflict Surfacing**: Ensured operational conflicts (such as HTTP 409 `A threat feed synchronization is already in progress` or HTTP 401 unauthorized errors) cleanly return `{ success: false, errors: [errorMsg] }` instead of falling back to client-side ingestion when in `auto` mode.
  - **Unit & E2E Test Hardening**:
    - Added comprehensive unit test coverage in `src/tests/unit/services/syncServiceServerMode.test.ts` verifying that 409 concurrency lock conflicts, 401 unauthorized, 404 Function not found, 502 Bad Gateway text, and FunctionsRelayError behave strictly according to transport vs operational specifications.
    - Verified `tests/e2e/manual-sync-server-side.e2e.test.tsx` Phase 2 passes with expected error banner display.
- **Deep Verification**:
  - Unit tests: 65/65 files passed (427/427 tests).
  - Smoke tests: 3/3 files passed (13/13 tests).
  - E2E tests: 12/12 files passed (106/106 tests).
  - Total test pyramid: 80/80 test files passed (546/546 tests).
  - Production build: `npm --prefix src run verify` (`build:edge` -> `tsc` -> `vite build`) completed cleanly with 0 errors.
