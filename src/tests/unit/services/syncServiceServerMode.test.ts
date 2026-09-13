import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();
const mockFrom = vi.fn();
const mockGetSession = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
    functions: { invoke: (...args: any[]) => mockInvoke(...args) },
    auth: {
      getSession: () => mockGetSession(),
    },
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

import { SyncService, isTransportError } from '@/services/syncService';

describe('SyncService — Server-Side Manual Sync Trigger (Task 11c, TDD)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'fake-jwt-token',
          user: { id: 'admin-user-1', email: 'admin@vulnbeacon.com' },
        },
      },
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        range: vi.fn().mockResolvedValue({ data: [], error: null }),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    mockIngestVendor.mockResolvedValue({
      status: 'SUCCESS',
      advisoriesCount: 1,
      newCvesCount: 1,
      durationMs: 50,
      details: {},
    });
    mockGetAdvisories.mockReturnValue([]);
    mockGetCves.mockReturnValue([]);
    mockGetMappings.mockReturnValue([]);
  });

  it('triggers server-side manual sync when authenticated session is present in auto mode', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        ran: ['redhat', 'nutanix'],
        failed: [],
        logs: [
          {
            id: 'log-1',
            vendor_code: 'redhat',
            status: 'SUCCESS',
            items_fetched: 5,
            new_items_count: 2,
            duration_ms: 120,
            started_at: '2026-09-09T00:00:00Z',
            finished_at: '2026-09-09T00:00:01Z',
          },
        ],
        errors: [],
      },
      error: null,
    });

    const service = new SyncService();
    const result = await service.syncVendors();

    expect(mockInvoke).toHaveBeenCalledWith(
      'sync-cve',
      expect.objectContaining({
        body: {
          action: 'trigger_manual_sync',
          vendorCodes: ['redhat', 'nutanix', 'ubuntu', 'debian', 'suse', 'cisco', 'vmware'],
        },
      })
    );
    expect(result.success).toBe(true);
    expect(result.newLogs).toHaveLength(1);
    expect(result.newLogs[0].vendor_code).toBe('redhat');
  });

  it('triggers server-side manual sync when mode is explicitly set to server', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        ran: ['redhat'],
        failed: [],
        logs: [],
        errors: [],
      },
      error: null,
    });

    const service = new SyncService();
    const result = await service.syncVendors(['redhat'], { mode: 'server' });

    expect(mockInvoke).toHaveBeenCalledWith(
      'sync-cve',
      expect.objectContaining({
        body: {
          action: 'trigger_manual_sync',
          vendorCodes: ['redhat'],
        },
      })
    );
    expect(result.success).toBe(true);
  });

  it('surfaces 409 lock conflict error when server-side sync is already running', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        message: 'A threat feed synchronization is already in progress',
        context: {
          json: async () => ({
            success: false,
            error: 'A threat feed synchronization is already in progress',
          }),
        },
      },
    });

    const service = new SyncService();
    const result = await service.syncVendors(undefined, { mode: 'server' });

    expect(result.success).toBe(false);
    expect(result.errors).toContain('A threat feed synchronization is already in progress');
  });

  it('surfaces 409 lock conflict error in auto mode without falling back to client', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        message: 'A threat feed synchronization is already in progress',
        context: {
          json: async () => ({
            success: false,
            error: 'A threat feed synchronization is already in progress',
          }),
        },
      },
    });

    const service = new SyncService();
    const result = await service.syncVendors(undefined, { mode: 'auto' });

    expect(result.success).toBe(false);
    expect(result.errors).toContain('A threat feed synchronization is already in progress');
    // Ensure persist_ingestion was NOT invoked (no client-side fallback)
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith(
      'sync-cve',
      expect.objectContaining({
        body: expect.objectContaining({
          action: 'trigger_manual_sync',
        }),
      })
    );
  });

  it('surfaces operational error thrown as exception in auto mode without falling back to client', async () => {
    mockInvoke.mockRejectedValue(new Error('Unauthorized: Admin privileges required'));

    const service = new SyncService();
    const result = await service.syncVendors(undefined, { mode: 'auto' });

    expect(result.success).toBe(false);
    expect(result.errors).toContain('Unauthorized: Admin privileges required');
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('falls back to client-side ingestion when mode is explicitly set to client', async () => {
    mockInvoke.mockResolvedValue({
      data: { log: { id: 'client-log-1', status: 'SUCCESS' } },
      error: null,
    });

    const service = new SyncService();
    await service.syncVendors(['redhat'], { mode: 'client' });

    // Should call persist_ingestion, NOT trigger_manual_sync
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

  it('falls back to client-side ingestion when user is unauthenticated in auto mode', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
    });
    mockInvoke.mockResolvedValue({
      data: { log: { id: 'anon-log-1', status: 'SUCCESS' } },
      error: null,
    });

    const service = new SyncService();
    await service.syncVendors(['redhat'], { mode: 'auto' });

    // Should call persist_ingestion, NOT trigger_manual_sync
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

  it('falls back to client-side ingestion in auto mode when server invocation returns FunctionsFetchError', async () => {
    // First call is trigger_manual_sync which fails with FunctionsFetchError
    // Subsequent calls are client-side chunking/persist_ingestion
    mockInvoke
      .mockResolvedValueOnce({
        data: null,
        error: new Error('FunctionsFetchError: Failed to send a request to the Edge Function'),
      })
      .mockResolvedValue({
        data: { log: { id: 'fallback-log-1', status: 'SUCCESS' } },
        error: null,
      });

    const service = new SyncService();
    const result = await service.syncVendors(['redhat'], { mode: 'auto' });

    expect(mockInvoke).toHaveBeenNthCalledWith(
      1,
      'sync-cve',
      expect.objectContaining({
        body: expect.objectContaining({
          action: 'trigger_manual_sync',
        }),
      })
    );
    expect(mockInvoke).toHaveBeenNthCalledWith(
      2,
      'sync-cve',
      expect.objectContaining({
        body: expect.objectContaining({
          action: 'persist_ingestion',
        }),
      })
    );
    expect(result.success).toBe(true);
  });

  it('falls back to client-side ingestion in server mode when server invocation throws network transport error', async () => {
    mockInvoke
      .mockRejectedValueOnce(new Error('Failed to send a request to the Edge Function'))
      .mockResolvedValue({
        data: { log: { id: 'fallback-log-server', status: 'SUCCESS' } },
        error: null,
      });

    const service = new SyncService();
    const result = await service.syncVendors(['redhat'], { mode: 'server' });

    expect(mockInvoke).toHaveBeenNthCalledWith(
      1,
      'sync-cve',
      expect.objectContaining({
        body: expect.objectContaining({
          action: 'trigger_manual_sync',
        }),
      })
    );
    expect(mockInvoke).toHaveBeenNthCalledWith(
      2,
      'sync-cve',
      expect.objectContaining({
        body: expect.objectContaining({
          action: 'persist_ingestion',
        }),
      })
    );
    expect(result.success).toBe(true);
  });

  it('surfaces 401 unauthorized error in auto mode without falling back to client', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        name: 'FunctionsHttpError',
        context: {
          status: 401,
          json: async () => ({
            success: false,
            error: 'Unauthorized: Admin authentication required for manual sync',
          }),
        },
      },
    });

    const service = new SyncService();
    const result = await service.syncVendors(undefined, { mode: 'auto' });

    expect(result.success).toBe(false);
    expect(result.errors).toContain('Unauthorized: Admin authentication required for manual sync');
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('falls back to client-side ingestion in auto mode when server invocation returns FunctionsRelayError', async () => {
    mockInvoke
      .mockResolvedValueOnce({
        data: null,
        error: {
          name: 'FunctionsRelayError',
          message: 'Relay Error invoking the Edge Function',
        },
      })
      .mockResolvedValue({
        data: { log: { id: 'fallback-relay-log', status: 'SUCCESS' } },
        error: null,
      });

    const service = new SyncService();
    const result = await service.syncVendors(['redhat'], { mode: 'auto' });

    expect(mockInvoke).toHaveBeenNthCalledWith(
      1,
      'sync-cve',
      expect.objectContaining({
        body: expect.objectContaining({
          action: 'trigger_manual_sync',
        }),
      })
    );
    expect(mockInvoke).toHaveBeenNthCalledWith(
      2,
      'sync-cve',
      expect.objectContaining({
        body: expect.objectContaining({
          action: 'persist_ingestion',
        }),
      })
    );
    expect(result.success).toBe(true);
  });

  it('falls back to client-side ingestion in auto mode when server returns 404 Function not found', async () => {
    mockInvoke
      .mockResolvedValueOnce({
        data: null,
        error: {
          name: 'FunctionsHttpError',
          message: 'Edge Function returned a non-2xx status code',
          context: {
            status: 404,
            json: async () => ({ message: 'Function not found' }),
          },
        },
      })
      .mockResolvedValue({
        data: { log: { id: 'fallback-404-log', status: 'SUCCESS' } },
        error: null,
      });

    const service = new SyncService();
    const result = await service.syncVendors(['redhat'], { mode: 'auto' });

    expect(result.success).toBe(true);
  });

  it('falls back to client-side ingestion in auto mode when gateway returns 502 Bad Gateway text', async () => {
    mockInvoke
      .mockResolvedValueOnce({
        data: null,
        error: {
          name: 'FunctionsHttpError',
          message: 'Edge Function returned a non-2xx status code',
          context: {
            status: 502,
            text: async () => '502 Bad Gateway: Edge Runtime supervisor crashed',
          },
        },
      })
      .mockResolvedValue({
        data: { log: { id: 'fallback-502-log', status: 'SUCCESS' } },
        error: null,
      });

    const service = new SyncService();
    const result = await service.syncVendors(['redhat'], { mode: 'auto' });

    expect(result.success).toBe(true);
  });

  describe('isTransportError helper classification', () => {
    it('classifies network and infrastructure errors as transport errors', () => {
      expect(isTransportError({ name: 'FunctionsFetchError' }, 'Failed to send a request')).toBe(true);
      expect(isTransportError({ name: 'FunctionsRelayError' }, 'Relay Error invoking the Edge Function')).toBe(true);
      expect(isTransportError({ context: { status: 404 } }, 'Function not found')).toBe(true);
      expect(isTransportError({ context: { status: 502 } }, 'Bad Gateway')).toBe(true);
      expect(isTransportError({ context: { status: 503 } }, 'Service Unavailable')).toBe(true);
      expect(isTransportError({ context: { status: 504 } }, 'Gateway Timeout')).toBe(true);
      expect(isTransportError(new Error('fetch failed'), 'fetch failed')).toBe(true);
      expect(isTransportError(new Error('NetworkError when attempting to fetch resource'), 'NetworkError')).toBe(true);
      expect(isTransportError(null, 'Unsupported action')).toBe(true);
    });

    it('classifies operational errors as non-transport errors', () => {
      expect(isTransportError({ context: { status: 409 } }, 'A threat feed synchronization is already in progress')).toBe(false);
      expect(isTransportError({ context: { status: 401 } }, 'Unauthorized: Admin authentication required for manual sync')).toBe(false);
      expect(isTransportError({ context: { status: 403 } }, 'Forbidden')).toBe(false);
      expect(isTransportError({ context: { status: 500 } }, 'Database transaction rolled back')).toBe(false);
      expect(isTransportError(new Error('Invalid argument'), 'Invalid argument')).toBe(false);
    });
  });
});

