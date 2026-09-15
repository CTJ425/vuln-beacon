import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '@/App';
import { CveService } from '@/services/cveService';
import { SyncService } from '@/services/syncService';
import { WebhookConfigService } from '@/services/webhookConfigService';
import { AdvisoryService } from '@/services/advisoryService';
import { VendorService } from '@/services/vendorService';

// A failed initial load must not be indistinguishable from an empty database.
// Before this guard, App.loadData swallowed the failure into console.error and
// the Dashboard still rendered the "no data yet, go and sync" prompt, which tells
// the operator to run a sync when the real problem is that Supabase is unreachable.

const ADVISORY = {
  id: 'adv-state-1',
  advisory_id: 'RHSA-2026:3001',
  title: 'Kernel Security Update',
  severity: 'HIGH',
  published_at: '2026-09-01T00:00:00Z',
  url: 'https://access.redhat.com/errata/RHSA-2026:3001',
  vendor_code: 'redhat',
  vendor_name: 'Red Hat',
  cves: [],
  product_impacts: [],
  affected_products: ['Red Hat Enterprise Linux 9'],
  fixed_versions: [],
} as any;

describe('E2E: Page state (loading / empty / error)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    try {
      window.localStorage.clear();
    } catch {}

    vi.spyOn(CveService.prototype, 'fetchCves').mockResolvedValue([]);
    vi.spyOn(VendorService.prototype, 'fetchVendors').mockResolvedValue([]);
    vi.spyOn(SyncService.prototype, 'fetchSyncLogs').mockResolvedValue([]);
    vi.spyOn(WebhookConfigService.prototype, 'fetchWebhooks').mockResolvedValue([]);
  });

  it('surfaces a retryable error state when the initial data load fails', async () => {
    vi.spyOn(AdvisoryService.prototype, 'fetchAdvisories').mockRejectedValue(
      new Error('supabase unreachable')
    );

    render(<App />);

    const errorState = await screen.findByTestId('page-state-error', {}, { timeout: 4000 });
    expect(errorState).toHaveTextContent(/unable to load/i);

    // The empty-database prompt must not be shown when the load actually failed.
    expect(screen.queryByText(/Go to Admin Console/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('recovers to the dashboard when the retry succeeds', async () => {
    const fetchAdvisories = vi
      .spyOn(AdvisoryService.prototype, 'fetchAdvisories')
      .mockRejectedValueOnce(new Error('supabase unreachable'))
      .mockResolvedValue([ADVISORY]);

    render(<App />);

    await screen.findByTestId('page-state-error', {}, { timeout: 4000 });
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });
    await waitFor(() => expect(fetchAdvisories).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId('page-state-error')).not.toBeInTheDocument();
  });

  it('still shows the empty-database prompt when the load succeeds with no data', async () => {
    vi.spyOn(AdvisoryService.prototype, 'fetchAdvisories').mockResolvedValue([]);

    render(<App />);

    await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });
    expect(screen.getByTestId('page-state-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('page-state-error')).not.toBeInTheDocument();
  });
});
