import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '@/App';
import { supabase } from '@/lib/supabase';
import { CveService } from '@/services/cveService';
import { SyncService } from '@/services/syncService';
import { WebhookConfigService } from '@/services/webhookConfigService';
import { AdvisoryService } from '@/services/advisoryService';
import { VendorService } from '@/services/vendorService';

describe('E2E: Admin Backstage System & Auth Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(AdvisoryService.prototype, 'fetchAdvisories').mockResolvedValue([
      {
        id: 'adv-1',
        advisory_id: 'RHSA-2026:1001',
        title: 'Critical Security Update',
        severity: 'CRITICAL',
        published_at: '2026-09-01T00:00:00Z',
        url: 'https://access.redhat.com/errata/RHSA-2026:1001',
        vendor_code: 'redhat',
        vendor_name: 'Red Hat',
        cves: [],
        product_impacts: [],
        affected_products: ['RHEL 9'],
        fixed_versions: [],
      } as any,
    ]);

    vi.spyOn(CveService.prototype, 'fetchCves').mockResolvedValue([]);
    vi.spyOn(VendorService.prototype, 'fetchVendors').mockResolvedValue([
      {
        id: 'v1',
        code: 'redhat',
        name: 'Red Hat',
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);
    vi.spyOn(SyncService.prototype, 'fetchSyncLogs').mockResolvedValue([
      {
        id: 'log-e2e-1',
        vendor_code: 'redhat',
        status: 'SUCCESS',
        items_fetched: 25,
        new_items_count: 3,
        duration_ms: 1200,
        started_at: '2026-09-07T12:00:00.000Z',
        details: {
          advisories_count: 25,
          new_cves_count: 3,
          duration_ms: 1200,
          endpoints: ['https://access.redhat.com/security/data/csaf/v2/advisories/'],
        },
      },
      {
        id: 'log-e2e-2',
        vendor_code: 'vmware',
        status: 'FAILED',
        items_fetched: 0,
        new_items_count: 0,
        duration_ms: 350,
        started_at: '2026-09-07T12:05:00.000Z',
        error_message: '503 Service Unavailable',
        details: {
          error_stack: 'HttpError 503: Service Unavailable\n  at adapter.ts:15',
        },
      },
    ]);
    vi.spyOn(WebhookConfigService.prototype, 'fetchWebhooks').mockResolvedValue([
      {
        id: 'hook-1',
        name: 'SOC Alerts',
        platform: 'discord',
        webhook_url: 'https://discord.com/api/webhooks/mock',
        min_severity: 'HIGH',
        is_active: true,
        created_at: '2026-09-01T00:00:00Z',
      },
    ]);
  });

  it('allows public access to explorer and sync monitor without asking for password', async () => {
    render(<App />);

    // Wait for overview load
    expect(await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 })).toBeInTheDocument();

    // Navigate to CVE Explorer without any auth prompt
    fireEvent.click(screen.getByText('CVE Explorer'));
    expect(await screen.findByText(/Errata Explorer/i, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByText(/後台系統身分驗證/i)).not.toBeInTheDocument();

    // Navigate to Sync Monitor without any auth prompt
    fireEvent.click(screen.getByText('Sync Monitor'));
    expect(await screen.findByText('Feed Synchronization Monitor', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByText(/後台系統身分驗證/i)).not.toBeInTheDocument();

    // Verify Log Observation field exists in Sync Monitor table
    expect(screen.getByText('Log Details')).toBeInTheDocument();
    const inspectButtons = screen.getAllByRole('button', { name: /Inspect/i });
    expect(inspectButtons.length).toBeGreaterThan(0);

    // Inspect first log observation field
    fireEvent.click(inspectButtons[0]);
    expect(await screen.findByText(/Log Observability & Diagnostics/i)).toBeInTheDocument();
    expect(screen.getByText(/Structured Observability Field/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Close/i }));
  });

  it('requires password only when clicking Admin Console, unlocks admin features upon sign-in, and signs out', async () => {
    const mockUser = { id: 'admin-1', email: 'admin@vulnbeacon.com' };
    vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({
      data: {
        user: mockUser as any,
        session: { user: mockUser, access_token: 'fake-jwt' } as any,
      },
      error: null,
    });
    vi.spyOn(supabase.auth, 'signOut').mockResolvedValue({ error: null });

    render(<App />);
    await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

    // Click Admin Console in sidebar
    const adminNavBtn = screen.getByText('Admin Console');
    fireEvent.click(adminNavBtn);

    // Prompt for Supabase login credentials
    expect(await screen.findByText(/後台系統身分驗證/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();

    // Fill in credentials
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'admin@vulnbeacon.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'SuperSecret123!' } });
    fireEvent.click(screen.getByRole('button', { name: /登入後台/i }));

    // Unlocks Admin Console
    expect(await screen.findByText('後台管理系統', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(await screen.findByText(/admin@vulnbeacon.com/i)).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: /Webhook 設定/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Log 資料查詢/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /API 與 Supabase 運作狀態/i })).toBeInTheDocument();

    // Feature 1: Webhook settings
    expect(screen.getByText(/Add Webhook Integration/i)).toBeInTheDocument();
    expect(screen.getByText('SOC Alerts')).toBeInTheDocument();

    // Feature 2: Log data query
    fireEvent.click(screen.getByRole('tab', { name: /Log 資料查詢/i }));
    expect(await screen.findByText(/Log 資料查詢與排錯/i)).toBeInTheDocument();
    expect(screen.getByText('503 Service Unavailable')).toBeInTheDocument();

    // Feature 3: API & Supabase Status
    fireEvent.click(screen.getByRole('tab', { name: /API 與 Supabase 運作狀態/i }));
    expect(await screen.findByText(/API 與 Supabase 運作狀態監控/i)).toBeInTheDocument();

    // Sign out of Admin Console
    const signOutBtn = screen.getByRole('button', { name: /登出/i });
    fireEvent.click(signOutBtn);

    // Returns to public overview
    await waitFor(() => {
      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(screen.getByText(/Security Intelligence Overview/i)).toBeInTheDocument();
    });
  });
});
