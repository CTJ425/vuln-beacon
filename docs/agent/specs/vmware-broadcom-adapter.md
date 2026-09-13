# Spec — VMware / Broadcom Vendor Adapter

Task ID: `TASK-VMWARE-BROADCOM` (TASK.md Task 32)
Lane: 2 (new external API + second external dependency + cross-module registration)
Date: 2026-09-13 Asia/Taipei

## Task

Add a `vmware` vendor adapter that ingests VMware Security Advisories (VMSA) from the
public Broadcom support-portal API, and enriches each CVE with a CVSS score and vector
from the NVD API 2.0. Register it across the adapter registry, sync targets, UI vendor
maps, and URL builders.

## Feed contract (verified 2026-09-13)

### Primary source — Broadcom advisory list

| Item | Value |
| --- | --- |
| Endpoint | `POST https://support.broadcom.com/web/ecx/security-advisory/-/securityadvisory/getSecurityAdvisoryList` |
| Headers | `accept: application/json`, `content-type: application/json` |
| Body | `{"pageNumber":N,"pageSize":M,"searchVal":"","segment":"VC","sortInfo":{"column":"","order":""}}` |
| Auth | None |
| Coverage | `segment=VC` is the whole VMware division — 341 advisories. `VS`/`VF`/`VMW` return 0; `MF` (946) and `ES` (128) are other Broadcom divisions and MUST NOT be ingested. |
| Pagination | Response carries `data.pageInfo.{totalCount,currentPage,nextPage,lastPage,firstPage}`. `pageSize: 50` yields `lastPage: 6`. |
| Ordering | Newest first as returned. Do not re-sort on `published` — see the date trap below. |

Row fields: `affectedCve`, `alertType`, `documentId`, `notificationId`, `notificationUrl`,
`published`, `severity`, `status`, `supportProducts`, `title`, `totalRecords`, `updated`,
`workAround`.

**There is no detail endpoint.** `getSecurityAdvisoryDetail`, `getSecurityAdvisoryDetails`
and `getSecurityAdvisory` all return an HTML page, not JSON. Advisory detail exists only
as HTML on `notificationUrl`. Scraping it is an explicit non-goal.

### Field traps (all observed in the fixture)

| Field | Trap |
| --- | --- |
| `affectedCve` | A single string, not an array. Separators observed: `", "`, `","`, `", "` (**non-breaking space**), and `" and "` before the final id. May be an empty string. **Do not split.** Extract with a global regex `/CVE-\d{4}-\d{4,}/gi` and de-duplicate — this is immune to every separator. |
| `published` | Human format `"03 September 2026"` (day, month name, year). Not ISO. |
| `updated` | ISO-like but **without a timezone suffix**, with 0, 3 or 6 fractional digits: `2026-09-03T08:58:26.960422`, `2026-02-26T10:12:12.766`, `2024-11-26T11:04:26.833`. Must be interpreted as UTC explicitly; passing it to `new Date()` unmodified makes it local time. |
| `severity` | Values observed: `CRITICAL`, `HIGH`, `MEDIUM`. Handle `LOW` and unknown defensively. |
| `supportProducts` | **Truncated by the server** — the literal value contains a trailing ellipsis, e.g. `"VMware Fusion,VMware Work..."`. Never present it as a complete product list. |

### Enrichment source — NVD API 2.0

| Item | Value |
| --- | --- |
| Endpoint | `GET https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=<CVE>` |
| Auth | None (an API key raises the rate limit but the project holds no such secret) |
| Score path | `vulnerabilities[0].cve.metrics.cvssMetricV31[0].cvssData.{baseScore,baseSeverity,vectorString}` |
| Description | `vulnerabilities[0].cve.descriptions[0].value` |
| Miss | A CVE absent from NVD returns HTTP 200 with `totalResults: 0` — not an error. |

**Rate limit is a hard design constraint, measured today:**

- 7 sequential requests completed in 4.5s with zero failures (~0.65s each).
- Concurrency 5 → 5 of 10 requests returned **429**. Concurrency 10 → **all 10** returned 429.

Therefore NVD enrichment MUST be strictly sequential. The `BATCH_SIZE = 5` concurrency
used by every other adapter in this project is wrong here and must not be copied.

**NVD lags the vendor.** `CVE-2026-41722` (8.0 HIGH) and `CVE-2026-41703` (7.6 HIGH)
resolve, but `CVE-2026-59346`, published by Broadcom on 2026-09-03, still returned
`totalResults: 0` on 2026-09-13. Broadcom's own `severity` is therefore the source of
truth for advisory severity; NVD only supplies `cvssScore`, `cvssVector` and
`description`. Never let a missing NVD record change or clear the advisory severity.

## Contract

- `VmwareAdapter implements VendorAdapter`, `vendorCode = 'vmware'`, `vendorName = 'VMware / Broadcom'`
  (match the existing `vendors` row seeded in `20260815000000_init_cve_collector.sql`).
- `fetchAdvisories(limit = 20)` — POST the list endpoint with `pageSize` covering `limit`,
  take the first `limit` rows, then enrich.
- `parse(rawPayload)` — accepts the raw list response object, `data.list`, or an array of
  rows; returns `NormalizedAdvisoryItem[]`. Non-object input returns `[]`.
  **`parse` must be pure and perform no network I/O** — enrichment happens in
  `fetchAdvisories`, so the parser stays unit-testable exactly like the other adapters.
- Enrichment rules:
  - De-duplicate CVE ids across the whole batch before querying NVD; query each id once.
  - Strictly sequential requests. No `Promise.all`, no batching.
  - Cap at 60 NVD requests per `fetchAdvisories` call. Beyond the cap, stop enriching and
    keep the un-enriched CVEs.
  - On HTTP 429, any other non-OK status, a network error, or `totalResults: 0`: skip that
    CVE and continue. On 429 specifically, stop enriching for the remainder of the run.
  - **NVD failure must never fail the sync.** An advisory with no NVD data is still a
    valid, ingestible advisory carrying Broadcom's severity.
- Field mapping:
  - `advisoryId` — the VMSA id parsed from `title` (e.g. `VMSA-2026-0007`), falling back to
    `documentId` when `title` carries no VMSA id.
  - `title` — `title` verbatim.
  - `severity` — from Broadcom `severity`, mapped to `SeverityLevel`.
  - `publishedAt` — parsed from `published` (`"03 September 2026"`).
  - `updatedAt` — parsed from `updated`, treated as UTC.
  - `url` — `notificationUrl`.
  - `mitigation` — `workAround` when it is not `"None"`.
  - `cves[]` — one entry per id found in `affectedCve`; `cvssScore`, `cvssVector` and
    `description` populated from NVD when available, otherwise left undefined.
  - `cves[].severity` — NVD `baseSeverity` when available, otherwise the advisory severity.
  - `rawPayload` — the source row.
- Must NOT change: any existing adapter, the `VendorAdapter` interface, the ingestion
  engine, or the normalized types.

## Files

- `src/adapters/vmware.ts` (new)
- `src/adapters/index.ts` (register in `ALL_ADAPTERS`)
- `src/services/syncService.ts` (add `'vmware'` to `SYNCED_VENDOR_CODES`)
- `src/utils/advisoryUrl.ts` (add `vmware` advisory + CVE URL builders)

Nothing else may be touched. Note in particular:

- **No migration.** The `vmware` vendor row is already seeded in
  `20260815000000_init_cve_collector.sql`.
- **No `VendorIcon.tsx` change.** `vmware` already has a colour, a display name and a
  `VmwareLogo` case.
- `src/supabase/functions/_shared/ingest.bundle.js` is regenerated by the `build:edge` step
  of the Verify command. That is expected build output, not a scope violation.

## Verify

```
npm --prefix src run test:unit
npm --prefix src run build
```

## Non-goals

- No HTML scraping of `notificationUrl` for CVSS, fixed versions, or full product lists.
- No `fixedVersions` or `productImpacts` — the API does not carry them.
- No `affectedProducts` from `supportProducts`; it is server-truncated and would be wrong.
- No NVD API key, no secret handling, no caching layer.
- No other Broadcom segments (`MF`, `ES`).
- No incremental / "since last sync" state.

## Test charter

| Case | Expected outcome | Layer / file |
| --- | --- | --- |
| Parse the list fixture | 5 advisories returned | unit / `src/tests/unit/adapters/vmware.test.ts` |
| VMSA id extraction | `advisoryId === 'VMSA-2026-0007'` for the `VCDSA38288` row | unit |
| Comma-separated CVEs | `VCDSA38288` yields `CVE-2026-59346`, `CVE-2026-59347` | unit |
| `" and "` separator | `VCDSA37513` yields exactly 3 ids, last is `CVE-2026-41724` | unit |
| Non-breaking-space separator | `VCDSA36986` yields exactly 4 ids, none containing ` ` | unit |
| Empty `affectedCve` | `VCDSA25199` parses to an advisory with `cves.length === 0`, does not throw | unit |
| Single CVE | `VCDSA37454` yields exactly 1 id | unit |
| Severity mapping | `VCDSA38288` → `CRITICAL`, `VCDSA36986` → `MEDIUM` | unit |
| `published` parsing | `"03 September 2026"` → ISO date 2026-09-03 | unit |
| `updated` parsed as UTC | `"2026-09-03T08:58:26.960422"` → `2026-09-03T08:58:26.960Z` | unit |
| `workAround: "None"` | does not populate `mitigation` | unit |
| `parse` does no network I/O | `parse()` called with `fetch` stubbed to throw still returns advisories | unit |
| Non-object input | `parse(null)` / `parse('x')` / `parse(42)` return `[]` | unit |
| NVD enrichment applied | with a mocked NVD response, `cves[].cvssScore === 8.0` and the CVSS:3.1 vector is set | unit |
| NVD miss (`totalResults: 0`) | CVE kept, `cvssScore` undefined, advisory severity unchanged | unit |
| NVD 429 | enrichment stops, `fetchAdvisories` still resolves with all advisories | unit |
| NVD requests are sequential | mock records call order; no two requests overlap | unit |
| NVD ids de-duplicated | a CVE appearing in two advisories is requested once | unit |
| Broadcom list fetch fails | `fetchAdvisories` throws | unit |
| Live feed reachable | smoke test fetches ≥1 advisory with a VMSA id | smoke / `src/tests/smoke/adapters.smoke.test.ts` |

## Fixtures (created by the main session)

- `src/tests/fixtures/vmware/vmware-advisory-list-sample.json` — real 5-row list response
  covering every separator trap: `VCDSA38288` (comma, CRITICAL), `VCDSA37513` (`" and "`,
  HIGH), `VCDSA36986` (non-breaking space, MEDIUM), `VCDSA25199` (empty `affectedCve`),
  `VCDSA37454` (single CVE).
- `src/tests/fixtures/vmware/nvd-cve-sample.json` — real NVD 2.0 response for
  `CVE-2026-41722`, 8.0 HIGH, vector `CVSS:3.1/AV:N/AC:L/PR:L/UI:R/S:U/C:H/I:H/A:H`.

## Conventions to match

Same as `cisco-csaf-adapter.md`: vitest, fixtures imported with `import x from '../../fixtures/vmware/...json'`,
`fetch` mocked via `globalThis.fetch = vi.fn()` with `vi.restoreAllMocks()` in `beforeEach`,
`parse` input guard `if (!rawPayload || typeof rawPayload !== 'object') return [];`,
CVE id regex `^CVE-\d{4}-\d{4,}$` uppercased, `rawPayload` preserved.

The closest existing model is `src/adapters/nutanix.ts` (POST list). **Do not copy its
`BATCH_SIZE = 5` concurrency into the NVD enrichment step** — see the rate-limit evidence
above.
