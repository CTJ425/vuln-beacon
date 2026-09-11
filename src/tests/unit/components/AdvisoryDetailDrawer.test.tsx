import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdvisoryDetailDrawer } from '@/components/explorer/AdvisoryDetailDrawer';
import { AdvisoryRowItem } from '@/services/advisoryService';

const mockAdvisory: AdvisoryRowItem = {
  id: 'adv-test-1',
  advisory_id: 'SUSE-SU-2026:3952-1',
  title: 'Security update for the Linux Kernel',
  severity: 'CRITICAL',
  published_at: '2026-08-20T10:00:00Z',
  vendor_code: 'suse',
  vendor_name: 'SUSE',
  summary: 'A critical vulnerability in Linux kernel allows privilege escalation.',
  cves: [
    {
      cve_id: 'CVE-2026-9999',
      description: 'Kernel privilege escalation flaw',
      severity: 'CRITICAL',
      cvss_v3_score: 9.8,
      is_known_exploited: true,
    },
  ],
  product_impacts: [
    {
      product_name: 'SUSE Linux Enterprise Server 15 SP5',
      component: 'kernel-default',
      state: 'Fixed',
      errata: 'SUSE-SU-2026:3952-1',
    },
    {
      product_name: 'openSUSE Leap 15.6',
      component: 'kernel-source',
      state: 'Will not fix',
      errata: '-',
    },
  ],
  affected_products: ['SUSE Linux Enterprise Server 15 SP5', 'openSUSE Leap 15.6'],
  fixed_versions: ['kernel-default-5.14.21-150500.55.65.1'],
  solution: 'zypper patch',
};

describe('AdvisoryDetailDrawer Component', () => {
  it('returns null when item is null', () => {
    const { container } = render(
      <AdvisoryDetailDrawer open={true} item={null} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders advisory synopsis, severity badge, and vendor icon', () => {
    render(
      <AdvisoryDetailDrawer open={true} item={mockAdvisory} onClose={vi.fn()} />
    );

    expect(screen.getByText('SUSE-SU-2026:3952-1')).toBeInTheDocument();
    expect(screen.getByText('Security update for the Linux Kernel')).toBeInTheDocument();
    expect(screen.getByText(/A critical vulnerability in Linux kernel/i)).toBeInTheDocument();
    expect(screen.getByText(/官方公告頁面/i)).toBeInTheDocument();
  });

  it('renders CVE list with clickable links and CISA KEV chip', () => {
    render(
      <AdvisoryDetailDrawer open={true} item={mockAdvisory} onClose={vi.fn()} />
    );

    const cveLink = screen.getByRole('link', { name: 'CVE-2026-9999' });
    expect(cveLink).toBeInTheDocument();
    expect(cveLink).toHaveAttribute('href', 'https://www.suse.com/security/cve/CVE-2026-9999');
    expect(screen.getByText('CISA KEV')).toBeInTheDocument();
  });

  it('renders product impacts table with correct state badges', () => {
    render(
      <AdvisoryDetailDrawer open={true} item={mockAdvisory} onClose={vi.fn()} />
    );

    expect(screen.getByText('SUSE Linux Enterprise Server 15 SP5')).toBeInTheDocument();
    expect(screen.getByText('kernel-default')).toBeInTheDocument();
    expect(screen.getByText(/🟢 已修復 \(Fixed\)/i)).toBeInTheDocument();
    expect(screen.getByText(/🔴 不予修復 \(Will not fix\)/i)).toBeInTheDocument();
  });

  it('safely handles sparse advisory records with missing cves and product impacts', () => {
    const sparseAdvisory: AdvisoryRowItem = {
      id: 'adv-sparse',
      advisory_id: 'UNKNOWN-ADV',
      title: 'Minimal Sparse Advisory',
      severity: 'LOW',
      published_at: '2026-01-01',
      vendor_code: 'generic',
      cves: [] as any,
      product_impacts: [] as any,
      affected_products: [],
      fixed_versions: [],
    };

    const { getByText } = render(
      <AdvisoryDetailDrawer open={true} item={sparseAdvisory} onClose={vi.fn()} />
    );

    expect(getByText('Minimal Sparse Advisory')).toBeInTheDocument();
    expect(getByText(/共 0 個 CVE/i)).toBeInTheDocument();
  });
});
