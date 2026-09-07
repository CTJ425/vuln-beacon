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
});
