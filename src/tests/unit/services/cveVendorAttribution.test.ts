import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: { from: (...args: any[]) => mockFrom(...args) },
}));

import { CveService } from '@/services/cveService';

const respondWith = (rows: any[]) => {
  const orderChain: any = {
    order: () => orderChain,
    range: () => Promise.resolve({ data: rows, error: null }),
  };
  mockFrom.mockReturnValue({ select: () => orderChain });
};

const mapping = (advisoryId: string, code: string, name: string, affected: any[] = []) => ({
  affected_products: affected,
  fixed_versions: [],
  advisories: { advisory_id: advisoryId, title: advisoryId, url: null, summary: null, vendors: { code, name } },
});

const cveRow = (mappings: any[]) => ({
  id: 'c1',
  cve_id: 'CVE-2026-4001',
  description: 'openssl: flaw',
  cvss_v3_score: 7.5,
  severity: 'HIGH',
  is_known_exploited: false,
  published_date: '2026-08-02T00:00:00Z',
  created_at: '2026-08-02T00:00:00Z',
  advisory_cve_map: mappings,
});

describe('CVE vendor attribution', () => {
  beforeEach(() => mockFrom.mockReset());

  it('lists every vendor that published an advisory for the CVE', async () => {
    respondWith([
      cveRow([
        mapping('RHSA-2026:1', 'redhat', 'Red Hat'),
        mapping('DSA-5001-1', 'debian', 'Debian'),
        mapping('USN-7001-1', 'ubuntu', 'Ubuntu'),
      ]),
    ]);
    const [cve] = await new CveService().fetchCves();
    expect(cve.vendor_codes).toEqual(['debian', 'redhat', 'ubuntu']);
  });

  it('does not invent a product impact when no vendor supplied one', async () => {
    respondWith([cveRow([mapping('DSA-5001-1', 'debian', 'Debian')])]);
    const [cve] = await new CveService().fetchCves();
    expect(cve.product_impacts).toEqual([]);
    expect(cve.affected_products).toEqual([]);
  });
});
