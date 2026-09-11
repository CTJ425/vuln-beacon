import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UbuntuAdapter } from '@/adapters/ubuntu';
import ubuntuFixture from '../../fixtures/ubuntu/ubuntu-notice-sample.json';

const adapter = new UbuntuAdapter();

describe('UbuntuAdapter — metadata and endpoints', () => {
  it('exposes correct vendorCode and vendorName', () => {
    expect(adapter.vendorCode).toBe('ubuntu');
    expect(adapter.vendorName).toBe('Ubuntu');
  });

  it('describes its official endpoints', () => {
    expect(adapter.endpoints).toHaveLength(3);
    const urls = adapter.endpoints.map((e) => e.url);
    expect(urls).toContain('https://ubuntu.com/security/notices.json');
    expect(urls).toContain('https://ubuntu.com/security/notices/{noticeId}.json');
    expect(urls).toContain('https://ubuntu.com/security/cves/{cveId}.json');
  });

  it('builds detail url, CVE lookup url, and list url', () => {
    expect(adapter.noticeDetailUrl('USN-8747-1')).toBe(
      'https://ubuntu.com/security/notices/USN-8747-1.json'
    );
    expect(adapter.cveLookupUrl('CVE-2026-42052')).toBe(
      'https://ubuntu.com/security/cves/CVE-2026-42052.json'
    );
    expect(adapter.noticesListUrl(10)).toBe(
      'https://ubuntu.com/security/notices.json?limit=10'
    );
  });
});

describe('UbuntuAdapter — parsing and normalization', () => {
  it('normalizes notice payload into NormalizedAdvisoryItem', () => {
    const items = adapter.parse([ubuntuFixture]);
    expect(items).toHaveLength(1);

    const adv = items[0];
    expect(adv.advisoryId).toBe('USN-8747-1');
    expect(adv.title).toBe('Beets vulnerability');
    expect(adv.severity).toBe('MEDIUM');
    expect(adv.publishedAt).toBe('2026-09-10T15:56:46.094967');
    expect(adv.url).toBe('https://ubuntu.com/security/notices/USN-8747-1');
    expect(adv.summary).toContain('Beets could allow malicious media metadata');
    expect(adv.solution).toContain('In general, a standard system update');
    expect(adv.rawPayload).toBeDefined();
  });

  it('extracts CVEs, products, and package impacts', () => {
    const [adv] = adapter.parse([ubuntuFixture]);
    expect(adv.cves).toHaveLength(1);

    const cve = adv.cves[0];
    expect(cve.cveId).toBe('CVE-2026-42052');
    expect(cve.cvssScore).toBe(6.0);
    expect(cve.severity).toBe('MEDIUM');
    expect(cve.productImpacts).toBeDefined();
    expect(cve.productImpacts!.length).toBeGreaterThan(0);

    const jammyImpact = cve.productImpacts!.find((p) => p.product_name === 'Ubuntu jammy');
    expect(jammyImpact).toBeDefined();
    expect(jammyImpact?.component).toBe('beets');
    expect(jammyImpact?.state).toBe('Fixed');
    expect(jammyImpact?.justification).toBe('1.6.0-1ubuntu0.1~esm1');
    expect(jammyImpact?.errata).toBe('USN-8747-1');

    expect(cve.fixedVersions).toContain('1.6.0-1ubuntu0.1~esm1');
    expect(cve.fixedVersions).toContain('1.6.0-8ubuntu0.1~esm1');
  });

  it('handles wrapper object with notices array', () => {
    const items = adapter.parse({ notices: [ubuntuFixture] });
    expect(items).toHaveLength(1);
    expect(items[0].advisoryId).toBe('USN-8747-1');
  });

  it('handles empty or malformed inputs cleanly', () => {
    expect(adapter.parse(null)).toEqual([]);
    expect(adapter.parse(undefined)).toEqual([]);
    expect(adapter.parse([])).toEqual([]);
    expect(adapter.parse({})).toEqual([]);
    expect(adapter.parse({ notices: [] })).toEqual([]);
    expect(adapter.parse([{ id: 'INVALID' }])).toEqual([]);
  });

  it('parses single CVE detail document with nested notices', () => {
    const cveDoc = {
      id: 'CVE-2026-42052',
      priority: 'medium',
      cvss3: 6.0,
      description: 'Test vulnerability description',
      notices: [ubuntuFixture],
    };
    const items = adapter.parse(cveDoc);
    expect(items).toHaveLength(1);
    expect(items[0].advisoryId).toBe('USN-8747-1');
    expect(items[0].cves[0].cveId).toBe('CVE-2026-42052');
  });
});

describe('UbuntuAdapter — fetchAdvisories', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fetches and returns normalized advisories', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ notices: [ubuntuFixture] }),
    } as unknown as Response);

    const result = await adapter.fetchAdvisories(1);
    expect(result).toHaveLength(1);
    expect(result[0].advisoryId).toBe('USN-8747-1');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://ubuntu.com/security/notices.json?limit=1'
    );
  });

  it('throws descriptive error if request fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as unknown as Response);

    await expect(adapter.fetchAdvisories()).rejects.toThrow(
      'Failed to fetch Ubuntu security notices: Internal Server Error'
    );
  });
});
