import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: { from: (...args: any[]) => mockFrom(...args) },
}));

import { AdvisoryService } from '@/services/advisoryService';
import { CveService } from '@/services/cveService';

/** Build the `.select().order()` chain the services use. */
const resolveWith = (rows: any[]) => ({
  select: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }),
});

describe('AdvisoryService — one RHSA lists every CVE it fixes', () => {
  beforeEach(() => mockFrom.mockReset());

  it('returns an advisory carrying all of its mapped CVEs', async () => {
    mockFrom.mockReturnValue(
      resolveWith([
        {
          id: 'a1',
          advisory_id: 'RHSA-2026:2000',
          title: 'Important: kernel security update',
          severity: 'CRITICAL',
          published_at: '2026-08-02T00:00:00Z',
          url: 'https://access.redhat.com/errata/RHSA-2026:2000',
          summary: 'kernel security update',
          vendor_id: 'redhat',
          vendors: { code: 'redhat', name: 'Red Hat' },
          advisory_cve_map: [
            {
              affected_products: [
                { product_name: 'Red Hat Enterprise Linux 9', component: 'kernel', state: 'Fixed', errata: 'RHSA-2026:2000' },
              ],
              fixed_versions: ['Released in RHSA-2026:2000'],
              cves: {
                cve_id: 'CVE-2026-2001',
                description: 'kernel: flaw one',
                cvss_v3_score: 9.1,
                severity: 'CRITICAL',
                is_known_exploited: false,
              },
            },
            {
              affected_products: [
                { product_name: 'Red Hat Enterprise Linux 8', component: 'kernel', state: 'Fixed', errata: 'RHSA-2026:2000' },
              ],
              fixed_versions: ['Released in RHSA-2026:2000'],
              cves: {
                cve_id: 'CVE-2026-2002',
                description: 'kernel: flaw two',
                cvss_v3_score: 9.0,
                severity: 'CRITICAL',
                is_known_exploited: false,
              },
            },
          ],
        },
      ])
    );

    const advisories = await new AdvisoryService().fetchAdvisories();

    expect(mockFrom).toHaveBeenCalledWith('advisories');
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
    mockFrom.mockReturnValue({
      select: () => ({ order: () => Promise.resolve({ data: null, error: { message: 'boom' } }) }),
    });

    await expect(new AdvisoryService().fetchAdvisories()).resolves.toEqual([]);
  });
});

describe('CveService — one CVE lists every RHSA that fixes it', () => {
  beforeEach(() => mockFrom.mockReset());

  it('collects all mapped advisories, not just the first', async () => {
    mockFrom.mockReturnValue(
      resolveWith([
        {
          id: 'c1',
          cve_id: 'CVE-2026-1000',
          description: 'openssl: example flaw',
          cvss_v3_score: 8.1,
          severity: 'HIGH',
          is_known_exploited: false,
          published_date: '2026-08-01T00:00:00Z',
          created_at: '2026-08-01T00:00:00Z',
          advisory_cve_map: [
            {
              affected_products: [
                { product_name: 'RHEL 9', component: 'openssl', state: 'Fixed', errata: 'RHSA-2026:1001' },
              ],
              fixed_versions: ['Released in RHSA-2026:1001'],
              advisories: {
                advisory_id: 'RHSA-2026:1001',
                title: 'openssl update for RHEL 9',
                url: 'https://access.redhat.com/errata/RHSA-2026:1001',
                vendors: { code: 'redhat', name: 'Red Hat' },
              },
            },
            {
              affected_products: [
                { product_name: 'RHEL 8', component: 'openssl', state: 'Fixed', errata: 'RHSA-2026:1002' },
              ],
              fixed_versions: ['Released in RHSA-2026:1002'],
              advisories: {
                advisory_id: 'RHSA-2026:1002',
                title: 'openssl update for RHEL 8',
                url: 'https://access.redhat.com/errata/RHSA-2026:1002',
                vendors: { code: 'redhat', name: 'Red Hat' },
              },
            },
          ],
        },
      ])
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
});
