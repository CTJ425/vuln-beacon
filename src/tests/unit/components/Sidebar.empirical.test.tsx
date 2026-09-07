import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '@/components/common/Sidebar';
import { APP_VERSION } from '@/config/version';
import { VendorNode } from '@/services/productTaxonomy';

describe('Sidebar Empirical Layout, Scrolling & DOM Verification (Challenger 2)', () => {
  // Generator for large vendor list mock
  const generateLargeTaxonomy = (count: number): VendorNode[] => {
    return Array.from({ length: count }, (_, i) => ({
      vendorCode: `vendor-${i}`,
      vendorName: `Vendor Enterprise ${i}`,
      advisoryCount: (i * 7) % 50,
      criticalCount: (i * 3) % 10,
      products: [
        {
          id: `product-${i}-a`,
          name: `Product ${i}-A`,
          advisoryCount: 2,
        },
      ],
    }));
  };

  describe('1. Sidebar Flexbox Structure & Styling Contract', () => {
    it('renders sidebar container with semantic aside element and flex column styles', () => {
      render(
        <Sidebar
          currentNav={{ section: 'dashboard' }}
          onSelectNav={vi.fn()}
          taxonomy={[]}
        />
      );

      const container = screen.getByTestId('sidebar-container');
      expect(container.tagName.toLowerCase()).toBe('aside');

      // Check computed styles / inline styles from MUI sx props
      const style = window.getComputedStyle(container);
      expect(style.display).toBe('flex');
      expect(style.flexDirection).toBe('column');
      expect(style.justifyContent).toBe('space-between');
      expect(style.overflow).toBe('hidden');
      expect(style.width).toBe('240px');
      expect(style.height).toBe('calc(100vh - 64px)');
    });

    it('isolates scrollable navigation list wrapper with flexGrow 1 and overflowY auto', () => {
      render(
        <Sidebar
          currentNav={{ section: 'dashboard' }}
          onSelectNav={vi.fn()}
          taxonomy={[]}
        />
      );

      const navWrapper = screen.getByTestId('sidebar-nav-list-wrapper');
      expect(navWrapper).toBeInTheDocument();

      const style = window.getComputedStyle(navWrapper);
      expect(style.flexGrow).toBe('1');
      expect(style.overflowY).toBe('auto');
    });

    it('pins the footer at the bottom outside the scrollable nav list wrapper', () => {
      render(
        <Sidebar
          currentNav={{ section: 'dashboard' }}
          onSelectNav={vi.fn()}
          taxonomy={[]}
        />
      );

      const container = screen.getByTestId('sidebar-container');
      const navWrapper = screen.getByTestId('sidebar-nav-list-wrapper');
      const footer = screen.getByTestId('sidebar-footer');

      // Both wrapper and footer must be direct children of container
      expect(navWrapper.parentElement).toBe(container);
      expect(footer.parentElement).toBe(container);

      // Footer must NOT be a child of navWrapper
      expect(navWrapper.contains(footer)).toBe(false);

      // Order of children: navWrapper first, footer second
      expect(container.children[0]).toBe(navWrapper);
      expect(container.children[1]).toBe(footer);

      // Footer styling verification
      const footerStyle = window.getComputedStyle(footer);
      expect(footerStyle.display).toBe('flex');
      expect(footerStyle.alignItems).toBe('center');
      expect(footerStyle.justifyContent).toBe('flex-start');
      expect(footerStyle.borderTop).toMatch(/1px solid/i);
    });
  });

  describe('2. Version Element Verification in Pinned Footer', () => {
    it('renders the version element strictly inside data-testid="sidebar-footer"', () => {
      render(
        <Sidebar
          currentNav={{ section: 'dashboard' }}
          onSelectNav={vi.fn()}
          taxonomy={[]}
        />
      );

      const footer = screen.getByTestId('sidebar-footer');
      const versionEl = screen.getByTestId('sidebar-version');

      expect(footer.contains(versionEl)).toBe(true);
      expect(versionEl).toBeInTheDocument();
      expect(versionEl.textContent).toBe(`v${APP_VERSION}`);
    });

    it('verifies version typography is non-interactive and userSelect is none', () => {
      render(
        <Sidebar
          currentNav={{ section: 'dashboard' }}
          onSelectNav={vi.fn()}
          taxonomy={[]}
        />
      );

      const versionEl = screen.getByTestId('sidebar-version');
      expect(versionEl.tagName.toLowerCase()).toBe('span'); // MUI Typography variant="caption"
      expect(versionEl.getAttribute('role')).toBeNull();

      const style = window.getComputedStyle(versionEl);
      expect(style.userSelect).toBe('none');
    });

    it('handles version prop variations correctly: without "v", with "v", and default fallback', () => {
      const { rerender } = render(
        <Sidebar
          currentNav={{ section: 'dashboard' }}
          onSelectNav={vi.fn()}
          taxonomy={[]}
          version="0.9.1"
        />
      );
      expect(screen.getByTestId('sidebar-version').textContent).toBe('v0.9.1');

      rerender(
        <Sidebar
          currentNav={{ section: 'dashboard' }}
          onSelectNav={vi.fn()}
          taxonomy={[]}
          version="v2.4.0-rc.1"
        />
      );
      expect(screen.getByTestId('sidebar-version').textContent).toBe('v2.4.0-rc.1');

      rerender(
        <Sidebar
          currentNav={{ section: 'dashboard' }}
          onSelectNav={vi.fn()}
          taxonomy={[]}
        />
      );
      expect(screen.getByTestId('sidebar-version').textContent).toBe(`v${APP_VERSION}`);
    });
  });

  describe('3. Large Vendor List Stress Test & Scrolling Confirmation', () => {
    it('maintains pinned footer position and DOM integrity under 100 vendor nodes', () => {
      const largeTaxonomy = generateLargeTaxonomy(100);
      const onSelectNav = vi.fn();

      render(
        <Sidebar
          currentNav={{ section: 'dashboard' }}
          onSelectNav={onSelectNav}
          taxonomy={largeTaxonomy}
        />
      );

      const container = screen.getByTestId('sidebar-container');
      const navWrapper = screen.getByTestId('sidebar-nav-list-wrapper');
      const footer = screen.getByTestId('sidebar-footer');
      const versionEl = screen.getByTestId('sidebar-version');

      // Ensure all 100 vendor entries are rendered inside navWrapper
      const listItems = navWrapper.querySelectorAll('.MuiListItemButton-root');
      // 1 Overview + 100 Vendors + 4 Static Items = 105 items
      expect(listItems.length).toBe(105);

      // Verify footer is still attached outside navWrapper at the bottom
      expect(container.children[1]).toBe(footer);
      expect(footer.contains(versionEl)).toBe(true);
      expect(versionEl.textContent).toBe(`v${APP_VERSION}`);

      // Verify first vendor and 99th vendor can be interacted with
      fireEvent.click(listItems[1]); // vendor-0
      expect(onSelectNav).toHaveBeenCalledWith({
        section: 'vendor',
        vendorCode: 'vendor-0',
      });

      fireEvent.click(listItems[100]); // vendor-99
      expect(onSelectNav).toHaveBeenCalledWith({
        section: 'vendor',
        vendorCode: 'vendor-99',
      });

      // Verify container overflow remains 'hidden' and navWrapper has overflowY 'auto'
      expect(window.getComputedStyle(container).overflow).toBe('hidden');
      expect(window.getComputedStyle(navWrapper).overflowY).toBe('auto');
    });

    it('maintains pinned footer position and DOM integrity under 300 vendor nodes', () => {
      const hugeTaxonomy = generateLargeTaxonomy(300);
      const onSelectNav = vi.fn();

      render(
        <Sidebar
          currentNav={{ section: 'vendor', vendorCode: 'vendor-250' }}
          onSelectNav={onSelectNav}
          taxonomy={hugeTaxonomy}
        />
      );

      const footer = screen.getByTestId('sidebar-footer');
      const versionEl = screen.getByTestId('sidebar-version');

      // Verify footer is still intact and rendering version
      expect(footer).toBeInTheDocument();
      expect(footer.contains(versionEl)).toBe(true);
      expect(versionEl.textContent).toBe(`v${APP_VERSION}`);

      // Verify the selected vendor has active styling
      const navWrapper = screen.getByTestId('sidebar-nav-list-wrapper');
      const selectedItem = navWrapper.querySelector('.Mui-selected');
      expect(selectedItem).toBeInTheDocument();
    });
  });

  describe('4. Navigation Interaction & State Transitions', () => {
    it('handles transition from dashboard to vendor to static nav items', () => {
      const sampleTaxonomy: VendorNode[] = [
        {
          vendorCode: 'canonical',
          vendorName: 'Ubuntu / Canonical',
          advisoryCount: 5,
          criticalCount: 1,
          products: [],
        },
      ];

      const handleSelect = vi.fn();
      const { rerender } = render(
        <Sidebar
          currentNav={{ section: 'dashboard' }}
          onSelectNav={handleSelect}
          taxonomy={sampleTaxonomy}
        />
      );

      // Click vendor
      fireEvent.click(screen.getByText('Ubuntu / Canonical'));
      expect(handleSelect).toHaveBeenCalledWith({
        section: 'vendor',
        vendorCode: 'canonical',
      });

      // Update props to vendor view
      rerender(
        <Sidebar
          currentNav={{ section: 'vendor', vendorCode: 'canonical' }}
          onSelectNav={handleSelect}
          taxonomy={sampleTaxonomy}
        />
      );

      // Click static item "Admin Console"
      fireEvent.click(screen.getByText('Admin Console'));
      expect(handleSelect).toHaveBeenCalledWith({ section: 'admin' });

      // Ensure version remains unperturbed
      expect(screen.getByTestId('sidebar-version')).toHaveTextContent(`v${APP_VERSION}`);
    });
  });
});
