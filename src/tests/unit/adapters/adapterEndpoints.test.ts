import { describe, it, expect } from 'vitest';
import { RedHatCsafAdapter } from '@/adapters/redhat-csaf';
import { getAdapterByCode, ALL_ADAPTERS } from '@/adapters';

/**
 * TASK-13. The Sync page must show which vendor API is actually contacted. The URLs
 * therefore have to come from the adapter itself — a copy typed into the UI would drift
 * from the code that does the fetching and would show the user something untrue.
 */
const adapter = new RedHatCsafAdapter();
const BASE = 'https://access.redhat.com/hydra/rest/securitydata/csaf';

describe('RedHatCsafAdapter describes its own endpoints', () => {
  it('exposes exactly three endpoints', () => {
    expect(adapter.endpoints).toHaveLength(3);
  });

  it('labels every endpoint and points every one at the Red Hat CSAF API', () => {
    for (const ep of adapter.endpoints) {
      expect(ep.label.length).toBeGreaterThan(0);
      expect(ep.url.startsWith(BASE)).toBe(true);
    }
  });

  it('covers the list, detail and CVE-lookup shapes', () => {
    const urls = adapter.endpoints.map((e) => e.url);
    expect(urls).toContain(`${BASE}.json?per_page=50`);
    expect(urls).toContain(`${BASE}/{advisoryId}.json`);
    expect(urls).toContain(`${BASE}.json?cve={cveId}`);
  });

  it('derives the endpoint urls from its own url fields rather than re-typed literals', () => {
    for (const ep of adapter.endpoints) {
      const derived =
        ep.url.startsWith(adapter.listUrl) || ep.url.startsWith(adapter.detailUrlBase);
      expect(derived).toBe(true);
    }
  });

  it('builds a detail url for one advisory', () => {
    expect(adapter.advisoryDetailUrl('RHSA-2026:1')).toBe(`${BASE}/RHSA-2026:1.json`);
  });

  it('builds a reverse-lookup url for one CVE', () => {
    expect(adapter.cveLookupUrl('CVE-2026-1')).toBe(`${BASE}.json?cve=CVE-2026-1`);
  });

  it('is reachable through the registry by vendor code', () => {
    const found = getAdapterByCode('redhat');
    expect(found).toBeDefined();
    expect(found!.endpoints).toHaveLength(3);
  });

  it('gives every registered adapter an endpoints list', () => {
    for (const a of ALL_ADAPTERS) {
      expect(Array.isArray(a.endpoints)).toBe(true);
      expect(a.endpoints.length).toBeGreaterThan(0);
    }
  });

  it('has no adapter for a seeded vendor that is not implemented', () => {
    expect(getAdapterByCode('vmware')).toBeUndefined();
  });
});
