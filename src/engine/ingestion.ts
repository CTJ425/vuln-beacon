import {
  Advisory,
  CveRecord,
  AdvisoryCveMap,
  VendorSyncLog,
  NormalizedAdvisoryItem,
  SyncStatus,
  WebhookAlertPayload,
} from '@/types';
import { getAdapterByCode } from '@/adapters';
import { WebhookService } from '@/services/webhook';

export interface IngestionEngineOptions {
  webhookService?: WebhookService;
  knownCveIds?: Iterable<string>;
}


export interface IngestionResult {
  vendorCode: string;
  status: SyncStatus;
  advisoriesCount: number;
  cvesCount: number;
  newCvesCount: number;
  durationMs: number;
  errorMessage?: string;
}

export class IngestionEngine {
  private advisories = new Map<string, Advisory>();
  private cves = new Map<string, CveRecord>();
  private mappings: AdvisoryCveMap[] = [];
  private syncLogs: VendorSyncLog[] = [];
  private webhookService?: WebhookService;
  private knownCveIds: Set<string>;

  constructor(options?: IngestionEngineOptions) {
    this.webhookService = options?.webhookService;
    this.knownCveIds = new Set(options?.knownCveIds ?? []);
  }

  async ingestVendor(vendorCode: string, rawPayload?: unknown): Promise<IngestionResult> {
    const startTime = Date.now();
    const adapter = getAdapterByCode(vendorCode);

    if (!adapter) {
      const durationMs = Date.now() - startTime;
      const log: VendorSyncLog = {
        id: `log-${Date.now()}`,
        vendor_code: vendorCode,
        status: 'FAILED',
        items_fetched: 0,
        new_items_count: 0,
        error_message: `Unknown vendor adapter code: ${vendorCode}`,
        duration_ms: durationMs,
        started_at: new Date(startTime).toISOString(),
        finished_at: new Date().toISOString(),
      };
      this.syncLogs.push(log);
      return {
        vendorCode,
        status: 'FAILED',
        advisoriesCount: 0,
        cvesCount: 0,
        newCvesCount: 0,
        durationMs,
        errorMessage: log.error_message || undefined,
      };
    }

    try {
      const items: NormalizedAdvisoryItem[] = rawPayload !== undefined
        ? adapter.parse(rawPayload)
        : await adapter.fetchAdvisories();

      let newCvesCount = 0;
      let totalCves = 0;
      const pendingAlerts: WebhookAlertPayload[] = [];

      for (const item of items) {
        const advKey = `${vendorCode}:${item.advisoryId}`;
        const advisoryRecord: Advisory = {
          id: `adv-${advKey}`,
          vendor_id: vendorCode,
          advisory_id: item.advisoryId,
          title: item.title,
          severity: item.severity,
          published_at: item.publishedAt,
          updated_at: item.updatedAt,
          url: item.url,
          summary: item.summary,
          raw_payload: item.rawPayload,
          created_at: new Date().toISOString(),
        };
        this.advisories.set(advKey, advisoryRecord);

        for (const cve of item.cves) {
          totalCves++;
          const cveKey = cve.cveId;
          const isNew = !this.cves.has(cveKey);
          const isTrulyNew = isNew && !this.knownCveIds.has(cveKey);
          if (isTrulyNew) newCvesCount++;

          const cveRecord: CveRecord = {
            id: `cve-${cveKey}`,
            cve_id: cve.cveId,
            description: cve.description || item.title,
            cvss_v3_score: cve.cvssScore ?? null,
            cvss_v3_vector: cve.cvssVector ?? null,
            severity: cve.severity || item.severity,
            is_known_exploited: false,
            published_date: item.publishedAt,
            created_at: new Date().toISOString(),
          };
          this.cves.set(cveKey, cveRecord);

          this.mappings.push({
            id: `map-${advKey}-${cveKey}`,
            advisory_id: advisoryRecord.id,
            cve_id: cveRecord.id,
            affected_products: cve.affectedProducts || [],
            product_impacts: cve.productImpacts || [],
            fixed_versions: cve.fixedVersions || [],
            created_at: new Date().toISOString(),
          });


          // Queue webhook alert if critical or high, but only for CVEs that are
          // both new to this run AND not already persisted in the DB — otherwise
          // every re-sync re-alerts on the same CVEs (BUG-003).
          if (this.webhookService && isTrulyNew && (cveRecord.severity === 'CRITICAL' || cveRecord.severity === 'HIGH')) {
            pendingAlerts.push({
              vendorName: adapter.vendorName,
              advisoryId: item.advisoryId,
              advisoryTitle: item.title,
              advisoryUrl: item.url,
              cveId: cve.cveId,
              cvssScore: cve.cvssScore,
              severity: cveRecord.severity,
              summary: cve.description || item.summary,
              affectedProducts: cve.affectedProducts,
              fixedVersions: cve.fixedVersions,
            });
          }
        }
      }

      // Dispatch all queued alerts concurrently so one slow hook cannot
      // serialise the whole ingestion (BUG-003).
      if (this.webhookService && pendingAlerts.length > 0) {
        await Promise.allSettled(pendingAlerts.map((alert) => this.webhookService!.notifyAll(alert)));
      }

      const durationMs = Date.now() - startTime;
      const log: VendorSyncLog = {
        id: `log-${Date.now()}`,
        vendor_code: vendorCode,
        status: 'SUCCESS',
        items_fetched: items.length,
        new_items_count: newCvesCount,
        duration_ms: durationMs,
        started_at: new Date(startTime).toISOString(),
        finished_at: new Date().toISOString(),
      };
      this.syncLogs.push(log);

      return {
        vendorCode,
        status: 'SUCCESS',
        advisoriesCount: items.length,
        cvesCount: totalCves,
        newCvesCount,
        durationMs,
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      const message = err instanceof Error ? err.message : 'Unknown error during ingestion';
      const log: VendorSyncLog = {
        id: `log-${Date.now()}`,
        vendor_code: vendorCode,
        status: 'FAILED',
        items_fetched: 0,
        new_items_count: 0,
        error_message: message,
        duration_ms: durationMs,
        started_at: new Date(startTime).toISOString(),
        finished_at: new Date().toISOString(),
      };
      this.syncLogs.push(log);

      return {
        vendorCode,
        status: 'FAILED',
        advisoriesCount: 0,
        cvesCount: 0,
        newCvesCount: 0,
        durationMs,
        errorMessage: message,
      };
    }
  }

  getAdvisories(): Advisory[] {
    return Array.from(this.advisories.values());
  }

  getCves(): CveRecord[] {
    return Array.from(this.cves.values());
  }

  getMappings(): AdvisoryCveMap[] {
    return [...this.mappings];
  }

  getSyncLogs(): VendorSyncLog[] {
    return [...this.syncLogs];
  }
}
