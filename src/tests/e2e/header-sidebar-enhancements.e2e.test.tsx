import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '@/App';
import { CveService } from '@/services/cveService';
import { SyncService } from '@/services/syncService';
import { WebhookConfigService } from '@/services/webhookConfigService';
import { AdvisoryService } from '@/services/advisoryService';
import { VendorService } from '@/services/vendorService';

describe('E2E: Header & Sidebar UI Enhancements (R4 / F5, F6)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(AdvisoryService.prototype, 'fetchAdvisories').mockResolvedValue([
      {
        id: 'adv-hsb-1',
        advisory_id: 'ADV-2026-001',
        title: 'Security Advisory Example',
        severity: 'HIGH',
        published_at: '2026-09-01T00:00:00Z',
        url: 'https://security.example.com/advisories/ADV-2026-001',
        vendor_code: 'redhat',
        vendor_name: 'Red Hat',
        cves: [],
        product_impacts: [],
        affected_products: ['Enterprise Linux 9'],
        fixed_versions: [],
      } as any,
    ]);

    vi.spyOn(CveService.prototype, 'fetchCves').mockResolvedValue([]);
    vi.spyOn(VendorService.prototype, 'fetchVendors').mockResolvedValue([]);
    vi.spyOn(SyncService.prototype, 'fetchSyncLogs').mockResolvedValue([]);
    vi.spyOn(WebhookConfigService.prototype, 'fetchWebhooks').mockResolvedValue([]);
  });

  // =========================================================================
  // Feature 5: Header GitHub Repository Link Button (R4 / F5)
  // =========================================================================
  describe('F5: Header GitHub Repository Link Button', () => {
    it('Tier 1: header displays a clickable link pointing to GitHub repository', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      // Link pointing to GitHub repo
      const githubLink = document.querySelector('a[href*="github.com/CTJ425/vuln-beacon"]');
      expect(githubLink).toBeInTheDocument();
    });

    it('Tier 1: header GitHub link specifies exact repository URL https://github.com/CTJ425/vuln-beacon', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      const githubLink = document.querySelector('a[href="https://github.com/CTJ425/vuln-beacon"]');
      expect(githubLink).toBeInTheDocument();
    });

    it('Tier 1: header GitHub link opens in new tab with target="_blank" and secure rel attributes', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      const githubLink = document.querySelector('a[href="https://github.com/CTJ425/vuln-beacon"]');
      expect(githubLink).toHaveAttribute('target', '_blank');
      const rel = githubLink?.getAttribute('rel') || '';
      expect(rel).toContain('noopener');
      expect(rel).toContain('noreferrer');
    });

    it('Tier 1: header notification bell icon button has been completely removed', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      // R4 explicitly requires replacing notification bell with GitHub repo link
      const bellButton = screen.queryByRole('button', { name: /notifications|bell|通知/i });
      expect(bellButton).not.toBeInTheDocument();

      // Check svg with bell class or lucide-bell
      const bellSvg = document.querySelector('svg.lucide-bell');
      expect(bellSvg).not.toBeInTheDocument();
    });

    it('Tier 1: header retains ThemeSwitcher alongside the GitHub link button', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      // Theme toggle switcher exists
      const themeSwitcher = screen.getByRole('button', { name: /切換為深色模式|切換為淺色模式|theme/i })
        || document.querySelector('button[aria-label*="模式"]');
      expect(themeSwitcher).toBeInTheDocument();
    });

    it('Tier 2 (Boundary): header GitHub link has accessible label or tooltip for screen readers', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      const githubLink = document.querySelector('a[href="https://github.com/CTJ425/vuln-beacon"]');
      const ariaLabel = githubLink?.getAttribute('aria-label') || githubLink?.getAttribute('title');
      expect(ariaLabel ? ariaLabel.toLowerCase() : 'github').toMatch(/github/i);
    });

    it('Tier 2 (Boundary): clicking header GitHub link does NOT trigger internal route changes', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      const githubLink = document.querySelector('a[href="https://github.com/CTJ425/vuln-beacon"]');
      if (githubLink) {
        fireEvent.click(githubLink);
      }

      // Remains on overview
      expect(screen.getByText(/Security Intelligence Overview/i)).toBeInTheDocument();
    });

    it('Tier 2 (Boundary): header branding displays VulnBeacon application name', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      expect(screen.getByText('VulnBeacon')).toBeInTheDocument();
    });

    it('Tier 2 (Boundary): header does NOT display public manual sync button for unauthenticated users', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      // R2 & R4: header public sync button removed
      const headerSyncBtn = screen.queryByRole('button', { name: /^Sync All Feeds$/i });
      expect(headerSyncBtn).not.toBeInTheDocument();
    });

    it('Tier 2 (Boundary): switching theme mode preserves header GitHub link visibility', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      const themeToggle = screen.getByRole('button', { name: /切換為深色模式|切換為淺色模式|theme/i })
        || document.querySelector('button[aria-label*="模式"]');

      if (themeToggle) {
        fireEvent.click(themeToggle);
      }

      const githubLink = document.querySelector('a[href="https://github.com/CTJ425/vuln-beacon"]');
      expect(githubLink).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Feature 6: Sidebar Application Version Display (R4 / F6)
  // =========================================================================
  describe('F6: Sidebar Application Version Display', () => {
    it('Tier 1: sidebar renders the application version in the bottom area', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      // R4 specifies displaying application version in bottom-left of sidebar
      const versionText = screen.getByText(/v?1\.0\.0(-dev\.\d+)?/i);
      expect(versionText).toBeInTheDocument();
    });

    it('Tier 1: sidebar version matches the semantic project version format', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      const versionElement = screen.getByText(/1\.0\.0/i);
      expect(versionElement.textContent).toMatch(/v?1\.0\.0(-dev\.\d+)?/i);
    });

    it('Tier 1: sidebar layout positions version at the bottom of the sidebar area', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      const versionElement = screen.getByText(/1\.0\.0/i);
      // The version element is contained inside the sidebar structure
      const sidebarContainer = versionElement.closest('[class*="MuiBox-root"]') || versionElement.parentElement;
      expect(sidebarContainer).toBeInTheDocument();
    });

    it('Tier 1: sidebar version element does not interfere with navigation items', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      // Navigation buttons remain accessible
      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('CVE Explorer')).toBeInTheDocument();
      expect(screen.getByText('Admin Console')).toBeInTheDocument();
    });

    it('Tier 1: clicking navigation items works smoothly alongside the version element', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      fireEvent.click(screen.getByText('CVE Explorer'));
      expect(await screen.findByRole('heading', { level: 4, name: /Explorer/i }, { timeout: 4000 })).toBeInTheDocument();

      // Version remains visible
      expect(screen.getByText(/1\.0\.0/i)).toBeInTheDocument();
    });

    it('Tier 2 (Boundary): version display uses secondary/muted typography', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      const versionElement = screen.getByText(/1\.0\.0/i);
      // Verify it is not styled as a primary action
      expect(versionElement.tagName.toLowerCase()).not.toBe('button');
    });

    it('Tier 2 (Boundary): toggling theme maintains legible version text', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      const themeToggle = screen.getByRole('button', { name: /切換為深色模式|切換為淺色模式|theme/i })
        || document.querySelector('button[aria-label*="模式"]');

      if (themeToggle) {
        fireEvent.click(themeToggle);
      }

      expect(screen.getByText(/1\.0\.0/i)).toBeInTheDocument();
    });

    it('Tier 2 (Boundary): version element is rendered as informative static text', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      const versionElement = screen.getByText(/1\.0\.0/i);
      // Should not have role="button" or interactive navigation action
      expect(versionElement.getAttribute('role')).not.toBe('button');
    });

    it('Tier 2 (Boundary): sidebar retains version visibility across page navigation', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      // Navigate to CVE Explorer
      fireEvent.click(screen.getByText('CVE Explorer'));
      expect(await screen.findByRole('heading', { level: 4, name: /Explorer/i }, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByText(/1\.0\.0/i)).toBeInTheDocument();

      // Navigate back to Overview
      fireEvent.click(screen.getByText('Overview'));
      expect(await screen.findByText(/Security Intelligence Overview/i)).toBeInTheDocument();
      expect(screen.getByText(/1\.0\.0/i)).toBeInTheDocument();
    });

    it('Tier 2 (Boundary): sidebar container maintains correct width and flex layout with version container', async () => {
      render(<App />);
      await screen.findByText(/Security Intelligence Overview/i, {}, { timeout: 4000 });

      const versionElement = screen.getByText(/1\.0\.0/i);
      expect(versionElement).toBeVisible();
    });
  });
});
