import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();
const mockFrom = vi.fn();
const mockGetSession = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
    functions: { invoke: (...args: any[]) => mockInvoke(...args) },
    auth: { getSession: () => mockGetSession() },
    supabaseKey: 'mock-supabase-key-123',
  },
}));

vi.mock('@/engine/ingestion', () => ({
  IngestionEngine: vi.fn().mockImplementation(() => ({
    ingestVendor: vi.fn().mockResolvedValue({
      status: 'SUCCESS',
      advisoriesCount: 0,
      cvesCount: 0,
      newCvesCount: 0,
      durationMs: 10,
    }),
    getAdvisories: vi.fn().mockReturnValue([]),
    getCves: vi.fn().mockReturnValue([]),
    getMappings: vi.fn().mockReturnValue([]),
  })),
}));

vi.mock('@/services/webhook', () => ({
  WebhookService: vi.fn().mockImplementation(() => ({
    registerWebhook: vi.fn(),
    clearWebhooks: vi.fn(),
    notifyAll: vi.fn(),
    dispatch: vi.fn().mockResolvedValue(true),
  })),
}));

import { getFunctionHeaders } from '@/lib/functionAuth';
import { SyncService } from '@/services/syncService';
import { WebhookConfigService } from '@/services/webhookConfigService';
import { VendorService } from '@/services/vendorService';

describe('Function Auth Headers and Client Services Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'custom-jwt-token-456' } },
      error: null,
    });
    mockInvoke.mockResolvedValue({
      data: { success: true },
      error: null,
    });
    mockFrom.mockReturnValue({
      select: () =>
        Object.assign(Promise.resolve({ data: [], error: null }), {
          range: () => Promise.resolve({ data: [], error: null }),
          order: () => Promise.resolve({ data: [], error: null }),
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      insert: () => Object.assign(Promise.resolve({ data: {}, error: null }), { select: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }) }),
      delete: () => Object.assign(Promise.resolve({ error: null }), { eq: () => Promise.resolve({ error: null }) }),
    });
  });

  describe('getFunctionHeaders()', () => {
    it('uses session access_token when available', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'user-jwt-token' } },
        error: null,
      });

      const headers = await getFunctionHeaders();
      expect(headers.Authorization).toBe('Bearer user-jwt-token');
      expect(headers.apikey).toBe('user-jwt-token');
    });

    it('falls back to client key when session is absent', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const headers = await getFunctionHeaders();
      expect(headers.Authorization).toBe('Bearer mock-supabase-key-123');
      expect(headers.apikey).toBe('mock-supabase-key-123');
    });

    it('returns empty headers when no token, client key or env key is present', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });
      const { supabase } = await import('@/lib/supabase');
      const originalKey = (supabase as any).supabaseKey;
      const originalEnv = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const originalMeta = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY;
      (supabase as any).supabaseKey = '';
      delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if ((import.meta as any).env) {
        delete (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY;
      }
      try {
        const headers = await getFunctionHeaders();
        expect(headers.Authorization).toBeUndefined();
        expect(headers.apikey).toBeUndefined();
      } finally {
        (supabase as any).supabaseKey = originalKey;
        if (originalEnv !== undefined) process.env.VITE_SUPABASE_PUBLISHABLE_KEY = originalEnv;
        if ((import.meta as any).env && originalMeta !== undefined) {
          (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY = originalMeta;
        }
      }
    });
  });

  describe('SyncService passes Authorization headers', () => {
    it('syncVendors passes headers with Authorization token to invoke', async () => {
      const service = new SyncService();
      await service.syncVendors(undefined, { mode: 'client' });

      expect(mockInvoke).toHaveBeenCalled();
      for (const call of mockInvoke.mock.calls) {
        const [fnName, options] = call;
        expect(fnName).toBe('sync-cve');
        expect(options.headers).toBeDefined();
        expect(options.headers.Authorization).toMatch(/^Bearer \S+/);
      }
    });
  });

  describe('WebhookConfigService passes Authorization headers', () => {
    it('createWebhook passes Authorization header to invoke', async () => {
      mockInvoke.mockResolvedValue({
        data: { success: true, data: { id: 'w1', name: 'hook', platform: 'discord', webhook_url: 'https://discord.com/hook' } },
        error: null,
      });

      const service = new WebhookConfigService();
      await service.createWebhook({
        name: 'hook',
        platform: 'discord',
        webhook_url: 'https://discord.com/hook',
        min_severity: 'HIGH',
        is_active: true,
      });

      expect(mockInvoke).toHaveBeenCalledWith(
        'sync-cve',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Bearer \S+/),
          }),
          body: expect.objectContaining({ action: 'create_webhook' }),
        })
      );
    });

    it('deleteWebhook passes Authorization header to invoke', async () => {
      mockInvoke.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const service = new WebhookConfigService();
      await service.deleteWebhook('w1');

      expect(mockInvoke).toHaveBeenCalledWith(
        'sync-cve',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Bearer \S+/),
          }),
          body: expect.objectContaining({ action: 'delete_webhook', id: 'w1' }),
        })
      );
    });

    it('testWebhook passes Authorization header to invoke', async () => {
      mockInvoke.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const service = new WebhookConfigService();
      await service.testWebhook({
        id: 'w1',
        name: 'hook',
        platform: 'discord',
        webhook_url: 'https://discord.com/hook',
        min_severity: 'HIGH',
        is_active: true,
        created_at: new Date().toISOString(),
      });

      expect(mockInvoke).toHaveBeenCalledWith(
        'sync-cve',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Bearer \S+/),
          }),
          body: expect.objectContaining({ action: 'test_webhook' }),
        })
      );
    });
  });

  describe('VendorService passes Authorization headers', () => {
    it('updateSchedule passes Authorization header to invoke', async () => {
      mockInvoke.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const service = new VendorService();
      await service.updateSchedule('redhat', {
        enabled: true,
        times: ['08:00'],
        timezone: 'Asia/Taipei',
      });

      expect(mockInvoke).toHaveBeenCalledWith(
        'sync-cve',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Bearer \S+/),
          }),
          body: expect.objectContaining({ action: 'update_vendor_schedule' }),
        })
      );
    });
  });
});
