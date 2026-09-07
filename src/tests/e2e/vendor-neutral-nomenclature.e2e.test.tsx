import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '@/App';
import { CveService } from '@/services/cveService';
import { SyncService } from '@/services/syncService';
import { WebhookConfigService } from '@/services/webhookConfigService';
import { AdvisoryService } from '@/services/advisoryService';
import { VendorService } from '@/services/vendorService';

describe('E2E: Vendor-Neutral Nomenclature (R3 / F4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(AdvisoryService.prototype, 'fetchAdvisories').mockResolvedValue([
      {
        id: 'adv-neutral-1',
        advisory_id: 'ADV-2026:001',
        title: 'Critical OpenSSL Buffer Overflow Vulnerability',
        severity: 'CRITICAL',
        published_at: '2026-09-01T00:00:00Z',
        url: 'https://security.example.com/advisory/ADV-2026:001',
        summary: 'A critical buffer overflow in OpenSSL parsing routines.',
        vendor_code: 'generic',
        vendor_name: 'Security Alliance',
        cves: [{ cve_id: 'CVE-2026-2001', description: 'OpenSSL buffer overflow' }],
        product_impacts: [
          {
            product_name: 'Core OS 10',
            component: 'openssl-libs',
            state: 'Fixed',
            errata: 'ADV-2026:001',
          },
        ],
        affected_products: ['Core OS 10'],
        fixed_versions: ['openssl-3.0.7-18'],
      } as any,
      {
        id: 'adv-neutral-2',
        advisory_id: 'ADV-2026:002',
        title: 'High Severity Privilege Escalation in System Daemon',
        severity: 'HIGH',
        published_at: '2026-09-02T00:00:00Z',
        url: 'https://security.example.com/advisory/ADV-2026:002',
        summary: 'Local privilege escalation vulnerability.',
        vendor_code: 'generic',
        vendor_name: 'Security Alliance',
        cves: [{ cve_id: 'CVE-2026-2002', description: 'Daemon privesc' }],
        product_impacts: [
          {
            product_name: 'Server Edition 4',
            component: 'systemd',
            state: 'Affected',
          },
        ],
        affected_products: ['Server Edition 4'],
        fixed_versions: [],
      } as any,
    ]);

    vi.spyOn(CveService.prototype, 'fetchCves').mockResolvedValue([
      {
        id: 'cve-1',
        cve_id: 'CVE-2026-2001',
        description: 'OpenSSL buffer overflow',
        severity: 'CRITICAL',
        is_known_exploited: false,
        created_at: '2026-09-01T00:00:00Z',
        vendor_code: 'generic',
        advisory_id: 'ADV-2026:001',
        advisory_title: 'Critical OpenSSL Buffer Overflow Vulnerability',
        affected_products: ['Core OS 10'],
        product_impacts: [
          {
            product_name: 'Core OS 10',
            component: 'openssl-libs',
            state: 'Fixed',
            justification: '',
            errata: 'ADV-2026:001',
            release_date: '2026-09-01',
          },
        ],
        fixed_versions: ['3.0.7-18'],
      },
    ]);

    vi.spyOn(VendorService.prototype, 'fetchVendors').mockResolvedValue([]);
    vi.spyOn(SyncService.prototype, 'fetchSyncLogs').mockResolvedValue([]);
    vi.spyOn(WebhookConfigService.prototype, 'fetchWebhooks').mockResolvedValue([]);
  });

  // =========================================================================
  // Feature 4: Vendor-Neutral Nomenclature Across Public UI (R3 / F4)
  // =========================================================================
  describe('F4: Vendor-Neutral Nomenclature', () => {
    it('Tier 1: dashboard MetricCards uses vendor-neutral label for tracked advisories metric', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      // Metric title should be Tracked Advisories or Security Advisories, not RHSA-Centric
      expect(screen.getByText('Tracked Advisories')).toBeInTheDocument();
      // Subtext should not refer to Red Hat Enterprise Feeds specifically
      expect(screen.queryByText(/Red Hat Enterprise Feeds/i)).not.toBeInTheDocument();
    });

    it('Tier 1: dashboard MetricCards uses vendor-neutral label for critical advisories', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      // R3: "Remove vendor-biased terminology (such as 'RHSA', 'RHSA ID', 'Red Hat Advisories')"
      // Must say "Critical Advisories" or "Critical Security Advisories", NOT "Critical RHSA"
      expect(screen.queryByText('Critical RHSA')).not.toBeInTheDocument();
      expect(screen.getByText(/Critical (Security )?Advisories|Critical CVEs/i)).toBeInTheDocument();
    });

    it('Tier 1: AdvisoryTable column header uses vendor-neutral label Advisory ID', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      // In R3, table header must NOT be "Red Hat Errata (RHSA)"
      expect(screen.queryByText('Red Hat Errata (RHSA)')).not.toBeInTheDocument();
      expect(screen.getByText(/Advisory ID|安全性通報 \(Advisories\)|Security Advisories/i)).toBeInTheDocument();
    });

    it('Tier 1: AdvisoryTable renders Fixed CVEs header in neutral terminology', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      expect(screen.getByText(/修補的 CVE \(Fixed CVEs\)|Fixed CVEs/i)).toBeInTheDocument();
    });

    it('Tier 1: AdvisoryTable renders multi-vendor advisories with neutral format', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      expect(screen.getByText('ADV-2026:001')).toBeInTheDocument();
      expect(screen.getByText('ADV-2026:002')).toBeInTheDocument();
    });

    it('Tier 1: AdvisoryDetailDrawer header displays vendor-neutral Security Advisory', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      fireEvent.click(screen.getByText('ADV-2026:001'));

      // Drawer opens: wait for drawer heading
      expect(await screen.findByText(/影響內容/i, {}, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.queryByText(/Red Hat Security Advisory \(RHSA\)/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Security Advisory|安全性通報/i)).toBeInTheDocument();
    });

    it('Tier 1: AdvisoryDetailDrawer external link button uses neutral label Official Advisory Page', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      fireEvent.click(screen.getByText('ADV-2026:001'));
      expect(await screen.findByText(/影響內容/i, {}, { timeout: 4000 })).toBeInTheDocument();

      // Must NOT say "Red Hat Errata 官方頁面"
      expect(screen.queryByText('Red Hat Errata 官方頁面')).not.toBeInTheDocument();
      expect(screen.getByText(/官方公告頁面|Official Advisory Page|官方頁面/i)).toBeInTheDocument();
    });

    it('Tier 1: CveFilterBar view mode toggle uses vendor-neutral label for Advisories view', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      fireEvent.click(screen.getByText('CVE Explorer'));
      expect(await screen.findByRole('heading', { level: 4, name: /Explorer/i }, { timeout: 4000 })).toBeInTheDocument();

      // Must NOT say "RHSA 公告視角 (Advisories)"
      expect(screen.queryByText(/RHSA 公告視角/i)).not.toBeInTheDocument();
      expect(screen.getByText(/安全性通報視角 \(Advisories\)|通報視角 \(Advisories\)|Advisories/i)).toBeInTheDocument();
    });

    it('Tier 1: CveFilterBar search placeholder uses vendor-neutral phrasing', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      fireEvent.click(screen.getByText('CVE Explorer'));
      expect(await screen.findByRole('heading', { level: 4, name: /Explorer/i }, { timeout: 4000 })).toBeInTheDocument();

      // Placeholder must NOT say "搜尋 RHSA 編號"
      const searchInput = screen.getByRole('textbox');
      const placeholder = searchInput.getAttribute('placeholder') || '';
      expect(placeholder).not.toMatch(/搜尋 RHSA 編號/i);
      expect(placeholder).toMatch(/搜尋通報編號|Advisory ID|CVE/i);
    });

    it('Tier 1: CveFilterBar product family dropdown provides vendor-neutral default option', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      fireEvent.click(screen.getByText('CVE Explorer'));
      expect(await screen.findByRole('heading', { level: 4, name: /Explorer/i }, { timeout: 4000 })).toBeInTheDocument();

      // Dropdown option must NOT say "All Red Hat Ecosystem"
      expect(screen.queryByText('All Red Hat Ecosystem')).not.toBeInTheDocument();
      expect(screen.getByText(/All Product Families|All Ecosystems|所有產品系列/i)).toBeInTheDocument();
    });

    it('Tier 2 (Boundary): header chip displays vendor-neutral security intelligence badge', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      // Header chip must NOT say "Red Hat Security & Errata"
      expect(screen.queryByText('Red Hat Security & Errata')).not.toBeInTheDocument();
      expect(screen.getByText(/Multi-Vendor Security & Errata|Security Intelligence|Security & Errata/i)).toBeInTheDocument();
    });

    it('Tier 2 (Boundary): Explorer page header title uses vendor-neutral phrasing', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      fireEvent.click(screen.getByText('CVE Explorer'));
      expect(await screen.findByRole('heading', { level: 4, name: /Explorer/i }, { timeout: 4000 })).toBeInTheDocument();

      // Title must NOT say "Red Hat Security Advisory (RHSA) & Errata Explorer"
      expect(screen.queryByText(/Red Hat Security Advisory \(RHSA\) & Errata Explorer/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Security Advisory & CVE Explorer|Advisory & CVE Explorer|Vulnerability Explorer/i)).toBeInTheDocument();
    });

    it('Tier 2 (Boundary): empty search in Explorer displays vendor-neutral empty state message', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      fireEvent.click(screen.getByText('CVE Explorer'));
      expect(await screen.findByRole('heading', { level: 4, name: /Explorer/i }, { timeout: 4000 })).toBeInTheDocument();

      const searchInput = screen.getByRole('textbox');
      fireEvent.change(searchInput, { target: { value: 'NONEXISTENT_QUERY_xyz123' } });

      expect(await screen.findByText(/無符合條件的資安資料/i)).toBeInTheDocument();
      // Should not contain vendor-biased failure text
      expect(screen.queryByText(/Red Hat 官方資料庫/i)).not.toBeInTheDocument();
    });

    it('Tier 2 (Boundary): filtering by product family maintains neutral table headers', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      fireEvent.click(screen.getByText('CVE Explorer'));
      expect(await screen.findByRole('heading', { level: 4, name: /Explorer/i }, { timeout: 4000 })).toBeInTheDocument();

      // Column header remains neutral
      expect(screen.queryByText('Red Hat Errata (RHSA)')).not.toBeInTheDocument();
    });

    it('Tier 2 (Boundary): filtering by severity maintains neutral table headers and metrics', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      fireEvent.click(screen.getByText('CVE Explorer'));
      expect(await screen.findByRole('heading', { level: 4, name: /Explorer/i }, { timeout: 4000 })).toBeInTheDocument();

      // Severity dropdown exists with neutral labels
      expect(screen.getByText(/All Severities|所有嚴重等級/i)).toBeInTheDocument();
    });

    it('Tier 2 (Boundary): searching with special characters does not break neutral rendering', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      fireEvent.click(screen.getByText('CVE Explorer'));
      expect(await screen.findByRole('heading', { level: 4, name: /Explorer/i }, { timeout: 4000 })).toBeInTheDocument();

      const searchInput = screen.getByRole('textbox');
      fireEvent.change(searchInput, { target: { value: '<script>alert(1)</script>' } });

      // No crash, neutral empty state
      expect(await screen.findByText(/無符合條件的資安資料/i)).toBeInTheDocument();
    });

    it('Tier 2 (Boundary): advisories render neutral status badges in detail drawer', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      fireEvent.click(screen.getByText('ADV-2026:001'));
      expect(await screen.findByText(/影響內容/i, {}, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 5, name: /ADV-2026:001/i })).toBeInTheDocument();

      // Status badge should display Fixed
      expect(screen.getByText(/已修復 \(Fixed\)/i)).toBeInTheDocument();
    });

    it('Tier 2 (Boundary): advisory without external URL renders details safely without vendor error', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      // ADV-2026:002
      fireEvent.click(screen.getByText('ADV-2026:002'));
      expect(await screen.findByText(/影響內容/i, {}, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 5, name: /ADV-2026:002/i })).toBeInTheDocument();
      expect(screen.getByText(/影響內容/i)).toBeInTheDocument();
    });

    it('Tier 2 (Boundary): switching between Advisory and CVE view preserves neutral toggle labels', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      fireEvent.click(screen.getByText('CVE Explorer'));
      expect(await screen.findByRole('heading', { level: 4, name: /Explorer/i }, { timeout: 4000 })).toBeInTheDocument();

      // Toggle to CVE view
      const cveToggle = screen.getByRole('button', { name: /CVE 弱點視角|弱點視角/i });
      fireEvent.click(cveToggle);

      // Toggle to Advisory view
      const advToggle = screen.getByRole('button', { name: /Advisories/i });
      expect(advToggle.textContent).not.toMatch(/RHSA/i);
      fireEvent.click(advToggle);

      expect(screen.getByText('ADV-2026:001')).toBeInTheDocument();
    });

    it('Tier 2 (Boundary): resetting filter bar restores neutral default values', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      fireEvent.click(screen.getByText('CVE Explorer'));
      expect(await screen.findByRole('heading', { level: 4, name: /Explorer/i }, { timeout: 4000 })).toBeInTheDocument();

      const searchInput = screen.getByRole('textbox');
      fireEvent.change(searchInput, { target: { value: 'openssl' } });

      const resetBtn = screen.getByRole('button', { name: /重設|Reset/i });
      fireEvent.click(resetBtn);

      expect(searchInput).toHaveValue('');
      expect(screen.getByText('ADV-2026:001')).toBeInTheDocument();
    });
  });
});
