import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CiscoAdapter } from '@/adapters/cisco';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import singleFixture from '../../fixtures/cisco/cisco-csaf-sample.json';
import multiFixture from '../../fixtures/cisco/cisco-csaf-multi-cve-sample.json';

const CHANGES_CSV_FIXTURE = readFileSync(
  resolve(__dirname, '../../fixtures/cisco/cisco-changes-sample.csv'),
  'utf-8'
);

const CHANGES_CSV = [
  '2026/cisco-sa-tce-roomos-dos-9v9jrc2q.json,2026-09-13T06:05:10Z',
  '2026/cisco-sa-hardening-iosxr-qg64ncm.json,2026-09-12T13:00:21Z',
  '2022/cisco-sa-ce-roomos-dos-c65x2qf2.json,2026-09-13T06:05:08Z',
  '2026/cisco-sa-asaftd-vpn-dos-dzv4mqff.json,2026-09-12T07:40:23Z',
].join('\n');

describe('CiscoAdapter — metadata and endpoints', () => {
  it('exposes the cisco vendor identity', () => {
    const adapter = new CiscoAdapter();
    expect(adapter.vendorCode).toBe('cisco');
    expect(adapter.vendorName).toBe('Cisco');
    expect(Array.isArray(adapter.endpoints)).toBe(true);
    expect(adapter.endpoints.length).toBeGreaterThan(0);
  });
});

describe('CiscoAdapter — parsing and normalization', () => {
  const adapter = new CiscoAdapter();

  it('parses a single-CVE CSAF advisory', () => {
    const items = adapter.parse(singleFixture);
    expect(items).toHaveLength(1);

    const adv = items[0];
    expect(adv.advisoryId).toBe('cisco-sa-tce-roomos-dos-9V9jrC2q');
    expect(adv.title).toContain('TelePresence');
    expect(adv.severity).toBe('HIGH');
  });

  it('maps published and updated dates from CSAF tracking dates', () => {
    const adv = adapter.parse(singleFixture)[0];
    expect(adv.publishedAt).toBeDefined();
    expect(adv.updatedAt).toBeDefined();
    expect(new Date(adv.publishedAt as string).toISOString()).toBe('2026-02-04T16:00:00.000Z');
    expect(new Date(adv.updatedAt as string).toISOString()).toBe('2026-02-12T17:37:39.000Z');
  });

  it('extracts CVE id, CVSS score and vector', () => {
    const adv = adapter.parse(singleFixture)[0];
    expect(adv.cves).toHaveLength(1);

    const cve = adv.cves[0];
    expect(cve.cveId).toBe('CVE-2026-20119');
    expect(cve.cvssScore).toBe(7.5);
    expect(cve.cvssVector).toBe('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H');
    expect(cve.severity).toBe('HIGH');
  });

  it('resolves CSAF product ids to product names', () => {
    const adv = adapter.parse(singleFixture)[0];
    const products = adv.cves[0].affectedProducts ?? [];
    expect(products.length).toBeGreaterThan(0);
    expect(products).toContain('RoomOS 10.3.2.0');
    for (const p of products) {
      expect(p).not.toMatch(/^CSAFPID-/);
    }
  });

  it('uses the self reference as the advisory URL', () => {
    const adv = adapter.parse(singleFixture)[0];
    expect(adv.url).toBe(
      'https://sec.cloudapps.cisco.com/security/center/content/CiscoSecurityAdvisory/cisco-sa-tce-roomos-dos-9V9jrC2q'
    );
  });

  it('derives advisory severity from the highest CVE severity', () => {
    const items = adapter.parse(multiFixture);
    expect(items).toHaveLength(1);

    const adv = items[0];
    expect(adv.cves).toHaveLength(2);
    expect(adv.cves.map((c) => c.cveId)).toEqual(['CVE-2026-20274', 'CVE-2026-20275']);
    expect(adv.cves[0].cvssScore).toBe(9.8);
    expect(adv.cves[1].cvssScore).toBe(8.8);
    expect(adv.severity).toBe('CRITICAL');
  });

  it('drops product ids that cannot be resolved to a name', () => {
    const adv = adapter.parse(multiFixture)[0];
    for (const cve of adv.cves) {
      const products = cve.affectedProducts ?? [];
      const fixed = cve.fixedVersions ?? [];
      expect(products.length).toBeGreaterThan(0);
      expect(products).toContain('3.0.0');
      for (const value of [...products, ...fixed]) {
        expect(value).not.toMatch(/^CSAFPID-/);
      }
    }
  });

  it('does not throw when product_tree has no relationships', () => {
    expect(() => adapter.parse(multiFixture)).not.toThrow();
    expect((multiFixture as Record<string, unknown>).product_tree).not.toHaveProperty('relationships');
  });

  it('accepts an array of CSAF documents', () => {
    const items = adapter.parse([singleFixture, multiFixture]);
    expect(items).toHaveLength(2);
  });

  it('returns an empty array for non-object payloads', () => {
    expect(adapter.parse(null)).toEqual([]);
    expect(adapter.parse(undefined)).toEqual([]);
    expect(adapter.parse('cisco')).toEqual([]);
    expect(adapter.parse(42)).toEqual([]);
  });
});

describe('CiscoAdapter — fetchAdvisories', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sorts the changes index descending by timestamp before slicing', async () => {
    const requested: string[] = [];
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('changes.csv')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(CHANGES_CSV) });
      }
      requested.push(url);
      return Promise.resolve({ ok: true, json: () => Promise.resolve(singleFixture) });
    }) as unknown as typeof fetch;

    await new CiscoAdapter().fetchAdvisories(2);

    expect(requested).toHaveLength(2);
    expect(requested[0]).toContain('2026/cisco-sa-tce-roomos-dos-9v9jrc2q.json');
    // 2022 entry is newer by timestamp than the 2026-09-12 rows, so it must come second
    expect(requested[1]).toContain('2022/cisco-sa-ce-roomos-dos-c65x2qf2.json');
  });

  it('skips advisories whose detail fetch fails instead of throwing', async () => {
    let call = 0;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('changes.csv')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(CHANGES_CSV) });
      }
      call += 1;
      if (call === 1) return Promise.resolve({ ok: false, status: 404 });
      return Promise.resolve({ ok: true, json: () => Promise.resolve(singleFixture) });
    }) as unknown as typeof fetch;

    const items = await new CiscoAdapter().fetchAdvisories(2);
    expect(items).toHaveLength(1);
    expect(items[0].advisoryId).toBe('cisco-sa-tce-roomos-dos-9V9jrC2q');
  });

  it('parses the real changes.csv fixture format', async () => {
    const requested: string[] = [];
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('changes.csv')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(CHANGES_CSV_FIXTURE) });
      }
      requested.push(url);
      return Promise.resolve({ ok: true, json: () => Promise.resolve(singleFixture) });
    }) as unknown as typeof fetch;

    const items = await new CiscoAdapter().fetchAdvisories(3);

    expect(requested).toHaveLength(3);
    for (const url of requested) {
      expect(url).toMatch(/^https:\/\/www\.cisco\.com\/\.well-known\/csaf\/\d{4}\/cisco-sa-[a-z0-9-]+\.json$/);
    }
    expect(items).toHaveLength(3);
  });

  it('throws when the changes index cannot be fetched', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 }) as unknown as typeof fetch;
    await expect(new CiscoAdapter().fetchAdvisories(1)).rejects.toThrow();
  });
});
