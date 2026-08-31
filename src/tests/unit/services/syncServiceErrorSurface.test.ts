import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
    functions: { invoke: (...args: any[]) => mockInvoke(...args) },
  },
}));

const mockIngestVendor = vi.fn();
const mockGetAdvisories = vi.fn();
const mockGetCves = vi.fn();
const mockGetMappings = vi.fn();

vi.mock('@/engine/ingestion', () => ({
  IngestionEngine: vi.fn().mockImplementation(() => ({
    ingestVendor: mockIngestVendor,
    getAdvisories: mockGetAdvisories,
    getCves: mockGetCves,
    getMappings: mockGetMappings,
  })),
}));

vi.mock('@/services/webhook', () => ({
  WebhookService: vi.fn().mockImplementation(() => ({
    registerWebhook: vi.fn(),
    clearWebhooks: vi.fn(),
    notifyAll: vi.fn(),
    dispatch: vi.fn(),
  })),
}));

import { SyncService } from '@/services/syncService';

const advisory = {
  id: 'adv-redhat:RHSA-2026:1',
  vendor_id: 'redhat',
  advisory_id: 'RHSA-2026:1',
  title: 'Test advisory',
  severity: 'HIGH',
  published_at: '2026-01-01T00:00:00.000Z',
  url: 'https://example.test/RHSA-2026:1',
  summary: 'summary',
  raw_payload: {},
  created_at: '2026-01-01T00:00:00.000Z',
};

/**
 * The real failure reason of a sync run must survive a persistence failure.
 * When the `sync-cve` invoke itself fails, no vendor_sync_logs row can be
 * written, so `newLogs` comes back empty and the UI falls back to the useless
 * "one or more vendor feeds could not be ingested." string — even though
 * syncVendors() held the real message all along. syncVendors() must therefore
 * return the in-memory reasons as well, not only the persisted ones.
 */
describe('SyncService returns the failure reason even when it cannot be persisted', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockFrom.mockReset().mockImplementation(() => ({
      select: () =>
        Object.assign(Promise.resolve({ data: [], error: null }), {
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      insert: () => Promise.resolve({ data: [], error: null }),
      update: () => Promise.resolve({ data: [], error: null }),
      upsert: () => Promise.resolve({ data: [], error: null }),
      delete: () => Promise.resolve({ data: [], error: null }),
    }));
    mockIngestVendor.mockReset().mockResolvedValue({
      vendorCode: 'redhat',
      status: 'SUCCESS',
      advisoriesCount: 1,
      cvesCount: 0,
      newCvesCount: 0,
      durationMs: 10,
    });
    mockGetAdvisories.mockReset().mockReturnValue([advisory]);
    mockGetCves.mockReset().mockReturnValue([]);
    mockGetMappings.mockReset().mockReturnValue([]);
  });

  it('reports the transport error when every invoke fails, so no log row exists', async () => {
    mockInvoke.mockRejectedValue(new Error('Failed to send a request to the Edge Function'));

    const result = await new SyncService().syncVendors();

    expect(result.success).toBe(false);
    expect(result.newLogs).toEqual([]);
    expect(result.errors).toEqual(['Failed to send a request to the Edge Function']);
  });

  it('reports a non-2xx chunk error when the closing log call also fails', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error('Edge Function returned a non-2xx status code'),
    });

    const result = await new SyncService().syncVendors();

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(['Edge Function returned a non-2xx status code']);
  });

  it('reports the ingest failure reason when the log row cannot be written', async () => {
    mockIngestVendor.mockResolvedValue({
      vendorCode: 'redhat',
      status: 'FAILED',
      advisoriesCount: 0,
      cvesCount: 0,
      newCvesCount: 0,
      durationMs: 10,
      errorMessage: 'Failed to fetch Red Hat CSAF advisories: Too Many Requests',
    });
    mockGetAdvisories.mockReturnValue([]);
    mockInvoke.mockRejectedValue(new Error('Failed to send a request to the Edge Function'));

    const result = await new SyncService().syncVendors();

    // Exactly one entry: the ingest reason is the root cause, and the transport
    // error that followed must not add a second slot for the same vendor.
    expect(result.success).toBe(false);
    expect(result.errors).toEqual(['Failed to fetch Red Hat CSAF advisories: Too Many Requests']);
  });

  it('returns no errors for a successful run', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true, log: { id: 'log-1', vendor_code: 'redhat', status: 'SUCCESS' } },
      error: null,
    });

    const result = await new SyncService().syncVendors();

    expect(result.success).toBe(true);
    expect(result.errors ?? []).toEqual([]);
  });
});
