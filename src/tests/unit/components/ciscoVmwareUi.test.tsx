import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }) },
    storage: { from: vi.fn(() => ({ list: vi.fn().mockResolvedValue({ data: [], error: null }) })) },
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
  },
}));

import { VendorIcon } from '@/components/common/VendorIcon';
import { SystemHealthMonitor } from '@/components/admin/SystemHealthMonitor';
import { CveDetailDrawer } from '@/components/explorer/CveDetailDrawer';
import { CveTableRowItem } from '@/components/explorer/CveTable';
import { AdvisoryService } from '@/services/advisoryService';
import { CveService } from '@/services/cveService';

const resolveWith = (rows: any[]) => {
  const result = { data: rows, error: null };
  const chain: any = {
    order: () => chain,
    range: () => Promise.resolve(result),
    then: (...args: any[]) => Promise.resolve(result).then(...args),
  };
  return { select: () => chain };
};

const advisoryRow = (advisoryId: string) => ({
  id: 'a1',
  advisory_id: advisoryId,
  title: `${advisoryId} advisory`,
  severity: 'HIGH',
  published_at: '2026-09-01T00:00:00Z',
  url: null,
  summary: null,
  vendor_id: null,
  vendors: null,
  advisory_cve_map: [
    {
      affected_products: [{ product_name: 'Product', component: 'core', state: 'Fixed', errata: advisoryId }],
      fixed_versions: ['1.2.3'],
      cves: { cve_id: 'CVE-2026-9000', description: 'core: flaw', cvss_v3_score: 7.5, severity: 'HIGH', is_known_exploited: false },
    },
  ],
});

const cveRow = (advisoryId: string) => ({
  id: 'c1',
  cve_id: 'CVE-2026-9000',
  description: 'core: flaw',
  cvss_v3_score: 7.5,
  severity: 'HIGH',
  is_known_exploited: false,
  published_date: '2026-09-01T00:00:00Z',
  created_at: '2026-09-01T00:00:00Z',
  advisory_cve_map: [
    {
      affected_products: [{ product_name: 'Product', component: 'core', state: 'Fixed', errata: advisoryId }],
      fixed_versions: ['1.2.3'],
      advisories: { advisory_id: advisoryId, title: 't', url: null, vendors: null },
    },
  ],
});

describe('Cisco and VMware UI coverage', () => {
  beforeEach(() => mockFrom.mockReset());

  it('renders the Cisco SVG logo for the cisco vendor code', () => {
    render(<VendorIcon vendorCode="cisco" />);
    const logo = screen.getByLabelText('Cisco logo');
    expect(logo.tagName.toLowerCase()).toBe('svg');
  });

  it.each([
    ['cisco-sa-ios-xe-2026', 'cisco', /Cisco/],
    ['VMSA-2026-0001', 'vmware', /VMware|Broadcom/],
  ])('AdvisoryService infers vendor from %s without a vendor join', async (advId, code, vendorText) => {
    mockFrom.mockReturnValue(resolveWith([advisoryRow(advId)]));
    const [adv] = await new AdvisoryService().fetchAdvisories();
    expect(adv.vendor_code).toBe(code);
    expect(adv.solution).toMatch(vendorText);
    expect(adv.solution).not.toMatch(/dnf|yum|access\.redhat\.com/);
  });

  it.each([
    ['cisco-sa-ios-xe-2026', 'cisco', /Cisco/],
    ['VMSA-2026-0001', 'vmware', /VMware|Broadcom/],
  ])('CveService infers vendor from %s without a vendor join', async (advId, code, vendorText) => {
    mockFrom.mockReturnValue(resolveWith([cveRow(advId)]));
    const [cve] = await new CveService().fetchCves();
    expect(cve.vendor_code).toBe(code);
    expect(cve.solution).toMatch(vendorText);
    expect(cve.solution).not.toMatch(/dnf|yum|access\.redhat\.com/);
  });

  it.each([
    ['cisco', 'cisco-sa-ios-xe-2026', 'sec.cloudapps.cisco.com'],
    ['vmware', 'VMSA-2026-0001', 'nvd.nist.gov'],
  ])('CveDetailDrawer links %s CVEs to the vendor source, not Red Hat', (vendorCode, advisoryId, host) => {
    const item = {
      id: 'c1',
      cve_id: 'CVE-2026-9000',
      description: 'core: flaw',
      severity: 'HIGH',
      is_known_exploited: false,
      published_date: '2026-09-01T00:00:00Z',
      created_at: '2026-09-01T00:00:00Z',
      vendor_code: vendorCode,
      advisory_id: advisoryId,
      all_advisories: [advisoryId],
      affected_products: ['Product'],
      product_impacts: [],
      fixed_versions: [],
      solution: 's',
    } as unknown as CveTableRowItem;
    render(<CveDetailDrawer open={true} item={item} onClose={() => {}} />);
    const link = screen.getByText('檢視官方公告頁面').closest('a');
    expect(link?.getAttribute('href')).toContain(host);
  });

  it('SystemHealthMonitor lists the Cisco and VMware feeds', async () => {
    mockFrom.mockReturnValue({ select: vi.fn().mockResolvedValue({ count: 0, error: null }) });
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK' } as any);
    render(<SystemHealthMonitor />);
    await waitFor(() => {
      expect(screen.getAllByText(/Cisco CSAF Feed/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Broadcom VMware Security Advisories/).length).toBeGreaterThan(0);
    });
  });
});
