import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '@/App';
import { supabase } from '@/lib/supabase';
import { CveService } from '@/services/cveService';
import { SyncService } from '@/services/syncService';
import { WebhookConfigService } from '@/services/webhookConfigService';
import { AdvisoryService } from '@/services/advisoryService';
import { VendorService } from '@/services/vendorService';

describe('E2E: Server-Side Manual Threat Feed Sync (Task 11c)', () => {
  const mockUser = { id: 'admin-e2e-1', email: 'admin@vulnbeacon.com' };

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: null },
      error: null,
    } as any);

    vi.spyOn(supabase.auth, 'onAuthStateChange').mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    } as any);

    vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({
      data: {
        user: mockUser as any,
        session: { user: mockUser, access_token: 'fake-admin-jwt-token' } as any,
      },
      error: null,
    } as any);

    vi.spyOn(VendorService.prototype, 'fetchVendors').mockResolvedValue([
      { id: 'v1', code: 'redhat', name: 'Red Hat', is_active: true, created_at: '2026-01-01' },
      { id: 'v2', code: 'nutanix', name: 'Nutanix', is_active: true, created_at: '2026-01-01' },
    ]);

    vi.spyOn(AdvisoryService.prototype, 'fetchAdvisories').mockResolvedValue([]);
    vi.spyOn(CveService.prototype, 'fetchCves').mockResolvedValue([]);
    vi.spyOn(WebhookConfigService.prototype, 'fetchWebhooks').mockResolvedValue([]);
    vi.spyOn(SyncService.prototype, 'fetchSyncLogs').mockResolvedValue([]);
  });

  const loginAdmin = async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: {
        session: {
          user: mockUser as any,
          access_token: 'fake-admin-jwt-token',
        } as any,
      },
      error: null,
    } as any);

    const adminNavBtn = await screen.findByText('Admin Console');
    fireEvent.click(adminNavBtn);

    const emailInput = await screen.findByLabelText(/Email/i);
    fireEvent.change(emailInput, { target: { value: 'admin@vulnbeacon.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'SuperSecret123!' } });
    fireEvent.click(screen.getByRole('button', { name: /登入後台/i }));

    expect(await screen.findByText('後台管理系統', {}, { timeout: 4000 })).toBeInTheDocument();
  };

  it('Phase 1: Admin triggers manual sync -> invokes sync-cve with trigger_manual_sync and updates logs', async () => {
    const mockInvoke = vi.spyOn(
      supabase.functions.constructor.prototype as any,
      'invoke'
    ).mockResolvedValue({
      data: {
        success: true,
        ran: ['redhat', 'nutanix'],
        failed: [],
        logs: [
          {
            id: 'server-log-1',
            vendor_code: 'redhat',
            status: 'SUCCESS',
            items_fetched: 15,
            new_items_count: 4,
            duration_ms: 1250,
            started_at: '2026-09-09T04:00:00.000Z',
            finished_at: '2026-09-09T04:00:01.250Z',
            details: {
              items_fetched: 15,
              new_cves_count: 4,
            },
          },
        ],
        errors: [],
      },
      error: null,
    });

    render(<App />);
    await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

    await loginAdmin();

    // Switch to Sync Monitor tab inside Admin Console
    fireEvent.click(await screen.findByRole('tab', { name: /同步監控/i }, { timeout: 4000 }));

    // Find and trigger manual sync
    fireEvent.click(await screen.findByText('Trigger Sync Run', {}, { timeout: 4000 }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'sync-cve',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer fake-admin-jwt-token',
          }),
          body: {
            action: 'trigger_manual_sync',
            vendorCodes: ['redhat', 'nutanix', 'ubuntu', 'debian', 'suse'],
          },
        })
      );
    });

    // Verification of user-facing feedback banner
    expect(
      await screen.findByText(/Ingestion complete! Fetched and updated feeds in Supabase./i)
    ).toBeInTheDocument();
  });

  it('Phase 2: Handles mutual exclusion concurrency conflict (HTTP 409)', async () => {
    vi.spyOn(
      supabase.functions.constructor.prototype as any,
      'invoke'
    ).mockResolvedValue({
      data: null,
      error: {
        message: 'A threat feed synchronization is already in progress',
        context: {
          json: async () => ({
            success: false,
            error: 'A threat feed synchronization is already in progress',
          }),
        },
      } as any,
    });

    render(<App />);
    await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

    await loginAdmin();

    const syncTab = await screen.findByRole('tab', { name: /同步監控/i });
    fireEvent.click(syncTab);

    const triggerSyncBtn = await screen.findByRole('button', { name: /Trigger Sync Run/i });
    fireEvent.click(triggerSyncBtn);

    expect(
      await screen.findByText(/Sync failed: A threat feed synchronization is already in progress/i)
    ).toBeInTheDocument();
  });

  it('Phase 3: Unauthenticated user is blocked and prompted for admin credentials', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: null },
      error: null,
    } as any);

    render(<App />);

    const adminNavBtn = await screen.findByRole('button', { name: /Admin Console/i });
    fireEvent.click(adminNavBtn);

    expect(await screen.findByText(/後台系統身分驗證/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Trigger Sync Run/i })).not.toBeInTheDocument();
  });
});
