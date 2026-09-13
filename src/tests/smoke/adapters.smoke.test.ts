import { describe, it, expect } from 'vitest';
import { ALL_ADAPTERS, getAdapterByCode } from '@/adapters';

describe('Adapters Registry Smoke Test', () => {
  it('should register implemented vendor adapters (Red Hat, Nutanix, Ubuntu, Debian, SUSE, Cisco, VMware)', () => {
    expect(ALL_ADAPTERS.length).toBeGreaterThanOrEqual(7);
    const codes = ALL_ADAPTERS.map((a) => a.vendorCode);
    expect(codes).toContain('redhat');
    expect(codes).toContain('nutanix');
    expect(codes).toContain('ubuntu');
    expect(codes).toContain('debian');
    expect(codes).toContain('suse');
    expect(codes).toContain('cisco');
    expect(codes).toContain('vmware');
  });

  it('should allow retrieval of adapters by code', () => {
    for (const code of ['redhat', 'nutanix', 'ubuntu', 'debian', 'suse', 'cisco', 'vmware']) {
      const adapter = getAdapterByCode(code);
      expect(adapter).toBeDefined();
      expect(adapter?.vendorCode).toBe(code);
      expect(typeof adapter?.fetchAdvisories).toBe('function');
      expect(typeof adapter?.parse).toBe('function');
      expect(Array.isArray(adapter?.endpoints)).toBe(true);
    }
  });

  it('should return undefined for unknown vendor code', () => {
    expect(getAdapterByCode('unknown_vendor')).toBeUndefined();
  });

  it('should fetch and parse live Nutanix advisories from public portal API', async () => {
    const adapter = getAdapterByCode('nutanix');
    expect(adapter).toBeDefined();

    const items = await adapter!.fetchAdvisories(2);
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);

    const first = items[0];
    expect(first.advisoryId).toMatch(/^NXSA-/);
    expect(first.url).toContain('portal.nutanix.com');
    expect(first.cves.length).toBeGreaterThan(0);
  }, 30000);

  it('should fetch and parse live Ubuntu security notices from official API', async () => {
    const adapter = getAdapterByCode('ubuntu');
    expect(adapter).toBeDefined();

    const items = await adapter!.fetchAdvisories(2);
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);

    const first = items[0];
    expect(first.advisoryId).toMatch(/^(?:USN|LSN)-/);
    expect(first.url).toContain('ubuntu.com/security/notices');
    expect(first.cves.length).toBeGreaterThan(0);
  }, 30000);

  it('should fetch and parse live Debian advisories from official DSA list', async () => {
    const adapter = getAdapterByCode('debian');
    expect(adapter).toBeDefined();

    const items = await adapter!.fetchAdvisories(2);
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);

    const first = items[0];
    expect(first.advisoryId).toMatch(/^DSA-/);
    expect(first.url).toContain('security-tracker.debian.org');
    expect(first.cves.length).toBeGreaterThan(0);
  }, 30000);

  it('should fetch and parse live SUSE advisories from CSAF repository', async () => {
    const adapter = getAdapterByCode('suse');
    expect(adapter).toBeDefined();

    const items = await adapter!.fetchAdvisories(2);
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);

    const first = items[0];
    expect(first.advisoryId).toMatch(/^(?:SUSE|openSUSE)-/i);
    expect(first.cves.length).toBeGreaterThan(0);
  }, 30000);

  it('should fetch and parse live Cisco advisories from the CSAF repository', async () => {
    const adapter = getAdapterByCode('cisco');
    expect(adapter).toBeDefined();

    const items = await adapter!.fetchAdvisories(2);
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);

    const first = items[0];
    expect(first.advisoryId).toMatch(/^cisco-sa-/i);
    expect(first.cves.length).toBeGreaterThan(0);
  }, 30000);

  it('should fetch and parse live VMware advisories from the Broadcom support portal', async () => {
    const adapter = getAdapterByCode('vmware');
    expect(adapter).toBeDefined();

    const items = await adapter!.fetchAdvisories(2);
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);

    const first = items[0];
    expect(first.advisoryId).toMatch(/^VMSA-\d{4}-\d{4}/i);
    expect(first.url).toContain('support.broadcom.com');
  }, 60000);
});
