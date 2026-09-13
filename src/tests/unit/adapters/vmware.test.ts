import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VmwareAdapter } from '@/adapters/vmware';
import listFixture from '../../fixtures/vmware/vmware-advisory-list-sample.json';
import nvdFixture from '../../fixtures/vmware/nvd-cve-sample.json';

const NVD_EMPTY = { resultsPerPage: 0, startIndex: 0, totalResults: 0, vulnerabilities: [] };

function advisoryById(items: ReturnType<VmwareAdapter['parse']>, vmsaId: string) {
  const found = items.find((a) => a.advisoryId === vmsaId);
  if (!found) throw new Error(`advisory ${vmsaId} not found in ${items.map((a) => a.advisoryId).join(', ')}`);
  return found;
}

describe('VmwareAdapter — metadata and endpoints', () => {
  it('exposes the vmware vendor identity', () => {
    const adapter = new VmwareAdapter();
    expect(adapter.vendorCode).toBe('vmware');
    expect(adapter.vendorName).toBe('VMware / Broadcom');
    expect(Array.isArray(adapter.endpoints)).toBe(true);
    expect(adapter.endpoints.length).toBeGreaterThan(0);
  });
});

describe('VmwareAdapter — parsing and normalization', () => {
  const adapter = new VmwareAdapter();

  it('parses every row of the list response', () => {
    expect(adapter.parse(listFixture)).toHaveLength(5);
  });

  it('accepts the raw response, the inner list, or an array of rows', () => {
    expect(adapter.parse(listFixture)).toHaveLength(5);
    expect(adapter.parse(listFixture.data.list)).toHaveLength(5);
    expect(adapter.parse([listFixture.data.list[0]])).toHaveLength(1);
  });

  it('uses the VMSA id from the title as the advisory id', () => {
    const adv = advisoryById(adapter.parse(listFixture), 'VMSA-2026-0007');
    expect(adv.title).toContain('VMSA-2026-0007');
    expect(adv.url).toContain('support.broadcom.com');
  });

  it('splits comma-separated CVE ids', () => {
    const adv = advisoryById(adapter.parse(listFixture), 'VMSA-2026-0007');
    expect(adv.cves.map((c) => c.cveId)).toEqual(['CVE-2026-59346', 'CVE-2026-59347']);
  });

  it('handles the " and " separator before the final CVE id', () => {
    const items = adapter.parse(listFixture);
    const adv = items.find((a) => a.cves.some((c) => c.cveId === 'CVE-2026-41722'));
    expect(adv).toBeDefined();
    expect(adv!.cves.map((c) => c.cveId)).toEqual([
      'CVE-2026-41722',
      'CVE-2026-41723',
      'CVE-2026-41724',
    ]);
  });

  it('handles the non-breaking-space separator', () => {
    const items = adapter.parse(listFixture);
    const adv = items.find((a) => a.cves.some((c) => c.cveId === 'CVE-2026-22715'));
    expect(adv).toBeDefined();
    expect(adv!.cves).toHaveLength(4);
    for (const cve of adv!.cves) {
      expect(cve.cveId).toMatch(/^CVE-\d{4}-\d{4,}$/);
      expect(cve.cveId).not.toContain(' ');
    }
  });

  it('parses an advisory whose affectedCve is empty', () => {
    const items = adapter.parse(listFixture);
    const adv = items.find((a) => a.cves.length === 0);
    expect(adv).toBeDefined();
    expect(adv!.title.length).toBeGreaterThan(0);
    expect(adv!.severity).toBe('HIGH');
  });

  it('maps Broadcom severity onto the advisory', () => {
    const items = adapter.parse(listFixture);
    expect(advisoryById(items, 'VMSA-2026-0007').severity).toBe('CRITICAL');
    const medium = items.find((a) => a.cves.some((c) => c.cveId === 'CVE-2026-22715'));
    expect(medium!.severity).toBe('MEDIUM');
  });

  it('parses the human-formatted published date', () => {
    const adv = advisoryById(adapter.parse(listFixture), 'VMSA-2026-0007');
    expect(adv.publishedAt).toBeDefined();
    expect(new Date(adv.publishedAt as string).toISOString().slice(0, 10)).toBe('2026-09-03');
  });

  it('treats the timezone-less updated timestamp as UTC', () => {
    const adv = advisoryById(adapter.parse(listFixture), 'VMSA-2026-0007');
    expect(adv.updatedAt).toBeDefined();
    expect(new Date(adv.updatedAt as string).toISOString()).toBe('2026-09-03T08:58:26.960Z');
  });

  it('does not treat a "None" workaround as a mitigation', () => {
    for (const adv of adapter.parse(listFixture)) {
      expect(adv.mitigation ?? '').not.toBe('None');
    }
  });

  it('performs no network access while parsing', () => {
    globalThis.fetch = vi.fn(() => {
      throw new Error('parse must not perform network I/O');
    }) as unknown as typeof fetch;
    expect(adapter.parse(listFixture)).toHaveLength(5);
    vi.restoreAllMocks();
  });

  it('returns an empty array for non-object payloads', () => {
    expect(adapter.parse(null)).toEqual([]);
    expect(adapter.parse(undefined)).toEqual([]);
    expect(adapter.parse('vmware')).toEqual([]);
    expect(adapter.parse(42)).toEqual([]);
  });
});

describe('VmwareAdapter — fetchAdvisories and NVD enrichment', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function mockFeed(nvdHandler: (cveId: string) => unknown) {
    const nvdCalls: string[] = [];
    let inFlight = 0;
    let maxInFlight = 0;

    globalThis.fetch = vi.fn(async (url: string, options?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes('support.broadcom.com')) {
        expect(options?.method).toBe('POST');
        return { ok: true, status: 200, json: async () => listFixture };
      }
      if (urlStr.includes('services.nvd.nist.gov')) {
        const cveId = new URL(urlStr).searchParams.get('cveId') ?? '';
        nvdCalls.push(cveId);
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await Promise.resolve();
        inFlight -= 1;
        return nvdHandler(cveId);
      }
      return { ok: false, status: 404 };
    }) as unknown as typeof fetch;

    return { nvdCalls, maxInFlight: () => maxInFlight };
  }

  it('enriches CVEs with the NVD score and vector', async () => {
    mockFeed(() => ({ ok: true, status: 200, json: async () => nvdFixture }));

    const items = await new VmwareAdapter().fetchAdvisories(5);
    const enriched = items.flatMap((a) => a.cves).find((c) => c.cvssScore !== undefined);

    expect(enriched).toBeDefined();
    expect(enriched!.cvssScore).toBe(8.0);
    expect(enriched!.cvssVector).toBe('CVSS:3.1/AV:N/AC:L/PR:L/UI:R/S:U/C:H/I:H/A:H');
  });

  it('keeps a CVE that NVD does not know, without changing advisory severity', async () => {
    mockFeed(() => ({ ok: true, status: 200, json: async () => NVD_EMPTY }));

    const items = await new VmwareAdapter().fetchAdvisories(5);
    const adv = advisoryById(items, 'VMSA-2026-0007');

    expect(adv.severity).toBe('CRITICAL');
    expect(adv.cves).toHaveLength(2);
    expect(adv.cves[0].cvssScore).toBeUndefined();
  });

  it('requests each distinct CVE id at most once', async () => {
    const feed = mockFeed(() => ({ ok: true, status: 200, json: async () => NVD_EMPTY }));

    await new VmwareAdapter().fetchAdvisories(5);

    expect(feed.nvdCalls.length).toBe(new Set(feed.nvdCalls).size);
  });

  it('queries NVD strictly sequentially', async () => {
    const feed = mockFeed(() => ({ ok: true, status: 200, json: async () => NVD_EMPTY }));

    await new VmwareAdapter().fetchAdvisories(5);

    expect(feed.nvdCalls.length).toBeGreaterThan(1);
    expect(feed.maxInFlight()).toBe(1);
  });

  it('stops enriching after a 429 but still returns every advisory', async () => {
    const feed = mockFeed(() => ({ ok: false, status: 429 }));

    const items = await new VmwareAdapter().fetchAdvisories(5);

    expect(items).toHaveLength(5);
    expect(feed.nvdCalls).toHaveLength(1);
    expect(items.flatMap((a) => a.cves).every((c) => c.cvssScore === undefined)).toBe(true);
  });

  it('survives an NVD network error', async () => {
    mockFeed(() => {
      throw new Error('socket hang up');
    });

    const items = await new VmwareAdapter().fetchAdvisories(5);
    expect(items).toHaveLength(5);
  });

  it('throws when the Broadcom list cannot be fetched', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 }) as unknown as typeof fetch;
    await expect(new VmwareAdapter().fetchAdvisories(5)).rejects.toThrow();
  });
});
