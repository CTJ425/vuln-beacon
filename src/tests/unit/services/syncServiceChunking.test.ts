import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
    functions: { invoke: (...args: any[]) => mockInvoke(...args) },
  },
}));

const mockIngestVendor = vi.fn();
const mockGetAdvisories = vi.fn();
const mockGetCves = vi.fn();
const mockGetMappings = vi.fn();

vi.mock('@/engine/ingestion', () => ({
  IngestionEngine: vi.fn().mockImplementation(() => ({
    ingestVendor: mockIngestVendor,
    getAdvisories: mockGetAdvisories,
    getCves: mockGetCves,
    getMappings: mockGetMappings,
  })),
}));

vi.mock('@/services/webhook', () => ({
  WebhookService: vi.fn().mockImplementation(() => ({})),
}));

import { SyncService } from '@/services/syncService';

/**
 * BUG-003. A full Red Hat run built a single 43.6 MB functions.invoke body and the
 * self-hosted Edge Runtime supervisor killed the worker (HTTP 500
 * "WorkerRequestCancelled"). syncVendors() must therefore send the ingestion in
 * chunks whose serialised size is bounded, and write exactly one sync log per run.
 */
const CHUNK_MAX_BYTES = 3_000_000;

/** ~40 KB of product impact rows, so a handful of advisories exceeds the budget. */
const bulkImpacts = (advisoryId: string) =>
  Array.from({ length: 200 }, (_, i) => ({
    product_name: `Red Hat OpenShift Container Platform 4.${i}`,
    component: `registry.redhat.io/openshift4/ose-component-rhel9-${i}`,
    state: 'Fixed',
    justification: 'None',
    errata: advisoryId,
    release_date: '2026-01-01T00:00:00.000Z',
  }));

const advisory = (n: number) => ({
  id: `adv-redhat:RHSA-2026:${n}`,
  vendor_id: 'redhat',
  advisory_id: `RHSA-2026:${n}`,
  title: `Advisory ${n}`,
  severity: 'HIGH',
  published_at: '2026-01-01T00:00:00.000Z',
  url: `https://example.test/RHSA-2026:${n}`,
  summary: 'summary',
  raw_payload: {},
  created_at: '2026-01-01T00:00:00.000Z',
});

const cve = (n: number) => ({
  id: `cve-CVE-2026-${n}`,
  cve_id: `CVE-2026-${n}`,
  description: 'desc',
  severity: 'HIGH',
  is_known_exploited: false,
  created_at: '2026-01-01T00:00:00.000Z',
});

/** Each advisory maps to `perAdvisory` CVEs, each mapping carrying bulk impacts. */
const buildRun = (advisoryCount: number, perAdvisory: number) => {
  const advisories = Array.from({ length: advisoryCount }, (_, i) => advisory(i));
  const cves: any[] = [];
  const mappings: any[] = [];
  let cveN = 0;
  for (const adv of advisories) {
    for (let k = 0; k < perAdvisory; k++) {
      const c = cve(cveN++);
      cves.push(c);
      mappings.push({
        id: `map-${adv.id}-${c.id}`,
        advisory_id: adv.id,
        cve_id: c.id,
        affected_products: [],
        product_impacts: bulkImpacts(adv.advisory_id),
        fixed_versions: [`Released in ${adv.advisory_id}`],
        created_at: '2026-01-01T00:00:00.000Z',
      });
    }
  }
  return { advisories, cves, mappings };
};

const loadRun = (run: ReturnType<typeof buildRun>) => {
  mockGetAdvisories.mockReturnValue(run.advisories);
  mockGetCves.mockReturnValue(run.cves);
  mockGetMappings.mockReturnValue(run.mappings);
};

const bodies = () => mockInvoke.mock.calls.map((c) => c[1].body);
const dataCalls = () => bodies().filter((b: any) => !b.syncMeta);
const metaCalls = () => bodies().filter((b: any) => b.syncMeta);

describe('SyncService bounds the persist payload (BUG-003)', () => {
  beforeEach(() => {
    mockInvoke.mockReset().mockResolvedValue({
      data: { success: true, log: { id: 'log-1', vendor_code: 'redhat', status: 'SUCCESS' } },
      error: null,
    });
    mockFrom.mockReset().mockImplementation(() => ({
      select: () =>
        Object.assign(Promise.resolve({ data: [], error: null }), {
          range: () => Promise.resolve({ data: [], error: null }),
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
    }));
    mockIngestVendor.mockReset().mockResolvedValue({
      status: 'SUCCESS',
      advisoriesCount: 1,
      cvesCount: 1,
      newCvesCount: 1,
      durationMs: 10,
    });
    mockGetAdvisories.mockReset();
    mockGetCves.mockReset();
    mockGetMappings.mockReset();
  });

  it('splits a large run into several data calls, each under the byte budget', async () => {
    loadRun(buildRun(300, 3));

    const result = await new SyncService().syncVendors();

    expect(result.success).toBe(true);
    expect(dataCalls().length).toBeGreaterThan(1);
    for (const body of dataCalls()) {
      expect(JSON.stringify(body).length).toBeLessThanOrEqual(CHUNK_MAX_BYTES);
    }
  });

  it('sends every advisory, CVE and mapping exactly once across the data calls', async () => {
    const run = buildRun(300, 3);
    loadRun(run);

    await new SyncService().syncVendors();

    const sentAdv = dataCalls().flatMap((b: any) => b.advisories.map((a: any) => a.id));
    const sentMap = dataCalls().flatMap((b: any) => b.mappings.map((m: any) => m.id));
    const sentCve = dataCalls().flatMap((b: any) => b.cves.map((c: any) => c.id));

    expect(new Set(sentAdv).size).toBe(sentAdv.length);
    expect(sentAdv.sort()).toEqual(run.advisories.map((a) => a.id).sort());
    expect(new Set(sentMap).size).toBe(sentMap.length);
    expect(sentMap.sort()).toEqual(run.mappings.map((m) => m.id).sort());
    expect(new Set(sentCve)).toEqual(new Set(run.cves.map((c) => c.id)));
  });

  it('keeps each mapping in the same call as the advisory it belongs to', async () => {
    loadRun(buildRun(300, 3));

    await new SyncService().syncVendors();

    for (const body of dataCalls()) {
      const advIds = new Set(body.advisories.map((a: any) => a.id));
      for (const m of body.mappings) {
        expect(advIds.has(m.advisory_id)).toBe(true);
      }
      const cveIds = new Set(body.cves.map((c: any) => c.id));
      for (const m of body.mappings) {
        expect(cveIds.has(m.cve_id)).toBe(true);
      }
    }
  });

  it('writes exactly one sync log, carrying the totals for the whole run', async () => {
    const run = buildRun(300, 3);
    loadRun(run);

    await new SyncService().syncVendors();

    const meta = metaCalls();
    expect(meta).toHaveLength(1);
    expect(meta[0].syncMeta.status).toBe('SUCCESS');
    expect(meta[0].syncMeta.itemsFetched).toBe(run.advisories.length);
    expect(meta[0].syncMeta.newItemsCount).toBe(run.cves.length);
    expect(meta[0].advisories).toEqual([]);
    expect(meta[0].cves).toEqual([]);
    expect(meta[0].mappings).toEqual([]);
  });

  it('still uses one data call plus one log call for a small run', async () => {
    loadRun(buildRun(1, 1));

    await new SyncService().syncVendors();

    expect(dataCalls()).toHaveLength(1);
    expect(metaCalls()).toHaveLength(1);
  });

  it('aborts the remaining chunks and logs the real error when one chunk fails', async () => {
    loadRun(buildRun(300, 3));

    let dataCallCount = 0;
    mockInvoke.mockImplementation(async (_name: string, opts: any) => {
      if (opts.body.syncMeta) {
        return { data: { success: true, log: { id: 'log-fail', status: 'FAILED' } }, error: null };
      }
      dataCallCount++;
      if (dataCallCount === 2) {
        return { data: null, error: new Error('WorkerRequestCancelled: request has been cancelled by supervisor') };
      }
      return { data: { success: true, log: null }, error: null };
    });

    const result = await new SyncService().syncVendors();

    expect(result.success).toBe(false);
    expect(dataCallCount).toBe(2);

    const meta = metaCalls();
    expect(meta).toHaveLength(1);
    expect(meta[0].syncMeta.status).toBe('FAILED');
    expect(meta[0].syncMeta.errorMessage).toContain('WorkerRequestCancelled');
  });
});
