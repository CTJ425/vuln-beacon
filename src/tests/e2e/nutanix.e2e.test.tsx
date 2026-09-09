import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '@/App';
import { supabase } from '@/lib/supabase';
import { IngestionEngine } from '@/engine/ingestion';
import { WebhookService } from '@/services/webhook';
import { AdvisoryService, AdvisoryRowItem } from '@/services/advisoryService';
import { CveService } from '@/services/cveService';
import { SyncService } from '@/services/syncService';
import { VendorService } from '@/services/vendorService';
import { WebhookConfigService } from '@/services/webhookConfigService';
import { Vendor, VendorSyncLog } from '@/types';
import nutanixFixture from '../fixtures/nutanix/nutanix-advisory-sample.json';

const { mockAdminUser } = vi.hoisted(() => ({
  mockAdminUser: { id: 'admin-nutanix', email: 'secops-admin@vulnbeacon.com' },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            user: { id: 'admin-nutanix', email: 'secops-admin@vulnbeacon.com' },
          },
        },
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { user: mockAdminUser }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn().mockImplementation(() => ({
      select: () =>
        Object.assign(Promise.resolve({ data: [], error: null }), {
          range: () => Promise.resolve({ data: [], error: null }),
          eq: () => Promise.resolve({ data: [], error: null }),
          order: () => Promise.resolve({ data: [], error: null }),
          single: () => Promise.resolve({ data: null, error: null }),
        }),
    })),
    functions: {
      invoke: vi.fn().mockResolvedValue({
        data: {
          success: true,
          log: {
            id: 'log-nutanix-e2e',
            vendor_code: 'nutanix',
            status: 'SUCCESS',
            items_fetched: 1,
            new_items_count: 2,
            started_at: '2026-09-08T08:00:00Z',
            finished_at: '2026-09-08T08:00:02Z',
          },
        },
        error: null,
      }),
    },
    storage: {
      from: vi.fn().mockReturnValue({
        download: vi.fn().mockResolvedValue({
          data: { text: async () => JSON.stringify(nutanixFixture) },
          error: null,
        }),
        upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
      }),
    },
  },
}));

describe('E2E: Comprehensive Nutanix Integration Lifecycle', () => {
  const mockVendors: Vendor[] = [
    {
      id: 'v-redhat',
      code: 'redhat',
      name: 'Red Hat',
      icon_url: 'https://access.redhat.com/favicon.ico',
      is_active: true,
      created_at: '2026-08-01T00:00:00Z',
      schedule_enabled: true,
      schedule_times: ['08:00', '12:30'],
      schedule_timezone: 'Asia/Taipei',
    },
    {
      id: 'v-nutanix',
      code: 'nutanix',
      name: 'Nutanix',
      icon_url: 'https://www.nutanix.com/favicon.ico',
      homepage: 'https://portal.nutanix.com/page/documents/security-advisories',
      is_active: true,
      created_at: '2026-08-01T00:00:00Z',
      schedule_enabled: true,
      schedule_times: ['09:00', '18:00'],
      schedule_timezone: 'Asia/Taipei',
    },
  ];

  const mockNutanixAdvisory: AdvisoryRowItem = {
    id: 'adv-nutanix-1',
    advisory_id: 'NXSA-AOS-7.5.1.12',
    title: '[AOS] Nutanix Security Advisory NXSA-AOS-7.5.1.12 (AOS 7.5.1.12)',
    severity: 'HIGH',
    published_at: '2026-08-24T19:53:27.498236',
    url: 'https://portal.nutanix.com/page/documents/security-advisories/release-advisories/details?id=NXSA-AOS-7.5.1.12',
    summary: 'Upgrade to AOS 7.5.1.12 or later.',
    solution: 'Upgrade to AOS 7.5.1.12 or later.',
    vendor_code: 'nutanix',
    vendor_name: 'Nutanix',
    cves: [
      { cve_id: 'CVE-2026-33416', description: 'LIBPNG memory corruption vulnerability', severity: 'HIGH', is_known_exploited: false },
      { cve_id: 'CVE-2026-48962', description: 'IO::Compress decompression vulnerability', severity: 'HIGH', is_known_exploited: false },
    ],
    product_impacts: [
      {
        product_name: 'AOS',
        component: 'AOS',
        state: 'Affected',
        justification: 'All versions prior to 7.5.1.12',
        errata: 'AOS 7.5.1.12',
        cpe: 'cpe:2.3:a:nutanix:aos:*:*:*:*:*:*:*:*',
      },
    ],
    affected_products: ['AOS', 'AOS 7.5.1.12'],
    fixed_versions: ['AOS 7.5.1.12'],
  };

  const mockCves = [
    {
      id: 'cve-1',
      cve_id: 'CVE-2026-33416',
      description: 'LIBPNG memory corruption vulnerability',
      severity: 'HIGH',
      cvss_v3_score: 7.5,
      cvss_v3_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H',
      is_known_exploited: false,
      created_at: '2026-08-24T19:53:27Z',
      vendor_code: 'nutanix',
      advisory_id: 'NXSA-AOS-7.5.1.12',
      advisory_title: '[AOS] Nutanix Security Advisory NXSA-AOS-7.5.1.12 (AOS 7.5.1.12)',
      affected_products: ['AOS'],
      all_advisories: ['NXSA-AOS-7.5.1.12'],
      product_impacts: [
        {
          product_name: 'AOS',
          component: 'AOS',
          state: 'Affected',
          justification: 'All versions prior to 7.5.1.12',
          errata: 'AOS 7.5.1.12',
          cpe: 'cpe:2.3:a:nutanix:aos:*:*:*:*:*:*:*:*',
        },
      ],
      fixed_versions: ['AOS 7.5.1.12'],
    },
    {
      id: 'cve-2',
      cve_id: 'CVE-2026-48962',
      description: 'IO::Compress decompression vulnerability',
      severity: 'HIGH',
      cvss_v3_score: 7.5,
      is_known_exploited: false,
      created_at: '2026-08-24T19:53:27Z',
      vendor_code: 'nutanix',
      advisory_id: 'NXSA-AOS-7.5.1.12',
      advisory_title: '[AOS] Nutanix Security Advisory NXSA-AOS-7.5.1.12 (AOS 7.5.1.12)',
      affected_products: ['AOS'],
      all_advisories: ['NXSA-AOS-7.5.1.12'],
      product_impacts: [],
      fixed_versions: ['AOS 7.5.1.12'],
    },
  ];

  const mockSyncLogs: VendorSyncLog[] = [
    {
      id: 'log-nx-prev',
      vendor_code: 'nutanix',
      status: 'SUCCESS',
      items_fetched: 1,
      new_items_count: 2,
      started_at: '2026-09-08T08:00:00Z',
      finished_at: '2026-09-08T08:00:03Z',
      duration_ms: 3000,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (supabase.auth.getSession as any).mockResolvedValue({
      data: {
        session: {
          user: mockAdminUser,
        },
      },
    });
    vi.spyOn(VendorService.prototype, 'fetchVendors').mockResolvedValue(mockVendors);
    vi.spyOn(AdvisoryService.prototype, 'fetchAdvisories').mockResolvedValue([mockNutanixAdvisory]);
    vi.spyOn(CveService.prototype, 'fetchCves').mockResolvedValue(mockCves as any);
    vi.spyOn(SyncService.prototype, 'fetchSyncLogs').mockResolvedValue(mockSyncLogs);
    vi.spyOn(WebhookConfigService.prototype, 'fetchWebhooks').mockResolvedValue([]);
  });

  it('Phase 1: Ingestion Engine parses Nutanix feed and dispatches webhooks for high severity CVEs', async () => {
    const webhookService = new WebhookService();
    const mockNotifyAll = vi.spyOn(webhookService, 'notifyAll').mockResolvedValue(1);

    webhookService.registerWebhook({
      id: 'wh-nutanix',
      name: 'Nutanix Security Slack',
      platform: 'slack',
      webhook_url: 'https://hooks.slack.com/services/test/nutanix',
      min_severity: 'HIGH',
      is_active: true,
      created_at: new Date().toISOString(),
    });

    const engine = new IngestionEngine({ webhookService });
    const result = await engine.ingestVendor('nutanix', [nutanixFixture]);

    expect(result.status).toBe('SUCCESS');
    expect(result.advisoriesCount).toBe(1);
    expect(result.cvesCount).toBe(2);
    expect(result.newCvesCount).toBe(2);

    expect(mockNotifyAll).toHaveBeenCalled();
    const firstCallAlert = mockNotifyAll.mock.calls[0][0];
    expect(firstCallAlert.vendorName).toBe('Nutanix');
    expect(firstCallAlert.advisoryId).toBe('NXSA-AOS-7.5.1.12');
    expect(firstCallAlert.severity).toBe('HIGH');
    expect(firstCallAlert.affectedProducts).toContain('AOS');
  });

  it('Phase 2: App renders Nutanix overview card and navigates to dedicated Nutanix Vendor Page', async () => {
    render(<App />);

    // Wait for Dashboard to finish loading
    await screen.findByText('Security Intelligence Overview');

    // Check Nutanix brand presence in overview and navigation
    expect(screen.getAllByText('Nutanix').length).toBeGreaterThan(0);

    // Check Nutanix icon aria-label
    expect(screen.getAllByLabelText('Nutanix logo').length).toBeGreaterThan(0);

    // Click on Nutanix sidebar navigation
    const nutanixNavBtn = await screen.findByRole('button', { name: 'Nutanix' });
    fireEvent.click(nutanixNavBtn);

    // Verify Nutanix Vendor Page header
    await waitFor(() => {
      const heading = screen.getByRole('heading', { level: 4, name: 'Nutanix' });
      expect(heading).toBeInTheDocument();
    });

    // Verify Nutanix advisory and CVEs are listed
    expect(screen.getByText('NXSA-AOS-7.5.1.12')).toBeInTheDocument();
    expect(screen.getByText('CVE-2026-33416')).toBeInTheDocument();
    expect(screen.getByText('CVE-2026-48962')).toBeInTheDocument();
  });

  it('Phase 3: Advisory Detail Drawer opens and displays authentic Nutanix portal link and solution', async () => {
    render(<App />);

    await screen.findByText('Security Intelligence Overview');

    expect(screen.getByText('NXSA-AOS-7.5.1.12')).toBeInTheDocument();

    // Click on advisory row to open detail drawer
    const advLink = screen.getByText('NXSA-AOS-7.5.1.12');
    fireEvent.click(advLink);

    // Verify detail drawer renders Nutanix advisory details and solution
    await waitFor(() => {
      expect(screen.getAllByText(/Upgrade to AOS 7.5.1.12 or later/i).length).toBeGreaterThan(0);
    });

    expect(screen.getByText('LIBPNG memory corruption vulnerability')).toBeInTheDocument();
    expect(screen.getByText('Advisory: AOS 7.5.1.12')).toBeInTheDocument();
    expect(screen.getByText(/Prism LCM Upgrade: AOS 7.5.1.12/i)).toBeInTheDocument();

    // Verify official portal link is present and correct
    const officialLink = screen.getByRole('link', { name: /官方公告頁面|Official/i });
    expect(officialLink).toHaveAttribute(
      'href',
      'https://portal.nutanix.com/page/documents/security-advisories/release-advisories/details?id=NXSA-AOS-7.5.1.12'
    );
  });

  it('Phase 4: Sync Monitor displays Nutanix feed source as Connected with official API endpoints', async () => {
    render(<App />);

    await screen.findByText('Security Intelligence Overview');

    // Navigate to Admin Console
    const adminNav = await screen.findByRole('button', { name: /Admin Console/i });
    fireEvent.click(adminNav);

    await screen.findByText('後台管理系統');

    // Switch to Sync Monitor tab
    const syncTab = screen.getByRole('tab', { name: /同步監控/i });
    fireEvent.click(syncTab);

    await waitFor(() => {
      expect(screen.getByText('Feed Sources')).toBeInTheDocument();
    });

    // Verify Nutanix row in FeedSourceTable
    const nutanixCell = screen.getByRole('cell', { name: /Nutanix nutanix/i });
    const nutanixRow = nutanixCell.closest('tr')!;
    expect(nutanixRow).toBeInTheDocument();

    // Must show Connected badge
    expect(nutanixRow).toHaveTextContent('Connected');

    // Must expose the official Nutanix endpoints
    expect(nutanixRow).toHaveTextContent('https://portal.nutanix.com/api/v1/advisories');
    expect(nutanixRow).toHaveTextContent('https://portal.nutanix.com/api/v1/advisory?id={advisoryId}');
    expect(nutanixRow).toHaveTextContent('https://portal.nutanix.com/api/v1/vulnerabilities');
  });

  it('Phase 5: Manual sync trigger includes Nutanix and executes without error', async () => {
    const syncVendorsSpy = vi.spyOn(SyncService.prototype, 'syncVendors').mockResolvedValue({
      success: true,
      newLogs: [
        {
          id: 'log-nutanix-run',
          vendor_code: 'nutanix',
          status: 'SUCCESS',
          items_fetched: 1,
          new_items_count: 2,
          started_at: new Date().toISOString(),
        } as VendorSyncLog,
      ],
    });

    render(<App />);

    await screen.findByText('Security Intelligence Overview');

    // Navigate to Admin Console
    const adminNav = await screen.findByRole('button', { name: /Admin Console/i });
    fireEvent.click(adminNav);

    await screen.findByText('後台管理系統');

    // Switch to Sync Monitor tab
    const syncTab = screen.getByRole('tab', { name: /同步監控/i });
    fireEvent.click(syncTab);

    await waitFor(() => {
      expect(screen.getByText('Trigger Sync Run')).toBeInTheDocument();
    });

    const triggerBtn = screen.getByText('Trigger Sync Run');
    fireEvent.click(triggerBtn);

    await waitFor(() => {
      expect(syncVendorsSpy).toHaveBeenCalled();
    });

    syncVendorsSpy.mockRestore();
  });

  it('Phase 6: CveDetailDrawer correctly displays Nutanix portal link and Prism LCM Upgrade guidance', async () => {
    render(<App />);

    await screen.findByText('Security Intelligence Overview');

    // Navigate to CVE Explorer page
    const explorerNav = await screen.findByRole('button', { name: /CVE Explorer/i });
    fireEvent.click(explorerNav);

    // Switch to CVE view mode in filter bar
    const cveModeBtn = await screen.findByRole('button', { name: /CVE 弱點視角/i });
    fireEvent.click(cveModeBtn);

    // Click on Nutanix CVE row
    const cveCell = await screen.findByText('CVE-2026-33416');
    fireEvent.click(cveCell);

    await waitFor(() => {
      expect(screen.getByText('LIBPNG memory corruption vulnerability')).toBeInTheDocument();
    });

    // Check official link points to Nutanix portal, NOT Red Hat errata
    const portalLink = screen.getByRole('link', { name: /檢視官方公告頁面/i });
    expect(portalLink).toHaveAttribute(
      'href',
      'https://portal.nutanix.com/page/documents/security-advisories/release-advisories/details?id=NXSA-AOS-7.5.1.12'
    );

    // Check solution remediation shows Prism LCM Upgrade rather than dnf upgrade
    expect(screen.getByText(/Prism LCM Upgrade: AOS 7.5.1.12/i)).toBeInTheDocument();
  });

  it('Phase 7: Unmocked multi-vendor SyncService syncs both Red Hat and Nutanix with clean isolation', async () => {
    const mockList = {
      advisories: [{ advisory_id: 'NXSA-AOS-7.5.1.12' }],
      totalCount: 1,
    };

    const fetchSpy = vi.fn(async (url: any, options?: any) => {
      const urlStr = String(url);
      if (urlStr.includes('access.redhat.com')) {
        return { ok: true, status: 200, json: async () => [] };
      }
      if (urlStr.includes('/api/v1/advisories') && options?.method === 'POST') {
        return { ok: true, status: 200, json: async () => mockList };
      }
      if (urlStr.includes('NXSA-AOS-7.5.1.12')) {
        return { ok: true, status: 200, json: async () => nutanixFixture };
      }
      return { ok: false, status: 404 };
    });
    vi.stubGlobal('fetch', fetchSpy);

    const service = new SyncService();
    const result = await service.syncVendors();

    expect(result.success).toBe(true);

    const invokeCalls = (supabase.functions.invoke as any).mock.calls;
    const vendorCodes = invokeCalls.map((c: any) => c[1]?.body?.vendorCode);

    expect(vendorCodes).toContain('redhat');
    expect(vendorCodes).toContain('nutanix');

    // Confirm nutanix payload contains authentic Nutanix advisory
    const nutanixCall = invokeCalls.find(
      (c: any) => c[1]?.body?.vendorCode === 'nutanix' && c[1]?.body?.advisories?.length > 0
    );
    expect(nutanixCall).toBeDefined();
    expect(nutanixCall[1].body.advisories[0].advisory_id).toBe('NXSA-AOS-7.5.1.12');

    vi.unstubAllGlobals();
  });
});
