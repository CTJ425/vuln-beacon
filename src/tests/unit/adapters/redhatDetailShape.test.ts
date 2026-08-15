import { describe, it, expect } from 'vitest';
import { RedHatAdapter } from '@/adapters/redhat';
import detailFixture from '../../fixtures/redhat/cve-detail-sample.json';

const adapter = new RedHatAdapter();

/**
 * The Red Hat "CVE detail" endpoint (/cve/<id>.json) has a different shape from
 * the "CVE list" endpoint (/cve.json): the id lives in `name` (not `CVE`),
 * severity in `threat_severity`, the score nested under `cvss3`, and bugzilla
 * is an object rather than a string. `fetchAndIngestQuery()` feeds this exact
 * payload straight into `parse()`, so the adapter must understand it.
 */
describe('RedHatAdapter parses the CVE detail payload shape', () => {
  it('reads the CVE id from `name` instead of dropping the record', () => {
    const items = adapter.parse([detailFixture]);

    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.cves[0].cveId).toBe('CVE-2023-4911');
    }
  });

  it('emits one advisory per distinct RHSA found in affected_release', () => {
    const items = adapter.parse([detailFixture]);

    expect(items.map((i) => i.advisoryId).sort()).toEqual([
      'RHSA-2023:5453',
      'RHSA-2023:5455',
    ]);
  });

  it('reads the CVSS score and vector from the nested cvss3 object', () => {
    const [item] = adapter.parse([detailFixture]);

    expect(item.cves[0].cvssScore).toBe(7.8);
    expect(item.cves[0].cvssVector).toBe('CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H');
    // 7.8 falls in the HIGH band
    expect(item.severity).toBe('HIGH');
  });

  it('reads the description from the bugzilla object', () => {
    const [item] = adapter.parse([detailFixture]);

    expect(item.cves[0].description).toContain('buffer overflow in ld.so');
  });

  it('still carries the package_state and affected_release impact matrix', () => {
    const [item] = adapter.parse([detailFixture]);
    const impacts = item.cves[0].productImpacts || [];

    expect(impacts.some((p) => p.state === 'Not affected' && p.component === 'glibc')).toBe(true);
    expect(impacts.some((p) => p.state === 'Fixed')).toBe(true);
  });

  it('keeps parsing the list-endpoint shape unchanged', () => {
    const items = adapter.parse([
      {
        CVE: 'CVE-2026-9999',
        severity: 'important',
        public_date: '2026-01-01T00:00:00Z',
        advisories: ['RHSA-2026:9999'],
        bugzilla_description: 'legacy list shape still works',
        cvss3_score: '7.5',
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].cves[0].cveId).toBe('CVE-2026-9999');
    expect(items[0].cves[0].description).toBe('legacy list shape still works');
  });
});
