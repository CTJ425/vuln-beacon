# Progress Log

## 2026-09-13 23:28:39 Asia/Taipei - VMware / Broadcom Vendor Adapter & Release 1.2.0 Finalization
- **VMware / Broadcom Adapter (Task 32 — COMPLETED)**:
  - Implemented full `VendorAdapter` compliance for `vmware` vendor ingesting VMware Security Advisories (VMSA) from the public Broadcom support-portal API (`POST https://support.broadcom.com/web/ecx/security-advisory/-/securityadvisory/getSecurityAdvisoryList`, segment=VC, no authentication).
  - CVSS scores and vectors enriched from NVD API 2.0 with strict sequential (non-batched) fetching due to rate-limit sensitivity (429 under concurrency); NVD used for enrichment only, severity ground truth remains Broadcom.
  - Added `src/adapters/vmware.ts`, `src/tests/unit/adapters/vmware.test.ts` (21 tests), fixtures (vmware-advisory-list-sample.json, nvd-cve-sample.json).
  - Updated `src/adapters/index.ts`, `src/services/syncService.ts` (SYNCED_VENDOR_CODES now 7 vendors), `src/utils/advisoryUrl.ts`, `src/supabase/functions/_shared/ingest.bundle.js` (build:edge output), plus six tests re-pointed from vmware to dell as the unimplemented exemplar.
  - No database migration: `vmware` vendor row already seeded in initial migration.
  - **Verification**: unit 75 files / 530 passed / 0 failed; smoke 18 passed including live Broadcom fetch; build succeeded. Live `fetchAdvisories(5)` returned 5 advisories and 14 CVEs with 0 malformed CVE ids and correct UTC dates.
  - **Reviewer verdict**: PASS.
  - **Accepted Risks**: (1) NVD enrichment coverage low without API key (~12% at 20-advisory sync, ~50 CVEs); user accepted for now (Broadcom severity always correct, CVSS scores additive). (2) No retry on Broadcom list fetch (matches sibling adapters, not unique).
  - **Completed**: 2026-09-13 23:28:39 Asia/Taipei.

- **Release 1.2.0 — Multi-Vendor Adapter Expansion**:
  - Finalized version bump to `1.2.0` in `src/package.json`, `src/package-lock.json`, `src/config/version.ts` (pre-set by main session).
  - Documented both Cisco CSAF adapter (Task 31, committed as 6bf576e) and VMware/Broadcom adapter (Task 32) in comprehensive release notes.
  - Vendor coverage: 5 working adapters → 7 (redhat, nutanix, ubuntu, debian, suse, cisco, vmware).
  - Updated `CHANGELOG.md` with 1.2.0 entry covering Added/Changed/Fixed across both adapters.
  - Recorded both adapters' accepted risks (Cisco incomplete product trees, VMware NVD coverage low) in `BUG_FIX.md`.
  - **Completed**: 2026-09-13 23:28:39 Asia/Taipei.

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
