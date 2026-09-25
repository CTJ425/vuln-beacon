import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '@/App';
import { CveService } from '@/services/cveService';
import { SyncService } from '@/services/syncService';
import { WebhookConfigService } from '@/services/webhookConfigService';
import { AdvisoryService } from '@/services/advisoryService';
import { VendorService } from '@/services/vendorService';

// Regression guard for the mobile horizontal-overflow bug.
//
// The main content area is a flex child sitting next to the fixed-width sidebar.
// A flex item defaults to `min-width: auto`, so it refuses to shrink below the
// intrinsic width of its content. The Explorer tables declare `minWidth: 700`,
// which pushed `main` wider than the viewport and made the whole document scroll
// sideways. `min-width: 0` is what lets the inner TableContainer own the
// horizontal scroll instead.

describe('E2E: Responsive layout', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    try {
      window.localStorage.clear();
    } catch {}

    vi.spyOn(AdvisoryService.prototype, 'fetchAdvisories').mockResolvedValue([
      {
        id: 'adv-responsive-1',
        advisory_id: 'RHSA-2026:2001',
        title: 'Kernel Security Update',
        severity: 'HIGH',
        published_at: '2026-09-01T00:00:00Z',
        url: 'https://access.redhat.com/errata/RHSA-2026:2001',
        vendor_code: 'redhat',
        vendor_name: 'Red Hat',
        cves: [],
        product_impacts: [],
        affected_products: ['Red Hat Enterprise Linux 9'],
        fixed_versions: [],
      } as any,
    ]);

    vi.spyOn(CveService.prototype, 'fetchCves').mockResolvedValue([]);
    vi.spyOn(VendorService.prototype, 'fetchVendors').mockResolvedValue([
      {
        code: 'redhat',
        name: 'Red Hat',
        csaf_feed_url: 'https://access.redhat.com/security/data/csaf/v2/advisories/',
        is_active: true,
      } as any,
    ]);
    vi.spyOn(SyncService.prototype, 'fetchSyncLogs').mockResolvedValue([]);
    vi.spyOn(WebhookConfigService.prototype, 'fetchWebhooks').mockResolvedValue([]);
  });

  it('lets the main content area shrink below the intrinsic width of its content', async () => {
    render(<App />);
    await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

    const main = screen.getByRole('main');
    // jsdom reports a zero length without a unit.
    expect(window.getComputedStyle(main).minWidth).toMatch(/^0(px)?$/);
  });
});
