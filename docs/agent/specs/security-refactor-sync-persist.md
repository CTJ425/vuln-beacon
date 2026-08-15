# Spec: Move Supabase writes for vendor sync behind an Edge Function (service role)

## Task
Currently `src/services/syncService.ts` writes directly to Supabase tables
(`vendors` read, `advisories`, `cves`, `advisory_cve_map`, `vendor_sync_logs`)
from the browser using the public anon/publishable key. Combined with RLS
policies that allow `FOR ALL USING (true) WITH CHECK (true)`, anyone holding
the (publicly embedded) anon key can write/delete arbitrary rows in these
tables directly via the Supabase REST API.

Move all **persistence** (the upsert/insert calls) for vendor sync into the
existing (currently stub) Edge Function `src/supabase/functions/sync-cve/index.ts`,
which runs with the service-role key server-side. The browser keeps doing the
**fetch + normalize** step (calling the Red Hat public API and
`IngestionEngine`, which is read-only against third parties, not a Supabase
write) but must call the Edge Function to persist results instead of writing
to `advisories` / `cves` / `advisory_cve_map` / `vendor_sync_logs` directly.

This is a **behavior-preserving refactor**: the resulting rows written to
Supabase must be identical in shape/content to what the current code writes
today. Do not change the ingestion algorithm, the conflict-resolution
(`onConflict`) keys, or the `affected_products` / `fixed_versions` field
mapping — only relocate where the writes execute.

## Contract

### Edge Function: `src/supabase/functions/sync-cve/index.ts`

Replace the current stub body entirely. New behavior:

Request: `POST`, JSON body:
```jsonc
{
  "action": "persist_ingestion",
  "vendorCode": "redhat",
  "advisories": [ /* Advisory[] from src/types, EXCEPT .id is a client-local
                     correlation string like "adv-redhat:RHSA-2026:1234",
                     not a real DB id */ ],
  "cves": [ /* CveRecord[] from src/types, .id is a client-local correlation
               string like "cve-CVE-2026-1234", not a real DB id */ ],
  "mappings": [ /* AdvisoryCveMap[] from src/types — .advisory_id and .cve_id
                   here are the client-local correlation strings above, used
                   to join advisories[]/cves[] to mappings[], NOT real DB ids */ ],
  "syncMeta": {
    "startedAt": "2026-08-15T23:50:00.000Z",
    "durationMs": 1234,
    "status": "SUCCESS", // or "PARTIAL_SUCCESS" | "FAILED"
    "errorMessage": null // string | null, optional
  }
}
```

Server-side algorithm (must match `syncService.ts`'s current `syncVendors()`
persistence loop at lines ~46-129, and `fetchAndIngestQuery()`'s persistence
loop at lines ~222-281, in the version of the file before this change — read
both before writing the function):

1. Create a Supabase client with `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
   env vars (already how the stub does it — keep that part).
2. Look up `vendors` row by `code = vendorCode`. If not found, respond
   `{ success: false, error: "Unknown vendor code: <code>" }` with HTTP 400.
3. For each entry in `cves`: `upsert` into `public.cves` with columns
   `cve_id, description, cvss_v3_score, cvss_v3_vector, severity,
   is_known_exploited, published_date`, `onConflict: 'cve_id'`, `.select('id').single()`.
   Build a `Map<localCveId, realCveDbId>` from `cve.id` (the client-local
   correlation string) → the returned real DB id.
4. For each entry in `advisories`: `upsert` into `public.advisories` with
   columns `vendor_id` (the real vendor DB id from step 2), `advisory_id,
   title, severity, published_at, url, summary, raw_payload` (default `{}`
   if absent), `onConflict: 'vendor_id, advisory_id'`, `.select('id').single()`.
   For each mapping in `mappings` where `mapping.advisory_id === advisory.id`
   (the client-local correlation string): look up the real cve DB id via the
   Map built in step 3 using `mapping.cve_id`; if not found, skip that
   mapping. Otherwise `upsert` into `public.advisory_cve_map` with
   `advisory_id` = the real advisory DB id just obtained, `cve_id` = the real
   cve DB id, `affected_products` = `mapping.product_impacts?.length ?
   mapping.product_impacts : mapping.affected_products`, `fixed_versions` =
   `mapping.fixed_versions`, `onConflict: 'advisory_id, cve_id'`.
5. Insert one row into `public.vendor_sync_logs`: `vendor_id` (real vendor DB
   id), `vendor_code` = `vendorCode`, `status` = `syncMeta.status`,
   `items_fetched` = `advisories.length`, `new_items_count` = `cves.length`,
   `duration_ms` = `syncMeta.durationMs`, `started_at` = `syncMeta.startedAt`,
   `finished_at` = `new Date().toISOString()`, `error_message` =
   `syncMeta.errorMessage ?? null`. `.select().single()`.
6. Respond `{ success: true, log: <the inserted vendor_sync_logs row> }` with
   HTTP 200. On any thrown error at any step, respond
   `{ success: false, error: <message> }` with HTTP 500 (same pattern the
   stub already uses in its catch block).
7. Keep the existing CORS header handling and `OPTIONS` short-circuit exactly
   as in the current stub.

Do not implement any other `action` value — if `action` is missing or not
`"persist_ingestion"`, respond HTTP 400 `{ success: false, error: "Unsupported action" }`.

### Frontend: `src/services/syncService.ts`

`syncVendors()`:
- Keep calling `engine.ingestVendor(code)` exactly as now (fetch + normalize
  stays client-side).
- Remove the direct `supabase.from('vendors').select(...)` lookup and the
  direct `supabase.from('advisories').upsert(...)` /
  `supabase.from('cves').upsert(...)` / `supabase.from('advisory_cve_map').upsert(...)`
  / `supabase.from('vendor_sync_logs').insert(...)` calls.
- Instead, after `engine.ingestVendor(code)` resolves, call:
  ```ts
  const { data, error } = await supabase.functions.invoke('sync-cve', {
    body: {
      action: 'persist_ingestion',
      vendorCode: code,
      advisories: engine.getAdvisories().filter((a) => a.vendor_id === code),
      cves: engine.getCves(),
      mappings: engine.getMappings(),
      syncMeta: {
        startedAt: new Date(startTime).toISOString(),
        durationMs: duration,
        status: result.status,
        errorMessage: result.errorMessage ?? null,
      },
    },
  });
  ```
  If `error` is truthy, throw it (existing catch block in the surrounding
  `for` loop already handles thrown errors by logging a `FAILED` sync log —
  but that `FAILED` log write must ALSO go through the same edge function
  call, not a direct insert; on invoke failure, call the edge function again
  with `syncMeta.status = 'FAILED'` and an empty `advisories`/`cves`/`mappings`
  — OR simply catch and rethrow so the outer catch in the existing code
  can call the edge function with status FAILED. Pick the simpler of the two;
  do not leave a code path that writes to `vendor_sync_logs` directly.)
- On success, push `data.log` (cast to `VendorSyncLog`) into `newLogs` in
  place of the current `logRow`-based push.

`fetchAndIngestQuery(query)`:
- Keep the Red Hat public API fetches and `engine.ingestVendor('redhat', [detail])`
  exactly as now.
- Replace the direct `supabase.from('vendors')` lookup +
  `supabase.from('advisories').upsert` / `supabase.from('cves').upsert` /
  `supabase.from('advisory_cve_map').upsert` loop with a single call to the
  same edge function (`action: 'persist_ingestion'`, `vendorCode: 'redhat'`,
  `advisories: engine.getAdvisories()`, `cves: engine.getCves()`,
  `mappings: engine.getMappings()`, and a `syncMeta` with `status: 'SUCCESS'`,
  `durationMs` measured around the ingest call, `startedAt` = ISO time before
  the ingest call).
- Return `true` only if the edge function call succeeds (`!error`), `false`
  on the existing early-return paths (unchanged) and on `error` truthy.

## Files
- `src/supabase/functions/sync-cve/index.ts` (rewrite the handler body)
- `src/services/syncService.ts` (rewrite `syncVendors()` and `fetchAndIngestQuery()`
  persistence calls only — do not touch `fetchSyncLogs()`)
- `src/tests/unit/services/syncServicePersist.test.ts` (already created by
  the spec author with failing tests — do not delete or rewrite its
  assertions, only make them pass; you may add more test cases in the same
  file if useful)

Do not touch: `src/adapters/redhat.ts`, `src/engine/ingestion.ts`,
`src/services/webhookConfigService.ts`, `src/services/webhook.ts`,
`src/pages/*`, `src/components/*`, any RLS/SQL migration file, `src/types/index.ts`.

## Verify
From `src/`: `npm run test:unit -- syncServicePersist` must pass, then
`npm test` (full suite) must still pass, then `npm run build` must succeed.
Report the exact command output.

## Non-goals
- Do not change RLS policies (handled separately by the main session).
- Do not build a `webhook-admin` edge function (separate follow-up task).
- Do not touch the CVE/RHSA data-model architecture (separate follow-up task).
- Do not add authentication/login.
- Do not deploy the edge function (the main session will deploy and do a
  live smoke test against the real Supabase project before RLS is tightened).

## Test charter
| Case | Expected outcome | Layer / file |
| --- | --- | --- |
| `syncVendors()` calls `supabase.functions.invoke('sync-cve', ...)` with `action: 'persist_ingestion'` and the correct `vendorCode` | mock is called with matching shape | unit / `syncServicePersist.test.ts` |
| `syncVendors()` never calls `supabase.from('advisories')`, `.from('cves')`, `.from('advisory_cve_map')`, or `.from('vendor_sync_logs')` with `.upsert`/`.insert` | those mock methods are not called | unit / `syncServicePersist.test.ts` |
| `fetchAndIngestQuery()` calls the edge function instead of direct table writes | mock is called with `action: 'persist_ingestion'`, `vendorCode: 'redhat'` | unit / `syncServicePersist.test.ts` |
| `fetchAndIngestQuery()` returns `false` when the edge function call errors | return value is `false` | unit / `syncServicePersist.test.ts` |
