import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '@/App';
import { CveService } from '@/services/cveService';
import { SyncService } from '@/services/syncService';
import { WebhookConfigService } from '@/services/webhookConfigService';
import { AdvisoryService } from '@/services/advisoryService';
import { VendorService } from '@/services/vendorService';

describe('E2E: Collapsible Sidebar Feature', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    try {
      window.localStorage.clear();
    } catch {}

    vi.spyOn(AdvisoryService.prototype, 'fetchAdvisories').mockResolvedValue([
      {
        id: 'adv-collapse-1',
        advisory_id: 'RHSA-2026:1001',
        title: 'Kernel Security Update',
        severity: 'HIGH',
        published_at: '2026-09-01T00:00:00Z',
        url: 'https://access.redhat.com/errata/RHSA-2026:1001',
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

  it('renders expanded sidebar by default with 240px width and visible labels', async () => {
    render(<App />);
    await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

    const sidebar = screen.getByTestId('sidebar-container');
    expect(sidebar).toHaveAttribute('data-collapsed', 'false');
    expect(window.getComputedStyle(sidebar).width).toBe('240px');

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('CVE Explorer')).toBeInTheDocument();
    expect(screen.getByText('Admin Console')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-version')).toBeVisible();

    const collapseBtn = screen.getByTestId('sidebar-collapse-button');
    expect(collapseBtn).toBeInTheDocument();
    expect(collapseBtn).toHaveAttribute('aria-label', expect.stringMatching(/收起|collapse/i));
  });

  it('collapses sidebar when clicking sidebar collapse button and expands back', async () => {
    render(<App />);
    await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

    const sidebar = screen.getByTestId('sidebar-container');
    const collapseBtn = screen.getByTestId('sidebar-collapse-button');

    // Click collapse button in sidebar footer
    fireEvent.click(collapseBtn);

    expect(sidebar).toHaveAttribute('data-collapsed', 'true');
    expect(window.getComputedStyle(sidebar).width).toBe('64px');

    // Text labels should be hidden
    expect(screen.queryByText('Overview')).not.toBeInTheDocument();
    expect(screen.queryByText('CVE Explorer')).not.toBeInTheDocument();
    expect(screen.queryByText('Admin Console')).not.toBeInTheDocument();

    // Version text is visually hidden in footer
    const versionEl = screen.getByTestId('sidebar-version');
    expect(window.getComputedStyle(versionEl).display).toBe('none');

    // Click expand button to restore
    fireEvent.click(screen.getByTestId('sidebar-collapse-button'));

    expect(sidebar).toHaveAttribute('data-collapsed', 'false');
    expect(window.getComputedStyle(sidebar).width).toBe('240px');
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('CVE Explorer')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-version')).toBeVisible();
  });

  it('allows collapsing and expanding via the header toggle button', async () => {
    render(<App />);
    await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

    const sidebar = screen.getByTestId('sidebar-container');
    const headerToggle = screen.getByTestId('header-sidebar-toggle');
    expect(headerToggle).toBeInTheDocument();
    expect(headerToggle).toHaveAttribute('aria-label', expect.stringMatching(/收起|collapse/i));

    // Collapse via header toggle
    fireEvent.click(headerToggle);
    expect(sidebar).toHaveAttribute('data-collapsed', 'true');
    expect(window.getComputedStyle(sidebar).width).toBe('64px');
    expect(headerToggle).toHaveAttribute('aria-label', expect.stringMatching(/展開|expand/i));

    // Expand via header toggle
    fireEvent.click(headerToggle);
    expect(sidebar).toHaveAttribute('data-collapsed', 'false');
    expect(window.getComputedStyle(sidebar).width).toBe('240px');
  });

  it('allows navigation while collapsed', async () => {
    render(<App />);
    await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

    // Collapse sidebar
    fireEvent.click(screen.getByTestId('sidebar-collapse-button'));

    // Accessibility contract: Navigation items are discoverable by role and name even when collapsed
    const explorerBtn = screen.getByRole('button', { name: 'CVE Explorer' });
    expect(explorerBtn).toBeInTheDocument();
    fireEvent.click(explorerBtn);

    expect(await screen.findByRole('heading', { level: 4, name: /Explorer/i }, { timeout: 4000 })).toBeInTheDocument();
  });

  it('persists collapsed state in localStorage across renders', async () => {
    try {
      window.localStorage.setItem('vulnbeacon-sidebar-collapsed', 'true');
    } catch {}

    render(<App />);
    await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

    const sidebar = screen.getByTestId('sidebar-container');
    expect(sidebar).toHaveAttribute('data-collapsed', 'true');
    expect(window.getComputedStyle(sidebar).width).toBe('64px');
  });
});
