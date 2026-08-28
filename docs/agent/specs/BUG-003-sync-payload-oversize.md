# BUG-003 — Sync fails because `persist_ingestion` sends an oversized payload

## Problem (measured, not inferred)

A full Red Hat sync builds a single `supabase.functions.invoke('sync-cve')` request body
of **43.6 MB**. The self-hosted Edge Runtime supervisor kills the worker and returns
HTTP 500 `{"msg":"WorkerRequestCancelled: request has been cancelled by supervisor"}`.
`SyncService.syncVendors()` catches this, sets `allSucceeded = false`, and `src/App.tsx:81`
renders "Sync failed: one or more vendor feeds could not be ingested."

Size breakdown of one live run (49 advisories, 285 CVEs, 627 mappings):

| Part | Size |
| --- | ---: |
| `advisories` | 0.05 MB |
| `cves` | 0.20 MB |
| `mappings` | **41.39 MB** |

Two independent causes inside `mappings`:

1. **Container image references are never collapsed.** Of 132,982 emitted
   `product_impacts` rows, **131,206 (99.1% of bytes)** look like
   `registry.redhat.io/openshift4/ose-hypershift-rhel9@sha256:<64 hex>_arm64`.
   `componentFromNvr()` (`src/adapters/redhat-csaf.ts:136`) only cuts at `-<digits>:`,
   so every image digest and every architecture stays a distinct component and the
   existing `seenKeys` dedupe at line 263 never fires.
2. **`product_impacts` is advisory-level data stored per `advisory_cve_map` row.**
   An RHSA with 25 CVEs ships 25 identical copies. Not fixed here — see Non-goals.

Measured effect of cause 1 alone: 41.4 MB -> 9.2 MB. Still too large to rely on, so
this spec ALSO bounds the request size by chunking.

## Contract

### 1. `src/adapters/redhat-csaf.ts` — collapse container image references

Add a normalisation step inside `componentFromNvr()` (or a helper it calls), applied
BEFORE the existing `-<digits>:` NVR cut:

- Input containing `@sha256:` -> return the repository path only, i.e. everything before
  `@sha256:`. Example:
  `registry.redhat.io/openshift4/ose-hypershift-rhel9@sha256:24d0...f6_arm64`
  -> `registry.redhat.io/openshift4/ose-hypershift-rhel9`
- The match must be case-insensitive on the `sha256` label and must not require the
  digest to be exactly 64 chars (upstream sometimes appends `_<arch>`).
- Inputs with no `@sha256:` keep today's behaviour byte-for-byte.

Because the component string collapses, the existing
`seenKeys` guard (`${productName}|${component}|${state}`) removes the per-architecture
and per-digest duplicates with no further change.

MUST NOT change: `collapseLocalePackages`, the `-debuginfo`/`-debugsource` skip, the
first-colon composite-id split, severity fallback, or `rawPayload` contents.

### 2. `src/services/syncService.ts` — bound the request size

Rewrite the persist step of `syncVendors()` so no single `functions.invoke` body can grow
with the feed:

- Split the work into **chunks of advisories**. Each chunk carries: its own advisories,
  the CVEs those advisories map to, and the mappings for those advisories.
- A chunk is closed when adding the next advisory would push the serialised chunk body
  over `PERSIST_CHUNK_MAX_BYTES = 3_000_000` (3 MB). A single advisory that alone exceeds
  the budget is still sent as its own chunk (never dropped, never split).
- Data chunks are sent with **no `syncMeta`** field.
- After all data chunks succeed, send ONE final call with empty `advisories`/`cves`/
  `mappings` and a `syncMeta` carrying the run totals, so exactly one
  `vendor_sync_logs` row is written per vendor per run.
- `syncMeta` gains two new fields: `itemsFetched` (total advisories in the run) and
  `newItemsCount` (total CVEs in the run).
- If any chunk returns an error, abort remaining chunks and fall through to the existing
  error path, which logs `status: 'FAILED'` with the real error message.
- The error path keeps sending exactly one call with `syncMeta` and empty arrays.

MUST NOT change: `fetchSyncLogs`, `fetchAndIngestQuery`, the known-CVE dedupe block, the
`vendorCodes = ['redhat']` list, or the `{ success, newLogs }` return shape.

### 3. `src/supabase/functions/sync-cve/index.ts` — make `syncMeta` optional

- When `syncMeta` is absent or null: persist advisories/CVEs/mappings exactly as today,
  write NO `vendor_sync_logs` row, and return `{ success: true, log: null }` with HTTP 200.
- When `syncMeta` is present: behave as today, except
  `items_fetched` = `syncMeta.itemsFetched ?? (advisories || []).length` and
  `new_items_count` = `syncMeta.newItemsCount ?? (cves || []).length`.
- Unknown `action` and unknown `vendorCode` still return HTTP 400. Errors still return 500.

### 4. `src/App.tsx` — surface the real failure reason

The generic string hides the cause. When `syncVendors()` reports `success === false`,
prefer the `error_message` of the first returned log whose `status === 'FAILED'`:

- With such a log: `Sync failed: <error_message>`
- With no log, or a null/empty `error_message`: keep today's exact string
  `Sync failed: one or more vendor feeds could not be ingested.`

MUST NOT change any other snackbar/alert copy or the nav structure.

## Files

- `src/adapters/redhat-csaf.ts`
- `src/services/syncService.ts`
- `src/supabase/functions/sync-cve/index.ts`
- `src/App.tsx`

Nothing else. Tests and specs are written by the main session and are off limits.

## Test charter

| Case | Expected outcome | Layer / file |
| --- | --- | --- |
| Component `repo/img@sha256:<hex>_arm64` | collapses to `repo/img` | unit / `tests/unit/adapters/redhatCsafContainerCollapse.test.ts` |
| Same image, 3 architectures, one product+state | yields exactly 1 impact row | same |
| Same image, 2 distinct digests, one product+state | yields exactly 1 impact row | same |
| Plain NVR `glibc-0:2.28-225.el8_8.6.x86_64` | still collapses to `glibc` (no regression) | same |
| Component with no `@sha256:` and no `-N:` | returned unchanged | same |
| Run whose advisories exceed the byte budget | more than one data invoke, each body <= 3 MB + one final invoke | unit / `tests/unit/services/syncServiceChunking.test.ts` |
| Data chunk invokes | carry no `syncMeta` | same |
| Final invoke | carries `syncMeta` with run totals and empty data arrays | same |
| Whole run | writes exactly one `vendor_sync_logs` row (one invoke with `syncMeta`) | same |
| A middle chunk returns an error | remaining chunks skipped; one FAILED log call with the real message; `success === false` | same |
| Small run under the budget | exactly one data invoke plus the final log invoke | same |
| `success === false` with a FAILED log carrying `error_message` | alert text contains that message | unit / `tests/unit/components/appSyncError.test.tsx` |
| `success === false` with no FAILED log | alert keeps the original generic string | same |

## Verify

```
npm --prefix src test
npm --prefix src run build
```

Not done until both pass with zero failures.

## Non-goals

- Do NOT move `product_impacts` from `advisory_cve_map` to `advisories`. That is the
  deeper de-duplication fix (would cut the payload to 0.13 MB) but changes the schema and
  every read path. Record it as a follow-up risk instead.
- Do NOT add adapters for the other seven seeded vendors.
- Do NOT change `vendorCodes = ['redhat']`.
- Do NOT touch the new Feeds & Sync tab work; that is a separate task.
