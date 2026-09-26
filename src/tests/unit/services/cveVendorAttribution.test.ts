import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: any[]) => mockRpc(...args) },
}));

import { CveService } from '@/services/cveService';
import { dataset, dsAdvisory, dsCve, dsMapping } from '../../helpers/explorerDataset';

const respondWith = (ds: any) => mockRpc.mockResolvedValue({ data: ds, error: null });

describe('CVE vendor attribution', () => {
  beforeEach(() => mockRpc.mockReset());

  it('lists every vendor that published an advisory for the CVE', async () => {
    respondWith(
      dataset({
        advisories: [
          dsAdvisory({ id: 'a1', advisory_id: 'RHSA-2026:1' }),
          dsAdvisory({ id: 'a2', advisory_id: 'DSA-5001-1', vendor_code: 'debian', vendor_name: 'Debian' }),
          dsAdvisory({ id: 'a3', advisory_id: 'USN-7001-1', vendor_code: 'ubuntu', vendor_name: 'Ubuntu' }),
        ],
        cves: [dsCve({ id: 'c1', cve_id: 'CVE-2026-4001' })],
        mappings: [dsMapping('a1', 'c1'), dsMapping('a2', 'c1'), dsMapping('a3', 'c1')],
      })
    );
    const [cve] = await new CveService().fetchCves();
    expect(cve.vendor_codes).toEqual(['debian', 'redhat', 'ubuntu']);
  });

  it('does not invent a product impact when no vendor supplied one', async () => {
    respondWith(
      dataset({
        advisories: [dsAdvisory({ id: 'a1', advisory_id: 'DSA-5001-1', vendor_code: 'debian', vendor_name: 'Debian' })],
        cves: [dsCve({ id: 'c1', cve_id: 'CVE-2026-4001' })],
        mappings: [dsMapping('a1', 'c1')],
      })
    );
    const [cve] = await new CveService().fetchCves();
    expect(cve.product_impacts).toEqual([]);
    expect(cve.affected_products).toEqual([]);
  });
});
