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
  WebhookService: vi.fn().mockImplementation(() => ({})),
}));

import { SyncService } from '@/services/syncService';

const PROTECTED_TABLES = ['advisories', 'cves', 'advisory_cve_map', 'vendor_sync_logs'];

/** Answers the CSAF reverse-index and detail endpoints the query flow uses. */
const mockCsafFetch = () =>
  vi.fn(async (url: any) => {
    const u = String(url);
    if (u.includes('csaf.json?cve=')) {
      return { ok: true, json: async () => [{ RHSA: 'RHSA-2026:1001', CVEs: ['CVE-2026-1'] }] };
    }
    return { ok: true, json: async () => ({ document: { tracking: { id: 'RHSA-2026:1001' } } }) };
  });


describe('SyncService persists via the sync-cve edge function, not direct table writes', () => {
  beforeEach(() => {
    mockInvoke.mockReset().mockResolvedValue({
      data: { success: true, log: { id: 'log-1', vendor_code: 'redhat', status: 'SUCCESS' } },
      error: null,
    });
    mockFrom.mockReset().mockReturnValue({
      select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
    });
    mockIngestVendor.mockReset().mockResolvedValue({
      status: 'SUCCESS',
      advisoriesCount: 1,
      cvesCount: 1,
      newCvesCount: 1,
      durationMs: 10,
    });
    mockGetAdvisories.mockReset().mockReturnValue([
      {
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
      },
    ]);
    mockGetCves.mockReset().mockReturnValue([
      {
        id: 'cve-CVE-2026-1',
        cve_id: 'CVE-2026-1',
        description: 'desc',
        severity: 'HIGH',
        is_known_exploited: false,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);
    mockGetMappings.mockReset().mockReturnValue([
      {
        id: 'map-1',
        advisory_id: 'adv-redhat:RHSA-2026:1',
        cve_id: 'cve-CVE-2026-1',
        affected_products: [],
        fixed_versions: [],
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });

  it('syncVendors() calls the sync-cve edge function with action=persist_ingestion', async () => {
    const service = new SyncService();
    await service.syncVendors();

    expect(mockInvoke).toHaveBeenCalledWith(
      'sync-cve',
      expect.objectContaining({
        body: expect.objectContaining({
          action: 'persist_ingestion',
          vendorCode: 'redhat',
        }),
      })
    );
  });

  it('syncVendors() never writes directly to protected tables', async () => {
    const service = new SyncService();
    await service.syncVendors();

    const protectedWrites = mockFrom.mock.calls.filter(([table]) => PROTECTED_TABLES.includes(table));
    expect(protectedWrites).toHaveLength(0);
  });

  it('fetchAndIngestQuery() calls the sync-cve edge function instead of writing directly', async () => {
    global.fetch = mockCsafFetch() as any;

    const service = new SyncService();
    const ok = await service.fetchAndIngestQuery('CVE-2026-1');

    expect(ok).toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith(
      'sync-cve',
      expect.objectContaining({
        body: expect.objectContaining({
          action: 'persist_ingestion',
          vendorCode: 'redhat',
        }),
      })
    );

    const protectedWrites = mockFrom.mock.calls.filter(([table]) => PROTECTED_TABLES.includes(table));
    expect(protectedWrites).toHaveLength(0);
  });

  it('fetchAndIngestQuery() reports failure when the payload parsed to nothing', async () => {
    // The CSAF endpoints answered, but nothing could be normalised out of the
    // documents — reporting success here makes the UI claim it saved data it did not.
    global.fetch = mockCsafFetch() as any;
    mockGetAdvisories.mockReturnValue([]);
    mockGetCves.mockReturnValue([]);
    mockGetMappings.mockReturnValue([]);

    const service = new SyncService();
    const ok = await service.fetchAndIngestQuery('CVE-2026-1');

    expect(ok).toBe(false);
  });

  it('fetchAndIngestQuery() returns false when the edge function call errors', async () => {
    global.fetch = mockCsafFetch() as any;
    mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    const service = new SyncService();
    const ok = await service.fetchAndIngestQuery('CVE-2026-1');

    expect(ok).toBe(false);
  });
});
