import { supabase } from '@/lib/supabase';
import { VendorSyncLog } from '@/types';
import { IngestionEngine } from '@/engine/ingestion';
import { WebhookService } from '@/services/webhook';

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
    const engine = new IngestionEngine({ webhookService: this.webhookService });
    const vendorCodes = ['redhat'];
    const newLogs: VendorSyncLog[] = [];

    for (const code of vendorCodes) {
      const startTime = Date.now();

      try {
        const result = await engine.ingestVendor(code);
        const duration = result.durationMs || Date.now() - startTime;

        // Persist CVEs, Advisories and Mappings via the sync-cve edge function
        // (runs with service-role key server-side).
        const { data, error } = await supabase.functions.invoke('sync-cve', {
          body: {
            action: 'persist_ingestion',
            vendorCode: code,
            advisories: engine.getAdvisories().filter((a) => a.vendor_id === code),
            cves: engine.getCves(),
            mappings: engine.getMappings(),
            syncMeta: {
              startedAt: new Date(startTime).toISOString(),
              durationMs: duration,
              status: result.status,
              errorMessage: result.errorMessage ?? null,
            },
          },
        });

        if (error) throw error;

        if (data?.log) {
          newLogs.push(data.log as VendorSyncLog);
        }
      } catch (err: any) {
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
      success: true,
      newLogs,
    };
  }

  async fetchAndIngestQuery(query: string): Promise<boolean> {
    const q = query.trim().toUpperCase();

    try {
      const detailDocuments: unknown[] = [];

      if (q.startsWith('RHSA-') || q.startsWith('RHBA-') || q.startsWith('RHEA-')) {
        const res = await fetch(`https://access.redhat.com/hydra/rest/securitydata/csaf/${q}.json`);
        if (!res.ok) return false;
        detailDocuments.push(await res.json());
      } else {
        const listRes = await fetch(`https://access.redhat.com/hydra/rest/securitydata/csaf.json?cve=${q}`);
        if (!listRes.ok) return false;
        const list = (await listRes.json()) as { RHSA?: string }[];
        if (!Array.isArray(list) || list.length === 0) return false;

        const fetched = await Promise.all(
          list.map(async (entry) => {
            if (!entry.RHSA) return null;
            try {
              const detailRes = await fetch(`https://access.redhat.com/hydra/rest/securitydata/csaf/${entry.RHSA}.json`);
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

