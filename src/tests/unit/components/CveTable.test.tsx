import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CveTable, CveTableRowItem } from '@/components/explorer/CveTable';

const mockItems: CveTableRowItem[] = [
  {
    id: '1',
    cve_id: 'CVE-2026-73086',
    description: 'Flaw in graphical components',
    severity: 'HIGH',
    cvss_v3_score: 7.5,
    is_known_exploited: false,
    created_at: '2026-08-15T00:00:00Z',
    vendor_code: 'redhat',
    advisory_id: 'RHSA-2026:48758',
    advisory_title: 'Red Hat Security Advisory for Firefox',
    all_advisories: ['RHSA-2026:48758', 'RHSA-2026:54412'],
    affected_products: ['Red Hat Enterprise Linux 9', 'Red Hat OpenShift'],
    product_impacts: [
      {
        product_name: 'Red Hat Enterprise Linux 9',
        component: 'firefox',
        state: 'Affected',
        errata: 'RHSA-2026:48758',
      },
    ],
  },
  {
    id: '2',
    cve_id: 'CVE-2026-46382',
    description: 'Server-Side Request Forgery flaw',
    severity: 'HIGH',
    cvss_v3_score: 7.5,
    is_known_exploited: true,
    created_at: '2026-08-15T00:00:00Z',
    vendor_code: 'redhat',
    advisory_id: 'CVE-2026-46382',
    advisory_title: 'Red Hat CVE-2026-46382',
    all_advisories: [],
    affected_products: ['Red Hat Enterprise Linux 9'],
    product_impacts: [
      {
        product_name: 'Red Hat Enterprise Linux 9',
        component: 'mrbs',
        state: 'Affected',
        errata: '-',
      },
    ],
  },
];

describe('CveTable Component', () => {
  it('should render in CVE view mode by default', () => {
    const handleSelect = vi.fn();
    render(<CveTable items={mockItems} onSelectRow={handleSelect} viewMode="cve" />);

    expect(screen.getByText('CVE 漏洞編號')).toBeInTheDocument();
    expect(screen.getByText('關聯官方 Errata (RHSA)')).toBeInTheDocument();
    expect(screen.getByText('CVE-2026-73086')).toBeInTheDocument();
    expect(screen.getByText('RHSA-2026:48758')).toBeInTheDocument();

    // Item with no advisory should show pending chip
    expect(screen.getByText('Errata 待發布')).toBeInTheDocument();
  });

  it('should render in Advisory view mode when viewMode="advisory"', () => {
    const handleSelect = vi.fn();
    render(<CveTable items={mockItems} onSelectRow={handleSelect} viewMode="advisory" />);

    expect(screen.getByText('Red Hat Errata (RHSA)')).toBeInTheDocument();
    expect(screen.getByText('對應 CVE 弱點 (Target CVEs)')).toBeInTheDocument();
    expect(screen.getByText('RHSA-2026:48758')).toBeInTheDocument();
    expect(screen.getByText('CVE-2026-73086')).toBeInTheDocument();
  });

  it('should trigger onSelectRow when clicking a table row', () => {
    const handleSelect = vi.fn();
    render(<CveTable items={mockItems} onSelectRow={handleSelect} />);

    const row = screen.getByText('CVE-2026-73086');
    fireEvent.click(row);

    expect(handleSelect).toHaveBeenCalledWith(mockItems[0]);
  });
});
