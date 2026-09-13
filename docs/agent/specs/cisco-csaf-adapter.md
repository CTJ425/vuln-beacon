# Spec — Cisco CSAF Vendor Adapter

Task ID: `TASK-CISCO-CSAF`
Lane: 2 (new external feed + DB migration + cross-module registration)
Date: 2026-09-13 Asia/Taipei

## Task

Add a `cisco` vendor adapter that ingests Cisco PSIRT advisories from the public
CSAF 2.0 distribution, and register it across the adapter registry, sync targets,
UI vendor maps, URL builders, and the vendors table.

## Feed contract (verified 2026-09-13)

| Item | Value |
| --- | --- |
| Index | `https://www.cisco.com/.well-known/csaf/changes.csv` |
| Index format | `<year>/<advisory-file>.json,<ISO8601 Z timestamp>` — 2820 rows |
| Index ordering | Descending by timestamp, but **not strictly** — out-of-order rows exist. The adapter MUST sort descending itself. |
| Detail | `https://www.cisco.com/.well-known/csaf/<year>/<advisory-file>.json` |
| Auth | None |
| CORS | No `access-control-allow-origin`. Irrelevant — ingestion runs server-side in the Edge Function bundle, same as SUSE (`ftp.suse.com` also has none). |
| Filename casing | Path in `changes.csv` is lowercase; `document.tracking.id` is mixed case (`cisco-sa-tce-roomos-dos-9V9jrC2q`). Build detail URLs from the CSV path, never from `tracking.id`. |

### CSAF document shape (verified against both fixtures)

- `document.tracking.id` — advisory ID (mixed case, use verbatim as `advisoryId`)
- `document.title` — advisory title
- `document.tracking.initial_release_date` — maps to `publishedAt`
- `document.tracking.current_release_date` — maps to `updatedAt`
- `document.notes[]` — `{category, title, text}`; `category: "summary"` is the summary.
  Other useful `category: "general"` entries by `title`: `Workarounds`, `Fixed Software`,
  `Vulnerable Products`.
- `document.references[]` — entry with `category: "self"` holds the canonical advisory URL.
- `vulnerabilities[]` — `{cve, ids, notes, product_status, remediations, scores, title}`
  - `scores[0].cvss_v3.baseScore` / `.baseSeverity` / `.vectorString`
  - `product_status.known_affected[]` — CSAF product IDs (`CSAFPID-nnnnnn`), **not names**
  - `remediations[]` — `{category: "vendor_fix", details, product_ids[]}`
- `product_tree.branches[]` — nested `vendor > product_family > product_version > service_pack`,
  leaf carries `product: {name, product_id}`. Resolve `CSAFPID-*` to names through this tree.
- `product_tree.relationships[]` — **optional**, absent in some advisories. Must be guarded.

### Severity rule (no vendor field exists)

Cisco CSAF has **no** `document.aggregate_severity`, no `vulnerabilities[].threats`, and
no "Security Impact Rating" field. Advisory-level `severity` MUST be derived as the
highest `scores[].cvss_v3.baseSeverity` across all `vulnerabilities[]`, mapped
CRITICAL/HIGH/MEDIUM/LOW. When no score is present, fall back to the existing CVSS-score
threshold helper, then `UNKNOWN`.

## Contract

- `CiscoAdapter implements VendorAdapter` with `vendorCode = 'cisco'`, `vendorName = 'Cisco'`.
- `fetchAdvisories(limit = 20)` — fetch `changes.csv`, parse rows, sort descending by
  timestamp, take the first `limit`, then fetch each advisory JSON with the same bounded
  concurrency the SUSE adapter uses. A failed individual detail fetch MUST be skipped, not
  thrown — one bad advisory must not fail the whole sync.
- `parse(rawPayload)` — accepts a single CSAF document object; returns
  `NormalizedAdvisoryItem[]`. Non-object input returns `[]`.
- Must NOT change: any existing adapter, the `VendorAdapter` interface, ingestion engine,
  or the normalized types.

## Files

- `src/adapters/cisco.ts` (new)
- `src/adapters/index.ts` (register in `ALL_ADAPTERS`)
- `src/services/syncService.ts` (add `'cisco'` to `SYNCED_VENDOR_CODES`)
- `src/components/common/VendorIcon.tsx` (add `cisco` colour + display name)
- `src/utils/advisoryUrl.ts` (add `cisco` advisory + CVE URL builders)
- `src/supabase/migrations/20260913000000_add_cisco_vendor.sql` (new)

Nothing else may be touched.

## Verify

```
npm --prefix src run test:unit
npm --prefix src run build
```

## Non-goals

- No VMware/Broadcom adapter. That is a separate follow-up task.
- No PGP (`.asc`) or SHA-512 signature verification.
- No incremental / "since last sync" state. Match the existing fresh-fetch model.
- No changes to the RSS feed path — CSAF is the only source.

## Test charter

| Case | Expected outcome | Layer / file |
| --- | --- | --- |
| Parse single-CVE CSAF fixture | 1 item; `advisoryId === 'cisco-sa-tce-roomos-dos-9V9jrC2q'`; `severity === 'HIGH'` | unit / `src/tests/unit/adapters/cisco.test.ts` |
| Date mapping | `publishedAt` from `initial_release_date` (2026-02-04), `updatedAt` from `current_release_date` (2026-02-12) | unit |
| CVE extraction | `cves[0].cveId === 'CVE-2026-20119'`, `cvssScore === 7.5`, `cvssVector` is the CVSS:3.1 string | unit |
| Product ID resolution | `affectedProducts` contains resolved names (`RoomOS 10.3.2.0`), never raw `CSAFPID-*` | unit |
| Multi-CVE advisory | 2 CVEs parsed; advisory `severity === 'CRITICAL'` (max of 9.8 CRITICAL / 8.8 HIGH) | unit |
| `product_tree.relationships` absent | Does not throw; still parses (multi-CVE fixture has no `relationships`) | unit |
| Non-object input | `parse(null)` / `parse('x')` / `parse(42)` return `[]` | unit |
| changes.csv parsing | 12-row fixture parses to rows with `path` + `timestamp`; sorted descending | unit |
| Advisory URL builder | `cisco` advisory ID produces the `sec.cloudapps.cisco.com/.../CiscoSecurityAdvisory/<id>` URL | unit / `src/tests/unit/...` |
| Live feed reachable | smoke test fetches ≥1 advisory with a CVE | smoke / `src/tests/smoke/adapters.smoke.test.ts` |

## Fixtures (already created by the main session)

- `src/tests/fixtures/cisco/cisco-csaf-sample.json` — single CVE, CVE-2026-20119, 7.5 HIGH
- `src/tests/fixtures/cisco/cisco-csaf-multi-cve-sample.json` — CVE-2026-20274 (9.8 CRITICAL) + CVE-2026-20275 (8.8 HIGH), no `product_tree.relationships`
- `src/tests/fixtures/cisco/cisco-changes-sample.csv` — 12 index rows

## Conventions to match (from the existing SUSE adapter)

| Aspect | Rule |
| --- | --- |
| `fetchAdvisories` signature | `async fetchAdvisories(limit = 20): Promise<NormalizedAdvisoryItem[]>` |
| Index fetch failure | `throw` if the `changes.csv` response is not `ok` |
| CSV row format | **Differs from SUSE.** SUSE rows are quoted (`"file.json","time"`); Cisco rows are **unquoted**: `2026/cisco-sa-foo-abc.json,2026-09-13T06:05:10Z`. Use a regex for the unquoted form. |
| Sort | `entries.sort((a, b) => b.time.localeCompare(a.time));` |
| Detail concurrency | `BATCH_SIZE = 5`, same batching loop as `suse.ts` |
| Detail failure | catch → `null` → filtered out before `parse()`. Never throws. |
| `parse` input guard | `if (!rawPayload || typeof rawPayload !== 'object') return [];` then `Array.isArray(rawPayload) ? rawPayload : [rawPayload]`, skipping docs without `doc.document` |
| `rawPayload` field | preserve the source doc |
| CVE ID validation | regex `^CVE-\d{4}-\d{4,}$`, uppercased |
| Test framework | vitest; fixtures imported with `import fixture from '../../fixtures/cisco/...json'`; `fetch` mocked via `globalThis.fetch = vi.fn()` with `vi.restoreAllMocks()` in `beforeEach` |

### Registration details

- `src/adapters/index.ts` — add `import { CiscoAdapter } from './cisco';` and `new CiscoAdapter(),` to `ALL_ADAPTERS`.
- `src/components/common/VendorIcon.tsx` — add `cisco: '#1BA0D7'` to `VENDOR_COLORS` and `cisco: 'Cisco'` to `VENDOR_NAMES`. **Do not** add a `case 'cisco'` to the logo switch; `DefaultVendorLogo` is the intended fallback (a Cisco SVG logo is a separate, out-of-scope change).
- `src/utils/advisoryUrl.ts` — in the CVE branch add `if (v === 'cisco') return 'https://sec.cloudapps.cisco.com/security/center/cveListing.x?cve=' + cveUpper;`
  and in the advisory-ID branch, for IDs matching `/^cisco-sa-/i` or `v === 'cisco'`, return
  `https://sec.cloudapps.cisco.com/security/center/content/CiscoSecurityAdvisory/<advisoryId>` (preserve the ID's original casing).
- `src/tests/smoke/adapters.smoke.test.ts` — add `'cisco'` to both the registry expectation list and the `getAdapterByCode` loop array, and add a Cisco live-fetch block modelled on the SUSE one.

### Migration

`src/supabase/migrations/20260913000000_add_cisco_vendor.sql`, following
`20260911000000_add_ubuntu_debian_suse_vendors.sql` verbatim in shape:

```sql
INSERT INTO public.vendors (code, name, icon_url, homepage, is_active, schedule_enabled, schedule_times, schedule_timezone)
VALUES
    ('cisco', 'Cisco', 'https://www.cisco.com/favicon.ico', 'https://sec.cloudapps.cisco.com/security/center/publicationListing.x', true, false, ARRAY['08:00','12:30','18:30'], 'Asia/Taipei')
ON CONFLICT (code) DO NOTHING;
```

## Amendment 1 — 2026-09-13 (post-review)

### Unresolvable product IDs must be dropped, not emitted raw

Verified against live Cisco CSAF documents: `product_status.known_affected` and
`remediations[].product_ids` legitimately reference `CSAFPID-*` ids that appear **nowhere**
in `product_tree` — 2 of 81 ids in `cisco-sa-tce-roomos-dos-9V9jrC2q`, 1 of 265 in
`cisco-sa-hardening-iosxr-qg64NcM`. This is normal Cisco data, not a fixture artefact.

Rule: when a `CSAFPID-*` id cannot be resolved to a product name through
`product_tree.branches`, **omit it** from `affectedProducts`, `fixedVersions` and
`productImpacts`. Never fall back to the raw id. A raw `CSAFPID-278404` string in a
user-facing product list is noise, not information.

### Build output is an expected side effect

`src/supabase/functions/_shared/ingest.bundle.js` is regenerated by the `build:edge` step
of `npm --prefix src run build`, which is part of the mandated Verify command. It bundles
`ALL_ADAPTERS`, so it **must** change when an adapter is added — otherwise server-side
scheduled sync would never see Cisco. It is expected build output, not a scope violation.
Added to `## Files`.

### Test files added to scope (owned by the main session, not builder)

These hardcode the vendor list and had to move from 5 to 6 vendors:
`src/tests/unit/services/syncServiceAdapterUrls.test.ts`,
`src/tests/unit/services/nutanixSyncService.test.ts`,
`src/tests/unit/services/syncServiceServerMode.test.ts`,
`src/tests/smoke/adapters.smoke.test.ts`.
