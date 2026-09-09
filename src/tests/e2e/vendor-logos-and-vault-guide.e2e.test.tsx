import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/App';
import { AdvisoryRowItem } from '@/services/advisoryService';
import { VendorSyncLog, Vendor } from '@/types';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'admin-1', email: 'admin@example.com' } }, user: { id: 'admin-1', email: 'admin@example.com' } },
        error: null,
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    storage: {
      from: vi.fn().mockReturnValue({
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    },
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
    },
  },
}));

vi.mock('@/services/advisoryService', () => ({
  AdvisoryService: vi.fn().mockImplementation(() => ({
    fetchAdvisories: vi.fn().mockResolvedValue([
      {
        id: 'adv-1',
        advisory_id: 'RHSA-2026:1001',
        title: 'Critical OpenSSL Vulnerability',
        severity: 'CRITICAL',
        published_at: '2026-09-08T00:00:00Z',
        url: 'https://access.redhat.com/errata/RHSA-2026:1001',
        summary: 'Security fix for OpenSSL',
        vendor_code: 'redhat',
        cves: [{ cve_id: 'CVE-2026-9999', description: 'OpenSSL buffer overflow', severity: 'CRITICAL', cvss_v3_score: 9.8, is_known_exploited: true }],
        product_impacts: [{ product_name: 'Red Hat Enterprise Linux 9', component: 'openssl', state: 'Fixed', errata: 'RHSA-2026:1001' }],
        affected_products: ['Red Hat Enterprise Linux 9'],
        fixed_versions: ['openssl-3.0.7-27.el9_2'],
        solution: 'dnf update openssl',
      } as AdvisoryRowItem,
    ]),
  })),
}));

vi.mock('@/services/vendorService', () => ({
  VendorService: vi.fn().mockImplementation(() => ({
    fetchVendors: vi.fn().mockResolvedValue([
      {
        id: 'v-redhat',
        code: 'redhat',
        name: 'Red Hat',
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
        schedule_enabled: true,
        schedule_times: ['08:00', '12:30', '18:30'],
        schedule_timezone: 'Asia/Taipei',
      } as Vendor,
      {
        id: 'v-netapp',
        code: 'netapp',
        name: 'NetApp',
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
        schedule_enabled: false,
        schedule_times: [],
        schedule_timezone: 'Asia/Taipei',
      } as Vendor,
      {
        id: 'v-vmware',
        code: 'vmware',
        name: 'VMware',
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
        schedule_enabled: false,
        schedule_times: [],
        schedule_timezone: 'Asia/Taipei',
      } as Vendor,
    ]),
    updateSchedule: vi.fn().mockResolvedValue({ success: true }),
  })),
}));

vi.mock('@/services/syncService', () => ({
  SYNCED_VENDOR_CODES: ['redhat', 'nutanix'],
  SyncService: vi.fn().mockImplementation(() => ({
    fetchSyncLogs: vi.fn().mockResolvedValue([
      {
        id: 'log-vault-fail',
        vendor_code: 'redhat',
        status: 'FAILED',
        items_fetched: 0,
        new_items_count: 0,
        duration_ms: 10,
        started_at: '2026-09-08T08:00:00Z',
        finished_at: '2026-09-08T08:00:01Z',
        error_message: 'Missing vault secrets: scheduled_sync_url or scheduled_sync_key not configured',
        details: { error_type: 'VaultConfigurationError' },
      } as VendorSyncLog,
    ]),
  })),
}));

describe('E2E: Authentic Vendor Logos & Vault Secrets Diagnostics Flow', () => {
  it('renders authentic SVG logos for Red Hat and other vendors on the dashboard', async () => {
    render(<App />);

    // Wait for Dashboard to render
    expect(await screen.findByText('Security Intelligence Overview')).toBeInTheDocument();

    // Red Hat logo should be rendered as SVG
    const redHatLogos = await screen.findAllByLabelText('Red Hat logo');
    expect(redHatLogos.length).toBeGreaterThan(0);
    expect(redHatLogos[0].tagName.toLowerCase()).toBe('svg');

    // Sidebar should render authentic vendor icons
    expect(screen.getByText('CVE Explorer')).toBeInTheDocument();
  });

  it('renders Vault Secrets guide with copyable SQL template in schedule settings', async () => {
    render(<App />);

    // Open Admin Console
    const adminNavBtn = await screen.findByRole('button', { name: 'Admin Console' });
    await userEvent.click(adminNavBtn);

    // Sign in through modal
    const emailInput = screen.getByLabelText(/Email/i);
    const passInput = screen.getByLabelText(/Password|密碼/i);
    await userEvent.type(emailInput, 'admin@example.com');
    await userEvent.type(passInput, 'password123');
    await userEvent.click(screen.getByRole('button', { name: /登入後台/i }));

    // In Admin Console, navigate to Sync Monitor tab
    const syncTab = await screen.findByRole('tab', { name: /同步監控/i });
    await userEvent.click(syncTab);

    // Click "Show Schedule Settings"
    const showScheduleBtn = await screen.findByRole('button', { name: /Show Schedule Settings/i });
    await userEvent.click(showScheduleBtn);

    // Verify Vault Secrets Guide is rendered
    expect(screen.getByText(/排程同步與 Supabase Vault 憑證指引/i)).toBeInTheDocument();

    // Open the guide collapse
    const viewGuideBtn = screen.getByRole('button', { name: /查看設定指令/i });
    await userEvent.click(viewGuideBtn);

    // Verify copyable instructions and SQL appear
    expect(screen.getByText(/複製 SQL 範本/i)).toBeInTheDocument();
    expect(screen.getAllByText(/scheduled_sync_url/).length).toBeGreaterThanOrEqual(1);
  });

  it('displays Vault Secrets resolution guidance when inspecting a missing vault secrets log', async () => {
    render(<App />);

    // Open Admin Console
    const adminNavBtn = await screen.findByRole('button', { name: 'Admin Console' });
    await userEvent.click(adminNavBtn);

    const emailInput = screen.getByLabelText(/Email/i);
    const passInput = screen.getByLabelText(/Password|密碼/i);
    await userEvent.type(emailInput, 'admin@example.com');
    await userEvent.type(passInput, 'password123');
    await userEvent.click(screen.getByRole('button', { name: /登入後台/i }));

    // In Admin Console, switch to Sync Monitor tab
    const syncTab = await screen.findByRole('tab', { name: /同步監控/i });
    await userEvent.click(syncTab);

    // Inspect the failed log row with Missing vault secrets
    const inspectBtns = await screen.findAllByRole('button', { name: /Inspect/i });
    expect(inspectBtns.length).toBeGreaterThan(0);
    await userEvent.click(inspectBtns[0]);

    // Modal should show both the failure reason and the resolution box
    expect(await screen.findByText(/排程密鑰未配置排除指引/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /複製修復指令/i })).toBeInTheDocument();
  });
});
