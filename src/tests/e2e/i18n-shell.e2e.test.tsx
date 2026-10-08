import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { App } from '@/App';
import { supabase } from '@/lib/supabase';
import { CveService } from '@/services/cveService';
import { SyncService } from '@/services/syncService';
import { WebhookConfigService } from '@/services/webhookConfigService';
import { AdvisoryService } from '@/services/advisoryService';
import { VendorService } from '@/services/vendorService';
import { LOCALE_STORAGE_KEY } from '@/i18n/I18nContext';

describe('E2E: interface language', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.removeItem(LOCALE_STORAGE_KEY);
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['en-US']);
    vi.spyOn(AdvisoryService.prototype, 'fetchAdvisories').mockResolvedValue([]);
    vi.spyOn(CveService.prototype, 'fetchCves').mockResolvedValue([]);
    vi.spyOn(VendorService.prototype, 'fetchVendors').mockResolvedValue([]);
    vi.spyOn(SyncService.prototype, 'fetchSyncLogs').mockResolvedValue([]);
    vi.spyOn(WebhookConfigService.prototype, 'fetchWebhooks').mockResolvedValue([]);
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({ data: { session: null }, error: null } as any);
  });

  it('should translate the navigation and remember the language across visits', async () => {
    render(<App />);
    expect(await screen.findByRole('link', { name: 'Overview' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '繁體中文' }));

    expect(screen.getByRole('link', { name: '總覽' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'CVE 檢索' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '管理後台' })).toBeInTheDocument();

    cleanup();
    render(<App />);
    expect(await screen.findByRole('link', { name: '總覽' })).toBeInTheDocument();
  });

  it('should open in Chinese for a Chinese browser with no stored choice', async () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['zh-TW']);
    render(<App />);
    expect(await screen.findByRole('link', { name: '總覽' })).toBeInTheDocument();
  });
});
