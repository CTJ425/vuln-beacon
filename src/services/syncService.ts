import { supabase } from '@/lib/supabase';
import { getFunctionHeaders } from '@/lib/functionAuth';

export async function extractErrorMessage(err: any): Promise<string> {
  if (err?.context && typeof err.context.json === 'function') {
    try {
      const response = typeof err.context.clone === 'function' ? err.context.clone() : err.context;
      const errorBody = await response.json();
      if (errorBody?.error && typeof errorBody.error === 'string') {
        return errorBody.error;
      }
      if (typeof errorBody?.error?.message === 'string') {
        return errorBody.error.message;
      }
      if (errorBody?.message && typeof errorBody.message === 'string') {
        return errorBody.message;
      }
    } catch {
      // Fall through to err.message on JSON extraction error
    }
  }
  return err?.message || 'Sync failed';
}
import { VendorSyncLog } from '@/types';
import { IngestionEngine } from '@/engine/ingestion';
import { WebhookService } from '@/services/webhook';
import { WebhookConfigService } from '@/services/webhookConfigService';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { getAdapterByCode } from '@/adapters';
import { RedHatCsafAdapter } from '@/adapters/redhat-csaf';
import { NutanixAdapter } from '@/adapters/nutanix';

// The vendors SyncService actually contacts today. Kept as the single source
// of truth so the UI can state sync coverage truthfully instead of guessing.
export const SYNCED_VENDOR_CODES = ['redhat', 'nutanix'] as const;

// BUG-003: a full vendor run can build a functions.invoke body of tens of MB,
// which the self-hosted Edge Runtime supervisor kills. Bound the size of each
// data-carrying invoke instead.
const PERSIST_CHUNK_MAX_BYTES = 3_000_000;

interface PersistChunk {
  advisories: any[];
  cves: any[];
  mappings: any[];
}

function measureUtf8(obj: unknown): number {
  return new TextEncoder().encode(JSON.stringify(obj)).length;
}

/**
 * Splits a run into chunks of advisories, each carrying its own advisories,
 * the CVEs those advisories map to, and the matching mappings. A chunk is
 * closed when adding the next advisory would push the serialised body over
 * PERSIST_CHUNK_MAX_BYTES. A single advisory that alone exceeds the budget is
 * still sent as its own chunk (never dropped, never split).
 */
function buildPersistChunks(
  advisories: any[],
  cves: any[],
  mappings: any[],
  vendorCode: string
): PersistChunk[] {
  const cveById = new Map(cves.map((c) => [c.id, c]));
  const mappingsByAdvisory = new Map<string, any[]>();
  for (const m of mappings) {
    const list = mappingsByAdvisory.get(m.advisory_id) ?? [];
    list.push(m);
    mappingsByAdvisory.set(m.advisory_id, list);
  }

  const baseEnvelopeBytes = measureUtf8({
    action: 'persist_ingestion',
    vendorCode,
    advisories: [],
    cves: [],
    mappings: [],
  });

  const itemByteCache = new WeakMap<object, number>();
  function getItemBytes(item: any): number {
    if (item && typeof item === 'object') {
      let size = itemByteCache.get(item);
      if (size === undefined) {
        size = measureUtf8(item);
        itemByteCache.set(item, size);
      }
      return size;
    }
    return measureUtf8(item);
  }

  const chunks: PersistChunk[] = [];
  let current: PersistChunk = { advisories: [], cves: [], mappings: [] };
  let currentCveIds = new Set<string>();
  let currentBytes = baseEnvelopeBytes;

  for (const adv of advisories) {
    const advMappings = mappingsByAdvisory.get(adv.id) ?? [];
    const advCveIds = new Set(advMappings.map((m) => m.cve_id));

    const newCveIdsForCurrent = Array.from(advCveIds).filter((id) => !currentCveIds.has(id));
    const newCvesForCurrent = newCveIdsForCurrent.map((id) => cveById.get(id)).filter(Boolean);

    let deltaBytes = getItemBytes(adv) + (current.advisories.length > 0 ? 1 : 0);
    for (let i = 0; i < newCvesForCurrent.length; i++) {
      deltaBytes += getItemBytes(newCvesForCurrent[i]) + (current.cves.length + i > 0 ? 1 : 0);
    }
    for (let i = 0; i < advMappings.length; i++) {
      deltaBytes += getItemBytes(advMappings[i]) + (current.mappings.length + i > 0 ? 1 : 0);
    }

    if (
      current.advisories.length > 0 &&
      currentBytes + deltaBytes > PERSIST_CHUNK_MAX_BYTES
    ) {
      chunks.push(current);
      const freshCves = Array.from(advCveIds).map((id) => cveById.get(id)).filter(Boolean);
      current = { advisories: [adv], cves: freshCves, mappings: [...advMappings] };
      currentCveIds = new Set(advCveIds);

      currentBytes = baseEnvelopeBytes + getItemBytes(adv);
      for (let i = 0; i < freshCves.length; i++) {
        currentBytes += getItemBytes(freshCves[i]) + (i > 0 ? 1 : 0);
      }
      for (let i = 0; i < advMappings.length; i++) {
        currentBytes += getItemBytes(advMappings[i]) + (i > 0 ? 1 : 0);
      }
    } else {
      current.advisories.push(adv);
      for (const c of newCvesForCurrent) current.cves.push(c);
      for (const m of advMappings) current.mappings.push(m);
      for (const id of newCveIdsForCurrent) currentCveIds.add(id);
      currentBytes += deltaBytes;
    }
  }

  if (current.advisories.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

export class SyncService {
  private webhookService = new WebhookService();
  private webhookConfigService = new WebhookConfigService();

  /**
   * Rebuilds the WebhookService's registered set from the currently active
   * configs so a sync can raise alerts. Every call clears the previous set
   * first: a deleted config must stop firing and an edited config must be
   * picked up, not merged with a stale snapshot from an earlier call in the
   * same session. Never throws.
   */
  async loadWebhooks(): Promise<number> {
    let configs: Awaited<ReturnType<WebhookConfigService['fetchWebhooks']>> = [];
    try {
      configs = await this.webhookConfigService.fetchWebhooks();
    } catch (err) {
      console.warn('Failed to load webhook configs:', err);
      this.webhookService?.clearWebhooks?.();
      return 0;
    }

    this.webhookService?.clearWebhooks?.();

    let registered = 0;
    for (const config of configs) {
      if (!config.is_active) continue;
      this.webhookService?.registerWebhook?.(config);
      registered++;
    }

    return registered;
  }

  /**
   * Already-persisted CVE ids, so the engine can suppress webhook alerts for
   * CVEs seen in a previous run (BUG-003). A query failure must not abort
   * the caller — fall back to an empty set instead.
   */
  private async fetchKnownCveIds(): Promise<string[]> {
    try {
      const { data, error } = await fetchAllRows<{ cve_id: string }>((from, to) =>
        supabase.from('cves').select('cve_id').range(from, to)
      );
      if (error) {
        console.warn('Failed to fetch known CVE ids for de-duplication:', error.message);
        return [];
      }
      return (data || []).map((row) => row.cve_id);
    } catch (err) {
      console.warn('Failed to fetch known CVE ids for de-duplication:', err);
      return [];
    }
  }

  async fetchSyncLogs(): Promise<VendorSyncLog[]> {
    try {
      const { data, error } = await supabase
        .from('vendor_sync_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50);

      if (error) {
        console.warn('Error fetching sync logs:', error.message);
        return [];
      }

      return (data || []).map((row) => ({
        id: row.id,
        vendor_id: row.vendor_id,
        vendor_code: row.vendor_code,
        status: row.status,
        items_fetched: row.items_fetched || 0,
        new_items_count: row.new_items_count || 0,
        error_message: row.error_message || undefined,
        duration_ms: row.duration_ms || 0,
        started_at: row.started_at,
        finished_at: row.finished_at,
        details: row.details || {},
      }));
    } catch (err) {
      console.error('Failed to fetch sync logs:', err);
      return [];
    }
  }

  async syncVendors(
    vendorCodes?: string[],
    options?: { mode?: 'auto' | 'server' | 'client' }
  ): Promise<{ success: boolean; newLogs: VendorSyncLog[]; errors?: string[] }> {
    const mode = options?.mode ?? 'auto';
    const targets = vendorCodes && vendorCodes.length > 0 ? vendorCodes : SYNCED_VENDOR_CODES;

    let canAttemptServer = mode === 'server';
    if (mode === 'auto') {
      try {
        const session = await supabase?.auth?.getSession?.();
        if (session?.data?.session?.access_token && session?.data?.session?.user) {
          canAttemptServer = true;
        }
      } catch {
        // Fall back to client
      }
    }

    if (canAttemptServer) {
      try {
        const headers = await getFunctionHeaders();
        const { data, error } = await supabase.functions.invoke('sync-cve', {
          headers,
          body: {
            action: 'trigger_manual_sync',
            vendorCodes: targets,
          },
        });

        if (error) {
          const errorMsg = await extractErrorMessage(error);
          const isTransportError =
            errorMsg.includes('Unsupported action') ||
            errorMsg.includes('404') ||
            errorMsg.includes('Failed to send a request') ||
            errorMsg.includes('Failed to fetch') ||
            errorMsg.includes('FunctionsFetchError') ||
            errorMsg.includes('fetch failed') ||
            errorMsg.includes('NetworkError');

          if (isTransportError || mode === 'auto') {
            console.warn('Server-side manual sync unsupported or unreachable; falling back to client execution:', errorMsg);
          } else {
            return {
              success: false,
              newLogs: (data?.logs ?? []) as VendorSyncLog[],
              errors: [errorMsg],
            };
          }
        } else if (data) {
          return {
            success: Boolean(data.success),
            newLogs: (data.logs ?? []) as VendorSyncLog[],
            errors: (data.errors ?? []) as string[],
          };
        }
      } catch (invokeErr: any) {
        const errorMsg = await extractErrorMessage(invokeErr);
        const isTransportError =
          errorMsg.includes('Unsupported action') ||
          errorMsg.includes('404') ||
          errorMsg.includes('Failed to send a request') ||
          errorMsg.includes('Failed to fetch') ||
          errorMsg.includes('FunctionsFetchError') ||
          errorMsg.includes('fetch failed') ||
          errorMsg.includes('NetworkError');

        if (!isTransportError && mode === 'server') {
          return {
            success: false,
            newLogs: [],
            errors: [errorMsg],
          };
        }
        console.warn('Server-side manual sync invocation exception; falling back to client execution:', errorMsg);
      }
    }

    // Register active webhooks before ingestion so alerts actually go out. A
    // load failure must not abort the sync — loadWebhooks never throws.
    await this.loadWebhooks();

    const knownCveIds = await this.fetchKnownCveIds();
    const knownCveIdSet = new Set(knownCveIds);

    const newLogs: VendorSyncLog[] = [];
    const errors: string[] = [];
    let allSucceeded = true;
    for (const code of targets) {
      const startTime = Date.now();
      // Per-iteration guard: at most one entry in `errors` per vendor. The
      // ingest failure reason is the root cause and wins over any transport
      // error that follows it in the same iteration.
      let recordedError = false;

      // Instantiate a fresh IngestionEngine per vendor to prevent accumulating
      // advisories, CVEs, and mappings across vendors (matching scheduled-sync architecture).
      const engine = new IngestionEngine({ webhookService: this.webhookService, knownCveIds: knownCveIdSet });

      try {
        const result = await engine.ingestVendor(code);
        const duration = result.durationMs || Date.now() - startTime;

        // Record the in-memory failure reason before any persist call runs —
        // a persist failure below jumps straight to the catch block, which
        // would otherwise discard this message in favour of the transport
        // error.
        if (result.status === 'FAILED' && result.errorMessage) {
          errors.push(result.errorMessage);
          recordedError = true;
        }

        // Persist CVEs, Advisories and Mappings via the sync-cve edge function
        // (runs with service-role key server-side). BUG-003: split into chunks
        // bounded by PERSIST_CHUNK_MAX_BYTES so no single invoke body grows
        // with the feed, then close the run with one syncMeta-only call so
        // exactly one vendor_sync_logs row is written.
        const advisories = engine.getAdvisories().filter((a) => a.vendor_id === code);
        const cves = engine.getCves();
        const mappings = engine.getMappings();
        const chunks = buildPersistChunks(advisories, cves, mappings, code);

        const headers = await getFunctionHeaders();

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const { error: chunkError } = await supabase.functions.invoke('sync-cve', {
            headers,
            body: {
              action: 'persist_ingestion',
              vendorCode: code,
              advisories: chunk.advisories,
              cves: chunk.cves,
              mappings: chunk.mappings,
            },
          });

          if (chunkError) throw chunkError;
        }

        const { data, error } = await supabase.functions.invoke('sync-cve', {
          headers,
          body: {
            action: 'persist_ingestion',
            vendorCode: code,
            advisories: [],
            cves: [],
            mappings: [],
            syncMeta: {
              startedAt: new Date(startTime).toISOString(),
              durationMs: duration,
              status: result.status,
              errorMessage: result.errorMessage ?? null,
              itemsFetched: advisories.length,
              newItemsCount: result.newCvesCount,
              details: result.details ?? {},
            },
          },
        });

        if (error) throw error;

        if (result.status === 'FAILED') {
          allSucceeded = false;
        }

        if (data?.log) {
          newLogs.push(data.log as VendorSyncLog);
        }

        // Record newly ingested CVEs so subsequent vendors in the same run do not re-count or re-alert them.
        for (const c of cves) {
          knownCveIdSet.add(c.cve_id);
        }
      } catch (err: any) {
        allSucceeded = false;
        const duration = Date.now() - startTime;
        const errorMessage = await extractErrorMessage(err);
        if (!recordedError) {
          errors.push(errorMessage);
        }

        try {
          const headers = await getFunctionHeaders();
          const { data: errData, error: errDataError } = await supabase.functions.invoke('sync-cve', {
            headers,
            body: {
              action: 'persist_ingestion',
              vendorCode: code,
              advisories: [],
              cves: [],
              mappings: [],
              syncMeta: {
                startedAt: new Date(startTime).toISOString(),
                durationMs: duration,
                status: 'FAILED',
                errorMessage,
                details: {
                  error_message: errorMessage,
                  duration_ms: duration,
                  failed_at: new Date().toISOString(),
                },
              },
            },
          });

          if (errDataError) {
            console.error(`Failed to persist FAILED sync log for vendor ${code}:`, errDataError);
          }

          if (errData?.log) {
            newLogs.push(errData.log as VendorSyncLog);
          }
        } catch (persistErr) {
          console.error(`Failed to persist FAILED sync log for vendor ${code}:`, persistErr);
        }
      }
    }

    const uniqueErrors = Array.from(new Set(errors));
    return {
      success: allSucceeded,
      newLogs,
      errors: uniqueErrors,
    };
  }

  async fetchAndIngestQuery(query: string): Promise<boolean> {
    const q = query.trim().toUpperCase();
    let vendorCode = 'redhat';
    const redhatAdapter = getAdapterByCode('redhat') as RedHatCsafAdapter;
    const nutanixAdapter = getAdapterByCode('nutanix') as NutanixAdapter | undefined;

    try {
      const detailDocuments: unknown[] = [];

      if (q.startsWith('RHSA-') || q.startsWith('RHBA-') || q.startsWith('RHEA-')) {
        vendorCode = 'redhat';
        const res = await fetch(redhatAdapter.advisoryDetailUrl(q));
        if (!res.ok) return false;
        detailDocuments.push(await res.json());
      } else if (q.startsWith('NXSA-')) {
        if (!nutanixAdapter) return false;
        vendorCode = 'nutanix';
        const res = await fetch(nutanixAdapter.advisoryDetailUrl(q));
        if (!res.ok) return false;
        const doc = await res.json();
        if (doc) detailDocuments.push(doc);
      } else {
        // Try Red Hat reverse lookup first
        const listRes = await fetch(redhatAdapter.cveLookupUrl(q));
        let foundRedhat = false;
        if (listRes.ok) {
          const list = (await listRes.json()) as { RHSA?: string }[];
          if (Array.isArray(list) && list.length > 0) {
            foundRedhat = true;
            vendorCode = 'redhat';
            const BATCH_SIZE = 5;
            for (let i = 0; i < list.length; i += BATCH_SIZE) {
              const batch = list.slice(i, i + BATCH_SIZE);
              const batchDocs = await Promise.all(
                batch.map(async (entry) => {
                  if (!entry.RHSA) return null;
                  try {
                    const detailRes = await fetch(redhatAdapter.advisoryDetailUrl(entry.RHSA));
                    if (detailRes.ok) {
                      return await detailRes.json();
                    }
                  } catch {
                    // Skip this advisory rather than failing the whole batch.
                  }
                  return null;
                })
              );
              for (const doc of batchDocs) {
                if (doc !== null) detailDocuments.push(doc);
              }
            }
          }
        }

        // If not found in Red Hat, check Nutanix vulnerability search
        if (!foundRedhat && nutanixAdapter) {
          try {
            const nutanixRes = await fetch(nutanixAdapter.vulnerabilityLookupUrl(), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ searchQuery: q, page: 1, pageSize: 10 }),
            });
            if (nutanixRes.ok) {
              const nutanixData = (await nutanixRes.json()) as { vulnerabilities?: any[] };
              const vulns = Array.isArray(nutanixData?.vulnerabilities) ? nutanixData.vulnerabilities : [];
              const targetAdvisoryIds = new Set<string>();
              for (const v of vulns) {
                const prod = v.productName === 'Prism' ? 'PC' : (v.productName || 'AOS');
                if (Array.isArray(v.fixedReleases)) {
                  for (const rel of v.fixedReleases) {
                    const cleanRel = String(rel).replace(/^(pc\.|ahv[-.]|aos[-.]|afs[-.])/i, '');
                    targetAdvisoryIds.add(`NXSA-${prod}-${cleanRel}`);
                    if (String(rel).toUpperCase().startsWith('NXSA-')) {
                      targetAdvisoryIds.add(String(rel));
                    } else {
                      targetAdvisoryIds.add(`NXSA-${prod}-${rel}`);
                    }
                  }
                }
              }

              for (const advId of targetAdvisoryIds) {
                try {
                  const detailRes = await fetch(nutanixAdapter.advisoryDetailUrl(advId));
                  if (detailRes.ok) {
                    const doc = await detailRes.json();
                    if (doc && doc.advisory_id) {
                      detailDocuments.push(doc);
                      vendorCode = 'nutanix';
                      break;
                    }
                  }
                } catch {
                  // Skip failed detail fetch
                }
              }
            }
          } catch {
            // Ignore Nutanix lookup error
          }
        }
      }

      if (detailDocuments.length === 0) {
        return false;
      }

      await this.loadWebhooks();
      const knownCveIds = await this.fetchKnownCveIds();
      const engine = new IngestionEngine({
        knownCveIds,
        webhookService: this.webhookService,
      });
      const startTime = Date.now();
      const startedAt = new Date(startTime).toISOString();
      const result = await engine.ingestVendor(vendorCode, detailDocuments);
      const durationMs = Date.now() - startTime;

      const advisories = engine.getAdvisories();

      // Nothing could be normalised out of the response — reporting success
      // here would make the UI claim it saved records it never wrote.
      if (engine.getCves().length === 0) {
        return false;
      }

      const syncMeta = {
        startedAt,
        durationMs,
        status: 'SUCCESS' as const,
        errorMessage: null,
        itemsFetched: advisories.length,
        newItemsCount: result.newCvesCount,
        details: result.details ?? {},
      };

      const chunks = buildPersistChunks(advisories, engine.getCves(), engine.getMappings(), vendorCode);
      const headers = await getFunctionHeaders();
      if (chunks.length === 1) {
        const chunk = chunks[0];
        const { error } = await supabase.functions.invoke('sync-cve', {
          headers,
          body: {
            action: 'persist_ingestion',
            vendorCode,
            advisories: chunk.advisories,
            cves: chunk.cves,
            mappings: chunk.mappings,
            syncMeta,
          },
        });
        if (error) {
          const errDetail = await extractErrorMessage(error);
          console.error('On-demand fetch error:', errDetail);
          return false;
        }
      } else {
        for (const chunk of chunks) {
          const { error: chunkError } = await supabase.functions.invoke('sync-cve', {
            headers,
            body: {
              action: 'persist_ingestion',
              vendorCode,
              advisories: chunk.advisories,
              cves: chunk.cves,
              mappings: chunk.mappings,
            },
          });
          if (chunkError) {
            const errDetail = await extractErrorMessage(chunkError);
            console.error('On-demand fetch error:', errDetail);
            return false;
          }
        }

        const { error } = await supabase.functions.invoke('sync-cve', {
          headers,
          body: {
            action: 'persist_ingestion',
            vendorCode,
            advisories: [],
            cves: [],
            mappings: [],
            syncMeta,
          },
        });
        if (error) {
          const errDetail = await extractErrorMessage(error);
          console.error('On-demand fetch error:', errDetail);
          return false;
        }
      }

      return true;
    } catch (e) {
      console.error('On-demand fetch error:', e);
      return false;
    }
  }
}

