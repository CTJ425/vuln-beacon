import { describe, it, expect } from 'vitest';
import { RedHatAdapter } from '@/adapters/redhat';
import redhatFixture from '../../fixtures/redhat/cve-sample.json';

describe('RedHatAdapter', () => {
  const adapter = new RedHatAdapter();

  it('should have correct vendor identity', () => {
    expect(adapter.vendorCode).toBe('redhat');
    expect(adapter.vendorName).toBe('Red Hat');
  });

  it('should parse raw Red Hat API payload into normalized advisories and CVEs', () => {
    const items = adapter.parse(redhatFixture);
    expect(items).toHaveLength(2);

    const first = items[0];
    expect(first.advisoryId).toBe('RHSA-2024:6821');
    expect(first.title).toContain('vCenter Server Remote Code Execution Vulnerability');
    expect(first.severity).toBe('CRITICAL');
    expect(first.cves).toHaveLength(1);
    expect(first.cves[0].cveId).toBe('CVE-2024-38812');
    expect(first.cves[0].cvssScore).toBe(9.8);
    expect(first.cves[0].affectedProducts).toContain('spring-framework-0:5.3.39-1.el9');
  });

  it('should handle empty or malformed payload gracefully', () => {
    expect(adapter.parse([])).toEqual([]);
    expect(adapter.parse(null)).toEqual([]);
    expect(adapter.parse({})).toEqual([]);
  });
});
