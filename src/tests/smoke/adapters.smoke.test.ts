import { describe, it, expect } from 'vitest';
import { ALL_ADAPTERS, getAdapterByCode } from '@/adapters';

describe('Adapters Registry Smoke Test', () => {
  it('should register Red Hat vendor adapter', () => {
    expect(ALL_ADAPTERS).toHaveLength(1);
    expect(ALL_ADAPTERS[0].vendorCode).toBe('redhat');
  });

  it('should allow retrieval of redhat adapter by its code', () => {
    const adapter = getAdapterByCode('redhat');
    expect(adapter).toBeDefined();
    expect(adapter?.vendorCode).toBe('redhat');
    expect(typeof adapter?.fetchAdvisories).toBe('function');
    expect(typeof adapter?.parse).toBe('function');
  });

  it('should return undefined for unknown vendor code', () => {
    expect(getAdapterByCode('unknown_vendor')).toBeUndefined();
  });
});
