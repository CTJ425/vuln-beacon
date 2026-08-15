import { describe, it, expect } from 'vitest';
import { CveService } from '@/services/cveService';
import { WebhookConfigService } from '@/services/webhookConfigService';
import { SyncService } from '@/services/syncService';

describe('Supabase Services (TDD)', () => {
  it('should initialize CveService and provide data retrieval operations', () => {
    const service = new CveService();
    expect(service).toBeDefined();
    expect(typeof service.fetchCves).toBe('function');
  });

  it('should initialize WebhookConfigService and provide webhook CRUD operations', () => {
    const service = new WebhookConfigService();
    expect(service).toBeDefined();
    expect(typeof service.fetchWebhooks).toBe('function');
    expect(typeof service.createWebhook).toBe('function');
    expect(typeof service.deleteWebhook).toBe('function');
  });

  it('should initialize SyncService and provide sync logs and ingestion trigger', () => {
    const service = new SyncService();
    expect(service).toBeDefined();
    expect(typeof service.fetchSyncLogs).toBe('function');
    expect(typeof service.syncVendors).toBe('function');
  });
});
