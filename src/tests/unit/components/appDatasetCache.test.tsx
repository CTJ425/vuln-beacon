import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockReadCachedDataset = vi.fn();
vi.mock('@/lib/explorerDataset', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/explorerDataset')>()),
  readCachedDataset: () => mockReadCachedDataset(),
}));

import { App } from '@/App';
import { CveService } from '@/services/cveService';
import { SyncService } from '@/services/syncService';
import { WebhookConfigService } from '@/services/webhookConfigService';
import { AdvisoryService, AdvisoryRowItem } from '@/services/advisoryService';
import { VendorService } from '@/services/vendorService';
import { supabase } from '@/lib/supabase';
import { dataset, dsAdvisory } from '../../helpers/explorerDataset';

const cached = dataset({ advisories: [dsAdvisory({ id: 'a-cached', advisory_id: 'RHSA-2026:7001', severity: 'CRITICAL' })] });

const fresh = [{
  id: 'a-fresh', advisory_id: 'RHSA-2026:8001', title: 'fresh advisory', severity: 'CRITICAL',
  published_at: '2026-09-20T00:00:00Z', vendor_code: 'redhat', vendor_name: 'Red Hat',
  cves: [], product_impacts: [], affected_products: [], fixed_versions: [],
}] as unknown as AdvisoryRowItem[];

const never = () => new Promise<never>(() => {});

describe('App shows the last cached dataset while it loads fresh data', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockReadCachedDataset.mockReset().mockResolvedValue(cached);
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({ data: { session: null }, error: null } as any);
    vi.spyOn(supabase.auth, 'onAuthStateChange').mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } } as any);
    vi.spyOn(VendorService.prototype, 'fetchVendors').mockResolvedValue([]);
    vi.spyOn(SyncService.prototype, 'fetchSyncLogs').mockResolvedValue([]);
    vi.spyOn(WebhookConfigService.prototype, 'fetchWebhooks').mockResolvedValue([]);
    vi.spyOn(CveService.prototype, 'fetchCves').mockResolvedValue([]);
  });

  it('renders cached advisories before the network answers', async () => {
    vi.spyOn(AdvisoryService.prototype, 'fetchAdvisories').mockImplementation(never);
    render(<App />);
    expect(await screen.findByText('RHSA-2026:7001', {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it('replaces the cached rows once fresh data arrives', async () => {
    vi.spyOn(AdvisoryService.prototype, 'fetchAdvisories').mockResolvedValue(fresh);
    render(<App />);
    expect(await screen.findByText('RHSA-2026:8001', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByText('RHSA-2026:7001')).not.toBeInTheDocument();
  });

  it('never lets a late cache read overwrite fresh data', async () => {
    let releaseCache: (v: unknown) => void = () => {};
    mockReadCachedDataset.mockReturnValue(new Promise((r) => { releaseCache = r; }));
    vi.spyOn(AdvisoryService.prototype, 'fetchAdvisories').mockResolvedValue(fresh);
    render(<App />);
    expect(await screen.findByText('RHSA-2026:8001', {}, { timeout: 4000 })).toBeInTheDocument();
    releaseCache(cached);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByText('RHSA-2026:8001')).toBeInTheDocument();
    expect(screen.queryByText('RHSA-2026:7001')).not.toBeInTheDocument();
  });

  it('keeps the cached rows and reports the error when the fresh load fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(AdvisoryService.prototype, 'fetchAdvisories').mockRejectedValue(new Error('offline'));
    render(<App />);
    expect(await screen.findByText(/Unable to load security data/i, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByText('RHSA-2026:7001')).toBeInTheDocument();
  });
});
