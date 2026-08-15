import { describe, it, expect } from 'vitest';
import { RedHatCsafAdapter } from '@/adapters/redhat-csaf';
import csafFixture from '../../fixtures/redhat/csaf-advisory-sample.json';

const adapter = new RedHatCsafAdapter();

describe('RedHatCsafAdapter — advisory-first ingestion', () => {
  it('emits exactly one advisory per errata document', () => {
    const items = adapter.parse([csafFixture]);

    expect(items).toHaveLength(1);
    expect(items[0].advisoryId).toBe('RHSA-2023:5455');
  });

  it('carries every CVE the advisory fixes', () => {
    const [item] = adapter.parse([csafFixture]);

    expect(item.cves.map((c) => c.cveId).sort()).toEqual(['CVE-2023-4527', 'CVE-2023-4911']);
  });

  it('reads advisory metadata from the CSAF document section', () => {
    const [item] = adapter.parse([csafFixture]);

    expect(item.title).toContain('glibc security update');
    expect(item.severity).toBe('HIGH'); // aggregate_severity "Important"
    expect(item.publishedAt).toBe('2023-10-05T14:14:13+00:00');
    expect(item.url).toBe('https://access.redhat.com/errata/RHSA-2023:5455');
    expect(item.summary).toContain('An update for glibc is now available');
  });

  it('reads per-CVE score, vector and description', () => {
    const [item] = adapter.parse([csafFixture]);
    const ldso = item.cves.find((c) => c.cveId === 'CVE-2023-4911')!;

    expect(ldso.cvssScore).toBe(7.8);
    expect(ldso.cvssVector).toBe('CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H');
    expect(ldso.severity).toBe('HIGH');
    expect(ldso.description).toContain('dynamic loader ld.so');
  });

  it('resolves affected products and components from the product tree', () => {
    const [item] = adapter.parse([csafFixture]);
    const impacts = item.cves.find((c) => c.cveId === 'CVE-2023-4911')!.productImpacts || [];

    // composite ids resolve to the human product name, not the raw branch id
    expect(impacts.some((p) => p.product_name === 'Red Hat Enterprise Linux BaseOS (v. 8)')).toBe(true);
    // the package NVR is reduced to a base component name
    expect(impacts.some((p) => p.component === 'glibc')).toBe(true);
    expect(impacts.every((p) => !p.product_name.includes('BaseOS-8.8.0'))).toBe(true);
    // product_status key "fixed" becomes a readable state
    expect(impacts.every((p) => p.state === 'Fixed')).toBe(true);
  });

  it('drops debug artifacts and deduplicates the impact matrix', () => {
    const [item] = adapter.parse([csafFixture]);
    const impacts = item.cves.find((c) => c.cveId === 'CVE-2023-4527')!.productImpacts || [];

    expect(impacts.some((p) => p.component.includes('debuginfo'))).toBe(false);

    const keys = impacts.map((p) => `${p.product_name}|${p.component}|${p.state}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('extracts the vendor fix and the workaround separately', () => {
    const [item] = adapter.parse([csafFixture]);

    expect(item.solution).toContain('access.redhat.com/articles/11258');
    expect(item.mitigation).toContain('no-aaaa');
  });

  it('ignores malformed payloads without throwing', () => {
    expect(adapter.parse([])).toEqual([]);
    expect(adapter.parse(null)).toEqual([]);
    expect(adapter.parse([{}])).toEqual([]);
  });
});
