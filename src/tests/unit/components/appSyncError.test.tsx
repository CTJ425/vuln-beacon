import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '@/App';
import { supabase } from '@/lib/supabase';
import { CveService } from '@/services/cveService';
import { SyncService } from '@/services/syncService';
import { WebhookConfigService } from '@/services/webhookConfigService';
import { AdvisoryService } from '@/services/advisoryService';

/**
 * BUG-003. The generic "one or more vendor feeds could not be ingested" string hid the
 * real cause (an Edge Function 500) for the whole investigation. When syncVendors()
 * returns a FAILED log carrying an error_message, the UI must show that message.
 */
const failedLog = (errorMessage: string | null) => ({
  id: 'log-1',
  vendor_id: 'v1',
  vendor_code: 'redhat',
  status: 'FAILED' as const,
  items_fetched: 0,
  new_items_count: 0,
  error_message: errorMessage,
  duration_ms: 10,
  started_at: '2026-01-01T00:00:00.000Z',
  finished_at: '2026-01-01T00:00:00.010Z',
});

// R2: manual sync is reachable only from the authenticated Admin Console, so the
// BUG-003 assertions below must sign in first. The behaviour under test is unchanged.
const triggerSync = async () => {
  const mockUser = { id: 'admin-1', email: 'admin@vulnbeacon.com', app_metadata: { role: 'admin' } };
  vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({
    data: {
      user: mockUser as any,
      session: { user: mockUser, access_token: 'fake-jwt' } as any,
    },
    error: null,
  } as any);

  render(<App />);

  fireEvent.click(await screen.findByText('Admin Console'));
  fireEvent.change(await screen.findByLabelText(/Email/i), {
    target: { value: 'admin@vulnbeacon.com' },
  });
  fireEvent.change(screen.getByLabelText(/Password/i), {
    target: { value: 'SuperSecret123!' },
  });
  fireEvent.click(screen.getByRole('button', { name: /登入後台/i }));

  fireEvent.click(await screen.findByRole('tab', { name: /同步監控/i }, { timeout: 4000 }));
  fireEvent.click(await screen.findByText('Trigger Sync Run', {}, { timeout: 4000 }));
};

describe('App surfaces the real sync failure reason (BUG-003)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(AdvisoryService.prototype, 'fetchAdvisories').mockResolvedValue([]);
    vi.spyOn(CveService.prototype, 'fetchCves').mockResolvedValue([]);
    vi.spyOn(WebhookConfigService.prototype, 'fetchWebhooks').mockResolvedValue([]);
    vi.spyOn(SyncService.prototype, 'fetchSyncLogs').mockResolvedValue([]);
  });

  it('shows the error_message of the failed log', async () => {
    vi.spyOn(SyncService.prototype, 'syncVendors').mockResolvedValue({
      success: false,
      newLogs: [failedLog('WorkerRequestCancelled: request has been cancelled by supervisor')],
    });

    await triggerSync();

    await waitFor(() =>
      expect(
        screen.getByText(/WorkerRequestCancelled: request has been cancelled by supervisor/)
      ).toBeTruthy()
    );
  });

  it('falls back to the generic message when no failed log carries a reason', async () => {
    vi.spyOn(SyncService.prototype, 'syncVendors').mockResolvedValue({
      success: false,
      newLogs: [failedLog(null)],
    });

    await triggerSync();

    await waitFor(() =>
      expect(
        screen.getByText('Sync failed: one or more vendor feeds could not be ingested.')
      ).toBeTruthy()
    );
  });

  it('falls back to the generic message when no logs are returned at all', async () => {
    vi.spyOn(SyncService.prototype, 'syncVendors').mockResolvedValue({
      success: false,
      newLogs: [],
    });

    await triggerSync();

    await waitFor(() =>
      expect(
        screen.getByText('Sync failed: one or more vendor feeds could not be ingested.')
      ).toBeTruthy()
    );
  });
});

/**
 * The persistence-failure case: the sync-cve invoke itself failed, so no
 * vendor_sync_logs row could be written and `newLogs` is empty. The reason
 * syncVendors() carries in `errors` must still reach the user.
 */
describe('App surfaces a failure reason that could not be persisted', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(AdvisoryService.prototype, 'fetchAdvisories').mockResolvedValue([]);
    vi.spyOn(CveService.prototype, 'fetchCves').mockResolvedValue([]);
    vi.spyOn(WebhookConfigService.prototype, 'fetchWebhooks').mockResolvedValue([]);
    vi.spyOn(SyncService.prototype, 'fetchSyncLogs').mockResolvedValue([]);
  });

  it('shows the in-memory error when no log row could be written', async () => {
    vi.spyOn(SyncService.prototype, 'syncVendors').mockResolvedValue({
      success: false,
      newLogs: [],
      errors: ['Failed to send a request to the Edge Function'],
    });

    await triggerSync();

    await waitFor(() =>
      expect(
        screen.getByText(/Failed to send a request to the Edge Function/)
      ).toBeTruthy()
    );
  });

  it('prefers the persisted log message over the in-memory one', async () => {
    vi.spyOn(SyncService.prototype, 'syncVendors').mockResolvedValue({
      success: false,
      newLogs: [failedLog('Edge Function returned a non-2xx status code')],
      errors: ['Edge Function returned a non-2xx status code'],
    });

    await triggerSync();

    await waitFor(() =>
      expect(
        screen.getByText('Sync failed: Edge Function returned a non-2xx status code')
      ).toBeTruthy()
    );
  });
});

/**
 * fetchCves/fetchAdvisories now reject on a load failure instead of returning
 * []. A successful sync followed by a failed reload must say exactly that,
 * not "Sync failed", and must not blank the rows already on screen.
 */
describe('App reports a failed reload after a successful sync', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(CveService.prototype, 'fetchCves').mockResolvedValue([]);
    vi.spyOn(WebhookConfigService.prototype, 'fetchWebhooks').mockResolvedValue([]);
    vi.spyOn(SyncService.prototype, 'fetchSyncLogs').mockResolvedValue([]);
  });

  it('says the sync completed and the reload failed', async () => {
    vi.spyOn(AdvisoryService.prototype, 'fetchAdvisories')
      .mockResolvedValueOnce([])
      .mockRejectedValue(new Error('network down'));
    vi.spyOn(SyncService.prototype, 'syncVendors').mockResolvedValue({ success: true, newLogs: [] });
    await triggerSync();
    await waitFor(() =>
      expect(screen.getByText(/Sync complete, but reloading the data failed: network down/)).toBeTruthy()
    );
    expect(screen.queryByText(/^Sync failed/)).toBeNull();
  });
});
