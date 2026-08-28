# TASK-13 Phase 2 — Vendor Schedule Settings and Real Scheduler

Status: SPEC
Created: 2026-08-28 Asia/Taipei
Lane: 2 (schema migration, Edge Function, background job, deployed behaviour)

## User decisions (fixed, do not revisit)

1. Scheduler runs as **pg_cron + pg_net -> a new `scheduled-sync` Edge Function**.
2. Schedule values are stored in **`vendors` table columns** and edited from a **Sync page UI**.
3. Work lands on `main`.

## Problem

`sync-cve` only persists data. Ingestion runs in the browser (`SyncService.syncVendors`
-> `IngestionEngine.ingestVendor`). Nothing runs without a user pressing a button, so
schedule values written to the database would have no actor.

## Design

### D1 — single source of truth for ingestion code

`src/engine/ingestion.ts`, `src/adapters/*`, `src/utils/cvss.ts`, `src/services/webhook.ts`,
`src/formatters/*` and `src/types/index.ts` are all pure (no `import.meta.env`, no browser
globals). The Edge Function MUST NOT contain a second copy of adapter or ingestion logic.

Instead a build step bundles the existing sources for Deno:

- New script `src/scripts/buildEdgeBundle.mjs` uses `esbuild` (already present through Vite)
  to bundle `src/supabase/functions/_shared/ingest.entry.ts` into
  `src/supabase/functions/_shared/ingest.bundle.js`.
- Bundle options: `format: 'esm'`, `platform: 'neutral'`, `target: 'es2022'`, `bundle: true`,
  and an alias resolving `@` to the `src/` root.
- `ingest.entry.ts` re-exports only what the Edge Function needs:
  `IngestionEngine`, `getAdapterByCode`, `isVendorDue`, `SCHEDULE_TICK_TOLERANCE_MINUTES`.
- New npm script `"build:edge": "node scripts/buildEdgeBundle.mjs"`.
- `ingest.bundle.js` is a generated artifact and MUST be committed (Supabase deploy reads it).

### D2 — due-time logic lives in TypeScript, not SQL

The cron tick carries no scheduling logic. It posts to the Edge Function every 5 minutes.
The Edge Function decides which vendors are due, using a pure, unit-tested function.

New file `src/services/scheduleWindow.ts`:

```ts
export const SCHEDULE_TICK_TOLERANCE_MINUTES = 10;

export interface VendorScheduleState {
  schedule_enabled: boolean;
  schedule_times: string[];        // 'HH:MM', vendor local time
  schedule_timezone: string;       // IANA name, e.g. 'Asia/Taipei'
  last_scheduled_run_at?: string | null;   // ISO 8601 UTC
}

export function dueOccurrence(state: VendorScheduleState, now: Date): Date | null;
export function isVendorDue(state: VendorScheduleState, now: Date): boolean;
```

`dueOccurrence` rules:

1. Return `null` when `schedule_enabled` is false or `schedule_times` is empty.
2. Resolve each `HH:MM` to today's and yesterday's instant in `schedule_timezone`
   (use `Intl.DateTimeFormat` with `timeZone`; do not add a date library).
3. Take the latest occurrence `<= now`.
4. Return `null` when that occurrence is older than `SCHEDULE_TICK_TOLERANCE_MINUTES`.
   The tolerance applies unconditionally: a run fires only near its scheduled time.
   A slot missed because the tick did not fire is skipped, not caught up later at an
   arbitrary hour.
5. Return `null` when `last_scheduled_run_at >= occurrence` (already ran this slot).
6. Otherwise return the occurrence.

`isVendorDue` is `dueOccurrence(...) !== null`.

An unknown `schedule_timezone` MUST NOT throw; treat it as not due and let the caller log.

### D3 — schema

New migration `src/supabase/migrations/20260828000000_vendor_schedule.sql`:

```sql
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS schedule_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS schedule_times TEXT[] NOT NULL DEFAULT ARRAY['08:00','12:30','18:30'],
  ADD COLUMN IF NOT EXISTS schedule_timezone TEXT NOT NULL DEFAULT 'Asia/Taipei',
  ADD COLUMN IF NOT EXISTS last_scheduled_run_at TIMESTAMPTZ;
```

Plus a CHECK constraint named `vendors_schedule_times_format` asserting every element of
`schedule_times` matches `^([01][0-9]|2[0-3]):[0-5][0-9]$`.

`SELECT` on `vendors` is already public. Do NOT re-add a browser write policy —
migration `20260816000000_restrict_write_rls.sql` deliberately dropped it. All writes go
through an Edge Function using the service-role key.

### D4 — cron registration

Same migration file, after the DDL:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

Then a tick function `public.tick_scheduled_syncs()` that:

- reads `scheduled_sync_url` and `scheduled_sync_key` from `vault.decrypted_secrets`;
- returns immediately (no error) when either secret is missing;
- issues ONE `net.http_post` to the URL with header
  `Authorization: Bearer <scheduled_sync_key>` and body `'{}'::jsonb`.

Then registration, guarded so re-running the migration does not create a duplicate job:

```sql
SELECT cron.unschedule('vuln-beacon-scheduled-sync')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'vuln-beacon-scheduled-sync');
SELECT cron.schedule('vuln-beacon-scheduled-sync', '*/5 * * * *',
  $$ SELECT public.tick_scheduled_syncs() $$);
```

**The migration MUST NOT contain any secret value.** It documents, in a SQL comment, the
one-time manual step:

```
select vault.create_secret('https://<ref>.supabase.co/functions/v1/scheduled-sync', 'scheduled_sync_url');
select vault.create_secret('<service-role-key>', 'scheduled_sync_key');
```

### D5 — `scheduled-sync` Edge Function

New file `src/supabase/functions/scheduled-sync/index.ts`.

- Accepts `POST` only; keeps the existing `corsHeaders` shape used by `sync-cve`.
- **Auth**: reads the `Authorization` header, requires `Bearer <SUPABASE_SERVICE_ROLE_KEY>`.
  Any other value returns `401` with `{ success: false, error: 'Unauthorized' }`.
  This endpoint MUST NOT be callable with the browser publishable key.
- Imports `IngestionEngine`, `getAdapterByCode`, `isVendorDue` from
  `../_shared/ingest.bundle.js`.
- Selects vendors with `schedule_enabled = true`, filters with `isVendorDue(vendor, new Date())`.
- For each due vendor, in sequence:
  1. `engine.ingestVendor(vendorCode)`;
  2. upsert advisories, cves and mappings directly with the service-role client in batches
     of at most 1000 rows per statement. **No 3 MB chunking** — that limit exists only for
     the browser -> Edge Function HTTP boundary and does not apply here;
  3. insert exactly ONE `vendor_sync_logs` row for the run;
  4. set `vendors.last_scheduled_run_at = now()` **after** the run finishes, whether it
     succeeded or failed, so one failed slot does not retry every 5 minutes.
- A failure on one vendor MUST NOT stop the remaining vendors.
- **Every write result MUST be inspected.** No `await supabaseClient...` may destructure only
  `data`. A failed `vendor_sync_logs` insert must be logged and must not let the vendor be
  reported as a successful run.
- **New-CVE counting.** Construct the engine with `knownCveIds` populated from the `cves`
  table, the way `src/services/syncService.ts` does. Without it `new_items_count` counts
  every CVE in the vendor's advisories as new on every scheduled run, so a recurring sync
  permanently over-reports new vulnerabilities.
- **Storage compensation.** Mirror `sync-cve`'s BUG-009 behaviour: when an advisories upsert
  fails after its raw payloads were uploaded, remove the objects that batch just wrote, so a
  failed batch leaves no orphan in the `advisory-documents` bucket.
- Response body: `{ success: true, ran: string[], skipped: string[], logs: VendorSyncLog[] }`.
- When no vendor is due, return `200` with `ran: []`.

### D6 — schedule write path

Extend `src/supabase/functions/sync-cve/index.ts` with a second action. Keep
`persist_ingestion` behaviour byte-for-byte unchanged.

New action `update_vendor_schedule`, body:

```
{ action: 'update_vendor_schedule', vendorCode: string,
  schedule: { enabled: boolean, times: string[], timezone: string } }
```

- Validates every entry of `times` against `^([01][0-9]|2[0-3]):[0-5][0-9]$`; rejects with
  `400` and `{ success: false, error: 'Invalid schedule time' }` otherwise.
- Rejects an empty `times` array when `enabled` is true, with the same `400` shape.
- Validates `timezone` with `Intl.DateTimeFormat`; invalid names return `400`
  `{ success: false, error: 'Invalid timezone' }`.
- Updates the row matched by `code = vendorCode`; returns
  `{ success: true, vendor: <updated row> }`.
- The unsupported-action branch must still return `400 'Unsupported action'` for any
  other action value.

### D7 — client and UI

- `src/types/index.ts`: extend `Vendor` with
  `schedule_enabled: boolean; schedule_times: string[]; schedule_timezone: string;
  last_scheduled_run_at?: string | null;`
- `src/services/vendorService.ts`:
  - `fetchVendors()` maps the four new columns, with defaults
    (`false`, `[]`, `'Asia/Taipei'`, `null`) when a column is absent.
  - New `updateSchedule(vendorCode: string, schedule: { enabled: boolean; times: string[];
    timezone: string }): Promise<{ success: boolean; error?: string }>` calling
    `supabase.functions.invoke('sync-cve', { body: { action: 'update_vendor_schedule', ... } })`.
    It returns `{ success: false, error }` instead of throwing.
- New `src/components/sync/ScheduleSettings.tsx`:
  - Props `{ vendors: Vendor[]; onSave: (vendorCode, schedule) => Promise<{ success: boolean; error?: string }> }`.
  - One row per vendor: an enable switch, an editable comma-separated `HH:MM` list, a
    timezone text field, and a Save button. Accessible names are fixed so tests can
    address them: `Enable schedule for <vendor name>`, `Schedule times for <vendor name>`,
    `Timezone for <vendor name>`, and a button named `Save <vendor name>`.
  - Rejects an invalid `HH:MM` entry in the client before calling `onSave`, showing
    `Invalid time format` and leaving `onSave` uncalled.
  - Shows `Saved` on success and the returned `error` text on failure.
  - Renders `No vendor records loaded.` for an empty `vendors` array, matching
    `FeedSourceTable`.
- `src/pages/SyncMonitorPage.tsx`: add an **optional** prop
  `onSaveSchedule?: (vendorCode, schedule) => Promise<{ success: boolean; error?: string }>`
  and render a `Schedule` section holding `ScheduleSettings` directly below `Feed Sources`
  only when the prop is supplied. The prop MUST be optional: the existing
  `tests/unit/components/feedSourceTable.test.tsx` renders `SyncMonitorPage` without it and
  MUST keep compiling and passing unchanged.
- `src/App.tsx`: pass a handler that calls `VendorService.updateSchedule` then refreshes
  vendors. Do not block the dashboard render on it.

## Files

Builder A (backend):
- src/supabase/migrations/20260828000000_vendor_schedule.sql (new)
- src/supabase/functions/scheduled-sync/index.ts (new)
- src/supabase/functions/_shared/ingest.entry.ts (new)
- src/supabase/functions/_shared/ingest.bundle.js (generated, committed)
- src/supabase/functions/sync-cve/index.ts (edit — add action only)
- src/services/scheduleWindow.ts (new)
- src/scripts/buildEdgeBundle.mjs (new)
- src/package.json (edit — add "build:edge" script only)

Builder B (frontend):
- src/types/index.ts (edit — extend Vendor only)
- src/services/vendorService.ts (edit)
- src/components/sync/ScheduleSettings.tsx (new)
- src/pages/SyncMonitorPage.tsx (edit)
- src/App.tsx (edit)

## Non-goals

- No retry logic for a failed scheduled run (BUG-005 stays open).
- No change to `persist_ingestion`, to `PERSIST_CHUNK_MAX_BYTES`, or to browser chunking.
- No second copy of adapter or ingestion logic in Deno.
- No secrets in migrations or in committed source.
- No change to `Header.tsx`'s cosmetic shift text.

## Test charter

| Case | Expected outcome | Layer / file |
| --- | --- | --- |
| Disabled vendor | `isVendorDue` false | tests/unit/services/scheduleWindow.test.ts |
| Empty `schedule_times` | false | same |
| Slot 2 min ago, never run | true | same |
| Slot 2 min ago, `last_scheduled_run_at` after it | false | same |
| Slot 6 h ago, never run | false (tolerance) | same |
| Slot 6 h ago, ran yesterday | false | same |
| Yesterday 23:50 slot, now 00:02 local | true | same |
| Non-UTC timezone honoured (Asia/Taipei vs UTC) | different due results | same |
| Invalid timezone | false, no throw | same |
| `fetchVendors` maps schedule columns | values present | tests/unit/services/vendorScheduleService.test.ts |
| `fetchVendors` with columns absent | defaults applied | same |
| `updateSchedule` invokes sync-cve with correct action and body | asserted | same |
| `updateSchedule` on invoke error | `{ success: false, error }`, no throw | same |
| `updateSchedule` on validation error in body | error text surfaced | same |
| Migration adds 4 columns + CHECK + both extensions + cron job | SQL source assertions | tests/unit/supabase/vendorScheduleMigration.test.ts |
| Migration contains no literal service key or project URL | no match | same |
| `scheduled-sync` requires bearer service-role auth | source assertion | tests/unit/supabase/scheduledSyncFunction.test.ts |
| `scheduled-sync` imports the shared bundle, not a copied adapter | source assertion | same |
| `sync-cve` still rejects unknown actions | source assertion | same |
| ScheduleSettings renders a row per vendor with times | rendered | tests/unit/components/scheduleSettings.test.tsx |
| Invalid `HH:MM` blocks save | `onSave` not called, error shown | same |
| Successful save shows confirmation | `Saved` shown | same |
| Failed save shows returned error | error text shown | same |
| Empty vendors | `No vendor records loaded.` | same |

## Verify

```
npm --prefix src run build:edge && npm --prefix src test && npm --prefix src run build
```

## Accepted risks

- **R1 — Edge Function wall-clock.** A full Red Hat CSAF ingest inside one Edge Function
  invocation may exceed the Edge Runtime time limit. The user accepted this when choosing
  the pg_cron design. Record in `BUG_FIX.md`.
- **R3 — a wall-clock kill leaves later vendors silently unlogged.** The per-vendor
  `try/catch/finally` cannot observe an Edge Runtime time-limit kill between iterations, so
  vendors later in the due list get no `vendor_sync_logs` row at all for that tick. Follows
  from R1.
- **R2 — one missed slot per failure.** `last_scheduled_run_at` is set even on failure, so
  a failed run waits for the next slot. Related to the open BUG-005.
