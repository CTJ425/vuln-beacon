import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '@/App';
import { CveService } from '@/services/cveService';
import { SyncService } from '@/services/syncService';
import { WebhookConfigService } from '@/services/webhookConfigService';

describe('App Root Component', () => {
  beforeEach(() => {
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
    expect(await screen.findByText(/Security Intelligence Dashboard/i, {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it('should switch navigation tabs when sidebar links are clicked', async () => {
    render(<App />);

    // Wait for initial load
    await screen.findByText(/Security Intelligence Dashboard/i, {}, { timeout: 4000 });

    // Click CVE Explorer tab
    const explorerTab = screen.getByText('CVE Explorer');
    fireEvent.click(explorerTab);
    expect(await screen.findByText(/Errata Explorer/i, {}, { timeout: 4000 })).toBeInTheDocument();

    // Click Sync Monitor tab
    const syncTab = screen.getByText('Sync Monitor');
    fireEvent.click(syncTab);
    expect(await screen.findByText('Feed Synchronization Monitor', {}, { timeout: 4000 })).toBeInTheDocument();

    // Click Webhooks & Config tab
    const settingsTab = screen.getByText('Webhooks & Config');
    fireEvent.click(settingsTab);
    expect(await screen.findByText('Integrations & Notification Settings', {}, { timeout: 4000 })).toBeInTheDocument();
  });
});
