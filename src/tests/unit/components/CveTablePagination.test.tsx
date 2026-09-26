import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CveTable, CVE_TABLE_PAGE_SIZE } from '@/components/explorer/CveTable';

const make = (n: number, prefix = 'CVE-2026-') =>
  Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    cve_id: `${prefix}${10000 + i}`,
    description: 'kernel: flaw',
    severity: 'HIGH',
    is_known_exploited: false,
    published_date: '2026-08-01T00:00:00Z',
    created_at: '2026-08-01T00:00:00Z',
    vendor_code: 'redhat',
    advisory_id: 'RHSA-2026:1000',
    advisory_title: 't',
    all_advisories: ['RHSA-2026:1000'],
    affected_products: [],
    product_impacts: [],
    fixed_versions: [],
  })) as any[];

const bodyRows = () => within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row');

describe('CveTable pagination', () => {
  it('renders one page of rows instead of every row', () => {
    render(<CveTable items={make(120)} onSelectRow={() => {}} viewMode="cve" />);
    expect(bodyRows()).toHaveLength(CVE_TABLE_PAGE_SIZE);
    expect(screen.getByText('CVE-2026-10000')).toBeInTheDocument();
    expect(screen.queryByText(`CVE-2026-${10000 + CVE_TABLE_PAGE_SIZE}`)).not.toBeInTheDocument();
  });

  it('moves to the next page', () => {
    render(<CveTable items={make(120)} onSelectRow={() => {}} viewMode="cve" />);
    fireEvent.click(screen.getByRole('button', { name: /next page/i }));
    expect(screen.getByText(`CVE-2026-${10000 + CVE_TABLE_PAGE_SIZE}`)).toBeInTheDocument();
    expect(screen.queryByText('CVE-2026-10000')).not.toBeInTheDocument();
  });

  it('returns to the first page when the filtered list changes', () => {
    const { rerender } = render(<CveTable items={make(120)} onSelectRow={() => {}} viewMode="cve" />);
    fireEvent.click(screen.getByRole('button', { name: /next page/i }));
    rerender(<CveTable items={make(80, 'CVE-2025-')} onSelectRow={() => {}} viewMode="cve" />);
    expect(screen.getByText('CVE-2025-10000')).toBeInTheDocument();
  });

  it('shows no pager for a single page', () => {
    render(<CveTable items={make(3)} onSelectRow={() => {}} viewMode="cve" />);
    expect(bodyRows()).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /next page/i })).not.toBeInTheDocument();
  });
});
