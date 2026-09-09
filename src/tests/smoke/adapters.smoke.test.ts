import { describe, it, expect } from 'vitest';
import { ALL_ADAPTERS, getAdapterByCode } from '@/adapters';

describe('Adapters Registry Smoke Test', () => {
  it('should register implemented vendor adapters (Red Hat, Nutanix)', () => {
    expect(ALL_ADAPTERS.length).toBeGreaterThanOrEqual(2);
    const codes = ALL_ADAPTERS.map((a) => a.vendorCode);
    expect(codes).toContain('redhat');
    expect(codes).toContain('nutanix');
  });

  it('should allow retrieval of adapters by code', () => {
    for (const code of ['redhat', 'nutanix']) {
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
  }, 15000);
});
