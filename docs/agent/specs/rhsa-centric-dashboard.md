# Spec: RHSA-centric Dashboard (Phase C3a)

## Task

The data layer now exposes advisories as first-class records
(`AdvisoryService.fetchAdvisories()` → `AdvisoryRowItem[]`, where each advisory
carries **every CVE it fixes**). The Dashboard, however, is still CVE-first:
`DashboardPage` takes `cves: CveTableRowItem[]`, renders a `CveTable`, and its
metric cards count CVE records — even though the page title already claims to
be a Red Hat Security Advisory feed.

Make the Dashboard organised around RHSA advisories. CVE data stays available
for the CVE-lookup entry point (handled elsewhere); this task changes the
Dashboard's primary axis to advisories and adds the advisory table component
the Explorer will later reuse.

## Contract

### 1. New `src/components/explorer/AdvisoryTable.tsx`

An advisory-row table, mirroring the visual language of the existing
`src/components/explorer/CveTable.tsx` (read it first — same MUI
`TableContainer`/`Paper` styling, same empty-state pattern, same
`SeverityBadge` and `formatDate` usage, same hover/cursor row behaviour and
trailing `ChevronRight` action cell).

```ts
interface AdvisoryTableProps {
  items: AdvisoryRowItem[];
  onSelectRow: (item: AdvisoryRowItem) => void;
}
```

Columns, in order:
1. **Red Hat Errata (RHSA)** — `item.advisory_id`, monospace, `primary.main`,
   bold (match `CveTable`'s advisory cell styling).
2. **修補的 CVE (Fixed CVEs)** — render each `item.cves[].cve_id`. Show the
   first two ids as text; if there are more, follow them with a `Chip` labelled
   `+N`. Every rendered id must appear in the DOM as its own text node so it is
   individually findable. Below them, a caption reading `共 N 個 CVE`.
3. **嚴重等級** — `<SeverityBadge severity={item.severity} />`.
4. **公告主旨 (Synopsis)** — `item.title` (noWrap), with a caption underneath
   reading `共涉及 N 個元件` from `item.product_impacts.length` when > 0.
5. **受影響產品** — `item.affected_products[0]`, plus `+N 產品` when there is
   more than one; wrap in a `Tooltip` showing the joined list (same pattern as
   `CveTable`'s products cell). Render `-` when the list is empty.
6. **發布日期** — `formatDate(item.published_at, 'yyyy-MM-dd')`.
7. Trailing action cell with `ChevronRight`.

Clicking a row calls `onSelectRow(item)`.

Empty state (`items.length === 0`): reuse `CveTable`'s exact empty-state
markup and copy — the heading text must still contain `無符合條件` so shared
assertions keep working.

### 2. `src/components/dashboard/MetricCards.tsx` — optional label overrides

The card titles are currently hardcoded (`'Critical CVEs'`, `'High Severity'`,
`'Impacted Components'`, and the fourth card's title). Add an **optional**
`labels` prop so callers can relabel without changing behaviour:

```ts
labels?: {
  critical?: string;
  high?: string;
  components?: string;
  total?: string;
};
```

Each card title becomes `labels?.<key> ?? '<the current hardcoded string>'`.
**The defaults must be byte-identical to today's strings** — an existing test
asserts `'Critical CVEs'`, `'High Severity'`, and `'Impacted Components'` are
rendered when no labels are passed. Change nothing else in this file: the
prop names `totalCves`/`criticalCount`/`highCount`/`totalImpactedComponents`,
the icons, subtexts, colours, and layout all stay as they are.

### 3. `src/pages/DashboardPage.tsx` — advisory-first

New props (replacing the current three):

```ts
interface DashboardPageProps {
  advisories: AdvisoryRowItem[];
  cves: CveTableRowItem[];
  onSelectAdvisory: (item: AdvisoryRowItem) => void;
  onSelectCve: (item: CveTableRowItem) => void;
  onNavigateToExplorer: () => void;
}
```

Rendering:

- **Metrics** — `<MetricCards>` driven by advisories:
  - `criticalCount` = advisories with `severity === 'CRITICAL'`
  - `highCount` = advisories with `severity === 'HIGH'`
  - `totalImpactedComponents` = sum of `advisory.product_impacts.length`
  - `totalCves` = `advisories.length`
  - `labels` = `{ critical: 'Critical RHSA', high: 'High Severity',
    components: 'Impacted Components', total: 'Tracked Advisories' }`
- **Urgent list** — replace the `CveTable` with `<AdvisoryTable>` fed by
  advisories whose `severity` is `CRITICAL` or `HIGH`, capped at the first 5
  (same `.slice(0, 5)` as today), wired to `onSelectAdvisory`. Advisories of
  any other severity must not appear in this list.
- **Product distribution** — keep `<VendorDistributionChart>` with the same
  five product-family buckets and the same substring-matching rules, but
  compute the counts from **advisories** instead of CVEs: for each advisory,
  match against `advisory.affected_products.join(' ').toLowerCase()` using the
  identical keyword conditions already in the file. Pass
  `total={advisories.length}`.
- Keep the page heading, subheading, layout, spacing, and the
  "View All Errata Explorer" button (still calling `onNavigateToExplorer`)
  exactly as they are.

The `cves` and `onSelectCve` props are accepted and kept in the interface for
the CVE-lookup work that follows, but this task does not have to render them.
Do not delete them.

### 4. `src/App.tsx` — load and route advisories

- Import `AdvisoryService` and `AdvisoryRowItem`; create it with `useMemo`
  alongside the existing services.
- Add `advisories` state (`AdvisoryRowItem[]`) and a
  `selectedAdvisory` state (`AdvisoryRowItem | null`).
- In `loadData()`, fetch advisories in the same `Promise.all` as the existing
  calls and store the result.
- In `handleManualSync()`'s post-sync refresh, refetch advisories too so the
  Dashboard updates after a sync.
- Pass `advisories`, `cves`, `onSelectAdvisory={setSelectedAdvisory}`,
  `onSelectCve={setSelectedCve}`, and the existing `onNavigateToExplorer` to
  `<DashboardPage>`.
- The empty-state Alert currently shown when `cves.length === 0` on the
  dashboard tab should instead trigger when **both** `cves.length === 0` and
  `advisories.length === 0`. Keep its copy and its sync button unchanged.
- `selectedAdvisory` is stored but nothing consumes it yet — the advisory
  detail drawer is the next task. Do **not** build a drawer here, and do not
  wire `selectedAdvisory` into the existing `CveDetailDrawer` (their item
  shapes differ). Leaving it set-but-unread is intentional.

## Files
- `src/components/explorer/AdvisoryTable.tsx` (new)
- `src/components/dashboard/MetricCards.tsx`
- `src/pages/DashboardPage.tsx`
- `src/App.tsx`

Do not touch: `src/services/*`, `src/adapters/*`, `src/engine/*`,
`src/types/index.ts`, `src/components/explorer/CveTable.tsx`,
`src/components/explorer/CveDetailDrawer.tsx`, `src/pages/ExplorerPage.tsx`,
`src/supabase/**`, and any existing test file.

## Verify
From `/root/dev/vuln-beacon/src`:
1. `npm run test:unit -- advisoryDashboard` — must pass.
2. `npm test` — full suite must pass (64 tests were green before this task's
   new test file was added).
3. `npm run build` — must succeed.

Report the exact output of all three.

If an existing test fails, **do not edit it** (you are blocked from editing
tests) — stop and report the test name, its assertion, and observed vs
expected so the main session can adjudicate.

## Non-goals
- No advisory detail drawer (next task).
- No changes to `ExplorerPage` or its view-mode toggle (next task).
- No pagination, no caching, no new dependencies.
- Do not change `VendorDistributionChart`'s implementation — only what is
  passed into it.

## Test charter
| Case | Expected outcome | Layer / file |
| --- | --- | --- |
| `AdvisoryTable` renders one row per advisory with its RHSA id and fixed CVE ids | ids present in DOM | unit / `advisoryDashboard.test.tsx` |
| Clicking an advisory row calls `onSelectRow` with that advisory | called with the item | unit / `advisoryDashboard.test.tsx` |
| `AdvisoryTable` empty state renders | text contains `無符合條件` | unit / `advisoryDashboard.test.tsx` |
| Dashboard shows advisory-oriented metric labels | `Critical RHSA`, `Tracked Advisories` rendered | unit / `advisoryDashboard.test.tsx` |
| Dashboard urgent list includes CRITICAL/HIGH advisories and excludes others | LOW advisory absent | unit / `advisoryDashboard.test.tsx` |
| Clicking a dashboard advisory row bubbles up via `onSelectAdvisory` | called with the item | unit / `advisoryDashboard.test.tsx` |
