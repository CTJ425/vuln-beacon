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
import ubuntuFixture from '../../fixtures/ubuntu/ubuntu-notice-sample.json';
import debianFixture from '../../fixtures/debian/debian-dsa-sample.json';
import suseFixture from '../../fixtures/suse/suse-csaf-sample.json';

describe('SyncService — Ubuntu, Debian, and SUSE On-Demand Queries', () => {
  beforeEach(() => {
    mockInvoke.mockReset().mockResolvedValue({
      data: {
        success: true,
        log: {
          id: 'log-test-1',
          vendor_code: 'ubuntu',
          status: 'SUCCESS',
          items_fetched: 1,
          new_items_count: 1,
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

  it('fetchAndIngestQuery with USN- advisory id fetches Ubuntu notice and persists ingestion', async () => {
    const fetchSpy = vi.fn(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('ubuntu.com/security/notices/USN-8747-1.json')) {
        return {
          ok: true,
          status: 200,
          json: async () => ubuntuFixture,
        };
      }
      return { ok: false, status: 404 };
    });
    vi.stubGlobal('fetch', fetchSpy);

    const service = new SyncService();
    const ok = await service.fetchAndIngestQuery('USN-8747-1');

    expect(ok).toBe(true);
    expect(mockInvoke).toHaveBeenCalled();

    const lastCall = mockInvoke.mock.calls[0];
    expect(lastCall[0]).toBe('sync-cve');
    expect(lastCall[1].body.action).toBe('persist_ingestion');
    expect(lastCall[1].body.vendorCode).toBe('ubuntu');
    expect(lastCall[1].body.advisories[0].advisory_id).toBe('USN-8747-1');
    expect(lastCall[1].body.cves[0].cve_id).toBe('CVE-2026-42052');

    vi.unstubAllGlobals();
  });

  it('fetchAndIngestQuery with DSA- advisory id fetches Debian DSA and persists ingestion', async () => {
    const fetchSpy = vi.fn(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('DSA/list')) {
        return {
          ok: true,
          status: 200,
          text: async () => debianFixture.dsaListSample,
        };
      }
      return { ok: false, status: 404 };
    });
    vi.stubGlobal('fetch', fetchSpy);

    const service = new SyncService();
    const ok = await service.fetchAndIngestQuery('DSA-6492-1');

    expect(ok).toBe(true);
    expect(mockInvoke).toHaveBeenCalled();

    const lastCall = mockInvoke.mock.calls[0];
    expect(lastCall[0]).toBe('sync-cve');
    expect(lastCall[1].body.action).toBe('persist_ingestion');
    expect(lastCall[1].body.vendorCode).toBe('debian');
    expect(lastCall[1].body.advisories[0].advisory_id).toBe('DSA-6492-1');
    expect(lastCall[1].body.cves.some((c: any) => c.cve_id === 'CVE-2026-26961')).toBe(true);

    vi.unstubAllGlobals();
  });

  it('fetchAndIngestQuery with SUSE-SU- hyphenated id fetches CSAF document and persists ingestion', async () => {
    const fetchSpy = vi.fn(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('suse-su-2026_3951-1.json')) {
        return {
          ok: true,
          status: 200,
          json: async () => suseFixture,
        };
      }
      return { ok: false, status: 404 };
    });
    vi.stubGlobal('fetch', fetchSpy);

    const service = new SyncService();
    const ok = await service.fetchAndIngestQuery('SUSE-SU-2026-3951-1');

    expect(ok).toBe(true);
    expect(mockInvoke).toHaveBeenCalled();

    const lastCall = mockInvoke.mock.calls[0];
    expect(lastCall[0]).toBe('sync-cve');
    expect(lastCall[1].body.action).toBe('persist_ingestion');
    expect(lastCall[1].body.vendorCode).toBe('suse');
    expect(lastCall[1].body.advisories[0].advisory_id).toBe('SUSE-SU-2026:3951-1');
    expect(lastCall[1].body.cves[0].cve_id).toBe('CVE-2026-32147');

    vi.unstubAllGlobals();
  });

  it('fetchAndIngestQuery falls back to Debian reverse lookup when not in Red Hat, Nutanix, or Ubuntu', async () => {
    const fetchSpy = vi.fn(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('access.redhat.com')) {
        return { ok: true, status: 200, json: async () => [] };
      }
      if (urlStr.includes('ubuntu.com')) {
        return { ok: false, status: 404 };
      }
      if (urlStr.includes('DSA/list')) {
        return {
          ok: true,
          status: 200,
          text: async () => debianFixture.dsaListSample,
        };
      }
      return { ok: false, status: 404 };
    });
    vi.stubGlobal('fetch', fetchSpy);

    const service = new SyncService();
    const ok = await service.fetchAndIngestQuery('CVE-2026-26961');

    expect(ok).toBe(true);
    expect(mockInvoke).toHaveBeenCalled();

    const lastCall = mockInvoke.mock.calls[0];
    expect(lastCall[1].body.vendorCode).toBe('debian');
    expect(lastCall[1].body.advisories[0].advisory_id).toBe('DSA-6492-1');
    expect(lastCall[1].body.cves.some((c: any) => c.cve_id === 'CVE-2026-26961')).toBe(true);

    vi.unstubAllGlobals();
  });
});
