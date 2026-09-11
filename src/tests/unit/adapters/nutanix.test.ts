import { describe, it, expect, vi } from 'vitest';
import { NutanixAdapter } from '@/adapters/nutanix';
import nutanixFixture from '../../fixtures/nutanix/nutanix-advisory-sample.json';

const adapter = new NutanixAdapter();

describe('NutanixAdapter — metadata and endpoints', () => {
  it('exposes correct vendorCode and vendorName', () => {
    expect(adapter.vendorCode).toBe('nutanix');
    expect(adapter.vendorName).toBe('Nutanix');
  });

  it('describes its official endpoints', () => {
    expect(adapter.endpoints).toHaveLength(3);
    const urls = adapter.endpoints.map((e) => e.url);
    expect(urls).toContain('https://portal.nutanix.com/api/v1/advisories');
    expect(urls).toContain('https://portal.nutanix.com/api/v1/advisory?id={advisoryId}');
    expect(urls).toContain('https://portal.nutanix.com/api/v1/vulnerabilities');
  });

  it('builds detail url and helper urls', () => {
    expect(adapter.advisoryDetailUrl('NXSA-AOS-7.5.1.12')).toBe(
      'https://portal.nutanix.com/api/v1/advisory?id=NXSA-AOS-7.5.1.12'
    );
    expect(adapter.vulnerabilityLookupUrl()).toBe(
      'https://portal.nutanix.com/api/v1/vulnerabilities'
    );
    expect(adapter.advisoriesListUrl()).toBe(
      'https://portal.nutanix.com/api/v1/advisories'
    );
  });
});

describe('NutanixAdapter — parsing and normalization', () => {
  it('normalizes an advisory document into a NormalizedAdvisoryItem', () => {
    const items = adapter.parse([nutanixFixture]);
    expect(items).toHaveLength(1);

    const adv = items[0];
    expect(adv.advisoryId).toBe('NXSA-AOS-7.5.1.12');
    expect(adv.title).toBe('[AOS] Nutanix Security Advisory NXSA-AOS-7.5.1.12 (AOS 7.5.1.12)');
    expect(adv.severity).toBe('HIGH');
    expect(adv.publishedAt).toBe('2026-08-24T19:53:27.498236');
    expect(adv.updatedAt).toBe('2026-09-07T06:58:50.096392');
    expect(adv.url).toBe(
      'https://portal.nutanix.com/page/documents/security-advisories/release-advisories/details?id=NXSA-AOS-7.5.1.12'
    );
    expect(adv.summary).toBe('Upgrade to AOS 7.5.1.12 or later.');
    expect(adv.solution).toBe('Upgrade to AOS 7.5.1.12 or later.');
    expect(adv.rawPayload).toBeDefined();
  });

  it('extracts all CVEs with scores, severity and vector', () => {
    const [adv] = adapter.parse([nutanixFixture]);
    expect(adv.cves).toHaveLength(2);

    const cve1 = adv.cves.find((c) => c.cveId === 'CVE-2026-33416');
    expect(cve1).toBeDefined();
    expect(cve1!.description).toContain('LIBPNG heap buffer aliasing');
    expect(cve1!.cvssScore).toBe(7.5);
    expect(cve1!.cvssVector).toBe('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H');
    expect(cve1!.severity).toBe('HIGH');
    expect(cve1!.affectedProducts).toEqual(['AOS', 'AOS 7.5.1.12']);
    expect(cve1!.fixedVersions).toEqual(['AOS 7.5.1.12']);

    const impact = cve1!.productImpacts?.[0];
    expect(impact).toBeDefined();
    expect(impact!.product_name).toBe('AOS');
    expect(impact!.state).toBe('Affected');
    expect(impact!.justification).toBe('All versions prior to 7.5.1.12');
    expect(impact!.errata).toBe('AOS 7.5.1.12');
    expect(impact!.cpe).toBe('cpe:2.3:a:nutanix:aos:*:*:*:*:*:*:*:*');
  });

  it('handles a single raw object or wrapped { advisories: [...] } payload', () => {
    const singleItems = adapter.parse(nutanixFixture);
    expect(singleItems).toHaveLength(1);
    expect(singleItems[0].advisoryId).toBe('NXSA-AOS-7.5.1.12');

    const wrappedItems = adapter.parse({ advisories: [nutanixFixture] });
    expect(wrappedItems).toHaveLength(1);
    expect(wrappedItems[0].advisoryId).toBe('NXSA-AOS-7.5.1.12');
  });

  it('normalizes varying severity strings properly', () => {
    const makeWithSev = (sev: string) => ({
      ...nutanixFixture,
      advisory_id: `NXSA-TEST-${sev}`,
      severity: sev,
      cvelist: [{ cve_id: 'CVE-2026-0001', severity: sev }],
    });

    expect(adapter.parse([makeWithSev('critical')])[0].severity).toBe('CRITICAL');
    expect(adapter.parse([makeWithSev('Important')])[0].severity).toBe('HIGH');
    expect(adapter.parse([makeWithSev('Medium')])[0].severity).toBe('MEDIUM');
    expect(adapter.parse([makeWithSev('Low')])[0].severity).toBe('LOW');
    expect(adapter.parse([makeWithSev('random')])[0].severity).toBe('UNKNOWN');
  });

  it('tolerates empty, null, or malformed inputs without throwing', () => {
    expect(adapter.parse(null)).toEqual([]);
    expect(adapter.parse(undefined)).toEqual([]);
    expect(adapter.parse([])).toEqual([]);
    expect(adapter.parse('invalid string')).toEqual([]);
    expect(adapter.parse([{}])).toEqual([]);
    expect(adapter.parse([{ advisory_id: 'NXSA-NO-CVES' }])).toEqual([]);
  });

  it('filters out invalid CVE formats in cvelist', () => {
    const payload = {
      ...nutanixFixture,
      cvelist: [
        { cve_id: 'NOT-A-CVE', cvss: 5.0 },
        { cve_id: 'CVE-2026-99999', cvss: '9.8', severity: 'Critical' },
      ],
    };
    const [adv] = adapter.parse([payload]);
    expect(adv.cves).toHaveLength(1);
    expect(adv.cves[0].cveId).toBe('CVE-2026-99999');
    expect(adv.cves[0].cvssScore).toBe(9.8);
    expect(adv.cves[0].severity).toBe('CRITICAL');
  });

  it('deduplicates identical CVE IDs within an advisory payload', () => {
    const payload = {
      ...nutanixFixture,
      cvelist: [
        { cve_id: 'CVE-2026-11111', cvss: 7.5 },
        { cve_id: 'CVE-2026-11111', cvss: 7.5 },
        'CVE-2026-11111',
      ],
    };
    const [adv] = adapter.parse([payload]);
    expect(adv.cves).toHaveLength(1);
    expect(adv.cves[0].cveId).toBe('CVE-2026-11111');
  });

  it('correctly parses affected_version array and sets justification in productImpacts', () => {
    const payload = {
      advisory_id: 'NXSA-AOS-7.5.1.12',
      product: 'AOS',
      affected_version: ['7.0', '7.0.0.5', '7.1'],
      fixedRelease: 'AOS 7.5.1.12',
      cvelist: [{ cve_id: 'CVE-2026-33416', cvss: 7.5 }],
    };
    const [adv] = adapter.parse([payload]);
    expect(adv.cves[0].productImpacts?.[0].justification).toBe('7.0, 7.0.0.5, 7.1');
  });

  it('supports string array in cveList and maps overallCVSS score to severity', () => {
    const payload = {
      advisory_id: 'NXSA-AHV-11.2',
      product: 'AHV',
      overallCVSS: '8.8',
      cveList: ['CVE-2026-33416', 'CVE-2026-99999'],
    };
    const [adv] = adapter.parse([payload]);
    expect(adv.cves).toHaveLength(2);
    expect(adv.cves[0].cveId).toBe('CVE-2026-33416');
    expect(adv.cves[0].cvssScore).toBe(8.8);
    expect(adv.cves[0].severity).toBe('HIGH');
  });

  it('reads lastModifiedDate when lastModified is missing', () => {
    const payload = {
      advisory_id: 'NXSA-PC-7.3.1.16',
      product: 'Prism',
      lastModifiedDate: '2026-08-31T04:15:44.797471',
      cvelist: [{ cve_id: 'CVE-2026-33416' }],
    };
    const [adv] = adapter.parse([payload]);
    expect(adv.updatedAt).toBe('2026-08-31T04:15:44.797471');
  });
});

describe('NutanixAdapter — fetchAdvisories live and batched fetching', () => {
  it('fetches advisory list and details in batches', async () => {
    const mockList = {
      advisories: [
        { advisory_id: 'NXSA-AOS-1.0' },
        { advisory_id: 'NXSA-AOS-2.0' },
      ],
      totalCount: 2,
    };

    const mockDetail1 = {
      advisory_id: 'NXSA-AOS-1.0',
      product: 'AOS',
      severity: 'Medium',
      cvelist: [{ cve_id: 'CVE-2026-1111' }],
    };
    const mockDetail2 = {
      advisory_id: 'NXSA-AOS-2.0',
      product: 'AOS',
      severity: 'High',
      cvelist: [{ cve_id: 'CVE-2026-2222' }],
    };

    const fetchSpy = vi.fn(async (url: any, options?: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/advisories') && options?.method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => mockList,
        };
      }
      if (urlStr.includes('NXSA-AOS-1.0')) {
        return {
          ok: true,
          status: 200,
          json: async () => mockDetail1,
        };
      }
      if (urlStr.includes('NXSA-AOS-2.0')) {
        return {
          ok: true,
          status: 200,
          json: async () => mockDetail2,
        };
      }
      return { ok: false, status: 404 };
    });

    vi.stubGlobal('fetch', fetchSpy);

    const items = await adapter.fetchAdvisories(10);
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.advisoryId)).toEqual(['NXSA-AOS-1.0', 'NXSA-AOS-2.0']);

    vi.unstubAllGlobals();
  });

  it('tolerates individual advisory detail failures without failing the batch', async () => {
    const mockList = {
      advisories: [
        { advisory_id: 'NXSA-OK-1' },
        { advisory_id: 'NXSA-FAIL-2' },
      ],
      totalCount: 2,
    };

    const mockDetailOk = {
      advisory_id: 'NXSA-OK-1',
      product: 'Prism',
      severity: 'High',
      cvelist: [{ cve_id: 'CVE-2026-3333' }],
    };

    const fetchSpy = vi.fn(async (url: any, _options?: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/advisories')) {
        return { ok: true, status: 200, json: async () => mockList };
      }
      if (urlStr.includes('NXSA-OK-1')) {
        return { ok: true, status: 200, json: async () => mockDetailOk };
      }
      // Simulate 500 error or network throw for second advisory
      throw new Error('Network timeout');
    });

    vi.stubGlobal('fetch', fetchSpy);

    const items = await adapter.fetchAdvisories(10);
    expect(items).toHaveLength(1);
    expect(items[0].advisoryId).toBe('NXSA-OK-1');

    vi.unstubAllGlobals();
  });

  it('throws a descriptive error when the initial advisories list fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    }));

    await expect(adapter.fetchAdvisories(10)).rejects.toThrow(
      'Failed to fetch Nutanix advisories list: Service Unavailable'
    );

    vi.unstubAllGlobals();
  });
});
