import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { IngestionEngine, getAdapterByCode, isVendorDue } from "../_shared/ingest.bundle.js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADVISORY_BUCKET = 'advisory-documents';

// BUG-008: keeps the storage key byte-identical to what sync-cve/index.ts uses
// (`advisory_id.replace(/:/g, '_')`) for every id made only of [A-Za-z0-9._:-].
// Only adds handling for characters current data never has: path separators
// and '..' traversal. Duplicated (not shared) from sync-cve/index.ts because
// each Edge Function is deployed and bundled independently — keep both copies
// in sync.
function sanitiseAdvisoryKey(advisoryId: unknown): string {
  return String(advisoryId)
    .replace(/:/g, '_')
    .replace(/\.\./g, '_')
    .replace(/[\\/]/g, '_');
}

// Server-side batches only — the 3 MB chunk limit belongs to the browser ->
// sync-cve HTTP boundary and does not apply to a function writing directly
// with the service-role client (TASK-13 D5).
const DB_BATCH_SIZE = 1000;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const SUPABASE_PAGE_SIZE = 1000;

// PostgREST caps a bare select() at 1000 rows and truncates silently, so
// every known cve_id must be paged in rather than assumed to fit one select.
async function fetchAllCveIds(supabaseClient: any): Promise<string[]> {
  const ids: string[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabaseClient
      .from('cves')
      .select('cve_id')
      .range(from, from + SUPABASE_PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data) ids.push(row.cve_id);
    if (data.length < SUPABASE_PAGE_SIZE) break;
    from += SUPABASE_PAGE_SIZE;
  }
  return ids;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
    );
  }

  // SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are reserved names injected
  // automatically by the Supabase Edge Function runtime — do not rename these.
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // An unset/empty service-role key must never be compared against the
  // header — that would collapse the check into `authHeader !== 'Bearer '`
  // and accept a request that sends exactly that literal value. Fail closed
  // without disclosing which environment variable is missing.
  if (!serviceRoleKey) {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
    );
  }

  const authHeader = req.headers.get('Authorization') ?? '';

  // This endpoint must only be callable by the pg_cron tick (or another
  // holder of the service-role key), never by the browser publishable key.
  if (authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
    );
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey
    );

    const { data: vendors, error: vendorsError } = await supabaseClient
      .from('vendors')
      .select('*')
      .eq('schedule_enabled', true);

    if (vendorsError) throw vendorsError;

    const now = new Date();
    const dueVendors = (vendors || []).filter((v: any) => isVendorDue(v, now));

    const ran: string[] = [];
    const skipped: string[] = ((vendors || []) as any[])
      .filter((v) => !dueVendors.includes(v))
      .map((v: any) => v.code);
    const logs: any[] = [];
    const stampFailures: string[] = [];

    // Already-persisted CVE ids, so the engine only counts genuinely new
    // CVEs. Without this every scheduled run reports every CVE in the
    // vendor's advisories as new, including ones a previous run stored.
    // A read failure must not abort the run — fall back to an empty set,
    // the same degradation syncService.ts uses.
    let knownCveIds: string[] = [];
    try {
      knownCveIds = await fetchAllCveIds(supabaseClient);
    } catch (knownIdsErr: any) {
      console.warn('Failed to fetch known CVE ids for de-duplication:', knownIdsErr);
    }

    for (const vendor of dueVendors) {
      // A fresh engine per vendor — IngestionEngine accumulates advisories,
      // cves and mappings in instance Maps that are never cleared, so
      // reusing one instance across vendors would leak vendor A's rows
      // into vendor B's upsert and stamp them with vendor B's vendor_id.
      const engine = new IngestionEngine({ knownCveIds });
      const startedAt = new Date().toISOString();
      try {
        const result = await engine.ingestVendor(vendor.code);

        const advisories = engine.getAdvisories();
        const cves = engine.getCves();
        const mappings = engine.getMappings();

        const cveIdMap = new Map<string, string>();
        for (const batch of chunk(cves, DB_BATCH_SIZE)) {
          const { data: insertedCves, error: cveError } = await supabaseClient
            .from('cves')
            .upsert(
              batch.map((c: any) => ({
                cve_id: c.cve_id,
                description: c.description,
                cvss_v3_score: c.cvss_v3_score,
                cvss_v3_vector: c.cvss_v3_vector,
                severity: c.severity,
                is_known_exploited: c.is_known_exploited,
                published_date: c.published_date,
              })),
              { onConflict: 'cve_id' }
            )
            .select('id, cve_id');

          if (cveError) throw cveError;
          for (const row of insertedCves || []) {
            const original = batch.find((c: any) => c.cve_id === row.cve_id);
            if (original) cveIdMap.set(original.id, row.id);
          }
        }

        // Upload the raw document the same way sync-cve/index.ts does, so an
        // advisory that only ever arrives through the scheduler still gets a
        // raw_payload_path. A storage failure for one advisory must not
        // abort the vendor's run — log it and leave that advisory's path
        // null rather than throwing.
        //
        // Uploads happen per batch, immediately before that batch's upsert,
        // rather than for every advisory up front. Uploading everything up
        // front would leave later, never-attempted batches' objects orphaned
        // in the bucket if an earlier batch's upsert fails.
        const rawPayloadPaths = new Map<string, string>();
        const advisoryIdMap = new Map<string, string>();
        for (const batch of chunk(advisories, DB_BATCH_SIZE)) {
          for (const adv of batch as any[]) {
            const hasPayload = adv.raw_payload && Object.keys(adv.raw_payload).length > 0;
            if (!hasPayload) continue;
            const path = `${vendor.code}/${sanitiseAdvisoryKey(adv.advisory_id)}.json`;
            try {
              const { error: uploadError } = await supabaseClient.storage
                .from(ADVISORY_BUCKET)
                .upload(path, JSON.stringify(adv.raw_payload), {
                  contentType: 'application/json',
                  upsert: true,
                });
              if (uploadError) throw uploadError;
              rawPayloadPaths.set(adv.advisory_id, path);
            } catch (uploadErr: any) {
              console.error(
                `Failed to upload raw payload for advisory ${adv.advisory_id} (vendor ${vendor.code}):`,
                uploadErr
              );
            }
          }

          const { data: insertedAdvisories, error: advError } = await supabaseClient
            .from('advisories')
            .upsert(
              batch.map((adv: any) => ({
                vendor_id: vendor.id,
                advisory_id: adv.advisory_id,
                title: adv.title,
                severity: adv.severity,
                published_at: adv.published_at,
                url: adv.url,
                summary: adv.summary,
                raw_payload: {},
                raw_payload_path: rawPayloadPaths.get(adv.advisory_id) ?? null,
              })),
              { onConflict: 'vendor_id, advisory_id' }
            )
            .select('id, advisory_id');

          if (advError) {
            // BUG-009 (mirrored from sync-cve/index.ts): the upsert failed
            // after this batch's payloads were already uploaded, so those
            // objects are now orphaned. Best-effort remove them; never let a
            // cleanup failure mask or replace the original error.
            const batchPaths = batch
              .map((adv: any) => rawPayloadPaths.get(adv.advisory_id))
              .filter((path): path is string => !!path);
            if (batchPaths.length > 0) {
              try {
                const { error: removeError } = await supabaseClient.storage
                  .from(ADVISORY_BUCKET)
                  .remove(batchPaths);
                if (removeError) {
                  console.error(
                    `Failed to remove orphaned raw payloads for vendor ${vendor.code}:`,
                    removeError
                  );
                }
              } catch (removeErr: any) {
                console.error(
                  `Failed to remove orphaned raw payloads for vendor ${vendor.code}:`,
                  removeErr
                );
              }
            }
            throw advError;
          }
          for (const row of insertedAdvisories || []) {
            const original = batch.find((a: any) => a.advisory_id === row.advisory_id);
            if (original) advisoryIdMap.set(original.id, row.id);
          }
        }

        const mappingRows = mappings
          .map((m: any) => {
            const realAdvisoryId = advisoryIdMap.get(m.advisory_id);
            const realCveId = cveIdMap.get(m.cve_id);
            if (!realAdvisoryId || !realCveId) return null;
            return {
              advisory_id: realAdvisoryId,
              cve_id: realCveId,
              affected_products: (m.product_impacts && m.product_impacts.length > 0)
                ? m.product_impacts
                : m.affected_products,
              fixed_versions: m.fixed_versions,
            };
          })
          .filter((m: any) => m !== null);

        for (const batch of chunk(mappingRows, DB_BATCH_SIZE)) {
          const { error: mapError } = await supabaseClient
            .from('advisory_cve_map')
            .upsert(batch, { onConflict: 'advisory_id, cve_id' });
          if (mapError) throw mapError;
        }

        const finishedAt = new Date().toISOString();
        const { data: logRow, error: logError } = await supabaseClient
          .from('vendor_sync_logs')
          .insert({
            vendor_id: vendor.id,
            vendor_code: vendor.code,
            status: result.status,
            items_fetched: result.advisoriesCount,
            new_items_count: result.newCvesCount,
            duration_ms: result.durationMs,
            started_at: startedAt,
            finished_at: finishedAt,
            error_message: result.errorMessage ?? null,
          })
          .select()
          .single();

        if (logError) throw logError;

        ran.push(vendor.code);
        logs.push(logRow);
      } catch (err: any) {
        // One vendor's failure must not stop the remaining vendors.
        const finishedAt = new Date().toISOString();
        const { data: logRow, error: logInsertError } = await supabaseClient
          .from('vendor_sync_logs')
          .insert({
            vendor_id: vendor.id,
            vendor_code: vendor.code,
            status: 'FAILED',
            items_fetched: 0,
            new_items_count: 0,
            duration_ms: null,
            started_at: startedAt,
            finished_at: finishedAt,
            error_message: err?.message ?? 'Unknown error during scheduled sync',
          })
          .select()
          .single();

        if (logInsertError) {
          // The vendor already failed and now its failure log couldn't be
          // written either — do not report it as a successful run, that
          // would hide the failure entirely.
          console.error(`Failed to insert vendor_sync_logs row for vendor ${vendor.code}:`, logInsertError);
        } else {
          ran.push(vendor.code);
          if (logRow) logs.push(logRow);
        }
      } finally {
        // Stamped after the run, success or failure, so one failed slot
        // waits for the next slot instead of retrying every tick (D5/R2).
        // Wrapped so a throw here cannot escape the vendor loop and skip
        // every remaining due vendor.
        try {
          const { error: stampError } = await supabaseClient
            .from('vendors')
            .update({ last_scheduled_run_at: new Date().toISOString() })
            .eq('id', vendor.id);

          if (stampError) {
            console.error(`Failed to stamp last_scheduled_run_at for vendor ${vendor.code}:`, stampError);
            stampFailures.push(vendor.code);
          }
        } catch (stampErr: any) {
          console.error(`Failed to stamp last_scheduled_run_at for vendor ${vendor.code}:`, stampErr);
          stampFailures.push(vendor.code);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, ran, skipped, logs, stampFailures }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
