import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json().catch(() => ({}));
    const { action, vendorCode, advisories, cves, mappings, syncMeta } = body;

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
    const cveIdMap = new Map<string, string>();
    for (const cveObj of (cves || [])) {
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
            raw_payload: adv.raw_payload || {},
          },
          { onConflict: 'vendor_id, advisory_id' }
        )
        .select('id')
        .single();

      if (advError) throw advError;

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

    // Record sync log.
    const { data: logRow, error: logError } = await supabaseClient
      .from('vendor_sync_logs')
      .insert({
        vendor_id: vendorId,
        vendor_code: vendorCode,
        status: syncMeta.status,
        items_fetched: (advisories || []).length,
        new_items_count: (cves || []).length,
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
