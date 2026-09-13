import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
    functions: { invoke: (...args: any[]) => mockInvoke(...args) },
  },
}));

import { SyncService } from '@/services/syncService';
import nutanixFixture from '../../fixtures/nutanix/nutanix-advisory-sample.json';

describe('SyncService — Nutanix integration', () => {
  beforeEach(() => {
    mockInvoke.mockReset().mockResolvedValue({
      data: {
        success: true,
        log: {
          id: 'log-nutanix-1',
          vendor_code: 'nutanix',
          status: 'SUCCESS',
          items_fetched: 1,
          new_items_count: 2,
        },
      },
      error: null,
    });
    mockFrom.mockReset().mockImplementation(() => ({
      select: () =>
        Object.assign(Promise.resolve({ data: [], error: null }), {
          range: () => Promise.resolve({ data: [], error: null }),
          eq: () => Promise.resolve({ data: [], error: null }),
          order: () => Promise.resolve({ data: [], error: null }),
        }),
    }));
  });

  it('fetchAndIngestQuery with NXSA- advisory id queries Nutanix API and persists ingestion', async () => {
    const fetchSpy = vi.fn(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('NXSA-AOS-7.5.1.12')) {
        return {
          ok: true,
          status: 200,
          json: async () => nutanixFixture,
        };
      }
      return { ok: false, status: 404 };
    });
    vi.stubGlobal('fetch', fetchSpy);

    const service = new SyncService();
    const ok = await service.fetchAndIngestQuery('NXSA-AOS-7.5.1.12');

    expect(ok).toBe(true);
    expect(mockInvoke).toHaveBeenCalled();

    const lastCall = mockInvoke.mock.calls[0];
    expect(lastCall[0]).toBe('sync-cve');
    expect(lastCall[1].body.action).toBe('persist_ingestion');
    expect(lastCall[1].body.vendorCode).toBe('nutanix');
    expect(lastCall[1].body.advisories[0].advisory_id).toBe('NXSA-AOS-7.5.1.12');
    expect(lastCall[1].body.cves).toHaveLength(2);

    vi.unstubAllGlobals();
  });

  it('fetchAndIngestQuery falls back to Nutanix when Red Hat does not find the CVE', async () => {
    const fetchSpy = vi.fn(async (url: any, options?: any) => {
      const urlStr = String(url);
      // Red Hat lookup returns empty
      if (urlStr.includes('access.redhat.com')) {
        return { ok: true, status: 200, json: async () => [] };
      }
      // Nutanix vulnerability search
      if (urlStr.includes('/api/v1/vulnerabilities') && options?.method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            vulnerabilities: [
              {
                productName: 'AOS',
                fixedReleases: ['7.5.1.12'],
                cveList: ['CVE-2026-33416'],
              },
            ],
          }),
        };
      }
      // Nutanix advisory detail
      if (urlStr.includes('NXSA-AOS-7.5.1.12')) {
        return {
          ok: true,
          status: 200,
          json: async () => nutanixFixture,
        };
      }
      return { ok: false, status: 404 };
    });
    vi.stubGlobal('fetch', fetchSpy);

    const service = new SyncService();
    const ok = await service.fetchAndIngestQuery('CVE-2026-33416');

    expect(ok).toBe(true);
    expect(mockInvoke).toHaveBeenCalled();

    const invokeCall = mockInvoke.mock.calls[0];
    expect(invokeCall[1].body.vendorCode).toBe('nutanix');

    vi.unstubAllGlobals();
  });

  it('syncVendors with nutanix triggers Nutanix adapter ingestion and persists', async () => {
    const mockList = {
      advisories: [{ advisory_id: 'NXSA-AOS-7.5.1.12' }],
      totalCount: 1,
    };

    const fetchSpy = vi.fn(async (url: any, options?: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/advisories') && options?.method === 'POST') {
        return { ok: true, status: 200, json: async () => mockList };
      }
      if (urlStr.includes('NXSA-AOS-7.5.1.12')) {
        return { ok: true, status: 200, json: async () => nutanixFixture };
      }
      return { ok: false, status: 404 };
    });
    vi.stubGlobal('fetch', fetchSpy);

    const service = new SyncService();
    const result = await service.syncVendors(['nutanix']);

    expect(result.success).toBe(true);
    expect(mockInvoke).toHaveBeenCalled();

    const callWithData = mockInvoke.mock.calls.find(
      (c) => c[1].body.vendorCode === 'nutanix' && c[1].body.advisories?.length > 0
    );
    expect(callWithData).toBeDefined();
    expect(callWithData![1].body.advisories[0].advisory_id).toBe('NXSA-AOS-7.5.1.12');

    vi.unstubAllGlobals();
  });

  it('syncVendors() by default syncs all vendors in SYNCED_VENDOR_CODES including nutanix', async () => {
    const mockList = {
      advisories: [{ advisory_id: 'NXSA-AOS-7.5.1.12' }],
      totalCount: 1,
    };

    const fetchSpy = vi.fn(async (url: any, options?: any) => {
      const urlStr = String(url);
      if (urlStr.includes('access.redhat.com')) {
        return { ok: true, status: 200, json: async () => [] };
      }
      if (urlStr.includes('/api/v1/advisories') && options?.method === 'POST') {
        return { ok: true, status: 200, json: async () => mockList };
      }
      if (urlStr.includes('NXSA-AOS-7.5.1.12')) {
        return { ok: true, status: 200, json: async () => nutanixFixture };
      }
      if (urlStr.includes('ubuntu.com')) {
        return { ok: true, status: 200, json: async () => ({ notices: [] }) };
      }
      if (urlStr.includes('debian.org') || urlStr.includes('salsa.debian.org')) {
        return { ok: true, status: 200, text: async () => '' };
      }
      if (urlStr.includes('suse.com')) {
        return { ok: true, status: 200, text: async () => '' };
      }
      if (urlStr.includes('cisco.com')) {
        return { ok: true, status: 200, text: async () => '' };
      }
      if (urlStr.includes('support.broadcom.com')) {
        return { ok: true, status: 200, json: async () => ({ data: { list: [] } }) };
      }
      return { ok: false, status: 404 };
    });
    vi.stubGlobal('fetch', fetchSpy);

    const service = new SyncService();
    const result = await service.syncVendors();

    expect(result.success).toBe(true);
    // Verified both redhat and nutanix invoked
    const invokedVendors = mockInvoke.mock.calls.map((c) => c[1]?.body?.vendorCode);
    expect(invokedVendors).toContain('redhat');
    expect(invokedVendors).toContain('nutanix');

    vi.unstubAllGlobals();
  });

  it('fetchAndIngestQuery properly strips AHV prefix from fixedReleases to form NXSA-AHV-11.2', async () => {
    const fetchSpy = vi.fn(async (url: any, options?: any) => {
      const urlStr = String(url);
      if (urlStr.includes('access.redhat.com')) {
        return { ok: true, status: 200, json: async () => [] };
      }
      if (urlStr.includes('/api/v1/vulnerabilities') && options?.method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            vulnerabilities: [
              {
                productName: 'AHV',
                fixedReleases: ['AHV-11.2'],
                cveList: ['CVE-2026-33416'],
              },
            ],
          }),
        };
      }
      if (urlStr.includes('NXSA-AHV-11.2')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ...nutanixFixture,
            advisory_id: 'NXSA-AHV-11.2',
            product: 'AHV',
          }),
        };
      }
      return { ok: false, status: 404 };
    });
    vi.stubGlobal('fetch', fetchSpy);

    const service = new SyncService();
    const ok = await service.fetchAndIngestQuery('CVE-2026-33416');

    expect(ok).toBe(true);
    const nutanixCall = mockInvoke.mock.calls.find(
      (c) => c[1].body.vendorCode === 'nutanix' && c[1].body.advisories?.[0]?.advisory_id === 'NXSA-AHV-11.2'
    );
    expect(nutanixCall).toBeDefined();

    vi.unstubAllGlobals();
  });
});
