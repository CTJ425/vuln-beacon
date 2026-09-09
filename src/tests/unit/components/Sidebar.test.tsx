import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '@/components/common/Sidebar';
import { APP_VERSION } from '@/config/version';
import { VendorNode } from '@/services/productTaxonomy';

describe('Sidebar Component (TDD)', () => {
  const mockTaxonomy: VendorNode[] = [
    {
      vendorCode: 'redhat',
      vendorName: 'Red Hat',
      advisoryCount: 12,
      criticalCount: 0,
      products: [],
    },
  ];

  it('renders application version in bottom-left footer by default', () => {
    render(
      <Sidebar
        currentNav={{ section: 'dashboard' }}
        onSelectNav={vi.fn()}
        taxonomy={mockTaxonomy}
      />
    );

    const versionEl = screen.getByTestId('sidebar-version');
    expect(versionEl).toBeInTheDocument();
    expect(versionEl).toHaveTextContent(`v${APP_VERSION}`);
  });

  it('renders custom version when passed through version prop', () => {
    render(
      <Sidebar
        currentNav={{ section: 'dashboard' }}
        onSelectNav={vi.fn()}
        taxonomy={[]}
        version="2.0.0"
      />
    );

    const versionEl = screen.getByTestId('sidebar-version');
    expect(versionEl).toHaveTextContent('v2.0.0');
  });

  it('normalizes version string when version already begins with "v"', () => {
    render(
      <Sidebar
        currentNav={{ section: 'dashboard' }}
        onSelectNav={vi.fn()}
        taxonomy={[]}
        version="v3.1.2"
      />
    );

    const versionEl = screen.getByTestId('sidebar-version');
    expect(versionEl).toHaveTextContent('v3.1.2');
  });

  it('renders navigation list in scrollable area and pinned footer in aside container', () => {
    render(
      <Sidebar
        currentNav={{ section: 'dashboard' }}
        onSelectNav={vi.fn()}
        taxonomy={mockTaxonomy}
      />
    );

    const container = screen.getByTestId('sidebar-container');
    expect(container).toBeInTheDocument();
    expect(container.tagName.toLowerCase()).toBe('aside');

    const navWrapper = screen.getByTestId('sidebar-nav-list-wrapper');
    expect(navWrapper).toBeInTheDocument();

    const footer = screen.getByTestId('sidebar-footer');
    expect(footer).toBeInTheDocument();
  });

  it('triggers onSelectNav when navigation buttons are clicked', () => {
    const handleSelectNav = vi.fn();
    render(
      <Sidebar
        currentNav={{ section: 'dashboard' }}
        onSelectNav={handleSelectNav}
        taxonomy={mockTaxonomy}
      />
    );

    fireEvent.click(screen.getByText('CVE Explorer'));
    expect(handleSelectNav).toHaveBeenCalledWith({ section: 'explorer' });

    fireEvent.click(screen.getByText('Red Hat'));
    expect(handleSelectNav).toHaveBeenCalledWith({
      section: 'vendor',
      vendorCode: 'redhat',
    });
  });

  describe('Collapsible Sidebar Behavior (TDD)', () => {
    it('renders in expanded state by default with width 240px and visible labels', () => {
      render(
        <Sidebar
          currentNav={{ section: 'dashboard' }}
          onSelectNav={vi.fn()}
          taxonomy={mockTaxonomy}
        />
      );

      const container = screen.getByTestId('sidebar-container');
      expect(container).toHaveAttribute('data-collapsed', 'false');
      expect(window.getComputedStyle(container).width).toBe('240px');

      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Red Hat')).toBeInTheDocument();
      expect(screen.getByText('CVE Explorer')).toBeInTheDocument();

      const collapseButton = screen.getByTestId('sidebar-collapse-button');
      expect(collapseButton).toBeInTheDocument();
      expect(collapseButton).toHaveAttribute('aria-label', expect.stringMatching(/收起|collapse/i));
    });

    it('renders in collapsed state when isCollapsed={true} with width 64px and hides text labels', () => {
      render(
        <Sidebar
          currentNav={{ section: 'dashboard' }}
          onSelectNav={vi.fn()}
          taxonomy={mockTaxonomy}
          isCollapsed={true}
        />
      );

      const container = screen.getByTestId('sidebar-container');
      expect(container).toHaveAttribute('data-collapsed', 'true');
      expect(window.getComputedStyle(container).width).toBe('64px');

      // Labels must not be displayed in text content
      expect(screen.queryByText('Overview')).not.toBeInTheDocument();
      expect(screen.queryByText('Red Hat')).not.toBeInTheDocument();
      expect(screen.queryByText('CVE Explorer')).not.toBeInTheDocument();

      // Version element remains in DOM (in footer) with display: none
      const versionEl = screen.getByTestId('sidebar-version');
      expect(versionEl).toBeInTheDocument();
      expect(window.getComputedStyle(versionEl).display).toBe('none');

      const collapseButton = screen.getByTestId('sidebar-collapse-button');
      expect(collapseButton).toHaveAttribute('aria-label', expect.stringMatching(/展開|expand/i));
    });

    it('supports collapsed alias prop', () => {
      render(
        <Sidebar
          currentNav={{ section: 'dashboard' }}
          onSelectNav={vi.fn()}
          taxonomy={mockTaxonomy}
          collapsed={true}
        />
      );

      const container = screen.getByTestId('sidebar-container');
      expect(container).toHaveAttribute('data-collapsed', 'true');
      expect(window.getComputedStyle(container).width).toBe('64px');
    });

    it('invokes onToggleCollapse when collapse button is clicked in controlled mode', () => {
      const handleToggle = vi.fn();
      render(
        <Sidebar
          currentNav={{ section: 'dashboard' }}
          onSelectNav={vi.fn()}
          taxonomy={mockTaxonomy}
          isCollapsed={false}
          onToggleCollapse={handleToggle}
        />
      );

      const button = screen.getByTestId('sidebar-collapse-button');
      fireEvent.click(button);
      expect(handleToggle).toHaveBeenCalledTimes(1);
    });

    it('toggles collapsed state internally in uncontrolled mode', () => {
      render(
        <Sidebar
          currentNav={{ section: 'dashboard' }}
          onSelectNav={vi.fn()}
          taxonomy={mockTaxonomy}
        />
      );

      const container = screen.getByTestId('sidebar-container');
      expect(container).toHaveAttribute('data-collapsed', 'false');
      expect(window.getComputedStyle(container).width).toBe('240px');

      const button = screen.getByTestId('sidebar-collapse-button');
      fireEvent.click(button);

      expect(container).toHaveAttribute('data-collapsed', 'true');
      expect(window.getComputedStyle(container).width).toBe('64px');

      fireEvent.click(button);
      expect(container).toHaveAttribute('data-collapsed', 'false');
      expect(window.getComputedStyle(container).width).toBe('240px');
    });

    it('supports defaultCollapsed={true} in uncontrolled mode', () => {
      render(
        <Sidebar
          currentNav={{ section: 'dashboard' }}
          onSelectNav={vi.fn()}
          taxonomy={mockTaxonomy}
          defaultCollapsed={true}
        />
      );

      const container = screen.getByTestId('sidebar-container');
      expect(container).toHaveAttribute('data-collapsed', 'true');
      expect(window.getComputedStyle(container).width).toBe('64px');

      const button = screen.getByTestId('sidebar-collapse-button');
      fireEvent.click(button);

      expect(container).toHaveAttribute('data-collapsed', 'false');
      expect(window.getComputedStyle(container).width).toBe('240px');
    });

    it('provides accessible names via aria-label to all navigation items when collapsed', () => {
      const handleSelectNav = vi.fn();
      render(
        <Sidebar
          currentNav={{ section: 'dashboard' }}
          onSelectNav={handleSelectNav}
          taxonomy={mockTaxonomy}
          isCollapsed={true}
        />
      );

      const overviewBtn = screen.getByRole('button', { name: 'Overview' });
      const vendorBtn = screen.getByRole('button', { name: 'Red Hat' });
      const explorerBtn = screen.getByRole('button', { name: 'CVE Explorer' });

      expect(overviewBtn).toBeInTheDocument();
      expect(vendorBtn).toBeInTheDocument();
      expect(explorerBtn).toBeInTheDocument();

      fireEvent.click(explorerBtn);
      expect(handleSelectNav).toHaveBeenCalledWith({ section: 'explorer' });

      fireEvent.click(vendorBtn);
      expect(handleSelectNav).toHaveBeenCalledWith({ section: 'vendor', vendorCode: 'redhat' });
    });

    it('allows navigation item clicks even when collapsed', () => {
      const handleSelectNav = vi.fn();
      render(
        <Sidebar
          currentNav={{ section: 'dashboard' }}
          onSelectNav={handleSelectNav}
          taxonomy={mockTaxonomy}
          isCollapsed={true}
        />
      );

      const navWrapper = screen.getByTestId('sidebar-nav-list-wrapper');
      const buttons = navWrapper.querySelectorAll('.MuiListItemButton-root');
      expect(buttons.length).toBeGreaterThanOrEqual(3);

      // First item is Overview
      fireEvent.click(buttons[0]);
      expect(handleSelectNav).toHaveBeenCalledWith({ section: 'dashboard' });

      // Second item is Red Hat
      fireEvent.click(buttons[1]);
      expect(handleSelectNav).toHaveBeenCalledWith({ section: 'vendor', vendorCode: 'redhat' });
    });

    it('supports rendering and clicking legacy static nav items when specified in staticNavIds', () => {
      const handleSelectNav = vi.fn();
      render(
        <Sidebar
          currentNav={{ section: 'dashboard' }}
          onSelectNav={handleSelectNav}
          taxonomy={[]}
          staticNavIds={['sync', 'settings']}
        />
      );

      fireEvent.click(screen.getByText('Sync Monitor'));
      expect(handleSelectNav).toHaveBeenCalledWith({ section: 'sync' });

      fireEvent.click(screen.getByText('Webhooks & Config'));
      expect(handleSelectNav).toHaveBeenCalledWith({ section: 'settings' });
    });
  });
});

