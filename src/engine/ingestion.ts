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
  details?: Record<string, unknown>;
}

export class IngestionEngine {
  private advisories = new Map<string, Advisory>();
  private cves = new Map<string, CveRecord>();
  private mappings: AdvisoryCveMap[] = [];
  private syncLogs: VendorSyncLog[] = [];
  private webhookService?: WebhookService;
  private knownCveIds: Set<string>;
  private pendingAlerts: WebhookAlertPayload[] = [];

  constructor(options?: IngestionEngineOptions) {
    this.webhookService = options?.webhookService;
    this.knownCveIds = new Set(options?.knownCveIds ?? []);
  }

  async ingestVendor(vendorCode: string, rawPayload?: unknown): Promise<IngestionResult> {
    const startTime = Date.now();
    const adapter = getAdapterByCode(vendorCode);

    if (!adapter) {
      const durationMs = Date.now() - startTime;
      const details = {
        reason: 'adapter_not_found',
        vendor_code: vendorCode,
        duration_ms: durationMs,
      };
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
        details,
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
        details,
      };
    }

    try {
      const items: NormalizedAdvisoryItem[] = rawPayload !== undefined
        ? adapter.parse(rawPayload)
        : await adapter.fetchAdvisories();

      let newCvesCount = 0;
      let totalCves = 0;

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

        const seenAdvCves = new Set<string>();
        for (const cve of item.cves) {
          const cveKey = cve.cveId;
          if (seenAdvCves.has(cveKey)) continue;
          seenAdvCves.add(cveKey);

          totalCves++;
          const isNew = !this.cves.has(cveKey);
          const isTrulyNew = isNew && !this.knownCveIds.has(cveKey);
          if (isTrulyNew) newCvesCount++;

          const cveRecord: CveRecord = {
            id: `cve-${cveKey}`,
            cve_id: cve.cveId,
            description: cve.description || null,
            description_fallback: item.title,
            cvss_v3_score: cve.cvssScore ?? null,
            cvss_v3_vector: cve.cvssVector ?? null,
            severity: cve.severity || item.severity,
            is_known_exploited: false,
            published_date: item.publishedAt,
            created_at: new Date().toISOString(),
          };
          this.cves.set(cveKey, cveRecord);

          const mapId = `map-${advKey}-${cveKey}`;
          const existingMapIndex = this.mappings.findIndex((m) => m.id === mapId);
          if (existingMapIndex >= 0) {
            const existing = this.mappings[existingMapIndex];
            const mergedProducts = Array.from(new Set([...(existing.affected_products || []), ...(cve.affectedProducts || [])]));
            const mergedImpacts = [...(existing.product_impacts || []), ...(cve.productImpacts || [])];
            const mergedVersions = Array.from(new Set([...(existing.fixed_versions || []), ...(cve.fixedVersions || [])]));
            this.mappings[existingMapIndex] = {
              ...existing,
              affected_products: mergedProducts,
              product_impacts: mergedImpacts,
              fixed_versions: mergedVersions,
            };
          } else {
            this.mappings.push({
              id: mapId,
              advisory_id: advisoryRecord.id,
              cve_id: cveRecord.id,
              affected_products: cve.affectedProducts || [],
              product_impacts: cve.productImpacts || [],
              fixed_versions: cve.fixedVersions || [],
              created_at: new Date().toISOString(),
            });
          }


          // Queue an alert only for CVEs new to this run AND not already
          // persisted, otherwise every re-sync re-alerts (BUG-003). Every
          // severity is queued; each webhook's min_severity decides delivery.
          if (this.webhookService && isTrulyNew) {
            this.pendingAlerts.push({
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

      const durationMs = Date.now() - startTime;
      const details = {
        advisories_count: items.length,
        cves_count: totalCves,
        new_cves_count: newCvesCount,
        duration_ms: durationMs,
        endpoints: adapter.endpoints?.map((e) => e.url) || [],
        completed_at: new Date().toISOString(),
      };
      const log: VendorSyncLog = {
        id: `log-${Date.now()}`,
        vendor_code: vendorCode,
        status: 'SUCCESS',
        items_fetched: items.length,
        new_items_count: newCvesCount,
        duration_ms: durationMs,
        started_at: new Date(startTime).toISOString(),
        finished_at: new Date().toISOString(),
        details,
      };
      this.syncLogs.push(log);

      return {
        vendorCode,
        status: 'SUCCESS',
        advisoriesCount: items.length,
        cvesCount: totalCves,
        newCvesCount,
        durationMs,
        details,
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      const message = err instanceof Error ? err.message : 'Unknown error during ingestion';
      const details = {
        error_name: err instanceof Error ? err.name : typeof err,
        error_stack: err instanceof Error ? err.stack : undefined,
        duration_ms: durationMs,
        endpoints: adapter ? (adapter.endpoints?.map((e) => e.url) || []) : [],
        failed_at: new Date().toISOString(),
      };
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
        details,
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
        details,
      };
    }
  }

  /**
   * Sends the alerts queued by ingestVendor. Callers invoke this only after the
   * run is persisted: alerting first meant a failed write re-alerted the same
   * CVEs on the next run, because they were still unknown to the database.
   */
  async dispatchPendingAlerts(): Promise<void> {
    const alerts = this.pendingAlerts;
    this.pendingAlerts = [];
    if (!this.webhookService || alerts.length === 0) return;
    // Concurrent so one slow hook cannot serialise the whole batch (BUG-003).
    await Promise.allSettled(alerts.map((alert) => this.webhookService!.notifyAll(alert)));
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
