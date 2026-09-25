import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import {
  IngestionEngine,
  isVendorDue,
  WebhookService,
  persistIngestion,
  SYNC_LEASE_NAME,
  SYNC_LEASE_TTL_SECONDS,
} from "../_shared/ingest.bundle.js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const failed: string[] = [];
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

    // Loaded once per invocation and shared across every vendor's engine —
    // mirrors SyncService.loadWebhooks() so a scheduled run raises the same
    // alerts a manual sync would. A read failure must not abort the run;
    // it degrades to zero registered webhooks, same as the known-CVE-ids
    // fallback above.
    const webhookService = new WebhookService();
    const { data: webhookConfigs, error: webhookConfigsError } = await supabaseClient
      .from('webhook_configs')
      .select('*')
      .eq('is_active', true);

    if (webhookConfigsError) {
      console.warn('Failed to load webhook configs for scheduled sync:', webhookConfigsError);
    } else {
      for (const config of webhookConfigs || []) {
        webhookService.registerWebhook(config);
      }
    }

    // One sync at a time across manual and scheduled runs (see sync_leases).
    const leaseHolder = crypto.randomUUID();
    let leaseAcquired = false;
    try {
      const { data: hasLease, error: leaseErr } = await supabaseClient.rpc('acquire_sync_lease', {
        p_name: SYNC_LEASE_NAME,
        p_holder: leaseHolder,
        p_ttl_seconds: SYNC_LEASE_TTL_SECONDS,
      });
      if (!leaseErr && hasLease === false) {
        return new Response(
          JSON.stringify({ success: false, skipped: true, error: 'A threat feed synchronization is already in progress' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      if (!leaseErr && hasLease === true) {
        leaseAcquired = true;
      }
    } catch {
      // Fall back gracefully if the lease RPC does not exist yet
    }

    try {
      for (const vendor of dueVendors) {
        // A fresh engine per vendor — IngestionEngine accumulates advisories,
        // cves and mappings in instance Maps that are never cleared, so
        // reusing one instance across vendors would leak vendor A's rows
        // into vendor B's upsert and stamp them with vendor B's vendor_id.
        const engine = new IngestionEngine({ knownCveIds, webhookService });
        const startedAt = new Date().toISOString();
        try {
          const result = await engine.ingestVendor(vendor.code);
          if (result.status === 'FAILED') {
            throw new Error(result.errorMessage || `Ingestion failed for vendor ${vendor.code}`);
          }

          const cves = engine.getCves();
          await persistIngestion(supabaseClient, {
            vendorId: vendor.id,
            vendorCode: vendor.code,
            advisories: engine.getAdvisories(),
            cves,
            mappings: engine.getMappings(),
          });

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
            details: result.details ?? {},
          })
          .select()
          .single();

        if (logError) throw logError;

        ran.push(vendor.code);
        logs.push(logRow);
        await engine.dispatchPendingAlerts();

        for (const c of cves) {
          if (!knownCveIds.includes(c.cve_id)) {
            knownCveIds.push(c.cve_id);
          }
        }
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
            details: {
              error_message: err?.message ?? 'Unknown error during scheduled sync',
              error_stack: err?.stack,
              failed_at: finishedAt,
            },
          })
          .select()
          .single();

        if (logInsertError) {
          // The vendor already failed and now its failure log couldn't be
          // written either — record in failed array and log error.
          console.error(`Failed to insert vendor_sync_logs row for vendor ${vendor.code}:`, logInsertError);
          failed.push(vendor.code);
        } else {
          failed.push(vendor.code);
          if (logRow) logs.push(logRow);
        }
      } finally {
        // Only update vendor schedule stamp if the vendor run succeeded (D5/R2).
        // A transient failure is not stamped so the next tick can retry.
        if (ran.includes(vendor.code)) {
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
    }
    } finally {
      if (leaseAcquired) {
        try {
          await supabaseClient.rpc('release_sync_lease', { p_name: SYNC_LEASE_NAME, p_holder: leaseHolder });
        } catch {}
      }
    }

    return new Response(
      JSON.stringify({ success: true, ran, failed, skipped, logs, stampFailures }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
