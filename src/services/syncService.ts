import { supabase } from '@/lib/supabase';
import { VendorSyncLog } from '@/types';
import { IngestionEngine } from '@/engine/ingestion';
import { WebhookService } from '@/services/webhook';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { getAdapterByCode } from '@/adapters';
import { RedHatCsafAdapter } from '@/adapters/redhat-csaf';

// The vendors SyncService actually contacts today. Kept as the single source
// of truth so the UI can state sync coverage truthfully instead of guessing.
export const SYNCED_VENDOR_CODES = ['redhat'] as const;

// BUG-003: a full vendor run can build a functions.invoke body of tens of MB,
// which the self-hosted Edge Runtime supervisor kills. Bound the size of each
// data-carrying invoke instead.
const PERSIST_CHUNK_MAX_BYTES = 3_000_000;

interface PersistChunk {
  advisories: any[];
  cves: any[];
  mappings: any[];
}

function persistChunkBodySize(vendorCode: string, chunk: PersistChunk): number {
  const json = JSON.stringify({
    action: 'persist_ingestion',
    vendorCode,
    advisories: chunk.advisories,
    cves: chunk.cves,
    mappings: chunk.mappings,
  });
  // functions.invoke transmits UTF-8 bytes, not UTF-16 code units. Non-ASCII
  // content (e.g. CJK component names from collapseLocalePackages) makes
  // json.length undershoot the real wire size, so measure encoded bytes.
  return new TextEncoder().encode(json).length;
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

  const chunks: PersistChunk[] = [];
  let current: PersistChunk = { advisories: [], cves: [], mappings: [] };
  let currentCveIds = new Set<string>();

  for (const adv of advisories) {
    const advMappings = mappingsByAdvisory.get(adv.id) ?? [];
    const advCveIds = new Set(advMappings.map((m) => m.cve_id));

    const newCveIdsForCurrent = Array.from(advCveIds).filter((id) => !currentCveIds.has(id));
    const newCvesForCurrent = newCveIdsForCurrent.map((id) => cveById.get(id)).filter(Boolean);

    const candidate: PersistChunk = {
      advisories: [...current.advisories, adv],
      cves: [...current.cves, ...newCvesForCurrent],
      mappings: [...current.mappings, ...advMappings],
    };

    if (
      current.advisories.length > 0 &&
      persistChunkBodySize(vendorCode, candidate) > PERSIST_CHUNK_MAX_BYTES
    ) {
      chunks.push(current);
      const freshCves = Array.from(advCveIds).map((id) => cveById.get(id)).filter(Boolean);
      current = { advisories: [adv], cves: freshCves, mappings: [...advMappings] };
      currentCveIds = new Set(advCveIds);
    } else {
      current = candidate;
      for (const id of newCveIdsForCurrent) currentCveIds.add(id);
    }
  }

  if (current.advisories.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

export class SyncService {
  private webhookService = new WebhookService();

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
      }));
    } catch (err) {
      console.error('Failed to fetch sync logs:', err);
      return [];
    }
  }

  async syncVendors(): Promise<{ success: boolean; newLogs: VendorSyncLog[] }> {
    // Already-persisted CVE ids, so the engine can suppress webhook alerts for
    // CVEs seen in a previous run (BUG-003). A query failure must not abort
    // the sync — fall back to an empty set instead.
    let knownCveIds: string[] = [];
    try {
      const { data, error } = await fetchAllRows<{ cve_id: string }>((from, to) =>
        supabase.from('cves').select('cve_id').range(from, to)
      );
      if (error) {
        console.warn('Failed to fetch known CVE ids for de-duplication:', error.message);
      } else {
        knownCveIds = (data || []).map((row) => row.cve_id);
      }
    } catch (err) {
      console.warn('Failed to fetch known CVE ids for de-duplication:', err);
    }

    const engine = new IngestionEngine({ webhookService: this.webhookService, knownCveIds });
    const newLogs: VendorSyncLog[] = [];
    let allSucceeded = true;

    for (const code of SYNCED_VENDOR_CODES) {
      const startTime = Date.now();

      try {
        const result = await engine.ingestVendor(code);
        const duration = result.durationMs || Date.now() - startTime;

        // Persist CVEs, Advisories and Mappings via the sync-cve edge function
        // (runs with service-role key server-side). BUG-003: split into chunks
        // bounded by PERSIST_CHUNK_MAX_BYTES so no single invoke body grows
        // with the feed, then close the run with one syncMeta-only call so
        // exactly one vendor_sync_logs row is written.
        const advisories = engine.getAdvisories().filter((a) => a.vendor_id === code);
        const cves = engine.getCves();
        const mappings = engine.getMappings();
        const chunks = buildPersistChunks(advisories, cves, mappings, code);

        for (const chunk of chunks) {
          const { error: chunkError } = await supabase.functions.invoke('sync-cve', {
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
              newItemsCount: cves.length,
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
      } catch (err: any) {
        allSucceeded = false;
        const duration = Date.now() - startTime;
        const { data: errData, error: errDataError } = await supabase.functions.invoke('sync-cve', {
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
              errorMessage: err?.message || 'Sync failed',
            },
          },
        });

        if (errDataError) {
          console.error(`Failed to persist FAILED sync log for vendor ${code}:`, errDataError);
        }

        if (errData?.log) {
          newLogs.push(errData.log as VendorSyncLog);
        }
      }
    }

    return {
      success: allSucceeded,
      newLogs,
    };
  }

  async fetchAndIngestQuery(query: string): Promise<boolean> {
    const q = query.trim().toUpperCase();
    const adapter = getAdapterByCode('redhat') as RedHatCsafAdapter;

    try {
      const detailDocuments: unknown[] = [];

      if (q.startsWith('RHSA-') || q.startsWith('RHBA-') || q.startsWith('RHEA-')) {
        const res = await fetch(adapter.advisoryDetailUrl(q));
        if (!res.ok) return false;
        detailDocuments.push(await res.json());
      } else {
        const listRes = await fetch(adapter.cveLookupUrl(q));
        if (!listRes.ok) return false;
        const list = (await listRes.json()) as { RHSA?: string }[];
        if (!Array.isArray(list) || list.length === 0) return false;

        const fetched = await Promise.all(
          list.map(async (entry) => {
            if (!entry.RHSA) return null;
            try {
              const detailRes = await fetch(adapter.advisoryDetailUrl(entry.RHSA));
              if (detailRes.ok) {
                return await detailRes.json();
              }
            } catch {
              // Skip this advisory rather than failing the whole batch.
            }
            return null;
          })
        );
        detailDocuments.push(...fetched.filter((doc) => doc !== null));
      }

      if (detailDocuments.length === 0) {
        return false;
      }

      const engine = new IngestionEngine();
      const startTime = Date.now();
      const startedAt = new Date(startTime).toISOString();
      await engine.ingestVendor('redhat', detailDocuments);
      const durationMs = Date.now() - startTime;

      // Nothing could be normalised out of the response — reporting success
      // here would make the UI claim it saved records it never wrote.
      if (engine.getCves().length === 0) {
        return false;
      }

      const { error } = await supabase.functions.invoke('sync-cve', {
        body: {
          action: 'persist_ingestion',
          vendorCode: 'redhat',
          advisories: engine.getAdvisories(),
          cves: engine.getCves(),
          mappings: engine.getMappings(),
          syncMeta: {
            startedAt,
            durationMs,
            status: 'SUCCESS',
            errorMessage: null,
          },
        },
      });

      if (error) return false;

      return true;
    } catch (e) {
      console.error('On-demand fetch error:', e);
      return false;
    }
  }
}

