import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: { from: (...args: any[]) => mockFrom(...args) },
}));

import { CveService } from '@/services/cveService';

/**
 * `raw_payload` holds the full CSAF document per advisory. Selecting it in the
 * list query drags every blob into the browser on page load.
 */
const captureSelect = (rows: any[]) => {
  const selectCalls: string[] = [];
  const orderChain: any = {
    order: () => orderChain,
    range: () => Promise.resolve({ data: rows, error: null }),
  };
  return {
    chain: { select: (columns: string) => { selectCalls.push(columns); return orderChain; } },
    selectCalls,
  };
};

const row = () => ({
  id: 'c1',
  cve_id: 'CVE-2026-3001',
  description: 'kernel: flaw',
  cvss_v3_score: 8.8,
  severity: 'IMPORTANT',
  is_known_exploited: false,
  published_date: '2026-08-02T00:00:00Z',
  last_modified_date: '2026-08-02T00:00:00Z',
  created_at: '2026-08-02T00:00:00Z',
  advisory_cve_map: [
    {
      affected_products: [
        { product_name: 'Red Hat Enterprise Linux 9', component: 'kernel', state: 'Fixed', errata: 'RHSA-2026:3000' },
      ],
      fixed_versions: ['Released in RHSA-2026:3000'],
      advisories: {
        advisory_id: 'RHSA-2026:3000',
        title: 'Important: kernel security update',
        url: 'https://access.redhat.com/errata/RHSA-2026:3000',
        summary: 'kernel security update',
        vendors: { code: 'redhat', name: 'Red Hat' },
      },
    },
    {
      affected_products: [],
      fixed_versions: [],
      advisories: {
        advisory_id: 'RHSA-2026:3001',
        title: 'Important: kernel security update',
        url: 'https://access.redhat.com/errata/RHSA-2026:3001',
        summary: 'kernel security update',
        vendors: { code: 'redhat', name: 'Red Hat' },
      },
    },
  ],
});

describe('CVE list query does not carry advisory blobs', () => {
  beforeEach(() => mockFrom.mockReset());

  it('omits raw_payload from the select', async () => {
    const { chain, selectCalls } = captureSelect([row()]);
    mockFrom.mockReturnValue(chain);

    await new CveService().fetchCves();

    expect(selectCalls[0]).not.toMatch(/raw_payload/);
  });

  it('still resolves every advisory id from the mapping rows', async () => {
    const { chain } = captureSelect([row()]);
    mockFrom.mockReturnValue(chain);

    const [cve] = await new CveService().fetchCves();

    expect(cve.all_advisories).toEqual(['RHSA-2026:3000', 'RHSA-2026:3001']);
    expect(cve.advisory_id).toBe('RHSA-2026:3000');
  });

  it('keeps the rendered fields the drawer depends on', async () => {
    const { chain } = captureSelect([row()]);
    mockFrom.mockReturnValue(chain);

    const [cve] = await new CveService().fetchCves();

    expect(cve.solution).toBeTruthy();
    expect(cve.product_impacts.length).toBeGreaterThan(0);
    expect(cve.affected_products).toContain('Red Hat Enterprise Linux 9');
  });
});
