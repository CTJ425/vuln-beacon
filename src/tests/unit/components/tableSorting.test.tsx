import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CveTable } from '@/components/explorer/CveTable';
import { AdvisoryTable } from '@/components/explorer/AdvisoryTable';

const cve = (cve_id: string, published_date: string, products: string[]) =>
  ({
    id: cve_id,
    cve_id,
    description: 'flaw',
    severity: 'HIGH',
    is_known_exploited: false,
    published_date,
    created_at: published_date,
    vendor_code: 'redhat',
    advisory_id: 'RHSA-2026:1000',
    advisory_title: 't',
    all_advisories: ['RHSA-2026:1000'],
    affected_products: products,
    product_impacts: [],
    fixed_versions: [],
  }) as any;

const advisory = (advisory_id: string, published_at: string, cveIds: string[], products: string[]) =>
  ({
    id: advisory_id,
    advisory_id,
    title: 't',
    severity: 'HIGH',
    published_at,
    vendor_code: 'redhat',
    cves: cveIds.map((cve_id) => ({ cve_id, description: '', severity: 'HIGH', is_known_exploited: false })),
    product_impacts: [],
    affected_products: products,
    fixed_versions: [],
  }) as any;

// First cell text of each body row.
const firstColumn = () =>
  within(screen.getAllByRole('rowgroup')[1])
    .getAllByRole('row')
    .map((row) => within(row).getAllByRole('cell')[0].textContent);

const clickHeader = (name: RegExp) => fireEvent.click(screen.getByRole('button', { name }));

describe('CveTable column sorting', () => {
  const items = [
    cve('CVE-2026-9999', '2026-08-01T00:00:00Z', ['openssl']),
    cve('CVE-2026-10000', '2026-07-01T00:00:00Z', ['bash']),
    cve('CVE-2025-1', '2026-09-01T00:00:00Z', ['Kernel']),
  ];

  it('keeps the given order until a header is clicked', () => {
    render(<CveTable items={items} onSelectRow={() => {}} viewMode="cve" />);
    expect(firstColumn()).toEqual(['CVE-2026-9999', 'CVE-2026-10000', 'CVE-2025-1']);
  });

  it('sorts by CVE id ascending, then descending', () => {
    render(<CveTable items={items} onSelectRow={() => {}} viewMode="cve" />);
    clickHeader(/CVE 漏洞編號/);
    expect(firstColumn()).toEqual(['CVE-2025-1', 'CVE-2026-9999', 'CVE-2026-10000']);
    clickHeader(/CVE 漏洞編號/);
    expect(firstColumn()).toEqual(['CVE-2026-10000', 'CVE-2026-9999', 'CVE-2025-1']);
  });

  it('sorts by affected product', () => {
    render(<CveTable items={items} onSelectRow={() => {}} viewMode="cve" />);
    clickHeader(/受影響產品/);
    expect(firstColumn()).toEqual(['CVE-2026-10000', 'CVE-2025-1', 'CVE-2026-9999']);
  });

  it('sorts by published date, newest first on the first click', () => {
    render(<CveTable items={items} onSelectRow={() => {}} viewMode="cve" />);
    clickHeader(/發布日期/);
    expect(firstColumn()).toEqual(['CVE-2025-1', 'CVE-2026-9999', 'CVE-2026-10000']);
    expect(screen.getByRole('columnheader', { name: /發布日期/ })).toHaveAttribute('aria-sort', 'descending');
    clickHeader(/發布日期/);
    expect(firstColumn()).toEqual(['CVE-2026-10000', 'CVE-2026-9999', 'CVE-2025-1']);
  });
});

describe('AdvisoryTable column sorting', () => {
  const items = [
    advisory('RHSA-2026:0002', '2026-08-01T00:00:00Z', ['CVE-2026-9999'], ['openssl']),
    advisory('RHSA-2026:0001', '2026-07-01T00:00:00Z', ['CVE-2026-10000'], ['bash']),
    advisory('RHSA-2026:0003', '2026-09-01T00:00:00Z', ['CVE-2025-1'], ['Kernel']),
  ];

  it('sorts by the CVEs column', () => {
    render(<AdvisoryTable items={items} onSelectRow={() => {}} />);
    clickHeader(/修補的 CVE/);
    expect(firstColumn()).toEqual(['RHSA-2026:0003', 'RHSA-2026:0002', 'RHSA-2026:0001']);
  });

  it('sorts by affected product', () => {
    render(<AdvisoryTable items={items} onSelectRow={() => {}} />);
    clickHeader(/受影響產品/);
    expect(firstColumn()).toEqual(['RHSA-2026:0001', 'RHSA-2026:0003', 'RHSA-2026:0002']);
  });

  it('sorts by published date', () => {
    render(<AdvisoryTable items={items} onSelectRow={() => {}} />);
    clickHeader(/發布日期/);
    expect(firstColumn()).toEqual(['RHSA-2026:0003', 'RHSA-2026:0002', 'RHSA-2026:0001']);
    clickHeader(/發布日期/);
    expect(firstColumn()).toEqual(['RHSA-2026:0001', 'RHSA-2026:0002', 'RHSA-2026:0003']);
  });
});
