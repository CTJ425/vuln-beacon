# Progress Log

## 2026-09-22 14:43:12 Asia/Taipei - Cisco / VMware Frontend UI Coverage
- **Cisco / VMware UI wiring (Lane 1 — COMPLETED)**:
  - Problem: Cisco and VMware adapters ingested data (1.2.0), but the frontend had no vendor-specific UI. Cisco rendered the generic fallback logo; advisories/CVEs without a vendor join were inferred as `redhat` (Red Hat `dnf/yum` solution text); the CVE detail drawer linked Cisco/VMware CVEs to `access.redhat.com`; System Health Monitor listed no Cisco/VMware feeds.
  - Ubuntu and Debian were already wired in all the same UI surfaces; no change needed.
  - Changes: added `CiscoLogo` (`src/components/icons/VendorLogos.tsx`) and `case 'cisco'` (`src/components/common/VendorIcon.tsx`); `cisco-sa-*` → `cisco` and `VMSA-*` → `vmware` inference plus vendor-specific solution text in `src/services/advisoryService.ts` and `src/services/cveService.ts`; Cisco/VMware official link via `getAdvisoryUrl` in `src/components/explorer/CveDetailDrawer.tsx`; Cisco CSAF and Broadcom VMware feeds in `src/components/admin/SystemHealthMonitor.tsx`.
  - Tests: new `src/tests/unit/components/ciscoVmwareUi.test.tsx` (8 tests; red 8/8 before, green after).
  - **Verification**: `npm --prefix src test` 92 files / 668 passed / 0 failed; `npm --prefix src run build` succeeded.
  - **Reviewer**: skipped under risk policy (red-green covered; no persisted state, auth, boundary, or control-flow change).
  - **Known gaps (not done)**: drawers show no copy-command block for Cisco/VMware (no package-manager command applies); `src/tests/e2e/vendor-logos-and-vault-guide.e2e.test.tsx:93` mocks `SYNCED_VENDOR_CODES` with 5 vendors (stale).
  - **Completed**: 2026-09-22 14:43:12 Asia/Taipei.

- **Supabase deployment catch-up (2026-09-22 16:30 Asia/Taipei — COMPLETED)**:
  - Root cause of missing Ubuntu/Debian/SUSE/Cisco data: migrations `20260911000000_add_ubuntu_debian_suse_vendors` and `20260913000000_add_cisco_vendor` were never applied (no vendor rows), and `sync-cve` / `scheduled-sync` were last deployed 2026-09-11 (before the Cisco/VMware adapters). Dev also lacked `20260909000000_server_side_sync_lock`.
  - Applied pending migrations via `supabase db push` to `vuln-beacon-dev` (egofadbvftmbwodjneoy) and `vuln-beacon` (baizoisgkgwqccqjwnxg); prod was dry-run first.
  - Deployed functions with `supabase functions deploy sync-cve scheduled-sync --use-api --no-verify-jwt`. `--use-api` is required (local bundling fails under podman: "entrypoint path does not exist"). `--no-verify-jwt` preserves the existing `verify_jwt=false`; the CLI default would switch it to true.
  - Verified on both projects: migrations 20260909/20260911/20260913 present; vendors ubuntu, debian, suse, cisco, vmware present. Dev: sync-cve v8, scheduled-sync v7. Prod: sync-cve v3, scheduled-sync v4. All verify_jwt=false.
  - **Open**: first data sync not yet run (manual sync needs admin login in UI); dev scheduled sync fails with "Missing vault secrets: scheduled_sync_url or scheduled_sync_key not configured"; prod has no sync log after 2026-09-11 (scheduler cause not investigated).

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
