// One-off backfill: move existing advisories.raw_payload JSONB content into
// the `advisory-documents` Supabase Storage bucket, keyed by
// `${vendor.code}/${advisory_id with ':' -> '_'}.json`, and clear the
// migrated rows' raw_payload column.
//
// Usage:
//   SUPABASE_URL=https://<project>.supabase.co \
//   SUPABASE_SECRET_KEY=<service-role-key> \
//   node scripts/backfillAdvisoryStorage.mjs
//
// Resumable: only rows where raw_payload_path is null are selected, so
// re-running after a partial failure only touches rows not yet migrated.

import { createClient } from '@supabase/supabase-js';

const ADVISORY_BUCKET = 'advisory-documents';

// BUG-008: keeps the storage key byte-identical to what the ~50 already-stored
// objects use (`advisory_id.replace(/:/g, '_')`) for every id made only of
// [A-Za-z0-9._:-]. Only adds handling for characters current data never has:
// path separators and '..' traversal. This helper is duplicated (not shared)
// with src/supabase/functions/sync-cve/index.ts because that is a separate
// Deno runtime — keep both copies in sync.
export function sanitiseAdvisoryKey(advisoryId) {
  return String(advisoryId)
    .replace(/:/g, '_')
    .replace(/\.\./g, '_')
    .replace(/[\\/]/g, '_');
}

const PAGE = 500;

export async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY environment variables.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let migrated = 0;
  let skipped = 0;
  const failed = [];

  // Rows already accounted for in this run, so a row still matching
  // `.is('raw_payload_path', null)` on the next iteration (skipped or
  // failed) is not re-processed and not re-counted.
  const processedIds = new Set();

  // Each migrated row sets raw_payload_path and so leaves the
  // `.is('raw_payload_path', null)` filter, so re-query from offset 0 every
  // iteration rather than advancing an offset across iterations. Ordered by
  // id so the window is deterministic while rows are being mutated.
  for (;;) {
    const { data: rows, error: selectError } = await supabase
      .from('advisories')
      .select('id, advisory_id, raw_payload, vendors(code)')
      .is('raw_payload_path', null)
      .order('id', { ascending: true })
      .range(0, PAGE - 1);

    if (selectError) {
      console.error('Failed to select advisories:', selectError.message);
      process.exit(1);
    }

    if (!rows || rows.length === 0) break;

    let migratedThisPage = 0;

    for (const row of rows) {
      if (processedIds.has(row.id)) {
        continue;
      }
      processedIds.add(row.id);

      try {
        if (!row.raw_payload || Object.keys(row.raw_payload).length === 0) {
          skipped += 1;
          continue;
        }

        const vendorCode = row.vendors?.code;
        if (!vendorCode) {
          throw new Error('missing vendor code');
        }
        const path = `${vendorCode}/${sanitiseAdvisoryKey(row.advisory_id)}.json`;

        const { error: uploadError } = await supabase.storage
          .from(ADVISORY_BUCKET)
          .upload(path, JSON.stringify(row.raw_payload), {
            contentType: 'application/json',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { error: updateError } = await supabase
          .from('advisories')
          .update({ raw_payload_path: path, raw_payload: {} })
          .eq('id', row.id);

        if (updateError) throw updateError;

        migrated += 1;
        migratedThisPage += 1;
      } catch (err) {
        failed.push(row.advisory_id);
        console.error(`Failed to migrate ${row.advisory_id}:`, err.message ?? err);
      }
    }

    // Rows that failed (or were skipped) never leave the `.is(...)` filter,
    // so a page with zero migrations would otherwise repeat forever.
    if (migratedThisPage === 0) {
      if (rows.length === PAGE) {
        console.error('No progress made on the current page; stopping to avoid an infinite loop.');
      }
      break;
    }

    if (rows.length < PAGE) break;
  }

  console.log(`migrated: ${migrated}, skipped: ${skipped}, failed: ${failed.length}`);
  if (failed.length > 0) {
    console.log('failed advisory_ids:', failed.join(', '));
  }
}

const isDirectRun =
  process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isDirectRun) {
  main();
}
