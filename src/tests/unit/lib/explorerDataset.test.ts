import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();
const mockFrom = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...a: any[]) => mockRpc(...a), from: (...a: any[]) => mockFrom(...a) },
}));

import { fetchExplorerDataset, toAdvisoryRows, toCveRows } from '@/lib/explorerDataset';
import { dataset, dsAdvisory, dsCve, dsMapping } from '../../helpers/explorerDataset';

const impA = { product_name: 'RHEL 9', component: 'kernel', state: 'Fixed' };
const impB = { product_name: 'RHEL 8', component: 'kernel', state: 'Affected' };

const sample = () =>
  dataset({
    advisories: [dsAdvisory({ id: 'a1', impacts: [impA, impB] }), dsAdvisory({ id: 'a2', advisory_id: 'DSA-1-1', vendor_code: 'debian', vendor_name: 'Debian' })],
    cves: [dsCve({ id: 'c1' }), dsCve({ id: 'c2', cve_id: 'CVE-2026-2000' })],
    mappings: [dsMapping('a1', 'c1', [0, 1], ['9.1']), dsMapping('a1', 'c2', [1]), dsMapping('a2', 'c1')],
  });

describe('explorer dataset', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockFrom.mockReset();
  });

  it('loads everything with one explorer_dataset RPC and no table queries', async () => {
    mockRpc.mockResolvedValue({ data: sample(), error: null });
    await fetchExplorerDataset();
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('explorer_dataset');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('shares one in-flight request between concurrent callers, then fetches fresh', async () => {
    mockRpc.mockResolvedValue({ data: sample(), error: null });
    await Promise.all([fetchExplorerDataset(), fetchExplorerDataset()]);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    await fetchExplorerDataset();
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });

  it('rejects when the RPC errors', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(fetchExplorerDataset()).rejects.toMatchObject({ message: 'boom' });
  });

  it('rebuilds advisory rows with each mapping resolved to its own impacts', () => {
    const [a1, a2] = toAdvisoryRows(sample());
    expect(a1.vendors).toEqual({ code: 'redhat', name: 'Red Hat' });
    expect(a1.advisory_cve_map).toEqual([
      { affected_products: [impA, impB], fixed_versions: ['9.1'], cves: expect.objectContaining({ cve_id: 'CVE-2026-1000' }) },
      { affected_products: [impB], fixed_versions: [], cves: expect.objectContaining({ cve_id: 'CVE-2026-2000' }) },
    ]);
    expect(a2.advisory_cve_map).toHaveLength(1);
  });

  it('rebuilds cve rows with every advisory that maps to them', () => {
    const [c1, c2] = toCveRows(sample());
    expect(c1.advisory_cve_map.map((m: any) => m.advisories.advisory_id).sort()).toEqual(['DSA-1-1', 'RHSA-2026:1000']);
    expect(c1.advisory_cve_map.find((m: any) => m.advisories.advisory_id === 'DSA-1-1').advisories.vendors).toEqual({ code: 'debian', name: 'Debian' });
    expect(c2.advisory_cve_map[0].affected_products).toEqual([impB]);
  });

  it('keeps the server order of advisories and cves', () => {
    expect(toAdvisoryRows(sample()).map((r: any) => r.id)).toEqual(['a1', 'a2']);
    expect(toCveRows(sample()).map((r: any) => r.id)).toEqual(['c1', 'c2']);
  });
});
