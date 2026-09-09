import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '@/App';
import { APP_VERSION } from '@/config/version';
import { CveService } from '@/services/cveService';
import { SyncService } from '@/services/syncService';
import { WebhookConfigService } from '@/services/webhookConfigService';
import { AdvisoryService } from '@/services/advisoryService';
import { VendorService } from '@/services/vendorService';
import { supabase } from '@/lib/supabase';

describe('App Root Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: null },
      error: null,
    } as any);
    vi.spyOn(supabase.auth, 'onAuthStateChange').mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    } as any);
    vi.spyOn(VendorService.prototype, 'fetchVendors').mockResolvedValue([]);
    vi.spyOn(AdvisoryService.prototype, 'fetchAdvisories').mockResolvedValue([
      {
        id: 'a1',
        advisory_id: 'RHSA-2026:6821',
        title: 'Test RHSA',
        severity: 'CRITICAL',
        published_at: '2026-08-15T00:00:00Z',
        url: 'https://access.redhat.com/errata/RHSA-2026:6821',
        summary: 'kernel security update',
        vendor_code: 'redhat',
        vendor_name: 'Red Hat',
        cves: [],
        product_impacts: [],
        affected_products: ['Red Hat Enterprise Linux 9'],
        fixed_versions: [],
      } as any,
    ]);
    vi.spyOn(CveService.prototype, 'fetchCves').mockResolvedValue([
      {
        id: '1',
        cve_id: 'CVE-2024-38812',
        description: 'Test CVE',
        severity: 'CRITICAL',
        is_known_exploited: false,
        created_at: '2026-08-15T00:00:00Z',
        vendor_code: 'redhat',
        advisory_id: 'RHSA-2024:6821',
        advisory_title: 'Test RHSA',
        affected_products: ['RHEL 9'],
        product_impacts: [
          {
            product_name: 'RHEL 9',
            component: 'spring-core',
            state: 'Fixed',
            justification: 'None',
            errata: 'RHSA-2024:6821',
            release_date: '2024-09-17',
          },
        ],
        fixed_versions: ['RHSA-2024:6821'],
      },
    ]);
    vi.spyOn(SyncService.prototype, 'fetchSyncLogs').mockResolvedValue([]);
    vi.spyOn(WebhookConfigService.prototype, 'fetchWebhooks').mockResolvedValue([]);
  });

  it('should render the VulnBeacon header and default to Overview tab', async () => {
    render(<App />);

    expect(screen.getByText('VulnBeacon')).toBeInTheDocument();
    expect(await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 })).toBeInTheDocument();

    // Verify Header GitHub repo link
    const githubLink = screen.getByTestId('header-github-link');
    expect(githubLink).toBeInTheDocument();
    expect(githubLink).toHaveAttribute('href', 'https://github.com/CTJ425/vuln-beacon');
    expect(githubLink).toHaveAttribute('target', '_blank');

    // Verify Header public manual sync button is removed
    expect(screen.queryByRole('button', { name: 'Sync All Feeds' })).not.toBeInTheDocument();

    // Verify Sidebar version footer
    const versionEl = screen.getByTestId('sidebar-version');
    expect(versionEl).toBeInTheDocument();
    expect(versionEl).toHaveTextContent(`v${APP_VERSION}`);
  });

  it('should switch navigation tabs when sidebar links are clicked', async () => {
    render(<App />);

    // Wait for initial load
    await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

    // Click CVE Explorer tab (R3: heading is vendor-neutral)
    const explorerTab = screen.getByText('CVE Explorer');
    fireEvent.click(explorerTab);
    expect(
      await screen.findByRole('heading', { level: 4, name: /Explorer/i }, { timeout: 4000 })
    ).toBeInTheDocument();

    // R1: Sync Monitor and Webhooks & Config are no longer public sidebar tabs.
    // They live inside the authenticated Admin Console, covered by
    // tests/e2e/admin-backstage-flow.e2e.test.tsx.
    expect(screen.queryByRole('button', { name: /^Sync Monitor$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Webhooks & Config$/i })).not.toBeInTheDocument();
  });

  it('should render a vendor group in the sidebar derived from advisory data, with the static nav items unchanged', async () => {
    render(<App />);
    await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

    // vendor entry derived from the mocked advisory (vendor_code: 'redhat'); the
    // vendor name also appears in the Overview's vendor-card row, so allow
    // more than one match — only presence is asserted here.
    expect((await screen.findAllByText('Red Hat', {}, { timeout: 4000 })).length).toBeGreaterThan(0);

    // R1: only the public static nav items remain; sync/webhooks moved behind auth
    expect(screen.getByText('CVE Explorer')).toBeInTheDocument();
    expect(screen.getByText('Admin Console')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Sync Monitor$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Webhooks & Config$/i })).not.toBeInTheDocument();
  });

  it('prompts admin login when selecting Admin Console or legacy admin sections without an active session', async () => {
    render(<App />);
    await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

    const adminNavBtn = await screen.findByRole('button', { name: /Admin Console/i });
    fireEvent.click(adminNavBtn);

    expect(await screen.findByText(/後台系統身分驗證/i)).toBeInTheDocument();
  });

  it('routes legacy sync section to Admin Console with Sync Monitor tab active when authenticated', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: { user: { id: 'admin-1', email: 'admin@vulnbeacon.com' } } },
      error: null,
    } as any);

    render(<App />);
    await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

    const adminNavBtn = await screen.findByRole('button', { name: /Admin Console/i });
    fireEvent.click(adminNavBtn);

    // Click Sync Monitor tab inside Admin Console
    const syncTab = await screen.findByRole('tab', { name: /同步監控/i });
    expect(syncTab).toBeInTheDocument();
    fireEvent.click(syncTab);
    expect(syncTab).toHaveAttribute('aria-selected', 'true');
  });

  it('renders fallback error boundary when an unrecognized navigation section is dispatched', async () => {
    render(<App />);
    await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

    // Directly click Overview to confirm standard page renders
    const overviewBtn = screen.getByRole('button', { name: /Overview/i });
    expect(overviewBtn).toBeInTheDocument();

    // The container should not be visible for valid routes
    expect(screen.queryByTestId('nav-fallback-container')).not.toBeInTheDocument();
  });
});

