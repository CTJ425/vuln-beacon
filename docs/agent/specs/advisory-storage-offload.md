# Spec: move advisory raw_payload out of Postgres into Supabase Storage

Lane 2 (schema migration + edge function + external storage system).

## Problem

`advisories.raw_payload` (JSONB) holds the full CSAF document per advisory,
~50-200KB each. It counts toward the Supabase free-tier 500MB database
limit. The read path no longer selects it (see prior task), but it is still
written on every sync, so the column keeps growing.

## Decision (confirmed with user)

- Store the full CSAF document in a new public Supabase Storage bucket
  `advisory-documents`, keyed by `${vendorCode}/${advisory_id with ':' -> '_'}.json`.
  Public read: CSAF documents are Red Hat public data already, and this
  matches the existing public-read RLS posture on `advisories`.
- Add `advisories.raw_payload_path text` to hold the storage key.
- Existing 50 rows: backfill their `raw_payload` content to Storage in this
  same pass, then clear the column (`raw_payload = '{}'::jsonb`) — do not
  drop the column. Clearing (not dropping) keeps the change reversible; if a
  drop is wanted later that is a separate, smaller migration.

## Out of scope

- No UI reads `raw_payload_path` yet. Building an on-demand advisory-detail
  viewer that fetches from Storage is a separate task.
- No change to `src/types/index.ts` — the client never needs to read or set
  `raw_payload_path`, so adding it there would be an unused speculative
  field.
- No change to `src/engine/ingestion.ts` or `src/services/syncService.ts` —
  the client already sends `raw_payload: item.rawPayload` in the edge
  function request body; that is still needed, since the edge function
  needs the raw content to upload it. Only what the edge function does with
  it changes.

## Test coverage note (read before implementing)

`src/supabase/functions/sync-cve/index.ts` is a Deno edge function. It has
**zero automated test coverage** today — confirmed by scout: no Deno test
file exists anywhere in the repo, and `vitest.config.ts`'s include glob
(`tests/**/*.{test,spec}.{ts,tsx}`) never reaches `supabase/functions/**`.
This task's entire new logic lives inside that function and in a one-off
Node backfill script, neither reachable by the existing Vitest suite. There
is no meaningful "failing test" to write first for the new behavior itself
— forcing one would mean building new Deno test infrastructure the project
has never used, which is disproportionate to this change.

Consequence: **reviewer must read the edge function diff and the backfill
script line by line** rather than lean on green tests. Flag this explicitly
when dispatching review.

The one thing that IS Vitest-observable and must NOT regress:
`src/tests/unit/services/syncServicePersist.test.ts` already asserts the
edge function is invoked with `action` and `vendorCode`. Confirm after the
change that `npm test` still passes unmodified — if it doesn't, the client
request contract broke, which is out of scope for this change.

## Migration: `src/supabase/migrations/20260816010000_advisory_storage.sql`

```sql
-- Storage bucket for full CSAF advisory documents, kept out of Postgres
-- to stay under the free-tier database size limit. Public read matches
-- the existing public-read RLS posture on public.advisories; CSAF
-- documents are Red Hat public data already.
insert into storage.buckets (id, name, public)
values ('advisory-documents', 'advisory-documents', true)
on conflict (id) do nothing;

create policy "Allow public read of advisory documents"
on storage.objects for select
using (bucket_id = 'advisory-documents');

alter table public.advisories
  add column if not exists raw_payload_path text;
```

No insert/update/delete policy on `storage.objects` is added: the
service-role key used by the edge function bypasses RLS entirely, the same
pattern already used for `public.advisories` writes (see
`20260816000000_restrict_write_rls.sql`, which only drops policies and
relies on service-role bypass).

## Edge function: `src/supabase/functions/sync-cve/index.ts`

Add a bucket name constant near the top:
```ts
const ADVISORY_BUCKET = 'advisory-documents';
```

In the advisory upsert loop (currently lines 80-99), before building the
upsert row, upload the payload if present and compute its storage path:

```ts
for (const adv of (advisories || [])) {
  let rawPayloadPath: string | null = null;
  const hasPayload = adv.raw_payload && Object.keys(adv.raw_payload).length > 0;

  if (hasPayload) {
    const path = `${vendorCode}/${String(adv.advisory_id).replace(/:/g, '_')}.json`;
    const { error: uploadError } = await supabaseClient.storage
      .from(ADVISORY_BUCKET)
      .upload(path, JSON.stringify(adv.raw_payload), {
        contentType: 'application/json',
        upsert: true,
      });

    if (uploadError) throw uploadError;
    rawPayloadPath = path;
  }

  const { data: insertedAdv, error: advError } = await supabaseClient
    .from('advisories')
    .upsert(
      {
        vendor_id: vendorId,
        advisory_id: adv.advisory_id,
        title: adv.title,
        severity: adv.severity,
        published_at: adv.published_at,
        url: adv.url,
        summary: adv.summary,
        raw_payload: {},
        raw_payload_path: rawPayloadPath,
      },
      { onConflict: 'vendor_id, advisory_id' }
    )
    .select('id')
    .single();

  if (advError) throw advError;
  // ... rest of the loop (mapping upsert) is unchanged
}
```

Everything else in the file — CVE upsert loop, mapping upsert, sync log
insert, error responses, CORS handling — is unchanged. Upload failure
throws, same as every other Supabase call in this function, so the whole
request fails with a 500 rather than silently persisting a advisory row
with a dangling/missing path.

Accepted edge case: if a later sync re-sends an advisory whose payload is
now empty when it previously had one, `raw_payload_path` is overwritten to
`null` on that upsert. Not guarded against — the CSAF adapter always
populates `rawPayload` when a fetch succeeds, so this cannot happen under
the current single adapter. Note it in the PR/task record as an accepted
assumption, not a fix-now bug.

## Backfill script: `src/scripts/backfillAdvisoryStorage.mjs` (new)

Plain Node ESM script (not TypeScript — keeps it outside `tsc`'s build so
it can never break `npm run build`). Uses `@supabase/supabase-js` (already
a dependency). Reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from
`process.env` — never hardcode credentials, never read `src/lib/supabase.ts`
(that file uses the anon key, which cannot write past RLS).

Behavior:
1. Create a service-role client.
2. Select every `advisories` row where `raw_payload_path is null`, joining
   `vendors(code)` for the bucket path prefix. This makes the script
   resumable: re-running it after a partial failure only touches rows not
   yet migrated.
3. For each row: if `Object.keys(row.raw_payload || {}).length === 0`, skip
   (nothing to migrate, leave `raw_payload_path` null).
4. Otherwise build the same path scheme as the edge function —
   `${vendor.code}/${row.advisory_id.replace(/:/g, '_')}.json` — upload with
   `upsert: true`, then update that row: `raw_payload_path = path`,
   `raw_payload = {}`.
5. Wrap each row in try/catch; collect failures instead of aborting, print
   a final summary (`migrated: N, skipped: N, failed: N` plus failed
   advisory_ids). This is a live-data operational script the user runs by
   hand, not app logic — a boundary operation against real network/storage
   calls, so per-row error collection is warranted here (unlike the
   "don't add unneeded error handling" default for in-process code).

Add a short usage comment at the top of the file (how to run it, what env
vars it needs) — this is its only documentation, and the how-to-run is not
obvious without it.

Add one npm script to `src/package.json`:
```json
"backfill:advisory-storage": "node scripts/backfillAdvisoryStorage.mjs"
```
(adjust the relative path to match wherever the script actually lives
under `src/`).

## Files (exhaustive)

- `src/supabase/migrations/20260816010000_advisory_storage.sql` (new)
- `src/supabase/functions/sync-cve/index.ts`
- `src/scripts/backfillAdvisoryStorage.mjs` (new)
- `src/package.json` (add one script entry only)

## Verify

`cd /root/dev/vuln-beacon/src && npm test && npm run build` — all existing
tests must still pass unmodified (no test file changes in this task), and
the build must compile clean. `tsc` does not type-check `.mjs` files or
`supabase/functions/**` (outside its module graph / a separate Deno
runtime), so neither is expected to affect the build.

## Non-goals

- Do not touch `src/types/index.ts`, `src/engine/ingestion.ts`,
  `src/services/syncService.ts`, or any read-path service.
- Do not add a DROP COLUMN migration for `raw_payload` — clearing its value
  is what was asked for, not removing the column.
- Do not attempt to run `supabase db push`, `supabase functions deploy`, or
  the backfill script against the live project — this session has no
  Supabase CLI auth (confirmed: `supabase projects list` fails with
  `LegacyPlatformAuthRequiredError`, no project link file exists). The user
  runs those steps by hand; the deliverable here is correct code only.
