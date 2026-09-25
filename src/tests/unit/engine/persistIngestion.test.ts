import { describe, it, expect, vi } from 'vitest';
import { persistIngestion, sanitiseAdvisoryKey } from '@/engine/persistIngestion';

function fakeClient(opts: { advisoryError?: unknown; uploadError?: unknown } = {}) {
  const calls: { rpc: any[]; upserts: Record<string, any[]>; uploads: string[]; removed: string[] } = {
    rpc: [],
    upserts: {},
    uploads: [],
    removed: [],
  };
  const client = {
    rpc: vi.fn(async (name: string, args: any) => {
      calls.rpc.push({ name, args });
      return { data: args.p_rows.map((r: any) => ({ id: `db-${r.cve_id}`, cve_id: r.cve_id })), error: null };
    }),
    from: vi.fn((table: string) => ({
      upsert: (rows: any) => {
        (calls.upserts[table] ??= []).push(rows);
        const result =
          table === 'advisories'
            ? opts.advisoryError
              ? { data: null, error: opts.advisoryError }
              : { data: rows.map((r: any) => ({ id: `db-${r.advisory_id}`, advisory_id: r.advisory_id })), error: null }
            : { data: null, error: null };
        return { select: async () => result, then: (res: any) => res(result) };
      },
    })),
    storage: {
      from: () => ({
        upload: async (path: string) => {
          if (opts.uploadError) return { error: opts.uploadError };
          calls.uploads.push(path);
          return { error: null };
        },
        remove: async (paths: string[]) => {
          calls.removed.push(...paths);
          return { error: null };
        },
      }),
    },
  };
  return { client, calls };
}

const advisory = (id: string, payload: Record<string, unknown> = { doc: 1 }) => ({
  id: `adv-redhat:${id}`,
  vendor_id: 'redhat',
  advisory_id: id,
  title: `Advisory ${id}`,
  severity: 'HIGH',
  published_at: '2026-01-01T00:00:00.000Z',
  url: `https://example.test/${id}`,
  raw_payload: payload,
  created_at: '',
}) as any;

const cve = (cveId: string, extra: Record<string, unknown> = {}) => ({
  id: `cve-${cveId}`,
  cve_id: cveId,
  description: null,
  description_fallback: 'Advisory title',
  cvss_v3_score: null,
  cvss_v3_vector: null,
  severity: 'HIGH',
  is_known_exploited: false,
  published_date: '2026-01-01T00:00:00.000Z',
  created_at: '',
  ...extra,
}) as any;

const mapping = (advId: string, cveId: string, extra: Record<string, unknown> = {}) => ({
  id: `map-${advId}-${cveId}`,
  advisory_id: `adv-redhat:${advId}`,
  cve_id: `cve-${cveId}`,
  affected_products: ['p1'],
  fixed_versions: ['1.0'],
  created_at: '',
  ...extra,
}) as any;

const run = (client: any, input: Partial<Parameters<typeof persistIngestion>[1]>) =>
  persistIngestion(client, { vendorId: 'vendor-uuid', vendorCode: 'redhat', advisories: [], cves: [], mappings: [], ...input });

describe('persistIngestion', () => {
  it('writes CVEs through upsert_cves and never sends the advisory title as the description', async () => {
    const { client, calls } = fakeClient();
    await run(client, { cves: [cve('CVE-2026-0001')] });

    expect(client.from).not.toHaveBeenCalledWith('cves');
    expect(calls.rpc).toHaveLength(1);
    expect(calls.rpc[0].name).toBe('upsert_cves');
    expect(calls.rpc[0].args.p_rows[0]).toMatchObject({
      cve_id: 'CVE-2026-0001',
      description: null,
      description_fallback: 'Advisory title',
      cvss_v3_score: null,
    });
  });

  it('drops malformed CVE ids and duplicate CVEs', async () => {
    const { client, calls } = fakeClient();
    await run(client, { cves: [cve('CVE-2026-0001'), cve('CVE-2026-0001'), cve('not-a-cve')] });
    expect(calls.rpc[0].args.p_rows.map((r: any) => r.cve_id)).toEqual(['CVE-2026-0001']);
  });

  it('links mappings to database ids and prefers structured product impacts', async () => {
    const { client, calls } = fakeClient();
    await run(client, {
      advisories: [advisory('RHSA-1')],
      cves: [cve('CVE-2026-0001')],
      mappings: [mapping('RHSA-1', 'CVE-2026-0001', { product_impacts: [{ product_name: 'RHEL 9' }] })],
    });
    expect(calls.upserts.advisory_cve_map[0]).toEqual([
      {
        advisory_id: 'db-RHSA-1',
        cve_id: 'db-CVE-2026-0001',
        affected_products: [{ product_name: 'RHEL 9' }],
        fixed_versions: ['1.0'],
      },
    ]);
  });

  it('merges duplicate mappings into one row', async () => {
    const { client, calls } = fakeClient();
    await run(client, {
      advisories: [advisory('RHSA-1')],
      cves: [cve('CVE-2026-0001')],
      mappings: [
        mapping('RHSA-1', 'CVE-2026-0001', { affected_products: ['a'], fixed_versions: ['1'] }),
        mapping('RHSA-1', 'CVE-2026-0001', { affected_products: ['b'], fixed_versions: ['1', '2'] }),
      ],
    });
    expect(calls.upserts.advisory_cve_map[0]).toHaveLength(1);
    expect(calls.upserts.advisory_cve_map[0][0]).toMatchObject({ affected_products: ['a', 'b'], fixed_versions: ['1', '2'] });
  });

  it('stores the raw document under a sanitised key and records its path', async () => {
    const { client, calls } = fakeClient();
    await run(client, { advisories: [advisory('RHSA-2026:1')] });
    expect(calls.uploads).toEqual(['redhat/RHSA-2026_1.json']);
    expect(calls.upserts.advisories[0][0].raw_payload_path).toBe('redhat/RHSA-2026_1.json');
    expect(calls.upserts.advisories[0][0].raw_payload).toEqual({});
  });

  it('keeps going with a null path when a raw document upload fails', async () => {
    const { client, calls } = fakeClient({ uploadError: new Error('storage down') });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await run(client, { advisories: [advisory('RHSA-1')] });
    expect(calls.upserts.advisories[0][0].raw_payload_path).toBeNull();
  });

  it('removes the uploaded documents and rethrows when the advisory upsert fails', async () => {
    const boom = new Error('upsert failed');
    const { client, calls } = fakeClient({ advisoryError: boom });
    await expect(run(client, { advisories: [advisory('RHSA-1')] })).rejects.toBe(boom);
    expect(calls.removed).toEqual(['redhat/RHSA-1.json']);
  });

  it('sanitises path separators and traversal in storage keys', () => {
    expect(sanitiseAdvisoryKey('../a/b\\c:d')).toBe('__a_b_c_d');
  });
});
