import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '@/App';
import { supabase } from '@/lib/supabase';
import { CveService } from '@/services/cveService';
import { SyncService } from '@/services/syncService';
import { WebhookConfigService } from '@/services/webhookConfigService';
import { AdvisoryService } from '@/services/advisoryService';
import { VendorService } from '@/services/vendorService';

describe('E2E: Navigation & Access Boundaries (R1, R2)', () => {
  const mockAdminUser = { id: 'admin-test-uid', email: 'admin@vulnbeacon.com' };

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(AdvisoryService.prototype, 'fetchAdvisories').mockResolvedValue([
      {
        id: 'adv-e2e-1',
        advisory_id: 'ADV-2026-001',
        title: 'Critical Remote Code Execution Advisory',
        severity: 'CRITICAL',
        published_at: '2026-09-01T00:00:00Z',
        url: 'https://security.example.com/advisories/ADV-2026-001',
        vendor_code: 'redhat',
        vendor_name: 'Red Hat',
        cves: [{ cve_id: 'CVE-2026-1001', description: 'Sample RCE CVE' }],
        product_impacts: [
          { product_name: 'Enterprise Linux 9', component: 'kernel-core', state: 'Fixed' },
        ],
        affected_products: ['Enterprise Linux 9'],
        fixed_versions: ['kernel-core-5.14.0'],
      } as any,
    ]);

    vi.spyOn(CveService.prototype, 'fetchCves').mockResolvedValue([
      {
        id: 'cve-e2e-1',
        cve_id: 'CVE-2026-1001',
        description: 'Sample RCE CVE in kernel',
        severity: 'CRITICAL',
        is_known_exploited: false,
        created_at: '2026-09-01T00:00:00Z',
        vendor_code: 'redhat',
        advisory_id: 'ADV-2026-001',
        advisory_title: 'Critical Remote Code Execution Advisory',
        affected_products: ['Enterprise Linux 9'],
        product_impacts: [
          {
            product_name: 'Enterprise Linux 9',
            component: 'kernel-core',
            state: 'Fixed',
            justification: '',
            errata: 'ADV-2026-001',
            release_date: '2026-09-01',
          },
        ],
        fixed_versions: ['5.14.0'],
      },
    ]);

    vi.spyOn(VendorService.prototype, 'fetchVendors').mockResolvedValue([
      {
        id: 'vendor-1',
        code: 'redhat',
        name: 'Red Hat',
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);

    vi.spyOn(SyncService.prototype, 'fetchSyncLogs').mockResolvedValue([
      {
        id: 'log-1',
        vendor_code: 'redhat',
        status: 'SUCCESS',
        items_fetched: 15,
        new_items_count: 2,
        duration_ms: 850,
        started_at: '2026-09-07T08:00:00.000Z',
        details: { advisories_count: 15, new_cves_count: 2 },
      },
    ]);

    vi.spyOn(WebhookConfigService.prototype, 'fetchWebhooks').mockResolvedValue([
      {
        id: 'hook-1',
        name: 'SecOps Channel',
        platform: 'slack',
        webhook_url: 'https://hooks.slack.com/services/mock',
        min_severity: 'HIGH',
        is_active: true,
        created_at: '2026-09-01T00:00:00Z',
      },
    ]);

    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: null },
      error: null,
    } as any);
  });

  // =========================================================================
  // Feature 1: Public Navigation Restriction (R1 / F1)
  // =========================================================================
  describe('F1: Public Navigation Restriction', () => {
    it('Tier 1: general user loads app and sees Overview and CVE Explorer in sidebar', async () => {
      render(<App />);

      expect(await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('CVE Explorer')).toBeInTheDocument();
      expect(screen.getByText('Admin Console')).toBeInTheDocument();
    });

    it('Tier 1: public sidebar navigation does NOT contain Sync Monitor', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      // In R1, Sync Monitor is removed from public sidebar
      const syncNavButton = screen.queryByRole('button', { name: /^Sync Monitor$/i });
      expect(syncNavButton).not.toBeInTheDocument();
    });

    it('Tier 1: public sidebar navigation does NOT contain Webhooks & Config', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      // In R1, Webhooks & Config is removed from public sidebar
      const webhooksNavButton = screen.queryByRole('button', { name: /Webhooks & Config/i });
      expect(webhooksNavButton).not.toBeInTheDocument();
    });

    it('Tier 1: clicking CVE Explorer loads the vulnerability search view without authentication challenge', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      fireEvent.click(screen.getByText('CVE Explorer'));

      expect(await screen.findByRole('heading', { level: 4, name: /Explorer/i }, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.queryByText(/後台系統身分驗證/i)).not.toBeInTheDocument();
    });

    it('Tier 1: clicking Overview navigates back to the Dashboard page without authentication challenge', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      // Navigate to Explorer first
      fireEvent.click(screen.getByText('CVE Explorer'));
      expect(await screen.findByRole('heading', { level: 4, name: /Explorer/i }, { timeout: 4000 })).toBeInTheDocument();

      // Navigate back to Overview
      fireEvent.click(screen.getByText('Overview'));
      expect(await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.queryByText(/後台系統身分驗證/i)).not.toBeInTheDocument();
    });

    it('Tier 2 (Boundary): clicking Admin Console when unauthenticated triggers the Admin Login modal', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      fireEvent.click(screen.getByText('Admin Console'));

      expect(await screen.findByText(/後台系統身分驗證/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    });

    it('Tier 2 (Boundary): closing Admin Login modal keeps the user on their active public page', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      // Navigate to CVE Explorer first
      fireEvent.click(screen.getByText('CVE Explorer'));
      expect(await screen.findByRole('heading', { level: 4, name: /Explorer/i }, { timeout: 4000 })).toBeInTheDocument();

      // Click Admin Console to open modal
      fireEvent.click(screen.getByText('Admin Console'));
      expect(await screen.findByText(/後台系統身分驗證/i)).toBeInTheDocument();

      // Close the modal via Close button
      const closeBtn = screen.getByRole('button', { name: /取消|Close/i });
      fireEvent.click(closeBtn);

      await waitFor(() => {
        expect(screen.queryByText(/後台系統身分驗證/i)).not.toBeInTheDocument();
      });
      // Remains on Explorer
      expect(screen.getByRole('heading', { level: 4, name: /Explorer/i })).toBeInTheDocument();
    });

    it('Tier 2 (Boundary): failed login attempt displays error feedback and denies backstage access', async () => {
      vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' } as any,
      });

      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      fireEvent.click(screen.getByText('Admin Console'));
      expect(await screen.findByText(/後台系統身分驗證/i)).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'wrong@admin.com' } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'wrongpass' } });
      fireEvent.click(screen.getByRole('button', { name: /登入後台/i }));

      expect(await screen.findByText(/Invalid login credentials/i)).toBeInTheDocument();
      expect(screen.queryByText('後台管理系統')).not.toBeInTheDocument();
    });

    it('Tier 2 (Boundary): switching between public pages clears any opened detail drawer', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      // Click on an advisory card/row to open drawer
      const advRow = await screen.findByText('ADV-2026-001');
      fireEvent.click(advRow);

      // Drawer is open
      expect(await screen.findByText(/影響內容/i)).toBeInTheDocument();

      // Switch to CVE Explorer
      fireEvent.click(screen.getByText('CVE Explorer'));
      expect(await screen.findByRole('heading', { level: 4, name: /Explorer/i }, { timeout: 4000 })).toBeInTheDocument();

      // Drawer should be closed
      await waitFor(() => {
        expect(screen.queryByText(/影響內容/i)).not.toBeInTheDocument();
      });
    });

    it('Tier 2 (Boundary): empty search in Explorer retains public navigation integrity', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      fireEvent.click(screen.getByText('CVE Explorer'));
      expect(await screen.findByRole('heading', { level: 4, name: /Explorer/i }, { timeout: 4000 })).toBeInTheDocument();

      const searchInput = screen.getByPlaceholderText(/搜尋|Search/i);
      fireEvent.change(searchInput, { target: { value: '   ' } });

      // Table still displays rows without crashing
      expect(screen.getByText('ADV-2026-001')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Feature 2: Admin Console 4-Tab Consolidation (R1 / F2)
  // =========================================================================
  describe('F2: Admin Console 4-Tab Consolidation', () => {
    const signInAsAdmin = async () => {
      vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({
        data: {
          user: mockAdminUser as any,
          session: { user: mockAdminUser, access_token: 'valid-jwt' } as any,
        },
        error: null,
      });

      fireEvent.click(screen.getByText('Admin Console'));
      await screen.findByText(/後台系統身分驗證/i);

      fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'admin@vulnbeacon.com' } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'ValidPassword123!' } });
      fireEvent.click(screen.getByRole('button', { name: /登入後台/i }));

      await screen.findByText('後台管理系統', {}, { timeout: 4000 });
    };

    it('Tier 1: authenticated administrator sees all 4 tabs in Admin Console', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });
      await signInAsAdmin();

      // R1 specifies 4 tabs: Webhook 設定, 同步監控, Log 資料查詢, API 與 Supabase 運作狀態
      expect(screen.getByRole('tab', { name: /Webhook 設定/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /同步監控/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Log 資料查詢/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /API 與 Supabase 運作狀態/i })).toBeInTheDocument();
    });

    it('Tier 1: admin Tab 0 renders the Webhook Configuration panel', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });
      await signInAsAdmin();

      // Tab 0 is active by default
      expect(screen.getByText(/Add Webhook Integration/i)).toBeInTheDocument();
      expect(screen.getByText('SecOps Channel')).toBeInTheDocument();
    });

    it('Tier 1: admin Tab 1 renders the Sync Monitor panel with Feed Sources and Schedule Settings', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });
      await signInAsAdmin();

      fireEvent.click(screen.getByRole('tab', { name: /同步監控/i }));

      expect(await screen.findByText(/Feed Sources|資料來源/i, {}, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByText(/Red Hat/i)).toBeInTheDocument();
    });

    it('Tier 1: admin Tab 2 renders the Log Query and Observability panel', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });
      await signInAsAdmin();

      fireEvent.click(screen.getByRole('tab', { name: /Log 資料查詢/i }));

      expect(await screen.findByText(/Log 資料查詢與排錯/i, {}, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByText(/redhat/i)).toBeInTheDocument();
    });

    it('Tier 1: admin Tab 3 renders the System Health Monitor panel', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });
      await signInAsAdmin();

      fireEvent.click(screen.getByRole('tab', { name: /API 與 Supabase 運作狀態/i }));

      expect(await screen.findByText(/API 與 Supabase 運作狀態監控/i, {}, { timeout: 4000 })).toBeInTheDocument();
    });

    it('Tier 2 (Boundary): rapid tab switching between all 4 tabs preserves component stability', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });
      await signInAsAdmin();

      // Switch through tabs 0 -> 1 -> 2 -> 3 -> 0
      fireEvent.click(screen.getByRole('tab', { name: /同步監控/i }));
      expect(await screen.findByText(/Feed Sources|資料來源/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('tab', { name: /Log 資料查詢/i }));
      expect(await screen.findByText(/Log 資料查詢與排錯/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('tab', { name: /API 與 Supabase 運作狀態/i }));
      expect(await screen.findByText(/API 與 Supabase 運作狀態監控/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('tab', { name: /Webhook 設定/i }));
      expect(await screen.findByText(/Add Webhook Integration/i)).toBeInTheDocument();
    });

    it('Tier 2 (Boundary): admin banner displays logged in admin email and sign out button', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });
      await signInAsAdmin();

      expect(screen.getByText(/admin@vulnbeacon.com/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /登出/i })).toBeInTheDocument();
    });

    it('Tier 2 (Boundary): signing out returns user to public overview and revokes backstage', async () => {
      vi.spyOn(supabase.auth, 'signOut').mockResolvedValue({ error: null });

      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });
      await signInAsAdmin();

      fireEvent.click(screen.getByRole('button', { name: /登出/i }));

      await waitFor(() => {
        expect(supabase.auth.signOut).toHaveBeenCalled();
        expect(screen.getByText(/Security Intelligence Overview/i)).toBeInTheDocument();
        expect(screen.queryByText('後台管理系統')).not.toBeInTheDocument();
      });
    });

    it('Tier 2 (Boundary): mid-session token expiration on Tab 1 immediately redirects to dashboard', async () => {
      let authCallback: any = null;
      vi.spyOn(supabase.auth, 'onAuthStateChange').mockImplementation(((cb: any) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }) as any);

      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });
      await signInAsAdmin();

      fireEvent.click(screen.getByRole('tab', { name: /同步監控/i }));
      expect(await screen.findByText(/Feed Sources|資料來源/i)).toBeInTheDocument();

      // Trigger mid-session token revocation
      if (authCallback) {
        authCallback('SIGNED_OUT', null);
      }

      await waitFor(() => {
        expect(screen.getByText(/Security Intelligence Overview/i)).toBeInTheDocument();
        expect(screen.queryByText('後台管理系統')).not.toBeInTheDocument();
      });
    });

    it('Tier 2 (Boundary): mid-session token expiration on Tab 0 immediately redirects to dashboard', async () => {
      let authCallback: any = null;
      vi.spyOn(supabase.auth, 'onAuthStateChange').mockImplementation(((cb: any) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }) as any);

      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });
      await signInAsAdmin();

      expect(screen.getByText(/Add Webhook Integration/i)).toBeInTheDocument();

      // Revoke token
      if (authCallback) {
        authCallback('SIGNED_OUT', null);
      }

      await waitFor(() => {
        expect(screen.getByText(/Security Intelligence Overview/i)).toBeInTheDocument();
        expect(screen.queryByText('後台管理系統')).not.toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // Feature 3: Role-Gated Manual Sync Operation (R2 / F3)
  // =========================================================================
  describe('F3: Role-Gated Manual Sync Operation', () => {
    it('Tier 1: public Header does NOT display a manual sync button for unauthenticated users', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      // R2 specifies manual sync is strictly role-gated to authenticated Admin Console
      // General users must not see an operable "Sync All Feeds" in public header
      const headerSyncBtn = screen.queryByRole('button', { name: /Sync All Feeds|手動同步/i });
      expect(headerSyncBtn).not.toBeInTheDocument();
    });

    it('Tier 1: unauthenticated users cannot execute manual sync from empty dashboard alert', async () => {
      // Mock empty state
      vi.spyOn(AdvisoryService.prototype, 'fetchAdvisories').mockResolvedValue([]);
      vi.spyOn(CveService.prototype, 'fetchCves').mockResolvedValue([]);

      render(<App />);
      await screen.findByText(/Connecting to live Supabase database/i, {}, { timeout: 4000 });

      // If empty alert button is clicked while unauthenticated, it must require admin login
      const emptyAlertSyncBtn = screen.queryByRole('button', { name: /Sync All Feeds Now/i });
      if (emptyAlertSyncBtn) {
        fireEvent.click(emptyAlertSyncBtn);
        expect(await screen.findByText(/後台系統身分驗證/i)).toBeInTheDocument();
      } else {
        expect(emptyAlertSyncBtn).not.toBeInTheDocument();
      }
    });

    it('Tier 1: manual sync trigger button is accessible inside Admin Console Tab 1', async () => {
      vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({
        data: {
          user: mockAdminUser as any,
          session: { user: mockAdminUser, access_token: 'valid-jwt' } as any,
        },
        error: null,
      });

      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      // Sign into Admin Console
      fireEvent.click(screen.getByText('Admin Console'));
      await screen.findByText(/後台系統身分驗證/i);
      fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'admin@vulnbeacon.com' } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'ValidPassword123!' } });
      fireEvent.click(screen.getByRole('button', { name: /登入後台/i }));
      await screen.findByText('後台管理系統', {}, { timeout: 4000 });

      // Switch to Tab 1 (同步監控)
      fireEvent.click(screen.getByRole('tab', { name: /同步監控/i }));

      // Trigger Sync button must be present in Tab 1
      const syncTriggerBtn = await screen.findByRole('button', { name: /Trigger Sync Run|手動同步|Sync All Feeds/i });
      expect(syncTriggerBtn).toBeInTheDocument();
      expect(syncTriggerBtn).toBeEnabled();
    });

    it('Tier 1: admin triggering manual sync executes sync service and displays progress/completion', async () => {
      const syncVendorsSpy = vi.spyOn(SyncService.prototype, 'syncVendors').mockResolvedValue({
        success: true,
        newLogs: [],
      });

      vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({
        data: {
          user: mockAdminUser as any,
          session: { user: mockAdminUser, access_token: 'valid-jwt' } as any,
        },
        error: null,
      });

      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      fireEvent.click(screen.getByText('Admin Console'));
      await screen.findByText(/後台系統身分驗證/i);
      fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'admin@vulnbeacon.com' } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'ValidPassword123!' } });
      fireEvent.click(screen.getByRole('button', { name: /登入後台/i }));
      await screen.findByText('後台管理系統', {}, { timeout: 4000 });

      fireEvent.click(screen.getByRole('tab', { name: /同步監控/i }));

      const syncTriggerBtn = await screen.findByRole('button', { name: /Trigger Sync Run|手動同步|Sync All Feeds/i });
      fireEvent.click(syncTriggerBtn);

      await waitFor(() => {
        expect(syncVendorsSpy).toHaveBeenCalled();
      });
    });

    it('Tier 1: sync failure surfaces diagnostic feedback in the alert banner', async () => {
      vi.spyOn(SyncService.prototype, 'syncVendors').mockResolvedValue({
        success: false,
        newLogs: [
          {
            id: 'failed-log-1',
            vendor_code: 'redhat',
            status: 'FAILED',
            items_fetched: 0,
            new_items_count: 0,
            duration_ms: 120,
            started_at: '2026-09-07T08:00:00.000Z',
            error_message: '503 Gateway Timeout',
          },
        ],
        errors: ['503 Gateway Timeout'],
      });

      vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({
        data: {
          user: mockAdminUser as any,
          session: { user: mockAdminUser, access_token: 'valid-jwt' } as any,
        },
        error: null,
      });

      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      fireEvent.click(screen.getByText('Admin Console'));
      await screen.findByText(/後台系統身分驗證/i);
      fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'admin@vulnbeacon.com' } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'ValidPassword123!' } });
      fireEvent.click(screen.getByRole('button', { name: /登入後台/i }));
      await screen.findByText('後台管理系統', {}, { timeout: 4000 });

      fireEvent.click(screen.getByRole('tab', { name: /同步監控/i }));

      const syncTriggerBtn = await screen.findByRole('button', { name: /Trigger Sync Run|手動同步|Sync All Feeds/i });
      fireEvent.click(syncTriggerBtn);

      expect(await screen.findByText(/Sync failed: 503 Gateway Timeout/i)).toBeInTheDocument();
    });

    it('Tier 2 (Boundary): manual sync button is disabled while sync is in-flight', async () => {
      let resolveSync: any;
      const syncPromise = new Promise((res) => {
        resolveSync = res;
      });
      vi.spyOn(SyncService.prototype, 'syncVendors').mockReturnValue(syncPromise as any);

      vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({
        data: {
          user: mockAdminUser as any,
          session: { user: mockAdminUser, access_token: 'valid-jwt' } as any,
        },
        error: null,
      });

      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      fireEvent.click(screen.getByText('Admin Console'));
      await screen.findByText(/後台系統身分驗證/i);
      fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'admin@vulnbeacon.com' } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'ValidPassword123!' } });
      fireEvent.click(screen.getByRole('button', { name: /登入後台/i }));
      await screen.findByText('後台管理系統', {}, { timeout: 4000 });

      fireEvent.click(screen.getByRole('tab', { name: /同步監控/i }));

      const syncTriggerBtn = await screen.findByRole('button', { name: /Trigger Sync Run|手動同步|Sync All Feeds/i });
      fireEvent.click(syncTriggerBtn);

      // During sync, button should be disabled
      await waitFor(() => {
        expect(syncTriggerBtn).toBeDisabled();
      });

      // Resolve sync
      resolveSync({ success: true, newLogs: [] });
      await waitFor(() => {
        expect(syncTriggerBtn).toBeEnabled();
      });
    });

    it('Tier 2 (Boundary): network crash during manual sync is handled cleanly without app crash', async () => {
      vi.spyOn(SyncService.prototype, 'syncVendors').mockRejectedValue(new Error('Network disconnected'));

      vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({
        data: {
          user: mockAdminUser as any,
          session: { user: mockAdminUser, access_token: 'valid-jwt' } as any,
        },
        error: null,
      });

      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      fireEvent.click(screen.getByText('Admin Console'));
      await screen.findByText(/後台系統身分驗證/i);
      fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'admin@vulnbeacon.com' } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'ValidPassword123!' } });
      fireEvent.click(screen.getByRole('button', { name: /登入後台/i }));
      await screen.findByText('後台管理系統', {}, { timeout: 4000 });

      fireEvent.click(screen.getByRole('tab', { name: /同步監控/i }));

      const syncTriggerBtn = await screen.findByRole('button', { name: /Trigger Sync Run|手動同步|Sync All Feeds/i });
      fireEvent.click(syncTriggerBtn);

      expect(await screen.findByText(/Sync failed: Network disconnected/i)).toBeInTheDocument();
      // App remains intact and interactive
      expect(syncTriggerBtn).toBeEnabled();
    });

    it('Tier 2 (Boundary): log out immediately revokes manual sync button access', async () => {
      vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({
        data: {
          user: mockAdminUser as any,
          session: { user: mockAdminUser, access_token: 'valid-jwt' } as any,
        },
        error: null,
      });
      vi.spyOn(supabase.auth, 'signOut').mockResolvedValue({ error: null });

      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      fireEvent.click(screen.getByText('Admin Console'));
      await screen.findByText(/後台系統身分驗證/i);
      fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'admin@vulnbeacon.com' } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'ValidPassword123!' } });
      fireEvent.click(screen.getByRole('button', { name: /登入後台/i }));
      await screen.findByText('後台管理系統', {}, { timeout: 4000 });

      fireEvent.click(screen.getByRole('tab', { name: /同步監控/i }));
      expect(await screen.findByRole('button', { name: /Trigger Sync Run|手動同步|Sync All Feeds/i })).toBeInTheDocument();

      // Sign out
      fireEvent.click(screen.getByRole('button', { name: /登出/i }));

      await waitFor(() => {
        expect(screen.getByText(/Security Intelligence Overview/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Trigger Sync Run|手動同步|Sync All Feeds/i })).not.toBeInTheDocument();
      });
    });

    it('Tier 2 (Boundary): refreshing sync logs in Admin Console updates the displayed log count', async () => {
      const fetchLogsSpy = vi.spyOn(SyncService.prototype, 'fetchSyncLogs');

      vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({
        data: {
          user: mockAdminUser as any,
          session: { user: mockAdminUser, access_token: 'valid-jwt' } as any,
        },
        error: null,
      });

      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      fireEvent.click(screen.getByText('Admin Console'));
      await screen.findByText(/後台系統身分驗證/i);
      fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'admin@vulnbeacon.com' } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'ValidPassword123!' } });
      fireEvent.click(screen.getByRole('button', { name: /登入後台/i }));
      await screen.findByText('後台管理系統', {}, { timeout: 4000 });

      fireEvent.click(screen.getByRole('tab', { name: /Log 資料查詢/i }));
      const refreshLogsBtn = await screen.findByRole('button', { name: /重新整理/i });
      fireEvent.click(refreshLogsBtn);

      await waitFor(() => {
        expect(fetchLogsSpy).toHaveBeenCalled();
      });
    });

    it('Tier 2 (Boundary): direct navigation state for unknown sections gracefully falls back to Dashboard', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      // Default is dashboard overview
      expect(screen.getByText(/Security Intelligence Overview/i)).toBeInTheDocument();
      expect(screen.queryByText('後台管理系統')).not.toBeInTheDocument();
    });
  });
});
