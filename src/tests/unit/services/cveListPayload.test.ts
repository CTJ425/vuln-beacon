import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: any[]) => mockRpc(...args) },
}));

import { CveService } from '@/services/cveService';
import { dataset, dsAdvisory, dsCve, dsMapping } from '../../helpers/explorerDataset';

// raw_payload stays out of the list read entirely: explorer_dataset() never
// selects it (tests/unit/supabase/explorerDatasetMigration.test.ts).
const sample = () =>
  dataset({
    advisories: [
      dsAdvisory({
        id: 'a1',
        advisory_id: 'RHSA-2026:3000',
        summary: 'kernel security update',
        impacts: [{ product_name: 'Red Hat Enterprise Linux 9', component: 'kernel', state: 'Fixed', errata: 'RHSA-2026:3000' }],
      }),
      dsAdvisory({ id: 'a2', advisory_id: 'RHSA-2026:3001', summary: 'kernel security update' }),
    ],
    cves: [dsCve({ id: 'c1', cve_id: 'CVE-2026-3001', cvss_v3_score: 8.8 })],
    mappings: [dsMapping('a1', 'c1', [0], ['Released in RHSA-2026:3000']), dsMapping('a2', 'c1')],
  });

describe('CVE list rows built from the explorer dataset', () => {
  beforeEach(() => mockRpc.mockReset().mockResolvedValue({ data: sample(), error: null }));

  it('still resolves every advisory id from the mapping rows', async () => {
    const [cve] = await new CveService().fetchCves();

    expect(cve.all_advisories).toEqual(['RHSA-2026:3000', 'RHSA-2026:3001']);
    expect(cve.advisory_id).toBe('RHSA-2026:3000');
  });

  it('keeps the rendered fields the drawer depends on', async () => {
    const [cve] = await new CveService().fetchCves();

    expect(cve.solution).toBeTruthy();
    expect(cve.product_impacts.length).toBeGreaterThan(0);
    expect(cve.affected_products).toContain('Red Hat Enterprise Linux 9');
  });
});
