# TASK-13 (Phase 1) — Show which vendor API the sync actually talks to

## Why

`SyncMonitorPage` today shows only a log table and claims it covers "all 8 vendors". That is
untrue: `ALL_ADAPTERS` holds one adapter (`RedHatCsafAdapter`, `src/adapters/index.ts:12`) and
`SyncService.syncVendors()` iterates a hardcoded `['redhat']`. The user must be able to see,
from the Sync page, exactly which vendor API is being contacted.

The endpoint URLs are currently written in four places: `listUrl` and `detailUrlBase` (private
members, `src/adapters/redhat-csaf.ts:154-155`) and three more string literals in
`src/services/syncService.ts:248,252,261`. A panel that hardcoded a fifth copy would drift and
lie. The adapter must therefore become the single source of truth, and both the sync path and
the UI must read from it.

## Contract

### 1. `src/types/index.ts` — declare the endpoint descriptor

Add:

```ts
export interface VendorEndpoint {
  /** Short human label, e.g. 'Advisory list'. */
  label: string;
  /** The URL actually requested. Placeholders in braces mark per-request values. */
  url: string;
}
```

Extend `VendorAdapter` with one new required member:

```ts
readonly endpoints: VendorEndpoint[];
```

MUST NOT change the existing `vendorCode`, `vendorName`, `fetchAdvisories`, `parse` members.

### 2. `src/adapters/redhat-csaf.ts` — expose the real endpoints and stop duplicating them

- Make `listUrl` and `detailUrlBase` readable by the rest of the app (drop `private`; keep
  `readonly`).
- Add two public helpers used for every per-item request:
  - `advisoryDetailUrl(advisoryId: string): string` -> `${detailUrlBase}/${advisoryId}.json`
  - `cveLookupUrl(cveId: string): string` -> `${listUrl}?cve=${cveId}`
- Add `readonly endpoints: VendorEndpoint[]` with exactly three entries, built from the fields
  above (NOT re-typed literals):
  | label | url |
  | `Advisory list (CSAF)` | `${listUrl}?per_page=50` |
  | `Advisory detail (CSAF)` | `${detailUrlBase}/{advisoryId}.json` |
  | `CVE reverse lookup` | `${listUrl}?cve={cveId}` |
- Rewrite the two existing `fetch` calls (lines ~158 and ~170) to use the same fields/helpers,
  so no literal URL string remains anywhere else in the file.

MUST NOT change parse(), the collapse helpers, or the BUG-003 container-image normalisation.

### 3. `src/services/syncService.ts` — read URLs from the adapter, and publish the sync scope

- Replace the three hardcoded `https://access.redhat.com/...` literals in
  `fetchAndIngestQuery` with calls to the Red Hat adapter's `advisoryDetailUrl()` and
  `cveLookupUrl()`, obtained via `getAdapterByCode('redhat')`. Behaviour and request shapes
  must stay byte-identical.
- Export the sync scope so the UI can state it truthfully rather than guessing:
  `export const SYNCED_VENDOR_CODES = ['redhat'] as const;`
  and make `syncVendors()` iterate that constant instead of its inline array literal.

MUST NOT change the BUG-003 chunking, the persist contract, `fetchSyncLogs`, or the
`{ success, newLogs }` return shape.

### 4. `src/services/vendorService.ts` — NEW

```ts
export class VendorService {
  async fetchVendors(): Promise<Vendor[]>
}
```

Reads `vendors` (`select('*')`, ordered by `name`). Read-only: the browser key has SELECT only
on this table (write policy dropped in migration 20260816000000). On error, log a warning and
return `[]`, matching how the other services degrade.

### 5. `src/components/sync/FeedSourceTable.tsx` — NEW

Props:

```ts
{ vendors: Vendor[]; logs: VendorSyncLog[] }
```

One row per vendor, ordered as given. Columns, with these exact header strings:

| Header | Content |
| `Vendor` | vendor `name`, with `code` beneath it |
| `Integration` | status chip, rules below |
| `API endpoint` | for a vendor WITH an adapter, every `endpoint.label` and `endpoint.url` from that adapter, one per line; otherwise the single text `No adapter implemented` |
| `Last sync` | from the newest `logs` entry whose `vendor_code` matches: its `status` and `started_at`; `Never` when there is none |
| `Detail` | that same log's `error_message` when present, otherwise `—` |

Integration chip rules, derived at render time — never hardcoded per vendor:

- adapter found via `getAdapterByCode(vendor.code)` AND `vendor.code` in `SYNCED_VENDOR_CODES`
  -> label `Connected`, colour success
- adapter found but code NOT in `SYNCED_VENDOR_CODES` -> label `Adapter idle`, colour warning
- no adapter -> label `Not implemented`, colour default

When `vendors` is empty, render a single full-width row with the text
`No vendor records loaded.` instead of an empty table body. `VendorService.fetchVendors()`
returns `[]` both while loading and on query failure, and a page whose purpose is to state the
truth must not answer that state with silent blankness.

### 6. `src/pages/SyncMonitorPage.tsx` — mount the panel and stop overstating coverage

- Props gain `vendors: Vendor[]`. Existing props unchanged.
- The subtitle string `Real-time execution status, disclosure counts, and duration history for all 8 vendors.`
  is false and MUST be replaced with:
  `Live feed sources, connection status, and execution history.`
- Render, in order: the existing header/button row, a section titled `Feed Sources` containing
  `<FeedSourceTable vendors={vendors} logs={logs} />`, then a section titled `Execution History`
  containing the existing `<SyncLogTable logs={logs} />`.

### 7. `src/App.tsx` — load and pass vendors

- Add a `vendors` state array, loaded via `VendorService`.
- Load it INDEPENDENTLY of the blocking `loadData` `Promise.all`, and keep the `isLoading` gate
  depending only on the original four loads (cves, sync logs, webhooks, advisories).
  Rationale (decided during implementation, supersedes the original draft of this section):
  when the vendors query sat inside the blocking `Promise.all`, a slow or failing vendors
  request delayed `setIsLoading(false)` and prevented the whole dashboard from rendering.
  Six tests failed on it. A vendor list is supporting detail for one panel; it must never gate
  the rest of the app.
- Pass `vendors={vendors}` to `SyncMonitorPage`.
- Refresh vendors nowhere else; a manual sync does not change the vendor list.

MUST NOT change nav structure, the BUG-003 error-message handling, or any other page's props.

## Files

- `src/types/index.ts`
- `src/adapters/redhat-csaf.ts`
- `src/adapters/redhat.ts` (legacy adapter; also `implements VendorAdapter`, so it needs its own `endpoints` once the member is required)
- `src/services/syncService.ts`
- `src/services/vendorService.ts` (new)
- `src/components/sync/FeedSourceTable.tsx` (new)
- `src/pages/SyncMonitorPage.tsx`
- `src/App.tsx`

Nothing else. Tests and specs are written by the main session and are off limits.

## Test charter

| Case | Expected outcome | Layer / file |
| --- | --- | --- |
| RedHatCsafAdapter.endpoints | 3 entries; every url starts with `https://access.redhat.com/hydra/rest/securitydata/csaf` | unit / `tests/unit/adapters/adapterEndpoints.test.ts` |
| `advisoryDetailUrl('RHSA-2026:1')` | equals `https://access.redhat.com/hydra/rest/securitydata/csaf/RHSA-2026:1.json` | same |
| `cveLookupUrl('CVE-2026-1')` | equals `https://access.redhat.com/hydra/rest/securitydata/csaf.json?cve=CVE-2026-1` | same |
| endpoints are derived, not re-typed | every `endpoints[].url` starts with the adapter's own `listUrl` or `detailUrlBase` | same |
| `fetchAndIngestQuery('CVE-2026-1')` | the URL it fetches equals `cveLookupUrl('CVE-2026-1')` | unit / `tests/unit/services/syncServiceAdapterUrls.test.ts` |
| Red Hat row | chip `Connected`; shows all three endpoint URLs | unit / `tests/unit/components/feedSourceTable.test.tsx` |
| A seeded vendor with no adapter (e.g. `vmware`) | chip `Not implemented`; text `No adapter implemented`; no URL rendered | same |
| Vendor with a matching FAILED log | shows `FAILED` and the log's `error_message` | same |
| Vendor with no log at all | shows `Never` and `—` | same |
| SyncMonitorPage | renders `Feed Sources` and `Execution History`; no longer contains the string `all 8 vendors` | same |
| `vendors` empty | renders one row with `No vendor records loaded.` | same |

## Verify

```
npm --prefix src test
npm --prefix src run build
```

Not done until both pass with zero failures.

## Non-goals

- No schema migration and no schedule editing — that is Phase 2 of this task.
- Do NOT add adapters for the other seven seeded vendors.
- Do NOT add a live connectivity probe button.
- Do NOT change `SYNCED_VENDOR_CODES` to include vendors that have no adapter.
