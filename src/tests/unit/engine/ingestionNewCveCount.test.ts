import { describe, it, expect, vi } from 'vitest';

const fakeAdapter = {
  vendorCode: 'redhat',
  vendorName: 'Red Hat',
  listUrl: 'https://example.test/list',
  detailUrlBase: 'https://example.test/detail',
  endpoints: [],
  advisoryDetailUrl: (id: string) => `https://example.test/detail/${id}`,
  cveLookupUrl: (id: string) => `https://example.test/cve/${id}`,
  fetchAdvisories: async () => [],
  parse: (raw: unknown) => raw as any[],
};

vi.mock('@/adapters', () => ({
  getAdapterByCode: () => fakeAdapter,
  ALL_ADAPTERS: [],
}));

import { IngestionEngine } from '@/engine/ingestion';

const item = (advisoryId: string, cveIds: string[]) => ({
  advisoryId,
  title: `Advisory ${advisoryId}`,
  severity: 'HIGH',
  publishedAt: '2026-01-01T00:00:00.000Z',
  url: `https://example.test/${advisoryId}`,
  cves: cveIds.map((cveId) => ({ cveId, severity: 'HIGH' })),
});

describe('IngestionEngine new CVE counting', () => {
  it('counts every cve as new when nothing is known yet', async () => {
    const engine = new IngestionEngine();
    const result = await engine.ingestVendor('redhat', [
      item('RHSA-1', ['CVE-2026-0001', 'CVE-2026-0002']),
    ]);

    expect(result.cvesCount).toBe(2);
    expect(result.newCvesCount).toBe(2);
  });

  it('does not count a cve that is already stored in the database', async () => {
    const engine = new IngestionEngine({ knownCveIds: ['CVE-2026-0001'] });
    const result = await engine.ingestVendor('redhat', [
      item('RHSA-1', ['CVE-2026-0001', 'CVE-2026-0002']),
    ]);

    expect(result.cvesCount).toBe(2);
    expect(result.newCvesCount).toBe(1);
  });

  it('reports zero new cves on a repeat run over unchanged data', async () => {
    const engine = new IngestionEngine({ knownCveIds: ['CVE-2026-0001', 'CVE-2026-0002'] });
    const result = await engine.ingestVendor('redhat', [
      item('RHSA-1', ['CVE-2026-0001', 'CVE-2026-0002']),
    ]);

    expect(result.newCvesCount).toBe(0);
  });

  it('still de-duplicates a cve repeated across advisories in one run', async () => {
    const engine = new IngestionEngine();
    const result = await engine.ingestVendor('redhat', [
      item('RHSA-1', ['CVE-2026-0003']),
      item('RHSA-2', ['CVE-2026-0003']),
    ]);

    expect(result.cvesCount).toBe(2);
    expect(result.newCvesCount).toBe(1);
  });
});
