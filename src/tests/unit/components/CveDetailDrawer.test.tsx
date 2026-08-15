import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CveDetailDrawer } from '@/components/explorer/CveDetailDrawer';
import { CveTableRowItem } from '@/components/explorer/CveTable';

const mockItem: CveTableRowItem = {
  id: 'cve-test-1',
  cve_id: 'CVE-2026-73086',
  description: 'Flaw in graphical components leading to security bypass.',
  cvss_v3_score: 7.5,
  cvss_v3_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N',
  severity: 'HIGH',
  is_known_exploited: false,
  published_date: '2026-08-15T00:00:00Z',
  created_at: '2026-08-15T00:00:00Z',
  vendor_code: 'redhat',
  advisory_id: 'RHSA-2026:48758',
  advisory_title: 'Red Hat Security Advisory for CVE-2026-73086',
  advisory_url: 'https://access.redhat.com/errata/RHSA-2026:48758',
  all_advisories: ['RHSA-2026:48758', 'RHSA-2026:54412'],
  affected_products: ['Red Hat Enterprise Linux 9', 'Red Hat Hardened Images'],
  product_impacts: [
    {
      product_name: 'Red Hat Enterprise Linux 9',
      component: 'firefox',
      state: 'Affected',
      errata: 'RHSA-2026:48758',
      release_date: '2026-08-15',
    },
    {
      product_name: 'Red Hat Hardened Images',
      component: 'opentelemetry-collector',
      state: 'Not affected',
      errata: '-',
      release_date: '-',
    },
  ],
  fixed_versions: ['RHSA-2026:48758'],
  solution: '請依據官方公告執行 dnf update 升級至修復套件。',
};

describe('CveDetailDrawer Component', () => {
  it('should render RHSA advisory and target CVE mapping clearly', () => {
    const handleClose = vi.fn();

    render(
      <CveDetailDrawer
        open={true}
        item={mockItem}
        onClose={handleClose}
      />
    );

    // RHSA & Target CVE
    expect(screen.getAllByText('RHSA-2026:48758').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('CVE-2026-73086')).toBeInTheDocument();
    expect(screen.getByText(/CVSS 分數:/i)).toBeInTheDocument();
    expect(screen.getByText('Flaw in graphical components leading to security bypass.')).toBeInTheDocument();


    // Table Headers
    expect(screen.getByText('Products / services')).toBeInTheDocument();
    expect(screen.getByText('Components')).toBeInTheDocument();
    expect(screen.getByText(/State \(狀態\)/i)).toBeInTheDocument();

    // Affected product row
    expect(screen.getByText('Red Hat Enterprise Linux 9')).toBeInTheDocument();
    expect(screen.getByText('firefox')).toBeInTheDocument();
    expect(screen.getByText(/🔴 受影響 \(Affected\)/i)).toBeInTheDocument();

    // Not affected product row
    expect(screen.getByText('Red Hat Hardened Images')).toBeInTheDocument();
    expect(screen.getByText('opentelemetry-collector')).toBeInTheDocument();
    expect(screen.getByText(/🟢 不受影響 \(Not affected\)/i)).toBeInTheDocument();
  });

  it('should filter between Affected and Not Affected toggles', () => {
    const handleClose = vi.fn();

    render(
      <CveDetailDrawer
        open={true}
        item={mockItem}
        onClose={handleClose}
      />
    );

    // Click Not Affected filter button
    const notAffectedBtn = screen.getByRole('button', { name: /不受影響/i });
    fireEvent.click(notAffectedBtn);


    // Should show Not Affected component
    expect(screen.getByText('opentelemetry-collector')).toBeInTheDocument();
    // Should filter out Affected component
    expect(screen.queryByText('firefox')).not.toBeInTheDocument();
  });

  it('should filter table when typing in search input', () => {
    const handleClose = vi.fn();

    render(
      <CveDetailDrawer
        open={true}
        item={mockItem}
        onClose={handleClose}
      />
    );

    const searchInput = screen.getByPlaceholderText(/搜尋產品或元件名稱/i);
    fireEvent.change(searchInput, { target: { value: 'firefox' } });

    expect(screen.getByText('firefox')).toBeInTheDocument();
    expect(screen.queryByText('opentelemetry-collector')).not.toBeInTheDocument();
  });
});
