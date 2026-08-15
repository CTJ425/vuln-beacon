import { describe, it, expect } from 'vitest';
import { RedHatAdapter } from '@/adapters/redhat';

const adapter = new RedHatAdapter();

describe('RedHatAdapter emits one advisory per RHSA (not only the first)', () => {
  it('emits a separate normalized advisory for every RHSA that fixes the CVE', () => {
    const items = adapter.parse([
      {
        CVE: 'CVE-2026-1000',
        severity: 'important',
        public_date: '2026-08-01T00:00:00Z',
        advisories: ['RHSA-2026:1001', 'RHSA-2026:1002', 'RHSA-2026:1003'],
        bugzilla_description: 'openssl: example flaw',
        cvss3_score: '8.1',
        affected_packages: ['openssl-3.0.7-1.el9'],
      },
    ]);

    expect(items).toHaveLength(3);
    expect(items.map((i) => i.advisoryId).sort()).toEqual([
      'RHSA-2026:1001',
      'RHSA-2026:1002',
      'RHSA-2026:1003',
    ]);

    // every emitted advisory carries the CVE it fixes
    for (const item of items) {
      expect(item.cves).toHaveLength(1);
      expect(item.cves[0].cveId).toBe('CVE-2026-1000');
    }

    // each advisory links to its own errata page, not the first one's
    const second = items.find((i) => i.advisoryId === 'RHSA-2026:1002');
    expect(second?.url).toContain('RHSA-2026:1002');
  });

  it('groups two CVEs that share one RHSA under that same advisory id', () => {
    const items = adapter.parse([
      {
        CVE: 'CVE-2026-2001',
        severity: 'critical',
        public_date: '2026-08-02T00:00:00Z',
        advisories: ['RHSA-2026:2000'],
        bugzilla_description: 'kernel: flaw one',
        cvss3_score: '9.1',
      },
      {
        CVE: 'CVE-2026-2002',
        severity: 'critical',
        public_date: '2026-08-02T00:00:00Z',
        advisories: ['RHSA-2026:2000'],
        bugzilla_description: 'kernel: flaw two',
        cvss3_score: '9.0',
      },
    ]);

    const forThatAdvisory = items.filter((i) => i.advisoryId === 'RHSA-2026:2000');
    expect(forThatAdvisory).toHaveLength(2);
    expect(forThatAdvisory.flatMap((i) => i.cves.map((c) => c.cveId)).sort()).toEqual([
      'CVE-2026-2001',
      'CVE-2026-2002',
    ]);
  });

  it('falls back to the CVE id as advisory id when no errata has been released', () => {
    const items = adapter.parse([
      {
        CVE: 'CVE-2026-3000',
        severity: 'moderate',
        public_date: '2026-08-03T00:00:00Z',
        advisories: [],
        bugzilla_description: 'httpd: unreleased flaw',
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].advisoryId).toBe('CVE-2026-3000');
  });
});
