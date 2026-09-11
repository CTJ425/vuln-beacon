import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SuseAdapter } from '@/adapters/suse';
import suseFixture from '../../fixtures/suse/suse-csaf-sample.json';

const adapter = new SuseAdapter();

describe('SuseAdapter — metadata and endpoints', () => {
  it('exposes correct vendorCode and vendorName', () => {
    expect(adapter.vendorCode).toBe('suse');
    expect(adapter.vendorName).toBe('SUSE');
  });

  it('describes its official endpoints', () => {
    expect(adapter.endpoints).toHaveLength(3);
    const urls = adapter.endpoints.map((e) => e.url);
    expect(urls).toContain('https://ftp.suse.com/pub/projects/security/csaf/changes.csv');
    expect(urls).toContain('https://ftp.suse.com/pub/projects/security/csaf/{advisoryFile}');
    expect(urls).toContain('https://www.suse.com/security/cve/{cveId}');
  });

  it('builds detail url and helper urls', () => {
    expect(adapter.advisoryDetailUrl('SUSE-SU-2026:3951-1')).toBe(
      'https://ftp.suse.com/pub/projects/security/csaf/suse-su-2026_3951-1.json'
    );
    expect(adapter.advisoryDetailUrl('SUSE-SU-2026-3951-1')).toBe(
      'https://ftp.suse.com/pub/projects/security/csaf/suse-su-2026_3951-1.json'
    );
    expect(adapter.advisoryDetailUrl('openSUSE-SU-2026-21816-1')).toBe(
      'https://ftp.suse.com/pub/projects/security/csaf/opensuse-su-2026_21816-1.json'
    );
    expect(adapter.cveLookupUrl('CVE-2026-32147')).toBe(
      'https://www.suse.com/security/cve/CVE-2026-32147'
    );
  });
});

describe('SuseAdapter — parsing and normalization', () => {
  it('normalizes CSAF 2.0 document into NormalizedAdvisoryItem', () => {
    const items = adapter.parse([suseFixture]);
    expect(items).toHaveLength(1);

    const adv = items[0];
    expect(adv.advisoryId).toBe('SUSE-SU-2026:3951-1');
    expect(adv.title).toBe('Security update for erlang');
    expect(adv.severity).toBe('MEDIUM');
    expect(adv.publishedAt).toBe('2026-09-03T07:43:14Z');
    expect(adv.url).toBe(
      'https://www.suse.com/support/update/announcement/2026/suse-su-20263951-1/'
    );
    expect(adv.summary).toContain('A security update for erlang is now available');
    expect(adv.solution).toContain('zypper');
  });

  it('extracts CVEs and product impacts from CSAF document', () => {
    const [adv] = adapter.parse([suseFixture]);
    expect(adv.cves).toHaveLength(1);

    const cve = adv.cves[0];
    expect(cve.cveId).toBe('CVE-2026-32147');
    expect(cve.cvssScore).toBe(5.3);
    expect(cve.cvssVector).toBe('CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:L/A:N');
    expect(cve.severity).toBe('MEDIUM');
    expect(cve.description).toContain('Path Traversal');

    expect(cve.productImpacts).toBeDefined();
    expect(cve.productImpacts!.length).toBeGreaterThan(0);
    const impact = cve.productImpacts![0];
    expect(impact.product_name).toBe('SUSE Linux Enterprise Server 15 SP7');
    expect(impact.component).toBe('erlang');
    expect(impact.state).toBe('Fixed');
    expect(impact.errata).toBe('SUSE-SU-2026:3951-1');

    expect(cve.fixedVersions).toContain('erlang-23.3.4.19-150300.3.42.1.x86_64');
  });

  it('handles empty or malformed inputs cleanly', () => {
    expect(adapter.parse(null)).toEqual([]);
    expect(adapter.parse(undefined)).toEqual([]);
    expect(adapter.parse({})).toEqual([]);
    expect(adapter.parse([])).toEqual([]);
    expect(adapter.parse([{ document: {} }])).toEqual([]);
  });
});

describe('SuseAdapter — fetchAdvisories', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fetches changes.csv then fetches details in batches', async () => {
    const changesCsv = `"suse-su-2026_3951-1.json","2026-09-03T07:43:14Z"\n`;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('changes.csv')) {
        return Promise.resolve({
          ok: true,
          text: async () => changesCsv,
        } as unknown as Response);
      }
      if (url.includes('suse-su-2026_3951-1.json')) {
        return Promise.resolve({
          ok: true,
          json: async () => suseFixture,
        } as unknown as Response);
      }
      return Promise.resolve({ ok: false, status: 404 } as unknown as Response);
    });

    const result = await adapter.fetchAdvisories(1);
    expect(result).toHaveLength(1);
    expect(result[0].advisoryId).toBe('SUSE-SU-2026:3951-1');
  });

  it('sorts changes.csv by timestamp descending so newer advisories take precedence over tail legacy entries', async () => {
    // Legacy 2014 entry at the end, newer 2026 entry earlier
    const unorderedChangesCsv = [
      '"suse-su-2026_3951-1.json","2026-09-03T07:43:14Z"',
      '"suse-su-2026_3595-1.json","2026-09-09T12:14:50Z"', // newest!
      '"suse-su-403.json","2014-10-24T22:07:03Z"', // legacy at tail
    ].join('\n');

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('changes.csv')) {
        return Promise.resolve({
          ok: true,
          text: async () => unorderedChangesCsv,
        } as unknown as Response);
      }
      if (url.includes('suse-su-2026_3595-1.json')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            ...suseFixture,
            document: {
              ...suseFixture.document,
              tracking: { id: 'SUSE-SU-2026:3595-1', current_release_date: '2026-09-09T12:14:50Z' },
            },
          }),
        } as unknown as Response);
      }
      return Promise.resolve({ ok: false, status: 404 } as unknown as Response);
    });

    const result = await adapter.fetchAdvisories(1);
    expect(result).toHaveLength(1);
    expect(result[0].advisoryId).toBe('SUSE-SU-2026:3595-1');
  });

  it('throws descriptive error if changes.csv fails to fetch', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    } as unknown as Response);

    await expect(adapter.fetchAdvisories()).rejects.toThrow(
      'Failed to fetch SUSE changes index: Service Unavailable'
    );
  });
});
