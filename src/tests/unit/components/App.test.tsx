import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '@/App';
import { CveService } from '@/services/cveService';
import { SyncService } from '@/services/syncService';
import { WebhookConfigService } from '@/services/webhookConfigService';
import { AdvisoryService } from '@/services/advisoryService';

describe('App Root Component', () => {
  beforeEach(() => {
    vi.spyOn(AdvisoryService.prototype, 'fetchAdvisories').mockResolvedValue([
      {
        id: 'a1',
        advisory_id: 'RHSA-2026:6821',
        title: 'Test RHSA',
        severity: 'CRITICAL',
        published_at: '2026-08-15T00:00:00Z',
        url: 'https://access.redhat.com/errata/RHSA-2026:6821',
        summary: 'kernel security update',
        vendor_id: 'redhat',
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
  });

  it('should switch navigation tabs when sidebar links are clicked', async () => {
    render(<App />);

    // Wait for initial load
    await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

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

  it('should render a vendor group in the sidebar derived from advisory data, with the static nav items unchanged', async () => {
    render(<App />);
    await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

    // vendor group derived from the mocked advisory (vendor_id: 'redhat'); the
    // vendor name also appears in the Overview's vendor-card row, so allow
    // more than one match — only presence is asserted here.
    expect((await screen.findAllByText('Red Hat', {}, { timeout: 4000 })).length).toBeGreaterThan(0);
    expect(await screen.findByText('Red Hat Enterprise Linux', {}, { timeout: 4000 })).toBeInTheDocument();

    // static nav items must still exist, unchanged
    expect(screen.getByText('CVE Explorer')).toBeInTheDocument();
    expect(screen.getByText('Sync Monitor')).toBeInTheDocument();
    expect(screen.getByText('Webhooks & Config')).toBeInTheDocument();
  });
});
