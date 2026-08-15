# Spec: CSAF advisory-first ingestion (Phase D1)

## Task

The product must be organised around RHSA errata, with CVE lookup as the
supporting path. An RHSA is Red Hat's remediation for **several** CVEs, so the
CVE list is core content of the advisory — not a by-product of what happened to
be fetched.

Today's ingestion is still CVE-driven: `RedHatAdapter.fetchAdvisories()` pulls
`/securitydata/cve.json` (a list of CVEs) and fans each CVE out to the RHSAs
that fix it. An advisory therefore only ever accumulates the CVEs that fell
inside the fetch window. Verified against the live API: RHSA-2023:5455 fixes
**4** CVEs, but our database records **1**.

Red Hat publishes an advisory-first feed. Verified endpoints:

- `GET /hydra/rest/securitydata/csaf.json?per_page=N` — errata list. Each entry:
  `{ RHSA, severity, released_on, CVEs[], bugzillas[], released_packages[], resource_url }`.
  The `CVEs` array is the advisory's complete CVE list.
  Supported filters: `cve`, `severity`, `after`, `before`, `package`, `per_page`.
  (`product` is **not** supported — returns HTTP 400.)
- `GET /hydra/rest/securitydata/csaf/<ERRATA-ID>.json` — full CSAF 2.0 document:
  `{ document, product_tree, vulnerabilities }`.

Scope note: this feed carries errata that address CVEs. A 1000-entry sample
held 996 RHSA, 3 RHBA, 1 RHEA — so all three prefixes appear and must not be
filtered out. Pure bug-fix/enhancement errata carrying no CVE are not served by
this API (`csaf/RHBA-2026:54000.json` → 404) and are out of scope.

This task adds the advisory-first adapter only. Wiring it into `SyncService`,
the CVE reverse lookup, and re-ingesting the database are follow-up tasks.

## Contract

### New `src/adapters/redhat-csaf.ts`

```ts
export class RedHatCsafAdapter implements VendorAdapter {
  readonly vendorCode = 'redhat';
  readonly vendorName = 'Red Hat';
  async fetchAdvisories(): Promise<NormalizedAdvisoryItem[]>;
  parse(rawPayload: unknown): NormalizedAdvisoryItem[];
}
```

Keep the existing `src/adapters/redhat.ts` untouched and still exported — it is
not deleted in this task.

#### `parse(rawPayload)`

Input: an array of **CSAF detail documents** (the `csaf/<ID>.json` shape).
Output: exactly **one** `NormalizedAdvisoryItem` per document, carrying every
CVE that document fixes.

Return `[]` for a non-array input. Skip (do not throw on) any element lacking
`document.tracking.id` or lacking a non-empty `vulnerabilities` array.

Advisory-level mapping:

| `NormalizedAdvisoryItem` field | Source |
| --- | --- |
| `advisoryId` | `document.tracking.id` |
| `title` | `document.title`, with a leading `Red Hat Security Advisory: ` / `Red Hat Bug Fix Advisory: ` / `Red Hat Enhancement Advisory: ` prefix stripped when present |
| `severity` | `normalizeSeverity(document.aggregate_severity.text)` |
| `publishedAt` | `document.tracking.initial_release_date` |
| `updatedAt` | `document.tracking.current_release_date` |
| `url` | `https://access.redhat.com/errata/<advisoryId>` |
| `summary` / `topic` | `document.notes[]` where `category === 'summary'` → its `text` |
| `statement` | `document.notes[]` where `category === 'general'` → its `text` |
| `solution` | first `vulnerabilities[].remediations[]` with `category === 'vendor_fix'` → its `details` |
| `mitigation` | first `vulnerabilities[].remediations[]` with `category === 'workaround'` → its `details` (omit when none) |
| `rawPayload` | `{ csaf_document_id: advisoryId, cve_ids: [...all cve ids...] }` — do **not** store the whole CSAF document, it can exceed 1 MB |

Per-CVE mapping, one entry in `cves[]` per element of `vulnerabilities[]`:

| `cves[]` field | Source |
| --- | --- |
| `cveId` | `.cve` |
| `description` | `.notes[]` with `category === 'description'` → `text`; fall back to `.title` |
| `cvssScore` | `.scores[0].cvss_v3.baseScore` (number; omit when absent) |
| `cvssVector` | `.scores[0].cvss_v3.vectorString` |
| `severity` | `normalizeSeverity(.threats[] where category === 'impact' → details)`; fall back to `.scores[0].cvss_v3.baseSeverity`; then to the advisory severity |
| `fixedVersions` | `['Released in <advisoryId>']` |
| `solution` | the advisory-level solution text |
| `productImpacts` | see below |
| `affectedProducts` | distinct `product_name` values from that CVE's `productImpacts` |

#### Product impact resolution

`vulnerabilities[].product_status` is an object keyed by state, each holding
composite product ids of the form `<branchId>:<packageNVR>` (e.g.
`BaseOS-8.8.0.Z.MAIN.EUS:glibc-0:2.28-225.el8_8.6.x86_64`).

Map each state key to a display state:

| `product_status` key | `ProductImpactItem.state` |
| --- | --- |
| `fixed` | `Fixed` |
| `known_affected` | `Affected` |
| `known_not_affected` | `Not affected` |
| `under_investigation` | `Under investigation` |
| anything else | the key with `_` replaced by spaces, first letter capitalised |

For each composite id:

1. Split on the **first** `:` — the left side is the branch id, the right side
   is the package NVR (which itself contains `:` for the epoch, so split once
   only).
2. Resolve the branch id to a human product name by walking
   `product_tree.branches` recursively and indexing every node with
   `category === 'product_name'` by its `product.product_id` → `product.name`.
   If unresolved, fall back to the raw branch id.
3. Reduce the package NVR to a base component name by stripping the
   version/epoch onward — i.e. cut at the first `-<digits>:` occurrence
   (`glibc-0:2.28-225.el8_8.6.x86_64` → `glibc`). If that pattern is absent,
   use the NVR unchanged.
4. Build `{ product_name, component, state, justification: 'None',
   errata: advisoryId, release_date: document.tracking.initial_release_date }`.

Then, per CVE:

- **Drop** components ending in `-debuginfo` or `-debugsource`. They are build
  artifacts, not actionable remediation targets, and dominate the raw list
  (one real advisory yielded 1017 product entries reducing to ~3 products and a
  dozen meaningful packages). This is a deliberate readability decision.
- **Deduplicate** on `` `${product_name}|${component}|${state}` ``.

#### `fetchAdvisories()`

1. `GET https://access.redhat.com/hydra/rest/securitydata/csaf.json?per_page=50`.
   Throw `new Error(...)` on a non-ok response, matching the existing adapter's
   behaviour.
2. For each list entry, fetch its detail document from
   `https://access.redhat.com/hydra/rest/securitydata/csaf/<RHSA>.json`
   (the list entry's id field is named `RHSA` even for RHBA/RHEA ids — do not
   filter by prefix). Resolve these in parallel with `Promise.all`, and on an
   individual fetch failure skip that advisory rather than failing the batch
   (mirror the `try { } catch { }` pattern in `redhat.ts:fetchAdvisories`).
3. Return `this.parse(detailDocuments)`.

## Files
- `src/adapters/redhat-csaf.ts` (new)

Do not touch: `src/adapters/redhat.ts`, `src/adapters/index.ts`,
`src/engine/ingestion.ts`, `src/services/**`, `src/types/index.ts`,
`src/components/**`, `src/pages/**`, `src/supabase/**`, any existing test file.

## Verify
From `/root/dev/vuln-beacon/src`:
1. `npx vitest run tests/unit/adapters/redhatCsaf.test.ts` — must pass.
2. `npm test` — full suite must pass (83 tests were green before this task's
   new test file was added).
3. `npm run build` — must succeed.

Report the exact output of all three.

If an existing test fails, **do not edit it** — stop and report the test name,
its assertion, and observed vs expected.

## Non-goals
- Do not register the new adapter in `src/adapters/index.ts` or wire it into
  `SyncService` — a follow-up task does that alongside the reverse-lookup
  rework and the database re-ingestion.
- Do not delete or modify the existing `RedHatAdapter`.
- Do not add new dependencies.
- Do not attempt to ingest non-security RHBA/RHEA errata; they are not served
  by this API.

## Test charter
| Case | Expected outcome | Layer / file |
| --- | --- | --- |
| One CSAF document yields exactly one advisory | `items.length === 1`, id `RHSA-2023:5455` | unit / `redhatCsaf.test.ts` |
| The advisory carries every CVE it fixes | both CVE ids present | unit / `redhatCsaf.test.ts` |
| Advisory metadata read from `document` | title, severity HIGH, initial release date, errata url, topic | unit / `redhatCsaf.test.ts` |
| Per-CVE score, vector, severity, description | 7.8 / vector string / HIGH / description text | unit / `redhatCsaf.test.ts` |
| Composite product ids resolve to human product names and base components | product name resolved, component `glibc`, raw branch id absent, state `Fixed` | unit / `redhatCsaf.test.ts` |
| Debug artifacts dropped and impacts deduplicated | no `debuginfo` component, no duplicate keys | unit / `redhatCsaf.test.ts` |
| Vendor fix and workaround extracted separately | solution and mitigation both populated | unit / `redhatCsaf.test.ts` |
| Malformed payloads return `[]` without throwing | `[]` for `[]`, `null`, `[{}]` | unit / `redhatCsaf.test.ts` |
