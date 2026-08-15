# Spec: Advisory detail drawer + real advisory grouping in Explorer (Phase C3b)

## Task

Two remaining gaps in the RHSA-centric rework:

1. **No advisory detail view.** `AdvisoryTable` rows (Dashboard, and shortly
   Explorer) have nowhere to open. `App.tsx` already holds a `selectedAdvisory`
   state that is deliberately unread (with a `void selectedAdvisory;` line to
   satisfy `noUnusedLocals`) waiting for this drawer.
2. **Explorer's advisory view is fake.** `ExplorerPage` has a
   `viewMode: 'advisory' | 'cve'` toggle, but both modes render the same
   `CveTable` over the same CVE array — the advisory mode only swaps column
   *labels*. One row is still one CVE, so a single RHSA fixing five CVEs shows
   as five rows.

Additionally, the CVE detail drawer's "multiple RHSA" chips (already present at
roughly `CveDetailDrawer.tsx:303-323`, rendered when `all_advisories` has more
than one entry) now receive real data from the data-layer fix, so **no change
is needed there** — do not touch that file.

## Contract

### 1. New `src/components/explorer/AdvisoryDetailDrawer.tsx`

A right-side MUI `Drawer` for one `AdvisoryRowItem`. Read
`src/components/explorer/CveDetailDrawer.tsx` first and mirror its visual
language: same `Drawer` anchor/width/padding, same section heading style, same
`SeverityBadge`, `formatDate`, copy-to-clipboard affordance, and the same
`X`/close-button treatment in the header.

```ts
interface AdvisoryDetailDrawerProps {
  open: boolean;
  item: AdvisoryRowItem | null;
  onClose: () => void;
}
```

When `item` is null, render nothing (`return null`) — a test asserts the
container is empty. **Important:** `CveDetailDrawer` currently calls
`if (!item) return null;` *before* its `useState`/`useMemo` hooks, which
violates the rules of hooks. Do **not** copy that pattern — declare all hooks
first, then return `null` after them.

Sections, in order:

1. **Header** — `item.advisory_id` (monospace, prominent),
   `<SeverityBadge severity={item.severity} />`, published date via
   `formatDate(item.published_at, 'yyyy-MM-dd')`, a close button, and an
   external link to `item.url` (labelled as the Red Hat Errata page) when
   `item.url` is set.
2. **影響內容 (Impact)** — `item.title` as the synopsis, and `item.summary`
   underneath when present.
3. **修補的 CVE 弱點 (Fixed CVEs)** — a list of **every** entry in `item.cves`.
   For each: the `cve_id` rendered as its own text node (tests query them
   individually), a `SeverityBadge` using that CVE's `severity` and
   `cvss_v3_score`, a `Flame`/KEV chip when `is_known_exploited` is true, and
   the CVE's `description` as body text. Above the list, a caption reading
   `共 N 個 CVE`. This section is the point of the whole feature — it must not
   be collapsed or truncated.
4. **受影響產品與元件 (Affected products & components)** — a table over
   `item.product_impacts` with columns `Products / services`, `Components`,
   `State`, `Errata`, mirroring the impact table in `CveDetailDrawer`
   (~lines 406-469), including its state badge colouring. A plain table is
   enough here — the search box and the 4-way state toggle from
   `CveDetailDrawer` are **not** required.
5. **修正方式 (Solution)** — `item.solution` as text, then a copyable
   `dnf upgrade <component>` command block built from
   `item.product_impacts[0]?.component` (mirror `CveDetailDrawer` ~lines
   472-504), and the errata link.

### 2. `src/pages/ExplorerPage.tsx` — advisory mode renders advisories

New props (added to the existing ones — keep `cves`, `onSelectCve`,
`onRefreshCves` exactly as they are):

```ts
advisories: AdvisoryRowItem[];
onSelectAdvisory: (item: AdvisoryRowItem) => void;
```

Add a `filteredAdvisories` `useMemo` alongside the existing `filteredCves`,
applying the same three filters to advisories:

- **Product family** (`selectedProductFamily`) — reuse the identical keyword
  rules already in the file, matching against
  `advisory.affected_products` and against
  `advisory.product_impacts[].component + ' ' + product_name`.
- **Severity** (`selectedSeverity`) — compare with `advisory.severity`.
- **Component state** (`selectedStatus`) — same normalised
  `state.toLowerCase().replace(/[\s_-]/g, '')` containment check over
  `advisory.product_impacts`.
- **Search** (`searchTerm`) — match against `advisory.advisory_id`,
  `advisory.title`, `advisory.summary`, **every `advisory.cves[].cve_id` and
  `.description`**, every `affected_products` entry, and every
  `product_impacts[]` `component` / `product_name` / `errata`. Searching a CVE
  id must therefore surface the RHSA that fixes it.

Rendering: when `viewMode === 'advisory'` render
`<AdvisoryTable items={filteredAdvisories} onSelectRow={onSelectAdvisory} />`;
when `viewMode === 'cve'` render the existing
`<CveTable items={filteredCves} onSelectRow={onSelectCve} viewMode={viewMode} />`
unchanged.

The "本地資料庫尚未收錄 / 向 Red Hat 官方即時抓取" Alert currently keys off
`filteredCves.length === 0 && searchTerm.trim() !== ''`. Change the emptiness
check to the list actually being displayed in the current `viewMode`
(`filteredAdvisories` in advisory mode, `filteredCves` in cve mode). Keep its
copy, its button, and `handleFetchDirectly` unchanged.

Keep the page heading, `CveFilterBar` wiring, and `handleReset` as they are.

### 3. `src/App.tsx` — wire the drawer

- Remove the `void selectedAdvisory;` placeholder line.
- Render `<AdvisoryDetailDrawer open={Boolean(selectedAdvisory)}
  item={selectedAdvisory} onClose={() => setSelectedAdvisory(null)} />`
  next to the existing `<CveDetailDrawer>`.
- Pass `advisories={advisories}` and `onSelectAdvisory={setSelectedAdvisory}`
  to `<ExplorerPage>` in addition to its current props.

## Files
- `src/components/explorer/AdvisoryDetailDrawer.tsx` (new)
- `src/pages/ExplorerPage.tsx`
- `src/App.tsx`

Do not touch: `src/components/explorer/CveDetailDrawer.tsx`,
`src/components/explorer/CveTable.tsx`,
`src/components/explorer/AdvisoryTable.tsx`,
`src/components/explorer/CveFilterBar.tsx`, `src/services/*`, `src/adapters/*`,
`src/engine/*`, `src/types/index.ts`, `src/supabase/**`, `src/pages/DashboardPage.tsx`,
and any existing test file.

## Verify
From `/root/dev/vuln-beacon/src`:
1. `npm run test:unit -- advisoryDetail` — must pass.
2. `npm test` — full suite must pass (69 tests were green before this task's
   new test file was added).
3. `npm run build` — must succeed.

Report the exact output of all three.

If an existing test fails, **do not edit it** (you are blocked from editing
tests) — stop and report the test name, its assertion, and observed vs expected.

## Non-goals
- Do not touch `CveDetailDrawer` — its multi-RHSA chips already work now that
  `all_advisories` is populated from real mappings.
- Do not add pagination, virtualisation, caching, or new dependencies.
- Do not change `CveFilterBar`'s markup (the search placeholder text is
  asserted by a test).
- Do not refactor the existing `filteredCves` logic — add alongside it.

## Test charter
| Case | Expected outcome | Layer / file |
| --- | --- | --- |
| Advisory drawer lists every fixed CVE with severity and description | both CVE ids and a description present | unit / `advisoryDetail.test.tsx` |
| Advisory drawer shows the products/components matrix | product name and component rendered | unit / `advisoryDetail.test.tsx` |
| Advisory drawer shows the remediation text | solution text rendered | unit / `advisoryDetail.test.tsx` |
| Advisory drawer renders nothing with a null item | container empty | unit / `advisoryDetail.test.tsx` |
| Explorer advisory view renders advisory rows | both RHSA ids present | unit / `advisoryDetail.test.tsx` |
| Searching a CVE id surfaces the RHSA that fixes it, and filters the others out | matching RHSA present, other absent | unit / `advisoryDetail.test.tsx` |
| Clicking an advisory row calls `onSelectAdvisory` | called with that advisory | unit / `advisoryDetail.test.tsx` |
