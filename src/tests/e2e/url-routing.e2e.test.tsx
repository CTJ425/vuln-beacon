import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { App } from '@/App';
import { supabase } from '@/lib/supabase';
import { CveService } from '@/services/cveService';
import { SyncService } from '@/services/syncService';
import { WebhookConfigService } from '@/services/webhookConfigService';
import { AdvisoryService } from '@/services/advisoryService';
import { VendorService } from '@/services/vendorService';

const OVERVIEW = /Security Intelligence Overview/i;
const ADVISORY_DRAWER_MARKER = /影響內容/i;

const mockAdminUser = { id: 'admin-uid', email: 'admin@vulnbeacon.com', app_metadata: { role: 'admin' } };

const startAt = (path: string) => window.history.replaceState(null, '', path);

// getSession and the auth listener's INITIAL_SESSION event must agree, as they
// do against a real Supabase client.
const mockSession = (user: unknown) => {
  const session = user ? { user, access_token: 'jwt' } : null;
  vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({ data: { session }, error: null } as any);
  vi.spyOn(supabase.auth, 'onAuthStateChange').mockImplementation(((cb: any) => {
    queueMicrotask(() => cb('INITIAL_SESSION', session));
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  }) as any);
};

describe('E2E: URL routing and deep links', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(AdvisoryService.prototype, 'fetchAdvisories').mockResolvedValue([
      {
        id: 'adv-1',
        advisory_id: 'RHSA-2026:1001',
        title: 'Critical kernel update',
        severity: 'CRITICAL',
        published_at: '2026-09-01T00:00:00Z',
        url: 'https://access.redhat.com/errata/RHSA-2026:1001',
        vendor_code: 'redhat',
        vendor_name: 'Red Hat',
        cves: [{ cve_id: 'CVE-2026-1001', description: 'Kernel RCE' }],
        product_impacts: [{ product_name: 'Enterprise Linux 9', component: 'kernel', state: 'Fixed' }],
        affected_products: ['Enterprise Linux 9'],
        fixed_versions: ['kernel-5.14.0'],
      } as any,
    ]);
    vi.spyOn(CveService.prototype, 'fetchCves').mockResolvedValue([
      {
        id: 'cve-1',
        cve_id: 'CVE-2026-1001',
        description: 'Kernel remote code execution in the network stack',
        severity: 'CRITICAL',
        is_known_exploited: false,
        created_at: '2026-09-01T00:00:00Z',
        vendor_code: 'redhat',
        advisory_id: 'RHSA-2026:1001',
        advisory_title: 'Critical kernel update',
        affected_products: ['Enterprise Linux 9'],
        product_impacts: [],
      },
    ]);
    vi.spyOn(VendorService.prototype, 'fetchVendors').mockResolvedValue([
      { id: 'v-1', code: 'redhat', name: 'Red Hat', is_active: true, created_at: '2026-01-01T00:00:00Z' },
    ]);
    vi.spyOn(SyncService.prototype, 'fetchSyncLogs').mockResolvedValue([]);
    vi.spyOn(WebhookConfigService.prototype, 'fetchWebhooks').mockResolvedValue([]);
    mockSession(null);
  });

  it('should render the page named by the initial URL', async () => {
    startAt('/explorer');
    render(<App />);
    expect(await screen.findByRole('heading', { level: 4, name: /Explorer/i }, { timeout: 4000 })).toBeInTheDocument();
  });

  it('should push a URL when a sidebar item is clicked and follow the browser back button', async () => {
    render(<App />);
    await screen.findByText(OVERVIEW, {}, { timeout: 4000 });

    fireEvent.click(screen.getByText('CVE Explorer'));
    await screen.findByRole('heading', { level: 4, name: /Explorer/i }, { timeout: 4000 });
    expect(window.location.pathname).toBe('/explorer');

    act(() => {
      window.history.back();
    });
    expect(await screen.findByText(OVERVIEW, {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it('should render sidebar items as links to their URLs', async () => {
    render(<App />);
    await screen.findByText(OVERVIEW, {}, { timeout: 4000 });
    expect(screen.getByRole('link', { name: 'CVE Explorer' })).toHaveAttribute('href', '/explorer');
    expect(screen.getByRole('link', { name: 'Red Hat' })).toHaveAttribute('href', '/vendors/redhat');
  });

  it('should open the advisory detail from a deep link over the overview, and return to / on close', async () => {
    startAt('/advisories/RHSA-2026%3A1001');
    render(<App />);

    expect(await screen.findByText(ADVISORY_DRAWER_MARKER, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByText(OVERVIEW)).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('presentation'), { key: 'Escape' });
    await waitFor(() => expect(window.location.pathname).toBe('/'));
    await waitFor(() => expect(screen.queryByText(ADVISORY_DRAWER_MARKER)).not.toBeInTheDocument());
  });

  it('should put the advisory URL in the address bar when an advisory is selected from a list', async () => {
    render(<App />);
    fireEvent.click(await screen.findByText('RHSA-2026:1001', {}, { timeout: 4000 }));

    expect(await screen.findByText(ADVISORY_DRAWER_MARKER)).toBeInTheDocument();
    expect(window.location.pathname).toBe('/advisories/RHSA-2026%3A1001');
  });

  it('should open the CVE detail from a deep link', async () => {
    startAt('/cves/CVE-2026-1001');
    render(<App />);
    expect(
      await screen.findByText(/Kernel remote code execution in the network stack/i, {}, { timeout: 4000 })
    ).toBeInTheDocument();
  });

  it('should say so when a deep-linked advisory does not exist', async () => {
    startAt('/advisories/NOPE-1');
    render(<App />);
    expect(await screen.findByText(/NOPE-1/, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByText(/was not found/i)).toBeInTheDocument();
  });

  it('should show Page Not Found for an unknown path', async () => {
    startAt('/nowhere');
    render(<App />);
    expect(await screen.findByText(/Page Not Found/i, {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it('should open the requested admin tab for a signed-in admin', async () => {
    mockSession(mockAdminUser);
    startAt('/admin/sync');
    render(<App />);
    expect(await screen.findByText(/Feed Sources|資料來源/i, {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it('should ask a signed-out visitor to sign in when the URL points at the admin console', async () => {
    startAt('/admin/sync');
    render(<App />);
    expect(await screen.findByText(/後台系統身分驗證/i, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByText(/Feed Sources|資料來源/i)).not.toBeInTheDocument();
  });

  it('should update the URL when an admin switches tabs', async () => {
    mockSession(mockAdminUser);
    startAt('/admin');
    render(<App />);
    fireEvent.click(await screen.findByRole('tab', { name: /同步監控/i }, { timeout: 4000 }));
    await waitFor(() => expect(window.location.pathname).toBe('/admin/sync'));
  });
});
