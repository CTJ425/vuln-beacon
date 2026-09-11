import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExplorerPage } from '@/pages/ExplorerPage';
import { CveTableRowItem } from '@/components/explorer/CveTable';
import { AdvisoryRowItem } from '@/services/advisoryService';

const mockCves: CveTableRowItem[] = [
  {
    id: 'cve-1',
    cve_id: 'CVE-2026-1111',
    description: 'Vulnerability in OpenSSL affecting networking',
    severity: 'CRITICAL',
    is_known_exploited: false,
    published_date: '2026-08-01',
    created_at: '2026-08-01',
    vendor_code: 'redhat',
    advisory_id: 'RHSA-2026:1111',
    advisory_title: 'Red Hat Security Advisory for OpenSSL',
    affected_products: ['Red Hat Enterprise Linux 9'],
    product_impacts: [
      {
        product_name: 'Red Hat Enterprise Linux 9',
        component: 'openssl',
        state: 'Affected',
      },
    ],
    fixed_versions: [],
  },
  {
    id: 'cve-2',
    cve_id: 'CVE-2026-2222',
    description: 'Vulnerability in curl mitigated by design',
    severity: 'LOW',
    is_known_exploited: false,
    published_date: '2026-08-02',
    created_at: '2026-08-02',
    vendor_code: 'ubuntu',
    advisory_id: 'USN-2222-1',
    advisory_title: 'Ubuntu Security Notice for curl',
    affected_products: ['Ubuntu 24.04 LTS'],
    product_impacts: [
      {
        product_name: 'Ubuntu 24.04 LTS',
        component: 'curl',
        state: 'Not affected',
      },
    ],
    fixed_versions: [],
  },
];

const mockAdvisories: AdvisoryRowItem[] = [
  {
    id: 'adv-1',
    advisory_id: 'RHSA-2026:1111',
    title: 'Red Hat Security Advisory for OpenSSL',
    severity: 'CRITICAL',
    published_at: '2026-08-01',
    vendor_code: 'redhat',
    cves: [
      {
        cve_id: 'CVE-2026-1111',
        description: 'Vulnerability in OpenSSL',
        severity: 'CRITICAL',
        is_known_exploited: false,
      },
    ],
    product_impacts: [
      {
        product_name: 'Red Hat Enterprise Linux 9',
        component: 'openssl',
        state: 'Affected',
      },
    ],
    affected_products: ['Red Hat Enterprise Linux 9'],
    fixed_versions: [],
  },
  {
    id: 'adv-2',
    advisory_id: 'USN-2222-1',
    title: 'Ubuntu Security Notice for curl',
    severity: 'LOW',
    published_at: '2026-08-02',
    vendor_code: 'ubuntu',
    cves: [
      {
        cve_id: 'CVE-2026-2222',
        description: 'Vulnerability in curl',
        severity: 'LOW',
        is_known_exploited: false,
      },
    ],
    product_impacts: [
      {
        product_name: 'Ubuntu 24.04 LTS',
        component: 'curl',
        state: 'Not affected',
      },
    ],
    affected_products: ['Ubuntu 24.04 LTS'],
    fixed_versions: [],
  },
];

describe('ExplorerPage Component', () => {
  it('correctly filters by Component State without substring collisions between Affected and Not affected', () => {
    render(
      <ExplorerPage
        cves={mockCves}
        advisories={mockAdvisories}
        onSelectCve={vi.fn()}
        onSelectAdvisory={vi.fn()}
      />
    );

    // Default view: advisory, both RHSA-2026:1111 and USN-2222-1 visible
    expect(screen.getByText('RHSA-2026:1111')).toBeInTheDocument();
    expect(screen.getByText('USN-2222-1')).toBeInTheDocument();

    // Select Component State = Affected
    const stateSelect = screen.getByLabelText('Component State');
    fireEvent.mouseDown(stateSelect);

    const affectedOption = screen.getByRole('option', { name: /🔴 Affected/i });
    fireEvent.click(affectedOption);

    // Must show Affected item (RHSA-2026:1111) and NOT Not affected item (USN-2222-1)
    expect(screen.getByText('RHSA-2026:1111')).toBeInTheDocument();
    expect(screen.queryByText('USN-2222-1')).not.toBeInTheDocument();

    // Switch Component State to Not affected
    fireEvent.mouseDown(stateSelect);
    const notAffectedOption = screen.getByRole('option', { name: /🟢 Not affected/i });
    fireEvent.click(notAffectedOption);

    // Must show Not affected item (USN-2222-1) and NOT Affected item (RHSA-2026:1111)
    expect(screen.getByText('USN-2222-1')).toBeInTheDocument();
    expect(screen.queryByText('RHSA-2026:1111')).not.toBeInTheDocument();
  });

  it('switches view mode between Advisories and CVEs cleanly', () => {
    render(
      <ExplorerPage
        cves={mockCves}
        advisories={mockAdvisories}
        onSelectCve={vi.fn()}
        onSelectAdvisory={vi.fn()}
      />
    );

    // Click CVEs toggle
    const cveToggle = screen.getByRole('button', { name: /CVE 弱點視角/i });
    fireEvent.click(cveToggle);

    expect(screen.getByText('CVE-2026-1111')).toBeInTheDocument();
    expect(screen.getByText('CVE-2026-2222')).toBeInTheDocument();
  });

  it('filters by search keyword and allows clearing via clear icon button', () => {
    render(
      <ExplorerPage
        cves={mockCves}
        advisories={mockAdvisories}
        onSelectCve={vi.fn()}
        onSelectAdvisory={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText(/搜尋通報編號、CVE 弱點編號/i);
    fireEvent.change(searchInput, { target: { value: 'openssl' } });

    expect(screen.getByText('RHSA-2026:1111')).toBeInTheDocument();
    expect(screen.queryByText('USN-2222-1')).not.toBeInTheDocument();

    // Click clear button
    const clearBtn = screen.getByLabelText('清除搜尋關鍵字');
    fireEvent.click(clearBtn);

    expect(screen.getByText('RHSA-2026:1111')).toBeInTheDocument();
    expect(screen.getByText('USN-2222-1')).toBeInTheDocument();
  });
});
