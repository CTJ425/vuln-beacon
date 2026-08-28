import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '@/App';
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

const triggerSync = async () => {
  render(<App />);
  fireEvent.click(await screen.findByText('Sync Monitor'));
  fireEvent.click(await screen.findByText('Trigger Sync Run'));
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
