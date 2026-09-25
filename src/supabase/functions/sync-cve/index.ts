import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { IngestionEngine, WebhookService, authorizeAdminRequest } from "../_shared/ingest.bundle.js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DB_BATCH_SIZE = 1000;
const SUPABASE_PAGE_SIZE = 1000;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

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
      hostname.endsWith('.internal') ||
      hostname.endsWith('.lan') ||
      hostname.endsWith('.home.arpa')
    ) {
      return false;
    }

    if (hostname.startsWith('[') && hostname.endsWith(']')) {
      const ip6 = hostname.slice(1, -1).toLowerCase();
      if (ip6 === '::' || ip6 === '::1') return false;
      if (ip6.startsWith('fc') || ip6.startsWith('fd')) return false;
      if (
        ip6.startsWith('fe8') ||
        ip6.startsWith('fe9') ||
        ip6.startsWith('fea') ||
        ip6.startsWith('feb')
      ) {
        return false;
      }
      if (ip6.startsWith('::ffff:')) return false;
      return true;
    }

    if (hostname === '::1' || hostname === '::') return false;

    const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (match) {
      const [o1, o2, o3, o4] = match.slice(1).map(Number);
      if (o1 > 255 || o2 > 255 || o3 > 255 || o4 > 255) return false;
      if (o1 === 0 || o1 === 10 || o1 === 127) return false;
      if (o1 === 169 && o2 === 254) return false;
      if (o1 === 172 && o2 >= 16 && o2 <= 31) return false;
      if (o1 === 192 && o2 === 168) return false;
      if (o1 === 100 && o2 >= 64 && o2 <= 127) return false;
      if (o1 >= 224) return false;
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

  try {
    // SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are reserved names injected
    // automatically by the Supabase Edge Function runtime — do not rename these.
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const { action, vendorCode, advisories, cves, mappings, syncMeta } = body;

    if (action === 'health_check') {
      return new Response(
        JSON.stringify({ success: true, status: 'ok', timestamp: new Date().toISOString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Every action below writes with the service-role client, so the caller
    // must be an admin (or hold the service-role key). The publishable key is
    // public and never authorizes anything here.
    const isAdmin = await authorizeAdminRequest(req.headers.get('Authorization'), {
      serviceRoleKey,
      getUser: (token: string) => supabaseClient.auth.getUser(token),
    });
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: admin authentication required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    if (action === 'trigger_manual_sync') {
      // D3: Mutual Exclusion & Concurrency Protection
      let lockAcquired = false;
      try {
        const { data: hasLock, error: lockErr } = await supabaseClient.rpc('try_acquire_sync_lock', { lock_id: 7425001 });
        if (!lockErr && hasLock === false) {
          return new Response(
            JSON.stringify({ success: false, error: 'A threat feed synchronization is already in progress' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
          );
        }
        if (!lockErr && hasLock === true) {
          lockAcquired = true;
        }
      } catch {
        // Fall back gracefully if lock RPC does not exist
      }

      try {
        const targetVendors: string[] = Array.isArray(body.vendorCodes) && body.vendorCodes.length > 0
          ? body.vendorCodes
          : ['redhat', 'nutanix', 'ubuntu', 'debian', 'suse'];

        let knownCveIds: string[] = [];
        try {
          knownCveIds = await fetchAllCveIds(supabaseClient);
        } catch (knownIdsErr) {
          console.warn('Failed to fetch known CVE ids for de-duplication:', knownIdsErr);
        }

        const webhookService = new WebhookService();
        const { data: webhookConfigs, error: webhookConfigsError } = await supabaseClient
          .from('webhook_configs')
          .select('*')
          .eq('is_active', true);

        if (webhookConfigsError) {
          console.warn('Failed to load webhook configs for manual sync:', webhookConfigsError);
        } else {
          for (const config of webhookConfigs || []) {
            webhookService.registerWebhook(config);
          }
        }

        const ran: string[] = [];
        const failed: string[] = [];
        const logs: any[] = [];
        const errors: string[] = [];
        let allSucceeded = true;

        for (const code of targetVendors) {
          const { data: vendor, error: vendorError } = await supabaseClient
            .from('vendors')
            .select('*')
            .eq('code', code)
            .single();

          if (vendorError || !vendor) {
            allSucceeded = false;
            failed.push(code);
            errors.push(`Unknown vendor code: ${code}`);
            continue;
          }

          const engine = new IngestionEngine({ knownCveIds, webhookService });
          const startedAt = new Date().toISOString();

          try {
            const result = await engine.ingestVendor(code);
            if (result.status === 'FAILED') {
              throw new Error(result.errorMessage || `Ingestion failed for vendor ${code}`);
            }

            const advisories = engine.getAdvisories().filter((a: any) => a.vendor_id === code);
            const cves = engine.getCves();
            const mappings = engine.getMappings();

            const uniqueCves = Array.from(new Map(cves.map((c: any) => [c.cve_id, c])).values());
            const cveIdMap = new Map<string, string>();
            for (const batch of chunk(uniqueCves, DB_BATCH_SIZE)) {
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

            const uniqueAdvisories = Array.from(new Map(advisories.map((a: any) => [a.advisory_id, a])).values());
            const rawPayloadPaths = new Map<string, string>();
            const advisoryIdMap = new Map<string, string>();
            for (const batch of chunk(uniqueAdvisories, DB_BATCH_SIZE)) {
              for (const adv of batch as any[]) {
                const hasPayload = adv.raw_payload && Object.keys(adv.raw_payload).length > 0;
                if (!hasPayload) continue;
                const path = `${code}/${sanitiseAdvisoryKey(adv.advisory_id)}.json`;
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
                    `Failed to upload raw payload for advisory ${adv.advisory_id} (vendor ${code}):`,
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
                const batchPaths = batch
                  .map((adv: any) => rawPayloadPaths.get(adv.advisory_id))
                  .filter((path): path is string => !!path);
                if (batchPaths.length > 0) {
                  try {
                    await supabaseClient.storage
                      .from(ADVISORY_BUCKET)
                      .remove(batchPaths);
                  } catch {}
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

            const dedupedMappings = Array.from(
              mappingRows.reduce((acc: Map<string, any>, m: any) => {
                const key = `${m.advisory_id}:${m.cve_id}`;
                if (!acc.has(key)) {
                  acc.set(key, m);
                } else {
                  const existing = acc.get(key);
                  const mergedProducts = Array.from(
                    new Set([...(existing.affected_products || []), ...(m.affected_products || [])])
                  );
                  const mergedVersions = Array.from(
                    new Set([...(existing.fixed_versions || []), ...(m.fixed_versions || [])])
                  );
                  acc.set(key, {
                    ...existing,
                    affected_products: mergedProducts,
                    fixed_versions: mergedVersions,
                  });
                }
                return acc;
              }, new Map<string, any>()).values()
            );

            for (const batch of chunk(dedupedMappings, DB_BATCH_SIZE)) {
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
                vendor_code: code,
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

            ran.push(code);
            logs.push(logRow);

            for (const c of cves) {
              if (!knownCveIds.includes(c.cve_id)) {
                knownCveIds.push(c.cve_id);
              }
            }
          } catch (err: any) {
            allSucceeded = false;
            failed.push(code);
            const finishedAt = new Date().toISOString();
            const errMsg = err?.message ?? `Unknown error syncing vendor ${code}`;
            errors.push(errMsg);

            const { data: logRow } = await supabaseClient
              .from('vendor_sync_logs')
              .insert({
                vendor_id: vendor.id,
                vendor_code: code,
                status: 'FAILED',
                items_fetched: 0,
                new_items_count: 0,
                duration_ms: null,
                started_at: startedAt,
                finished_at: finishedAt,
                error_message: errMsg,
                details: {
                  error_message: errMsg,
                  error_stack: err?.stack,
                  failed_at: finishedAt,
                },
              })
              .select()
              .single();

            if (logRow) {
              logs.push(logRow);
            }
          }
        }

        return new Response(
          JSON.stringify({
            success: allSucceeded,
            ran,
            failed,
            logs,
            errors,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      } finally {
        if (lockAcquired) {
          try {
            await supabaseClient.rpc('release_sync_lock', { lock_id: 7425001 });
          } catch {}
        }
      }
    }

    if (action === 'update_vendor_schedule') {
      return await handleUpdateVendorSchedule(supabaseClient, body);
    }

    if (action === 'test_webhook') {
      const { webhook, payload } = body;
      if (!webhook?.webhook_url || !isSafeDestinationUrl(webhook.webhook_url)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid or unsafe destination URL' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      try {
        let testPayload = payload;
        if (!testPayload) {
          if (webhook.platform === 'telegram') {
            let chatId: string | undefined;
            try {
              const parsed = new URL(webhook.webhook_url);
              chatId = parsed.searchParams.get('chat_id') ?? undefined;
            } catch {}
            testPayload = {
              text: '🚨 <b>[Test Alert]</b> VulnBeacon webhook delivery test.',
              parse_mode: 'HTML',
              disable_web_page_preview: false,
              ...(chatId ? { chat_id: chatId } : {}),
            };
          } else if (webhook.platform === 'slack') {
            testPayload = {
              text: '🚨 [Test Alert] VulnBeacon webhook delivery test.',
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: '🚨 *[Test Alert]* VulnBeacon webhook delivery test.',
                  },
                },
              ],
            };
          } else {
            testPayload = {
              content: '🚨 [Test Alert] VulnBeacon webhook delivery test.',
              embeds: [
                {
                  title: '🚨 [Test Alert] VulnBeacon webhook delivery test.',
                  description: 'Verified live delivery from VulnBeacon connected to Supabase backend.',
                  color: 0x388e3c,
                },
              ],
            };
          }
        }
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
      if (!webhook?.name || typeof webhook.name !== 'string' || !webhook.name.trim()) {
        return badRequest('Invalid webhook name');
      }
      if (!['discord', 'telegram', 'slack'].includes(webhook?.platform)) {
        return badRequest('Invalid platform');
      }
      const allowedSeverities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
      if (webhook.min_severity && !allowedSeverities.includes(webhook.min_severity)) {
        return badRequest('Invalid min_severity');
      }
      if (!webhook?.webhook_url || !isSafeDestinationUrl(webhook.webhook_url)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid or unsafe destination URL' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      const { data, error } = await supabaseClient
        .from('webhook_configs')
        .insert({
          name: webhook.name.trim(),
          platform: webhook.platform,
          webhook_url: webhook.webhook_url,
          min_severity: webhook.min_severity || 'HIGH',
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
      if (!id || typeof id !== 'string') {
        return badRequest('Missing or invalid id');
      }
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
        const payloadBytes = new TextEncoder().encode(payloadStr).length;
        if (payloadBytes > 5 * 1024 * 1024) {
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

    // Record sync log when syncMeta is provided (e.g. final chunk or single-chunk run)
    let logRow: any = null;
    if (syncMeta && syncMeta.status) {
      const { data, error: logError } = await supabaseClient
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
          details: syncMeta.details ?? {},
        })
        .select()
        .single();

      if (logError) throw logError;
      logRow = data;
    }

    return new Response(
      JSON.stringify({ success: true, ...(logRow ? { log: logRow } : {}) }),
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
