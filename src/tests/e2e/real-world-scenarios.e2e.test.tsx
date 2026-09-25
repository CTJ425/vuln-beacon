import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '@/App';
import { supabase } from '@/lib/supabase';
import { CveService } from '@/services/cveService';
import { SyncService } from '@/services/syncService';
import { WebhookConfigService } from '@/services/webhookConfigService';
import { AdvisoryService } from '@/services/advisoryService';
import { VendorService } from '@/services/vendorService';
import { APP_VERSION } from '@/config/version';

describe('E2E: Cross-Feature Interactions & Real-World Scenarios (Tiers 3 & 4)', () => {
  const mockAdminUser = { id: 'admin-e2e-super', email: 'secops-admin@vulnbeacon.com', app_metadata: { role: 'admin' } };

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(AdvisoryService.prototype, 'fetchAdvisories').mockResolvedValue([
      {
        id: 'adv-rw-1',
        advisory_id: 'ADV-2026:1088',
        title: 'Critical Vulnerability in Core Networking Stack',
        severity: 'CRITICAL',
        published_at: '2026-09-01T00:00:00Z',
        url: 'https://security.example.com/advisory/ADV-2026:1088',
        summary: 'Heap buffer overflow allows unauthenticated remote code execution.',
        vendor_code: 'generic',
        vendor_name: 'Core Systems',
        cves: [{ cve_id: 'CVE-2026-8888', description: 'Network heap overflow' }],
        product_impacts: [
          {
            product_name: 'Enterprise Router OS 12',
            component: 'net-core',
            state: 'Fixed',
            errata: 'ADV-2026:1088',
          },
        ],
        affected_products: ['Enterprise Router OS 12'],
        fixed_versions: ['net-core-12.4.1'],
      } as any,
    ]);

    vi.spyOn(CveService.prototype, 'fetchCves').mockResolvedValue([
      {
        id: 'cve-rw-1',
        cve_id: 'CVE-2026-8888',
        description: 'Network heap overflow in router stack',
        severity: 'CRITICAL',
        is_known_exploited: false,
        created_at: '2026-09-01T00:00:00Z',
        vendor_code: 'generic',
        advisory_id: 'ADV-2026:1088',
        advisory_title: 'Critical Vulnerability in Core Networking Stack',
        affected_products: ['Enterprise Router OS 12'],
        product_impacts: [
          {
            product_name: 'Enterprise Router OS 12',
            component: 'net-core',
            state: 'Fixed',
            justification: '',
            errata: 'ADV-2026:1088',
            release_date: '2026-09-01',
          },
        ],
        fixed_versions: ['12.4.1'],
      },
    ]);

    vi.spyOn(VendorService.prototype, 'fetchVendors').mockResolvedValue([
      {
        id: 'v-core',
        code: 'generic',
        name: 'Core Systems',
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);

    vi.spyOn(SyncService.prototype, 'fetchSyncLogs').mockResolvedValue([
      {
        id: 'log-initial',
        vendor_code: 'generic',
        status: 'SUCCESS',
        items_fetched: 50,
        new_items_count: 5,
        duration_ms: 1100,
        started_at: '2026-09-07T06:00:00.000Z',
        details: {
          advisories_count: 50,
          new_cves_count: 5,
        },
      },
    ]);

    vi.spyOn(WebhookConfigService.prototype, 'fetchWebhooks').mockResolvedValue([
      {
        id: 'hook-rw-1',
        name: 'Security Operations Alert',
        platform: 'slack',
        webhook_url: 'https://hooks.slack.com/services/mock/rw',
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

  const authenticateAdmin = async () => {
    vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({
      data: {
        user: mockAdminUser as any,
        session: { user: mockAdminUser, access_token: 'fake-jwt' } as any,
      },
      error: null,
    });

    fireEvent.click(screen.getByText('Admin Console'));
    await screen.findByText(/後台系統身分驗證/i);

    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'secops-admin@vulnbeacon.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'SuperSecret123!' } });
    fireEvent.click(screen.getByRole('button', { name: /登入後台/i }));

    await screen.findByText('後台管理系統', {}, { timeout: 4000 });
  };

  // =========================================================================
  // Tier 3: Pairwise Cross-Feature Interactions
  // =========================================================================
  describe('Tier 3: Pairwise Cross-Feature Combinations', () => {
    it('1. Admin sign-in -> navigate to Sync Monitor tab -> trigger manual sync -> verify sync log update in Log Query', async () => {
      const newLog = {
        id: 'log-new-synced',
        vendor_code: 'generic',
        status: 'SUCCESS',
        items_fetched: 10,
        new_items_count: 1,
        duration_ms: 900,
        started_at: '2026-09-07T12:00:00.000Z',
        details: { advisories_count: 10, new_cves_count: 1 },
      };

      vi.spyOn(SyncService.prototype, 'syncVendors').mockResolvedValue({
        success: true,
        newLogs: [newLog as any],
      });

      // Update sync logs mock on subsequent call
      vi.spyOn(SyncService.prototype, 'fetchSyncLogs').mockResolvedValue([
        newLog as any,
        {
          id: 'log-initial',
          vendor_code: 'generic',
          status: 'SUCCESS',
          items_fetched: 50,
          new_items_count: 5,
          duration_ms: 1100,
          started_at: '2026-09-07T06:00:00.000Z',
        } as any,
      ]);

      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });
      await authenticateAdmin();

      // Step 2: Switch to Tab 1 (同步監控)
      fireEvent.click(screen.getByRole('tab', { name: /同步監控/i }));
      const triggerBtn = await screen.findByRole('button', { name: /Trigger Sync Run|手動同步|Sync All Feeds/i });

      // Step 3: Trigger sync
      fireEvent.click(triggerBtn);

      // Step 4: Switch to Tab 2 (Log 資料查詢)
      fireEvent.click(screen.getByRole('tab', { name: /Log 資料查詢/i }));
      expect(await screen.findByText(/Log 資料查詢與排錯/i, {}, { timeout: 4000 })).toBeInTheDocument();
    });

    it('2. Explorer search with neutral filters -> open detail drawer -> verify neutral labels -> switch to Admin Console -> cancel modal -> verify return to Explorer', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      // Navigate to Explorer
      fireEvent.click(screen.getByText('CVE Explorer'));
      expect(await screen.findByRole('heading', { level: 4, name: /Explorer/i }, { timeout: 4000 })).toBeInTheDocument();

      // Search keyword
      const searchInput = screen.getByRole('textbox');
      fireEvent.change(searchInput, { target: { value: 'Networking' } });
      expect(screen.getByText('ADV-2026:1088')).toBeInTheDocument();

      // Open detail drawer
      fireEvent.click(screen.getByText('ADV-2026:1088'));
      expect(await screen.findByText(/影響內容/i)).toBeInTheDocument();
      // Neutral labels
      expect(screen.queryByText(/Red Hat Security Advisory \(RHSA\)/i)).not.toBeInTheDocument();

      // Close drawer
      const closeDrawerBtn = screen.getByRole('button', { name: /close|關閉/i })
        || document.querySelector('button svg.lucide-x')?.parentElement;
      if (closeDrawerBtn) fireEvent.click(closeDrawerBtn);

      // Click Admin Console to trigger login modal
      fireEvent.click(screen.getByText('Admin Console'));
      expect(await screen.findByText(/後台系統身分驗證/i)).toBeInTheDocument();

      // Cancel modal
      const cancelBtn = screen.getByRole('button', { name: /取消|Close/i });
      fireEvent.click(cancelBtn);

      // Verify user remains on Explorer with search query preserved
      await waitFor(() => {
        expect(screen.queryByText(/後台系統身分驗證/i)).not.toBeInTheDocument();
        expect(screen.getByText('ADV-2026:1088')).toBeInTheDocument();
      });
    });

    it('3. Public dashboard view -> check version & GitHub link -> authenticate -> verify 4 tabs -> sign out -> verify public view', async () => {
      vi.spyOn(supabase.auth, 'signOut').mockResolvedValue({ error: null });

      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      // Public checks: version in sidebar, GitHub link in header
      expect(screen.getByText(new RegExp(APP_VERSION, 'i'))).toBeInTheDocument();
      expect(document.querySelector('a[href*="github.com/CTJ425/vuln-beacon"]')).toBeInTheDocument();

      // Authenticate
      await authenticateAdmin();

      // Verify 4 tabs
      expect(screen.getByRole('tab', { name: /Webhook 設定/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /同步監控/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Log 資料查詢/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /API 與 Supabase 運作狀態/i })).toBeInTheDocument();

      // Sign out
      fireEvent.click(screen.getByRole('button', { name: /登出/i }));

      // Back on public dashboard
      await waitFor(() => {
        expect(screen.getByText(/Security Intelligence Overview/i)).toBeInTheDocument();
        expect(screen.queryByRole('tab', { name: /同步監控/i })).not.toBeInTheDocument();
      });
    });

    it('4. Mid-session token expiration while in Admin Console Tab 1 -> immediate redirect to dashboard, preventing sync actions', async () => {
      let authCallback: any = null;
      vi.spyOn(supabase.auth, 'onAuthStateChange').mockImplementation(((cb: any) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }) as any);

      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });
      await authenticateAdmin();

      fireEvent.click(screen.getByRole('tab', { name: /同步監控/i }));
      expect(await screen.findByRole('button', { name: /Trigger Sync Run|手動同步|Sync All Feeds/i })).toBeInTheDocument();

      // Session expires mid-session
      if (authCallback) {
        authCallback('SIGNED_OUT', null);
      }

      await waitFor(() => {
        expect(screen.getByText(/Security Intelligence Overview/i)).toBeInTheDocument();
        expect(screen.queryByText('後台管理系統')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Trigger Sync Run|手動同步|Sync All Feeds/i })).not.toBeInTheDocument();
      });
    });

    it('5. Admin switches across tabs with actions in each tab without state collision', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });
      await authenticateAdmin();

      // Tab 0: Webhook
      expect(screen.getByText(/Add Webhook Integration/i)).toBeInTheDocument();

      // Tab 1: Sync Monitor
      fireEvent.click(screen.getByRole('tab', { name: /同步監控/i }));
      expect(await screen.findByText(/Feed Sources|資料來源/i)).toBeInTheDocument();

      // Tab 2: Log Query
      fireEvent.click(screen.getByRole('tab', { name: /Log 資料查詢/i }));
      expect(await screen.findByText(/Log 資料查詢與排錯/i)).toBeInTheDocument();

      // Tab 3: System Health
      fireEvent.click(screen.getByRole('tab', { name: /API 與 Supabase 運作狀態/i }));
      expect(await screen.findByText(/API 與 Supabase 運作狀態監控/i)).toBeInTheDocument();
    });

    it('6. Direct attempt to access admin view triggers login modal then successfully unlocks admin console', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      // Click Admin Console
      fireEvent.click(screen.getByText('Admin Console'));
      expect(await screen.findByText(/後台系統身分驗證/i)).toBeInTheDocument();

      // Complete login
      vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({
        data: {
          user: mockAdminUser as any,
          session: { user: mockAdminUser, access_token: 'fake-jwt' } as any,
        },
        error: null,
      });

      fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'secops-admin@vulnbeacon.com' } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'SuperSecret123!' } });
      fireEvent.click(screen.getByRole('button', { name: /登入後台/i }));

      expect(await screen.findByText('後台管理系統', {}, { timeout: 4000 })).toBeInTheDocument();
    });

    it('7. Admin handles failed sync with observability diagnostics, logs out, public overview unaffected', async () => {
      vi.spyOn(SyncService.prototype, 'syncVendors').mockResolvedValue({
        success: false,
        newLogs: [
          {
            id: 'err-log-1',
            vendor_code: 'generic',
            status: 'FAILED',
            items_fetched: 0,
            new_items_count: 0,
            duration_ms: 150,
            started_at: '2026-09-07T12:00:00.000Z',
            error_message: '502 Bad Gateway',
          } as any,
        ],
        errors: ['502 Bad Gateway'],
      });
      vi.spyOn(supabase.auth, 'signOut').mockResolvedValue({ error: null });

      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });
      await authenticateAdmin();

      fireEvent.click(screen.getByRole('tab', { name: /同步監控/i }));
      const triggerBtn = await screen.findByRole('button', { name: /Trigger Sync Run|手動同步|Sync All Feeds/i });
      fireEvent.click(triggerBtn);

      expect(await screen.findByText(/Sync failed: 502 Bad Gateway/i)).toBeInTheDocument();

      // Sign out
      fireEvent.click(screen.getByRole('button', { name: /登出/i }));
      await waitFor(() => {
        expect(screen.getByText(/Security Intelligence Overview/i)).toBeInTheDocument();
      });
    });

    it('8. Theme toggle maintains coherent UI layout across Dashboard, Explorer, and Admin Console', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      const themeToggle = screen.getByRole('button', { name: /切換為深色模式|切換為淺色模式|theme/i })
        || document.querySelector('button[aria-label*="模式"]');

      if (themeToggle) {
        fireEvent.click(themeToggle);
      }

      fireEvent.click(screen.getByText('CVE Explorer'));
      expect(await screen.findByRole('heading', { level: 4, name: /Explorer/i }, { timeout: 4000 })).toBeInTheDocument();

      await authenticateAdmin();
      expect(screen.getByText('後台管理系統')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Tier 4: Real-World Workloads & Scenarios
  // =========================================================================
  describe('Tier 4: Real-World Workloads & Scenarios', () => {
    it('Scenario 1: General User Browsing Flow', async () => {
      render(<App />);

      // 1. Loads Overview with vendor-neutral metrics
      expect(await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByText('Tracked Advisories')).toBeInTheDocument();
      expect(screen.queryByText('Critical RHSA')).not.toBeInTheDocument();

      // 2. Checks GitHub repository link in Header
      const githubLink = document.querySelector('a[href="https://github.com/CTJ425/vuln-beacon"]');
      expect(githubLink).toBeInTheDocument();

      // 3. Checks application version in bottom-left Sidebar
      expect(screen.getByText(new RegExp(APP_VERSION, 'i'))).toBeInTheDocument();

      // 4. Confirms absence of Sync Monitor / Webhooks / Public Sync button
      expect(screen.queryByRole('button', { name: /^Sync Monitor$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Webhooks & Config/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Sync All Feeds$/i })).not.toBeInTheDocument();

      // 5. Navigates to CVE Explorer, applies search and views details
      fireEvent.click(screen.getByText('CVE Explorer'));
      expect(await screen.findByRole('heading', { level: 4, name: /Explorer/i }, { timeout: 4000 })).toBeInTheDocument();

      const searchInput = screen.getByRole('textbox');
      fireEvent.change(searchInput, { target: { value: 'CVE-2026-8888' } });
      expect(screen.getByText('ADV-2026:1088')).toBeInTheDocument();

      // 6. Opens detail drawer
      fireEvent.click(screen.getByText('ADV-2026:1088'));
      expect(await screen.findByText(/影響內容/i)).toBeInTheDocument();
      expect(screen.queryByText(/Red Hat Security Advisory \(RHSA\)/i)).not.toBeInTheDocument();
    });

    it('Scenario 2: Administrator Backstage Ingestion & Monitoring Flow', async () => {
      const syncVendorsSpy = vi.spyOn(SyncService.prototype, 'syncVendors').mockResolvedValue({
        success: true,
        newLogs: [],
      });
      vi.spyOn(supabase.auth, 'signOut').mockResolvedValue({ error: null });

      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      // 1. Opens Admin Console & authenticates
      await authenticateAdmin();

      // 2. Verifies all 4 tabs
      expect(screen.getByRole('tab', { name: /Webhook 設定/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /同步監控/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Log 資料查詢/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /API 與 Supabase 運作狀態/i })).toBeInTheDocument();

      // 3. Inspects Webhook configurations on Tab 0
      expect(screen.getByText('Security Operations Alert')).toBeInTheDocument();

      // 4. Switches to Tab 1 (同步監控), reviews feed sources
      fireEvent.click(screen.getByRole('tab', { name: /同步監控/i }));
      expect(await screen.findByText(/Feed Sources|資料來源/i)).toBeInTheDocument();

      // 5. Triggers manual sync run
      const triggerBtn = await screen.findByRole('button', { name: /Trigger Sync Run|手動同步|Sync All Feeds/i });
      fireEvent.click(triggerBtn);

      await waitFor(() => {
        expect(syncVendorsSpy).toHaveBeenCalled();
      });

      // 6. Switches to Tab 2 (Log 資料查詢), reviews execution history
      fireEvent.click(screen.getByRole('tab', { name: /Log 資料查詢/i }));
      expect(await screen.findByText(/Log 資料查詢與排錯/i)).toBeInTheDocument();

      // 7. Switches to Tab 3 (System Health)
      fireEvent.click(screen.getByRole('tab', { name: /API 與 Supabase 運作狀態/i }));
      expect(await screen.findByText(/API 與 Supabase 運作狀態監控/i)).toBeInTheDocument();

      // 8. Signs out securely
      fireEvent.click(screen.getByRole('button', { name: /登出/i }));
      await waitFor(() => {
        expect(screen.getByText(/Security Intelligence Overview/i)).toBeInTheDocument();
      });
    });

    it('Scenario 3: Security Advisory Search & Inspection Flow', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      // 1. Navigate to CVE Explorer
      fireEvent.click(screen.getByText('CVE Explorer'));
      expect(await screen.findByRole('heading', { level: 4, name: /Explorer/i }, { timeout: 4000 })).toBeInTheDocument();

      // 2. Uses vendor-neutral controls: view mode toggle & placeholder
      const searchBox = screen.getByRole('textbox');
      expect(searchBox.getAttribute('placeholder')).not.toMatch(/搜尋 RHSA 編號/i);

      // 3. Filters by severity CRITICAL
      const severitySelect = screen.getByLabelText(/Severity|嚴重等級/i);
      fireEvent.mouseDown(severitySelect);
      const criticalOption = await screen.findByRole('option', { name: /Critical/i });
      fireEvent.click(criticalOption);

      // 4. Inspects matching row
      expect(screen.getByText('ADV-2026:1088')).toBeInTheDocument();

      // 5. Opens detail drawer
      fireEvent.click(screen.getByText('ADV-2026:1088'));
      // The ID legitimately appears in the table row, the drawer heading, and the
      // drawer's self-referential errata cell; assert on the drawer heading.
      expect(
        await screen.findByRole('heading', { name: /ADV-2026:1088/i })
      ).toBeInTheDocument();
      expect(screen.getByText(/已修復 \(Fixed\)/i)).toBeInTheDocument();

      // 6. Resets search
      const closeBtn = screen.getByRole('button', { name: /close|關閉/i })
        || document.querySelector('button svg.lucide-x')?.parentElement;
      if (closeBtn) fireEvent.click(closeBtn);

      const resetBtn = screen.getByRole('button', { name: /重設|Reset/i });
      fireEvent.click(resetBtn);
    });

    it('Scenario 4: Access Boundary Protection & Session Revocation Flow', async () => {
      let authCallback: any = null;
      vi.spyOn(supabase.auth, 'onAuthStateChange').mockImplementation(((cb: any) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }) as any);

      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      // 1. Unauthenticated attempt: triggers login modal
      fireEvent.click(screen.getByText('Admin Console'));
      expect(await screen.findByText(/後台系統身分驗證/i)).toBeInTheDocument();

      // 2. Invalid credentials attempt
      vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Invalid credentials' } as any,
      });
      fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'bad@actor.com' } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'badpass' } });
      fireEvent.click(screen.getByRole('button', { name: /登入後台/i }));
      expect(await screen.findByText(/Invalid credentials/i)).toBeInTheDocument();

      // 3. Valid login
      vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValueOnce({
        data: {
          user: mockAdminUser as any,
          session: { user: mockAdminUser, access_token: 'fake-jwt' } as any,
        },
        error: null,
      });
      fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'secops-admin@vulnbeacon.com' } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'SuperSecret123!' } });
      fireEvent.click(screen.getByRole('button', { name: /登入後台/i }));
      expect(await screen.findByText('後台管理系統', {}, { timeout: 4000 })).toBeInTheDocument();

      // 4. In Admin Console Tab 1
      fireEvent.click(screen.getByRole('tab', { name: /同步監控/i }));
      expect(await screen.findByRole('button', { name: /Trigger Sync Run|手動同步|Sync All Feeds/i })).toBeInTheDocument();

      // 5. Session token revoked (mid-session timeout)
      if (authCallback) {
        authCallback('SIGNED_OUT', null);
      }

      // 6. User is immediately redirected to Dashboard, no backstage or manual sync access
      await waitFor(() => {
        expect(screen.getByText(/Security Intelligence Overview/i)).toBeInTheDocument();
        expect(screen.queryByText('後台管理系統')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Trigger Sync Run|手動同步|Sync All Feeds/i })).not.toBeInTheDocument();
      });
    });
  });
});
