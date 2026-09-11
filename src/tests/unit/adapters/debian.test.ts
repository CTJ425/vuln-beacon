import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DebianAdapter } from '@/adapters/debian';
import debianFixture from '../../fixtures/debian/debian-dsa-sample.json';

const adapter = new DebianAdapter();

describe('DebianAdapter — metadata and endpoints', () => {
  it('exposes correct vendorCode and vendorName', () => {
    expect(adapter.vendorCode).toBe('debian');
    expect(adapter.vendorName).toBe('Debian');
  });

  it('describes its official endpoints', () => {
    expect(adapter.endpoints).toHaveLength(3);
    const urls = adapter.endpoints.map((e) => e.url);
    expect(urls).toContain('https://security-tracker.debian.org/tracker/data/json');
    expect(urls).toContain(
      'https://salsa.debian.org/security-tracker-team/security-tracker/-/raw/master/data/DSA/list'
    );
    expect(urls).toContain('https://security-tracker.debian.org/tracker/{cveOrDsa}');
  });

  it('builds lookup urls', () => {
    expect(adapter.dsaLookupUrl('DSA-6492-1')).toBe(
      'https://security-tracker.debian.org/tracker/DSA-6492-1'
    );
    expect(adapter.cveLookupUrl('CVE-2026-26961')).toBe(
      'https://security-tracker.debian.org/tracker/CVE-2026-26961'
    );
  });
});

describe('DebianAdapter — parsing and normalization', () => {
  it('parses DSA list text format', () => {
    const items = adapter.parse(debianFixture.dsaListSample);
    expect(items).toHaveLength(2);

    const dsa1 = items.find((i) => i.advisoryId === 'DSA-6492-1');
    expect(dsa1).toBeDefined();
    expect(dsa1!.title).toBe('[ruby-rack] Debian Security Advisory DSA-6492-1');
    expect(dsa1!.url).toBe('https://security-tracker.debian.org/tracker/DSA-6492-1');
    expect(dsa1!.cves).toHaveLength(3);
    expect(dsa1!.cves.map((c) => c.cveId)).toContain('CVE-2026-26961');
    expect(dsa1!.cves[0].fixedVersions).toContain('3.1.20-0+deb13u2');
    expect(dsa1!.cves[0].productImpacts).toBeDefined();
    expect(dsa1!.cves[0].productImpacts![0].component).toBe('ruby-rack');
    expect(dsa1!.cves[0].productImpacts![0].product_name).toBe('Debian trixie');
    expect(dsa1!.cves[0].productImpacts![0].state).toBe('Fixed');

    const dsa2 = items.find((i) => i.advisoryId === 'DSA-6491-1');
    expect(dsa2).toBeDefined();
    expect(dsa2!.cves.map((c) => c.cveId)).toContain('CVE-2026-65107');
  });

  it('parses structured DSA advisory object', () => {
    const items = adapter.parse(debianFixture.dsaAdvisory);
    expect(items).toHaveLength(1);
    expect(items[0].advisoryId).toBe('DSA-6492-1');
    expect(items[0].cves).toHaveLength(3);
    expect(items[0].summary).toContain('Multiple security issues were found in Rack');
  });

  it('parses security-tracker data/json format', () => {
    const items = adapter.parse(debianFixture.trackerJsonSample);
    expect(items).toHaveLength(1);
    const adv = items[0];
    expect(adv.cves).toHaveLength(1);
    expect(adv.cves[0].cveId).toBe('CVE-2026-26961');
    expect(adv.severity).toBe('HIGH');
    expect(adv.cves[0].description).toContain('Rack contains a denial of service vulnerability');
    expect(adv.cves[0].productImpacts).toBeDefined();
    expect(adv.cves[0].productImpacts!.length).toBe(2);
  });

  it('handles empty or malformed inputs cleanly', () => {
    expect(adapter.parse(null)).toEqual([]);
    expect(adapter.parse(undefined)).toEqual([]);
    expect(adapter.parse('')).toEqual([]);
    expect(adapter.parse({})).toEqual([]);
    expect(adapter.parse([])).toEqual([]);
  });
});

describe('DebianAdapter — fetchAdvisories', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fetches DSA list and returns normalized items', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => debianFixture.dsaListSample,
    } as unknown as Response);

    const result = await adapter.fetchAdvisories(10);
    expect(result).toHaveLength(2);
    expect(result[0].advisoryId).toBe('DSA-6492-1');
  });

  it('throws descriptive error if DSA fetch fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
    } as unknown as Response);

    await expect(adapter.fetchAdvisories()).rejects.toThrow(
      'Failed to fetch Debian advisories: Bad Gateway'
    );
  });
});
