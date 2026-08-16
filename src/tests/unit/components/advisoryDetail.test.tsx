import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AdvisoryDetailDrawer } from '@/components/explorer/AdvisoryDetailDrawer';
import { ExplorerPage } from '@/pages/ExplorerPage';
import { AdvisoryRowItem } from '@/services/advisoryService';

const advisory = (over: Partial<AdvisoryRowItem> = {}): AdvisoryRowItem => ({
  id: 'a1',
  advisory_id: 'RHSA-2026:2000',
  title: 'Important: kernel security update',
  severity: 'CRITICAL',
  published_at: '2026-08-02T00:00:00Z',
  url: 'https://access.redhat.com/errata/RHSA-2026:2000',
  summary: 'A kernel security update is now available.',
  vendor_code: 'redhat',
  cves: [
    { cve_id: 'CVE-2026-2001', description: 'kernel: flaw one', severity: 'CRITICAL', cvss_v3_score: 9.1, is_known_exploited: false },
    { cve_id: 'CVE-2026-2002', description: 'kernel: flaw two', severity: 'HIGH', cvss_v3_score: 8.2, is_known_exploited: false },
  ],
  product_impacts: [
    { product_name: 'Red Hat Enterprise Linux 9', component: 'kernel', state: 'Fixed', errata: 'RHSA-2026:2000' },
    { product_name: 'Red Hat Enterprise Linux 8', component: 'kernel-rt', state: 'Affected', errata: '-' },
  ],
  affected_products: ['Red Hat Enterprise Linux 9', 'Red Hat Enterprise Linux 8'],
  fixed_versions: ['Released in RHSA-2026:2000'],
  solution: '請依據官方發佈之資安更新公告執行升級更新。',
  ...over,
});

describe('AdvisoryDetailDrawer — an RHSA shows every CVE it fixes', () => {
  it('lists all fixed CVEs with their severity', () => {
    render(<AdvisoryDetailDrawer open item={advisory()} onClose={() => {}} />);

    expect(screen.getByText('RHSA-2026:2000')).toBeInTheDocument();
    expect(screen.getByText('CVE-2026-2001')).toBeInTheDocument();
    expect(screen.getByText('CVE-2026-2002')).toBeInTheDocument();
    expect(screen.getByText(/kernel: flaw one/)).toBeInTheDocument();
  });

  it('shows the affected products and components matrix', () => {
    render(<AdvisoryDetailDrawer open item={advisory()} onClose={() => {}} />);

    expect(screen.getByText('Red Hat Enterprise Linux 9')).toBeInTheDocument();
    expect(screen.getByText('kernel-rt')).toBeInTheDocument();
  });

  it('shows the official remediation text', () => {
    render(<AdvisoryDetailDrawer open item={advisory()} onClose={() => {}} />);

    expect(screen.getByText(/請依據官方發佈之資安更新公告執行升級更新/)).toBeInTheDocument();
  });

  it('renders nothing when no advisory is selected', () => {
    const { container } = render(<AdvisoryDetailDrawer open={false} item={null} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('ExplorerPage — advisory view really groups by RHSA', () => {
  const renderExplorer = (over: Partial<React.ComponentProps<typeof ExplorerPage>> = {}) =>
    render(
      <ExplorerPage
        cves={[]}
        advisories={[
          advisory(),
          advisory({ id: 'a2', advisory_id: 'RHSA-2026:3000', title: 'Moderate: httpd update', severity: 'MEDIUM', cves: [
            { cve_id: 'CVE-2026-3001', description: 'httpd: flaw', severity: 'MEDIUM', cvss_v3_score: 5.3, is_known_exploited: false },
          ] }),
        ]}
        onSelectCve={() => {}}
        onSelectAdvisory={() => {}}
        {...over}
      />
    );

  it('renders advisory rows, not CVE rows, in the default advisory view', () => {
    renderExplorer();

    expect(screen.getByText('RHSA-2026:2000')).toBeInTheDocument();
    expect(screen.getByText('RHSA-2026:3000')).toBeInTheDocument();
  });

  it('finds the advisory that fixes a searched CVE id', async () => {
    renderExplorer();

    const search = screen.getByPlaceholderText(/搜尋|Search/i);
    await userEvent.type(search, 'CVE-2026-3001');

    expect(screen.getByText('RHSA-2026:3000')).toBeInTheDocument();
    expect(screen.queryByText('RHSA-2026:2000')).not.toBeInTheDocument();
  });

  it('opens the advisory detail when a row is clicked', async () => {
    const onSelectAdvisory = vi.fn();
    renderExplorer({ onSelectAdvisory });

    await userEvent.click(screen.getByText('RHSA-2026:3000'));

    expect(onSelectAdvisory).toHaveBeenCalledWith(
      expect.objectContaining({ advisory_id: 'RHSA-2026:3000' })
    );
  });
});
