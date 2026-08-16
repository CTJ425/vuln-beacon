# Spec: Vendor/Product Taxonomy Navigation + Global Overview

## Task

VulnBeacon is built Red-Hat-shaped, but more vendors and products are coming.
Three problems block that:

1. Navigation is flat — `Sidebar.tsx` hardcodes four tabs, driven by
   `useState<NavTab>` in `App.tsx`. There is nowhere to hang a product.
2. Product grouping is hardcoded three times, inconsistently:
   `DashboardPage.tsx:31-56` (5 keyword buckets), `CveFilterBar.tsx:109-115`
   (6 dropdown options), `ExplorerPage.tsx:34-60` / `:108-134` (the substring
   matcher). Adding a product means editing three lists that already disagree.
3. Overview assumes Red Hat: title at `DashboardPage.tsx:67` reads "Red Hat
   Security Intelligence Dashboard".

Build a single derived-taxonomy source, a vendor → product sidebar tree fed by
it, a new product page that reuses the Explorer, and an Overview reworked to
summarise across vendors.

**No router.** Extend the existing `useState` navigation. Accepted trade-off:
product pages are not deep-linkable; a reload returns to Overview.

## Contract

### 1. New `src/services/productTaxonomy.ts` — pure functions, no I/O

```ts
export function normalizeProductFamily(productName: string): string
```
Trim the input, then repeatedly apply, in this order, until the string stops
changing:
1. strip a trailing version parenthetical: `/\s*\(\s*v\.?\s*[\d.]+\s*\)\s*$/i`
2. strip one trailing channel/variant token from this set (case-insensitive,
   word-boundary at the end of string): `AppStream`, `BaseOS`, `CRB`,
   `CodeReady Linux Builder`, `Supplementary`, `Extras`, `Optional`, `Server`,
   `Workstation`, `Client`, `Desktop`
3. strip a trailing version number: `/\s+\d+(\.\d+)*$/`
4. collapse internal whitespace to single spaces and re-trim

If the result is empty after stripping, return the original trimmed input
(never return an empty string).

Verify against these exact fixture values (all appear verbatim in
`src/tests/fixtures/redhat/` or existing unit test files — grep for them):

| Input | Expected output |
| --- | --- |
| `Red Hat Enterprise Linux AppStream (v. 9)` | `Red Hat Enterprise Linux` |
| `Red Hat Enterprise Linux BaseOS (v. 9)` | `Red Hat Enterprise Linux` |
| `Red Hat Enterprise Linux BaseOS (v. 8)` | `Red Hat Enterprise Linux` |
| `Red Hat Enterprise Linux 9` | `Red Hat Enterprise Linux` |
| `Red Hat Enterprise Linux 8` | `Red Hat Enterprise Linux` |
| `Red Hat OpenShift` | `Red Hat OpenShift` |
| `Red Hat Hardened Images` | `Red Hat Hardened Images` |

Known accepted limitation: `RHEL 9` normalizes to `RHEL` (a separate family
from `Red Hat Enterprise Linux`). Do not add an alias map — out of scope.

```ts
export function slugify(name: string): string
```
Lowercase; replace every run of non-alphanumeric characters with a single `-`;
trim leading/trailing `-`. (`Red Hat Enterprise Linux` → `red-hat-enterprise-linux`.)

```ts
export interface ProductFamilyNode {
  id: string;            // slugify(name), or 'other' for the overflow node
  name: string;           // display name; 'Other products' for overflow
  advisoryCount: number;
  isOverflow?: boolean;    // true only on the 'other' node
  memberFamilyIds?: string[]; // family ids folded into 'other' (only when isOverflow)
}

export interface VendorNode {
  vendorId: string;       // advisory.vendor_id, verbatim
  vendorName: string;      // VENDOR_NAMES[vendorId] ?? vendorId
  advisoryCount: number;
  criticalCount: number;   // advisories in this vendor with severity === 'CRITICAL'
  products: ProductFamilyNode[]; // top N by advisoryCount desc, then 'other' last if any overflow
}

export function deriveTaxonomy(
  advisories: AdvisoryRowItem[],
  topN?: number  // default 10
): VendorNode[]
```
Group advisories by `vendor_id`. Within each vendor, group by
`normalizeProductFamily(name)` for every unique name in
`advisory.affected_products` (an advisory with N distinct families contributes
to each of those N families' `advisoryCount` — do not double count within one
family for one advisory). Sort vendors by `advisoryCount` desc. Sort each
vendor's families by `advisoryCount` desc, ties broken alphabetically by name.
Keep the top `topN` families; if more remain, fold them into one trailing
`ProductFamilyNode` with `id: 'other'`, `name: 'Other products'`,
`isOverflow: true`, `advisoryCount` = sum of the folded families' counts, and
`memberFamilyIds` = their slugified ids. If there is no overflow, omit the
`other` node entirely (do not emit it with count 0).

```ts
export function matchesProductFamily(
  advisory: AdvisoryRowItem,
  familyId: string,
  taxonomy: VendorNode[] // needed to resolve memberFamilyIds when familyId === 'other'
): boolean
```
True if `familyId === 'other'` and any of the advisory's normalized family ids
is in that vendor's `other` node's `memberFamilyIds`; otherwise true if any of
`advisory.affected_products` normalizes+slugifies to `familyId`.

### 2. `src/components/common/VendorIcon.tsx` — export existing maps

`VENDOR_NAMES` and `VENDOR_COLORS` (lines ~10-30) currently module-private.
Add `export` to both. Do not change their contents or `VendorIcon` itself.

### 3. `src/services/advisoryService.ts` — carry vendor_id

Add `vendor_id: string` to the `AdvisoryRowItem` interface and to the Supabase
`select(...)` string in `fetchAdvisories()`, and map it through into each
returned row. Do not change any other field or the join shape.

### 4. `src/components/common/Sidebar.tsx` — vendor/product tree

Replace the `NavTab` union with:

```ts
export type NavState =
  | { section: 'dashboard' | 'explorer' | 'sync' | 'settings' }
  | { section: 'vendor'; vendorId: string }
  | { section: 'product'; vendorId: string; productId: string };
```

```ts
interface SidebarProps {
  currentNav: NavState;
  onSelectNav: (nav: NavState) => void;
  taxonomy: VendorNode[]; // from deriveTaxonomy — Sidebar does not derive
}
```
Render order: `Overview` (`{section:'dashboard'}`) first, exactly as today.
Then one collapsible group per `VendorNode` (label = `vendorName`, icon =
`<VendorIcon vendorCode={vendorId} />`, clicking the vendor row itself
navigates to `{section:'vendor', vendorId}`); expanded by default when it (or
one of its products) is the current selection. Each group's children are its
`products`, each row showing `name` and `advisoryCount`, clicking navigates to
`{section:'product', vendorId, productId: product.id}`. After the vendor
groups, keep `CVE Explorer`, `Sync Monitor`, `Webhooks & Config` exactly as
today (same ids, same labels — do not rename; `App.test.tsx` asserts on these
three strings). Use MUI `Collapse`/nested `List` (already a project
dependency) — no new dependency.

### 5. `src/App.tsx` — NavState wiring

Replace `useState<NavTab>('dashboard')` with
`useState<NavState>({ section: 'dashboard' })`. Pass `taxonomy =
deriveTaxonomy(advisories)` (memoize with `useMemo` keyed on `advisories`) into
`Sidebar`. Extend the conditional render block (currently ~154-187) with two
new branches:
- `section === 'vendor'` → render `DashboardPage`-style vendor summary is out
  of scope for a dedicated component; instead render `ProductPage` with
  `productId: undefined` is also out of scope — for `vendor`, render
  `ProductPage` given the vendor's full `VendorNode` and no product filter
  (i.e. `ProductPage` must accept an optional `productId`; when absent, show
  all of that vendor's advisories unfiltered by family). See §6.
- `section === 'product'` → render `ProductPage` with both `vendorId` and
  `productId`.

`onNavigateToExplorer` (currently `() => setCurrentTab('explorer')`) becomes
`() => setCurrentNav({ section: 'explorer' })`. Every other existing prop
wiring for `DashboardPage`, `ExplorerPage`, `SyncMonitorPage`, `SettingsPage`
stays as-is.

### 6. New `src/pages/ProductPage.tsx`

```ts
interface ProductPageProps {
  vendorId: string;
  productId?: string;         // absent = whole-vendor view
  advisories: AdvisoryRowItem[];
  cves: CveTableRowItem[];
  taxonomy: VendorNode[];
  onSelectCve: (cve: CveTableRowItem) => void;
  onSelectAdvisory: (item: AdvisoryRowItem) => void;
  onRefreshCves?: () => Promise<void>;
}
```
Filter `advisories` to `vendor_id === vendorId`, then, if `productId` is
present, further filter with `matchesProductFamily(advisory, productId,
taxonomy)`. Render stat cards above a reused `ExplorerPage` (Critical count,
High count, total advisories, impacted components — same computation style as
`MetricCards` usage in `DashboardPage.tsx:75-79`, scoped to the filtered set).
Pass the filtered `advisories` (and `cves` filtered to CVEs referenced by
those advisories) into `ExplorerPage`. Page heading = vendor name, or
`{vendor name} · {product family name}` when `productId` is present.

### 7. `src/pages/ExplorerPage.tsx` — reuse-ready

Add optional prop `initialProductFamilyId?: string`. When present, seed the
existing `selectedVendor` filter state (`:20-26`) with it on mount, so the
filter bar opens pre-scoped. Replace the inline substring-matching blocks at
`:34-60` and `:108-134` with calls to `matchesProductFamily` (ExplorerPage
receives **optional** `taxonomy?: VendorNode[]` (default `[]`) as a new prop
to make this possible — thread it through from `App.tsx`/`ProductPage.tsx`,
sourced from the same `useMemo(deriveTaxonomy(advisories))`; optional so any
existing test that renders `ExplorerPage` without it still compiles — when
absent, filtering degrades to "no family match" rather than throwing). Keep
every other filter (search, severity, status, viewMode) unchanged.

### 8. `src/components/explorer/CveFilterBar.tsx` — dynamic product options

Add a new prop `productOptions: { value: string; label: string }[]` (built by
`ExplorerPage` from `taxonomy`, flattened across vendors, deduped by
`familyId`). Render the product `<MenuItem>` list (`:109-115`) from this prop
instead of the 6 hardcoded entries; keep the `"ALL"` sentinel item. Do not
change severity/status option lists.

### 9. `src/pages/DashboardPage.tsx` — global Overview

- `:67` title → `Security Intelligence Overview`; subtitle drops the
  Red-Hat-only phrasing (keep it factual: mentions multi-vendor advisory
  feeds, not just RHSA/Errata).
- Keep `MetricCards` and the "Urgent Vulnerabilities Requiring Attention"
  panel computed across all `advisories` exactly as today — no behavior
  change there.
- Delete `productDistribution` (`:31-56`) entirely.
- Add **optional** props `taxonomy?: VendorNode[]` (default `[]`),
  `onSelectVendor?: (vendorId: string) => void`, `onSelectProduct?:
  (vendorId: string, productId: string) => void` — optional so every existing
  call site that doesn't pass them still compiles and renders (vendor-card
  row and chart-click-navigate simply no-op / render nothing when absent).
  New vendor-card row: one card per `VendorNode` (name, icon,
  `advisoryCount`, `criticalCount`); clicking a card calls `onSelectVendor`.
- Feed `VendorDistributionChart` (`:115`) from the flattened product families
  across all vendors (name → advisoryCount) instead of the deleted bucket map;
  clicking a bar calls `onSelectProduct` with that family's `vendorId`/`id`.
  `VendorDistributionChart`'s own component code does not need to change if
  it already accepts a `{label, value}[]`-shaped input — read it first; if its
  prop shape differs, adapt the data you pass, not the component.

## Files

Exhaustive — touch nothing else:

- `src/services/productTaxonomy.ts` (new)
- `src/pages/ProductPage.tsx` (new)
- `src/services/advisoryService.ts`
- `src/components/common/VendorIcon.tsx`
- `src/components/common/Sidebar.tsx`
- `src/App.tsx`
- `src/pages/ExplorerPage.tsx`
- `src/components/explorer/CveFilterBar.tsx`
- `src/pages/DashboardPage.tsx`

Test files are written by the main session before dispatch (see Test charter)
and are pre-authored/red; builder makes them pass but does not invent new
test files beyond what's listed there.

## Test charter

| Case | Expected outcome | Layer / file |
| --- | --- | --- |
| Fixture strings table (§1) | each maps to stated family | unit — `src/tests/unit/services/productTaxonomy.test.ts` |
| Name normalizes to empty string | falls back to original trimmed input | unit — same |
| `slugify` on names with spaces/punctuation | lowercase, hyphenated, trimmed | unit — same |
| 15 distinct families across advisories, topN=10 | 10 named nodes + 1 `other` node summing the remaining 5 | unit — same |
| Exactly topN families, no overflow | no `other` node emitted | unit — same |
| `matchesProductFamily` for a normal family id | true for member advisory, false for a different family's advisory | unit — same |
| `matchesProductFamily('other', ...)` | true only for advisories whose family is in `memberFamilyIds` | unit — same |
| Two vendor codes present | two `VendorNode`s, each with correct `advisoryCount`/`criticalCount` | unit — same |
| `AdvisoryService.fetchAdvisories()` | returned rows carry `vendor_id` | unit — `src/tests/unit/services/advisoryCentric.test.ts` |
| Sidebar with a taxonomy | vendor group label + product child rows with counts are in the DOM; existing 3 labels (`CVE Explorer`, `Sync Monitor`, `Webhooks & Config`) still present unchanged | unit — `src/tests/unit/components/App.test.tsx` |
| Overview title | no longer contains "Red Hat"; new heading text present | unit — `src/tests/unit/components/App.test.tsx` and/or `advisoryDashboard.test.tsx` |
| Click a product node → ProductPage | renders heading with vendor+product name; advisory list restricted to that family | unit — `src/tests/unit/components/ProductPage.test.tsx` (new) |
| DashboardPage with a taxonomy | one vendor card per `VendorNode`; clicking it calls `onSelectVendor` | unit — `src/tests/unit/components/advisoryDashboard.test.tsx` |

## Non-goals

- No router, no deep links/URL state.
- No `vendors` table, no DB migration, no Settings UI for taxonomy editing.
- No alias map collapsing `RHEL` into `Red Hat Enterprise Linux`.
- No change to ingestion adapters or CSAF parsing.
- No change to `MetricCards` or the "Urgent Vulnerabilities" logic beyond
  already being fed all-vendor data (it already is — no code change needed
  there beyond the title/subtitle in §9).
