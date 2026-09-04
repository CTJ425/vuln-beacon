import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADVISORY_BUCKET = 'advisory-documents';

// BUG-008: keeps the storage key byte-identical to what the ~50 already-stored
// objects use (`advisory_id.replace(/:/g, '_')`) for every id made only of
// [A-Za-z0-9._:-]. Only adds handling for characters current data never has:
// path separators and '..' traversal. This helper is duplicated (not shared)
// with src/scripts/backfillAdvisoryStorage.mjs because that is a separate
// Node runtime — keep both copies in sync.
function sanitiseAdvisoryKey(advisoryId: unknown): string {
  return String(advisoryId)
    .replace(/:/g, '_')
    .replace(/\.\./g, '_')
    .replace(/[\\/]/g, '_');
}

const SCHEDULE_TIME_FORMAT = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

function badRequest(error: string): Response {
  return new Response(
    JSON.stringify({ success: false, error }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
  );
}

// TASK-13 D6: lets the Sync page write per-vendor schedule settings without
// re-opening browser write access to `vendors` (RLS still blocks that) — the
// Edge Function uses the service-role client instead.
async function handleUpdateVendorSchedule(supabaseClient: any, body: any): Promise<Response> {
  const { vendorCode, schedule } = body;
  const times: string[] = schedule?.times ?? [];
  const enabled: boolean = !!schedule?.enabled;
  const timezone: string = schedule?.timezone;

  if (!Array.isArray(times) || !times.every((t) => SCHEDULE_TIME_FORMAT.test(t))) {
    return badRequest('Invalid schedule time');
  }

  if (enabled && times.length === 0) {
    return badRequest('Invalid schedule time');
  }

  try {
    // Throws RangeError for an unknown IANA name.
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
  } catch {
    return badRequest('Invalid timezone');
  }

  const { data: vendorRow, error } = await supabaseClient
    .from('vendors')
    .update({
      schedule_enabled: enabled,
      schedule_times: times,
      schedule_timezone: timezone,
    })
    .eq('code', vendorCode)
    .select()
    .single();

  if (error) throw error;

  return new Response(
    JSON.stringify({ success: true, vendor: vendorRow }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  );
}

function isSafeDestinationUrl(inputUrl: string): boolean {
  try {
    const parsed = new URL(inputUrl);
    if (parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      return false;
    }
    if (hostname === '[::1]' || hostname === '::1') return false;
    const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (match) {
      const [o1, o2, o3, o4] = match.slice(1).map(Number);
      if (o1 > 255 || o2 > 255 || o3 > 255 || o4 > 255) return false;
      if (o1 === 0 || o1 === 127 || o1 === 10) return false;
      if (o1 === 172 && o2 >= 16 && o2 <= 31) return false;
      if (o1 === 192 && o2 === 168) return false;
      if (o1 === 169 && o2 === 254) return false;
    }
    return true;
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized: missing or invalid Authorization header' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
    );
  }

  try {
    // SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are reserved names injected
    // automatically by the Supabase Edge Function runtime — do not rename these.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json().catch(() => ({}));
    const { action, vendorCode, advisories, cves, mappings, syncMeta } = body;

    if (action === 'update_vendor_schedule') {
      return await handleUpdateVendorSchedule(supabaseClient, body);
    }

    if (action === 'test_webhook') {
      const { webhook, alert } = body;
      if (!webhook?.webhook_url || !isSafeDestinationUrl(webhook.webhook_url)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid or unsafe destination URL' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      try {
        const testPayload = alert ?? {
          text: '🚨 [Test Alert] VulnBeacon webhook delivery test.',
          content: '🚨 [Test Alert] VulnBeacon webhook delivery test.',
        };
        const res = await fetch(webhook.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testPayload),
        });
        return new Response(
          JSON.stringify({ success: res.ok, status: res.status }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      } catch (fetchErr: any) {
        return new Response(
          JSON.stringify({ success: false, error: fetchErr.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }

    if (action === 'create_webhook') {
      const { webhook } = body;
      if (!webhook?.webhook_url || !isSafeDestinationUrl(webhook.webhook_url)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid or unsafe destination URL' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      const { data, error } = await supabaseClient
        .from('webhook_configs')
        .insert({
          name: webhook.name,
          platform: webhook.platform,
          webhook_url: webhook.webhook_url,
          min_severity: webhook.min_severity,
          is_active: webhook.is_active ?? true,
        })
        .select()
        .single();
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (action === 'delete_webhook') {
      const { id } = body;
      const { error } = await supabaseClient
        .from('webhook_configs')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (action !== 'persist_ingestion') {
      return new Response(
        JSON.stringify({ success: false, error: 'Unsupported action' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Look up the real vendor DB id by code.
    const { data: vendor, error: vendorError } = await supabaseClient
      .from('vendors')
      .select('id')
      .eq('code', vendorCode)
      .single();

    if (vendorError || !vendor) {
      return new Response(
        JSON.stringify({ success: false, error: `Unknown vendor code: ${vendorCode}` }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const vendorId = vendor.id;

    // Upsert CVEs, keeping a map from client-local correlation id -> real DB id.
    const CVE_ID_REGEX = /^CVE-\d{4}-\d{4,}$/i;
    const cveIdMap = new Map<string, string>();
    for (const cveObj of (cves || [])) {
      if (!cveObj?.cve_id || !CVE_ID_REGEX.test(cveObj.cve_id)) {
        continue;
      }
      const { data: insertedCve, error: cveError } = await supabaseClient
        .from('cves')
        .upsert(
          {
            cve_id: cveObj.cve_id,
            description: cveObj.description,
            cvss_v3_score: cveObj.cvss_v3_score,
            cvss_v3_vector: cveObj.cvss_v3_vector,
            severity: cveObj.severity,
            is_known_exploited: cveObj.is_known_exploited,
            published_date: cveObj.published_date,
          },
          { onConflict: 'cve_id' }
        )
        .select('id')
        .single();

      if (cveError) throw cveError;

      if (insertedCve) {
        cveIdMap.set(cveObj.id, insertedCve.id);
      }
    }

    // Upsert advisories, then their mappings to CVEs.
    for (const adv of (advisories || [])) {
      let rawPayloadPath: string | null = null;
      const hasPayload = adv.raw_payload && Object.keys(adv.raw_payload).length > 0;

      if (hasPayload) {
        const payloadStr = JSON.stringify(adv.raw_payload);
        if (payloadStr.length > 5 * 1024 * 1024) {
          throw new Error(`Payload for advisory ${adv.advisory_id} exceeds 5MB limit`);
        }
        const path = `${vendorCode}/${sanitiseAdvisoryKey(adv.advisory_id)}.json`;
        const { error: uploadError } = await supabaseClient.storage
          .from(ADVISORY_BUCKET)
          .upload(path, payloadStr, {
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

      if (advError) {
        // BUG-009: the upsert failed after a successful upload, so the
        // object is now orphaned. Best-effort remove it; never let a
        // cleanup failure mask or replace the original error.
        if (rawPayloadPath) {
          try {
            await supabaseClient.storage.from(ADVISORY_BUCKET).remove([rawPayloadPath]);
          } catch {
            // best-effort only
          }
        }
        throw advError;
      }

      if (!insertedAdv) continue;

      const advMappings = (mappings || []).filter((m: any) => m.advisory_id === adv.id);
      for (const map of advMappings) {
        const realCveId = cveIdMap.get(map.cve_id);
        if (!realCveId) continue;

        const { error: mapError } = await supabaseClient
          .from('advisory_cve_map')
          .upsert(
            {
              advisory_id: insertedAdv.id,
              cve_id: realCveId,
              affected_products: (map.product_impacts && map.product_impacts.length > 0)
                ? map.product_impacts
                : map.affected_products,
              fixed_versions: map.fixed_versions,
            },
            { onConflict: 'advisory_id, cve_id' }
          );

        if (mapError) throw mapError;
      }
    }

    // BUG-003: a run is now split into chunks with no syncMeta, closed by one
    // syncMeta-only call. Only write a vendor_sync_logs row for that closing
    // call, so a run produces exactly one row.
    if (!syncMeta) {
      return new Response(
        JSON.stringify({ success: true, log: null }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Record sync log.
    const { data: logRow, error: logError } = await supabaseClient
      .from('vendor_sync_logs')
      .insert({
        vendor_id: vendorId,
        vendor_code: vendorCode,
        status: syncMeta.status,
        items_fetched: syncMeta.itemsFetched ?? (advisories || []).length,
        new_items_count: syncMeta.newItemsCount ?? (cves || []).length,
        duration_ms: syncMeta.durationMs,
        started_at: syncMeta.startedAt,
        finished_at: new Date().toISOString(),
        error_message: syncMeta.errorMessage ?? null,
      })
      .select()
      .single();

    if (logError) throw logError;

    return new Response(
      JSON.stringify({ success: true, log: logRow }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
