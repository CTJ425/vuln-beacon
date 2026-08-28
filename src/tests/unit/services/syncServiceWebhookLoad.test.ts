import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebhookConfig } from '@/types';

const mockRegisterWebhook = vi.fn();
const mockClearWebhooks = vi.fn();
const mockFetchWebhooks = vi.fn();

vi.mock('@/services/webhook', () => ({
  WebhookService: vi.fn().mockImplementation(() => ({
    registerWebhook: mockRegisterWebhook,
    clearWebhooks: mockClearWebhooks,
    notifyAll: vi.fn(),
    dispatch: vi.fn(),
  })),
}));

vi.mock('@/services/webhookConfigService', () => ({
  WebhookConfigService: vi.fn().mockImplementation(() => ({
    fetchWebhooks: mockFetchWebhooks,
  })),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn(), functions: { invoke: vi.fn() } },
}));

import { SyncService } from '@/services/syncService';

const config = (over: Partial<WebhookConfig> = {}): WebhookConfig => ({
  id: 'wh-1',
  name: 'Ops Discord',
  platform: 'discord',
  webhook_url: 'https://example.test/hook',
  min_severity: 'HIGH',
  is_active: true,
  created_at: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('SyncService webhook loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers every active webhook so a sync can raise alerts', async () => {
    mockFetchWebhooks.mockResolvedValue([config(), config({ id: 'wh-2', name: 'Ops Slack', platform: 'slack' })]);

    const loaded = await new SyncService().loadWebhooks();

    expect(loaded).toBe(2);
    expect(mockRegisterWebhook).toHaveBeenCalledTimes(2);
    expect(mockRegisterWebhook).toHaveBeenCalledWith(expect.objectContaining({ id: 'wh-1' }));
  });

  it('skips inactive webhooks', async () => {
    mockFetchWebhooks.mockResolvedValue([config({ id: 'wh-off', is_active: false })]);

    const loaded = await new SyncService().loadWebhooks();

    expect(loaded).toBe(0);
    expect(mockRegisterWebhook).not.toHaveBeenCalled();
  });

  it('degrades to zero webhooks instead of throwing when the config read fails', async () => {
    mockFetchWebhooks.mockRejectedValue(new Error('boom'));

    await expect(new SyncService().loadWebhooks()).resolves.toBe(0);
    expect(mockRegisterWebhook).not.toHaveBeenCalled();
  });

  it('does not accumulate duplicates when the same config is loaded twice', async () => {
    mockFetchWebhooks.mockResolvedValue([config()]);

    const service = new SyncService();
    await service.loadWebhooks();
    await service.loadWebhooks();

    // Registered once per load, but against a cleared list — never appended twice.
    expect(mockClearWebhooks).toHaveBeenCalledTimes(2);
    expect(mockRegisterWebhook).toHaveBeenCalledTimes(2);
  });

  it('stops dispatching to a webhook that was deleted between two syncs', async () => {
    const service = new SyncService();

    mockFetchWebhooks.mockResolvedValue([config({ id: 'wh-doomed' })]);
    await service.loadWebhooks();

    mockFetchWebhooks.mockResolvedValue([]);
    const loaded = await service.loadWebhooks();

    expect(loaded).toBe(0);
    // The stale entry must be dropped, not kept alive for the rest of the session.
    expect(mockClearWebhooks).toHaveBeenCalledTimes(2);
    expect(mockRegisterWebhook).toHaveBeenCalledTimes(1);
  });

  it('picks up an edited webhook url on the next load', async () => {
    const service = new SyncService();

    mockFetchWebhooks.mockResolvedValue([config({ webhook_url: 'https://example.test/old' })]);
    await service.loadWebhooks();

    mockFetchWebhooks.mockResolvedValue([config({ webhook_url: 'https://example.test/new' })]);
    await service.loadWebhooks();

    expect(mockRegisterWebhook).toHaveBeenLastCalledWith(
      expect.objectContaining({ webhook_url: 'https://example.test/new' })
    );
  });
});
