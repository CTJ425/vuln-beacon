# Spec: RHSA-centric data layer (Phase C1 + C2)

## Task

The product is meant to be organised around **RHSA advisories**, with CVE
lookup as a second entry point. Today the data layer is CVE-first and drops
the N:M relationship in three places:

1. `src/adapters/redhat.ts` — a Red Hat CVE record often lists several RHSAs
   that ship its fix. `parse()` keeps only `advisoriesList[0]` as the advisory
   and demotes the rest to a decorative `rawPayload.all_advisories` string
   array. Only the first RHSA ever becomes a row in `public.advisories`.
2. `src/services/cveService.ts:47` — reads only `row.advisory_cve_map[0]`, so
   even when several mappings exist, every mapping after the first is
   discarded (its `product_impacts` and `fixed_versions` are lost).
3. There is no way to query advisory-first at all — nothing selects `FROM
   advisories`, so "show me this RHSA and every CVE it fixes" is impossible.

This task fixes the data layer only. The UI rework is a separate follow-up.

## Contract

### 1. `src/adapters/redhat.ts` — emit one advisory per RHSA

In `parse()`, the per-CVE loop currently pushes exactly one
`NormalizedAdvisoryItem` using `primaryAdvisoryId = advisoriesList[0]`.
Change it to push **one `NormalizedAdvisoryItem` per entry in
`advisoriesList`**. For each emitted item:

- `advisoryId` = that specific RHSA id.
- `url` = `https://access.redhat.com/errata/<that RHSA id>` (each advisory
  links to its own errata page, not the first one's).
- `cves` = the same single-element array as today, carrying this CVE.
- `fixedVersions` (inside the `cves[0]` entry) = `['Released in <that RHSA id>']`
  — scoped to this advisory rather than listing every RHSA.
- `solution` (both the item-level and `cves[0]` one) = the existing Chinese
  "已發布" wording, but naming **that specific RHSA id** instead of the joined
  list.
- `productImpacts`, `affectedProducts`, `severity`, `publishedAt`, `summary`,
  `title`, `topic`, `mitigation`, `statement`, `securityFixes`,
  `updatedPackages` = unchanged from today's logic (these are CVE-level facts
  and stay identical on every emitted item).
- `rawPayload` = unchanged, and **must keep** `all_advisories: advisoriesList`
  (the full list) so a CVE can still show its sibling RHSAs.

When `advisoriesList` is empty (no errata released yet), keep today's exact
fallback: emit **one** item with `advisoryId = raw.CVE`, `url =
https://access.redhat.com/security/cve/<CVE>`, the "分析處置中" solution
wording, and `fixedVersions` as computed today. Do not change that path.

`IngestionEngine` already keys advisories by `vendorCode:advisoryId` and pushes
one mapping per (advisory, CVE), so emitting N items naturally produces N
advisory rows and N mapping rows. **Do not modify `src/engine/ingestion.ts`.**

### 2. New `src/services/advisoryService.ts` — advisory-first read

Export an `AdvisoryRowItem` interface and an `AdvisoryService` class with one
method, `async fetchAdvisories(): Promise<AdvisoryRowItem[]>`.

```ts
export interface AdvisoryRowItem {
  id: string;
  advisory_id: string;          // e.g. RHSA-2026:2000
  title: string;
  severity: SeverityLevel;
  published_at: string;
  url?: string;
  summary?: string;
  cves: {                       // EVERY CVE this advisory fixes
    cve_id: string;
    description: string;
    severity: SeverityLevel;
    cvss_v3_score?: number;
    is_known_exploited: boolean;
  }[];
  product_impacts: ProductImpactItem[];  // aggregated across all mapped CVEs
  affected_products: string[];           // distinct product_name, aggregated
  fixed_versions: string[];              // union across all mappings
  solution?: string;
}
```

Query shape — mirror the style already used in `cveService.fetchCves()`:

```ts
supabase
  .from('advisories')
  .select(`
    id, advisory_id, title, severity, published_at, url, summary,
    advisory_cve_map (
      affected_products,
      fixed_versions,
      cves ( cve_id, description, cvss_v3_score, cvss_v3_vector, severity, is_known_exploited, published_date )
    )
  `)
  .order('published_at', { ascending: false })
```

Mapping rules:

- `cves`: one entry per mapping whose joined `cves` object is present; skip
  mappings where it is null. Deduplicate by `cve_id`.
- `product_impacts`: the `affected_products` column stores
  `ProductImpactItem[]` objects (this is the existing, deliberately preserved
  convention — see `syncService`/`cveService`). Parse each mapping's
  `affected_products` with the **same** normalisation `cveService.fetchCves()`
  already applies (object entries → `ProductImpactItem` with the same field
  fallbacks; plain-string entries → the string-fallback shape), then
  concatenate across all mappings and deduplicate on
  `` `${product_name}|${component}|${state}` ``.
- `affected_products`: distinct `product_name` values from `product_impacts`.
- `fixed_versions`: union of every mapping's `fixed_versions`, deduplicated.
- `solution`: reuse the wording logic in `cveService.fetchCves()` — if
  fixed versions exist and none contain "pending", the "請依據官方發佈之資安更新
  公告 (...) 執行升級更新" text naming this advisory id; otherwise the
  "分析處置中" wording.
- On a Postgrest `error`, `console.warn` and return `[]` (do not throw).
  On a thrown exception, `console.error` and return `[]`. This matches
  `cveService`'s existing failure behaviour.

### 3. `src/services/cveService.ts` — stop discarding mappings after the first

Currently `const firstMap = row.advisory_cve_map && row.advisory_cve_map[0]`
and everything downstream reads only that one mapping. Change to iterate
**every** mapping in `row.advisory_cve_map`:

- `product_impacts`: parse each mapping's `affected_products` with the existing
  normalisation, concatenate across all mappings, deduplicate on
  `` `${product_name}|${component}|${state}` ``. Keep the existing
  "if still empty, synthesise a fallback impact row from the description"
  behaviour as-is when the merged result is empty.
- `fixed_versions`: union across all mappings (deduplicated), then fall back to
  today's derivation (released errata, then `Released in <advisory_id>`) only
  when that union is empty.
- `all_advisories`: distinct `advisories.advisory_id` across **all** mappings,
  in the order encountered. Fall back to the current
  `rawPayload.all_advisories` value only when no mapping yields an advisory id.
- `advisory_id`, `advisory_title`, `advisory_url`, `vendor_code`: keep sourcing
  from the **first** mapping's advisory (the primary), exactly as today, so the
  existing UI keeps working.
- Everything else in the returned `CveTableRowItem` (including
  `advisory_detail`) keeps its current shape and derivation.

Do not change the `.select(...)` string — it already returns every mapping.

## Files
- `src/adapters/redhat.ts`
- `src/services/advisoryService.ts` (new)
- `src/services/cveService.ts`

Do not touch: `src/engine/ingestion.ts`, `src/types/index.ts`,
`src/services/syncService.ts`, `src/supabase/**`, any page or component, any
existing test file.

## Verify
From `/root/dev/vuln-beacon/src`:
1. `npm run test:unit -- redhatMultiAdvisory advisoryCentric` — both files must pass.
2. `npm test` — full suite must pass (58 pre-existing tests were green before
   the two new files were added).
3. `npm run build` — must succeed.

Report the exact output of all three.

**If an existing test fails because this change legitimately alters advisory
counts, do NOT edit that test** (you are blocked from editing tests anyway) —
stop and report exactly which test, its assertion, and the observed vs expected
values, so the main session can adjudicate.

## Non-goals
- No UI changes (Dashboard / Explorer / detail drawer are a separate task).
- Do not add pagination or caching.
- Do not change the DB schema, RLS, or the edge function.
- Do not "fix" the convention of storing `ProductImpactItem[]` in the
  `affected_products` column — preserve it.

## Test charter
| Case | Expected outcome | Layer / file |
| --- | --- | --- |
| CVE with 3 RHSAs parses into 3 advisory items, each carrying that CVE, each linking to its own errata | 3 items, ids match, urls differ | unit / `redhatMultiAdvisory.test.ts` |
| Two CVEs sharing one RHSA both map to that advisory id | 2 items under the same advisory id | unit / `redhatMultiAdvisory.test.ts` |
| CVE with no errata falls back to CVE id as advisory id | 1 item, advisoryId === CVE id | unit / `redhatMultiAdvisory.test.ts` |
| Advisory with 2 mapped CVEs returns both, with impacts aggregated | `cves.length === 2`, `product_impacts.length === 2` | unit / `advisoryCentric.test.ts` |
| Advisory query error returns `[]` rather than throwing | resolves to `[]` | unit / `advisoryCentric.test.ts` |
| CVE mapped to 2 RHSAs lists both, merging impacts from both mappings | `all_advisories` has both; impacts from both | unit / `advisoryCentric.test.ts` |
