import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AdvisoryTable } from '@/components/explorer/AdvisoryTable';
import { DashboardPage } from '@/pages/DashboardPage';
import { AdvisoryRowItem } from '@/services/advisoryService';

const advisory = (over: Partial<AdvisoryRowItem> = {}): AdvisoryRowItem => ({
  id: 'a1',
  advisory_id: 'RHSA-2026:2000',
  title: 'Important: kernel security update',
  severity: 'CRITICAL',
  published_at: '2026-08-02T00:00:00Z',
  url: 'https://access.redhat.com/errata/RHSA-2026:2000',
  summary: 'kernel security update',
  cves: [
    { cve_id: 'CVE-2026-2001', description: 'kernel: flaw one', severity: 'CRITICAL', cvss_v3_score: 9.1, is_known_exploited: false },
    { cve_id: 'CVE-2026-2002', description: 'kernel: flaw two', severity: 'CRITICAL', cvss_v3_score: 9.0, is_known_exploited: false },
  ],
  product_impacts: [
    { product_name: 'Red Hat Enterprise Linux 9', component: 'kernel', state: 'Fixed', errata: 'RHSA-2026:2000' },
  ],
  affected_products: ['Red Hat Enterprise Linux 9'],
  fixed_versions: ['Released in RHSA-2026:2000'],
  solution: 'dnf update',
  ...over,
});

describe('AdvisoryTable — rows are RHSA advisories, not CVEs', () => {
  it('renders one row per advisory, showing the RHSA id and the CVEs it fixes', () => {
    render(<AdvisoryTable items={[advisory()]} onSelectRow={() => {}} />);

    expect(screen.getByText('RHSA-2026:2000')).toBeInTheDocument();
    expect(screen.getByText(/CVE-2026-2001/)).toBeInTheDocument();
    expect(screen.getByText(/CVE-2026-2002/)).toBeInTheDocument();
  });

  it('calls onSelectRow with the advisory when a row is clicked', async () => {
    const onSelectRow = vi.fn();
    const item = advisory();
    render(<AdvisoryTable items={[item]} onSelectRow={onSelectRow} />);

    await userEvent.click(screen.getByText('RHSA-2026:2000'));

    expect(onSelectRow).toHaveBeenCalledWith(item);
  });

  it('renders an empty state when there are no advisories', () => {
    render(<AdvisoryTable items={[]} onSelectRow={() => {}} />);
    expect(screen.getByText(/無符合條件/)).toBeInTheDocument();
  });
});

describe('DashboardPage — organised around RHSA advisories', () => {
  it('reports advisory-based metrics and lists urgent advisories', () => {
    render(
      <DashboardPage
        advisories={[
          advisory(),
          advisory({ id: 'a2', advisory_id: 'RHSA-2026:2100', severity: 'HIGH', title: 'Important: openssl update' }),
          advisory({ id: 'a3', advisory_id: 'RHSA-2026:2200', severity: 'LOW', title: 'Low: docs update' }),
        ]}
        cves={[]}
        onSelectAdvisory={() => {}}
        onSelectCve={() => {}}
        onNavigateToExplorer={() => {}}
      />
    );

    // metric cards are advisory-oriented
    expect(screen.getByText('Critical RHSA')).toBeInTheDocument();
    expect(screen.getByText('Tracked Advisories')).toBeInTheDocument();

    // the urgent list shows CRITICAL/HIGH advisories, not the LOW one
    expect(screen.getByText('RHSA-2026:2000')).toBeInTheDocument();
    expect(screen.getByText('RHSA-2026:2100')).toBeInTheDocument();
    expect(screen.queryByText('RHSA-2026:2200')).not.toBeInTheDocument();
  });

  it('passes the clicked advisory up so the detail view can open', async () => {
    const onSelectAdvisory = vi.fn();
    const item = advisory();
    render(
      <DashboardPage
        advisories={[item]}
        cves={[]}
        onSelectAdvisory={onSelectAdvisory}
        onSelectCve={() => {}}
        onNavigateToExplorer={() => {}}
      />
    );

    await userEvent.click(screen.getByText('RHSA-2026:2000'));

    expect(onSelectAdvisory).toHaveBeenCalledWith(item);
  });
});
