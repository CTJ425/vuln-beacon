import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: any[]) => mockRpc(...args) },
}));

import { AdvisoryService } from '@/services/advisoryService';
import { CveService } from '@/services/cveService';
import { dataset, dsAdvisory, dsCve, dsMapping } from '../../helpers/explorerDataset';

const respondWith = (ds: any) => mockRpc.mockResolvedValue({ data: ds, error: null });

describe('AdvisoryService — one RHSA lists every CVE it fixes', () => {
  beforeEach(() => mockRpc.mockReset());

  it('returns an advisory carrying all of its mapped CVEs', async () => {
    respondWith(
      dataset({
        advisories: [
          dsAdvisory({
            id: 'a1',
            advisory_id: 'RHSA-2026:2000',
            severity: 'CRITICAL',
            url: 'https://access.redhat.com/errata/RHSA-2026:2000',
            summary: 'kernel security update',
            impacts: [
              { product_name: 'Red Hat Enterprise Linux 9', component: 'kernel', state: 'Fixed', errata: 'RHSA-2026:2000' },
              { product_name: 'Red Hat Enterprise Linux 8', component: 'kernel', state: 'Fixed', errata: 'RHSA-2026:2000' },
            ],
          }),
        ],
        cves: [
          dsCve({ id: 'c1', cve_id: 'CVE-2026-2001', cvss_v3_score: 9.1, severity: 'CRITICAL' }),
          dsCve({ id: 'c2', cve_id: 'CVE-2026-2002', cvss_v3_score: 9.0, severity: 'CRITICAL' }),
        ],
        mappings: [
          dsMapping('a1', 'c1', [0], ['Released in RHSA-2026:2000']),
          dsMapping('a1', 'c2', [1], ['Released in RHSA-2026:2000']),
        ],
      })
    );

    const advisories = await new AdvisoryService().fetchAdvisories();

    expect(mockRpc).toHaveBeenCalledWith('explorer_dataset');
    expect(advisories).toHaveLength(1);

    const adv = advisories[0];
    expect(adv.advisory_id).toBe('RHSA-2026:2000');
    expect(adv.cves.map((c) => c.cve_id).sort()).toEqual(['CVE-2026-2001', 'CVE-2026-2002']);
    // impact matrix is aggregated across every mapped CVE
    expect(adv.product_impacts).toHaveLength(2);
    expect(adv.affected_products.sort()).toEqual([
      'Red Hat Enterprise Linux 8',
      'Red Hat Enterprise Linux 9',
    ]);
    // the row must carry vendor_code so the sidebar taxonomy can group by vendor
    expect(adv.vendor_code).toBe('redhat');
    expect(adv.vendor_name).toBe('Red Hat');
  });

  it('returns an empty list instead of throwing when the query errors', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

    await expect(new AdvisoryService().fetchAdvisories()).resolves.toEqual([]);
  });

  it('resolves legacy string impacts through the mapping indexes', async () => {
    respondWith(
      dataset({
        advisories: [dsAdvisory({ id: 'a1', impacts: ['RHEL 9'] })],
        cves: [dsCve({ id: 'c1', cve_id: 'CVE-2026-9999' })],
        mappings: [dsMapping('a1', 'c1', [0], ['RHSA-2026:9999'])],
      })
    );

    const [adv] = await new AdvisoryService().fetchAdvisories();
    expect(adv.cves.map((c) => c.cve_id)).toEqual(['CVE-2026-9999']);
    expect(adv.product_impacts.map((p) => p.component)).toEqual(['RHEL 9']);
  });
});

describe('CveService — one CVE lists every RHSA that fixes it', () => {
  beforeEach(() => mockRpc.mockReset());

  it('collects all mapped advisories, not just the first', async () => {
    respondWith(
      dataset({
        advisories: [
          dsAdvisory({ id: 'a1', advisory_id: 'RHSA-2026:1001', impacts: [{ product_name: 'RHEL 9', component: 'openssl', state: 'Fixed' }] }),
          dsAdvisory({ id: 'a2', advisory_id: 'RHSA-2026:1002', impacts: [{ product_name: 'RHEL 8', component: 'openssl', state: 'Fixed' }] }),
        ],
        cves: [dsCve({ id: 'c1', cve_id: 'CVE-2026-1000' })],
        mappings: [dsMapping('a1', 'c1', [0]), dsMapping('a2', 'c1', [0])],
      })
    );

    const cves = await new CveService().fetchCves();

    expect(cves).toHaveLength(1);
    const cve = cves[0];

    // every RHSA that ships a fix for this CVE must be listed
    expect(cve.all_advisories).toEqual(
      expect.arrayContaining(['RHSA-2026:1001', 'RHSA-2026:1002'])
    );
    // the impact matrix must merge rows from every mapping, not just mapping[0]
    expect(cve.product_impacts.map((p) => p.product_name).sort()).toEqual(['RHEL 8', 'RHEL 9']);
  });

  it('keeps per-CVE impacts when one advisory fixes several CVEs', async () => {
    respondWith(
      dataset({
        advisories: [
          dsAdvisory({
            id: 'a1',
            impacts: [
              { product_name: 'RHEL 9', component: 'kernel', state: 'Fixed' },
              { product_name: 'RHEL 8', component: 'kernel', state: 'Affected' },
            ],
          }),
        ],
        cves: [dsCve({ id: 'c1', cve_id: 'CVE-2026-0001' }), dsCve({ id: 'c2', cve_id: 'CVE-2026-0002' })],
        mappings: [dsMapping('a1', 'c1', [0]), dsMapping('a1', 'c2', [1])],
      })
    );

    const cves = await new CveService().fetchCves();
    const byId = Object.fromEntries(cves.map((c) => [c.cve_id, c.product_impacts.map((p) => p.product_name)]));
    expect(byId).toEqual({ 'CVE-2026-0001': ['RHEL 9'], 'CVE-2026-0002': ['RHEL 8'] });
  });
});
