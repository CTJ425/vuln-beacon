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
import { getAdapterByCode } from '@/adapters';

const csafDoc = (id: string, cves: string[]) => ({
  document: {
    aggregate_severity: { text: 'Important' },
    title: `Red Hat Security Advisory: ${id} update`,
    notes: [{ category: 'summary', text: 'An update is available.', title: 'Topic' }],
    tracking: {
      id,
      initial_release_date: '2026-01-01T00:00:00+00:00',
      current_release_date: '2026-01-02T00:00:00+00:00',
    },
  },
  product_tree: { branches: [], relationships: [] },
  vulnerabilities: cves.map((cve) => ({
    cve,
    notes: [{ category: 'description', text: `${cve} description`, title: 'Vulnerability description' }],
    product_status: { fixed: ['BaseOS-9.0.Z:glibc-0:2.34-1.el9.x86_64'] },
    scores: [{ cvss_v3: { baseScore: 7.5, baseSeverity: 'HIGH', vectorString: 'CVSS:3.1/AV:N' } }],
    threats: [{ category: 'impact', details: 'Important' }],
    title: `${cve} title`,
  })),
});

describe('the redhat adapter registered for ingestion is advisory-first', () => {
  it('resolves the CSAF adapter for vendor code "redhat"', () => {
    const adapter = getAdapterByCode('redhat');
    expect(adapter).toBeDefined();
    expect(adapter!.constructor.name).toBe('RedHatCsafAdapter');
  });
});

describe('SyncService.fetchAndIngestQuery uses the CSAF endpoints', () => {
  beforeEach(() => {
    mockInvoke.mockReset().mockResolvedValue({ data: { success: true, log: { id: 'l1' } }, error: null });
    mockFrom.mockReset();
  });

  it('looks a CVE up through the advisory reverse index and ingests every advisory that fixes it', async () => {
    const calls: string[] = [];
    global.fetch = vi.fn(async (url: any) => {
      const u = String(url);
      calls.push(u);
      if (u.includes('csaf.json?cve=')) {
        return {
          ok: true,
          json: async () => [
            { RHSA: 'RHSA-2026:1001', severity: 'important', CVEs: ['CVE-2026-5000'] },
            { RHSA: 'RHSA-2026:1002', severity: 'important', CVEs: ['CVE-2026-5000', 'CVE-2026-5001'] },
          ],
        };
      }
      if (u.includes('/csaf/RHSA-2026:1001.json')) {
        return { ok: true, json: async () => csafDoc('RHSA-2026:1001', ['CVE-2026-5000']) };
      }
      if (u.includes('/csaf/RHSA-2026:1002.json')) {
        return { ok: true, json: async () => csafDoc('RHSA-2026:1002', ['CVE-2026-5000', 'CVE-2026-5001']) };
      }
      return { ok: false, json: async () => ({}) };
    }) as any;

    const ok = await new SyncService().fetchAndIngestQuery('CVE-2026-5000');

    expect(ok).toBe(true);
    // the reverse index endpoint was used, not the per-CVE security-data endpoint
    expect(calls.some((c) => c.includes('csaf.json?cve=CVE-2026-5000'))).toBe(true);
    expect(calls.some((c) => c.includes('/securitydata/cve/'))).toBe(false);

    // both advisories that fix the CVE were persisted
    const body = mockInvoke.mock.calls[0][1].body;
    expect(body.action).toBe('persist_ingestion');
    const ids = body.advisories.map((a: any) => a.advisory_id).sort();
    expect(ids).toEqual(['RHSA-2026:1001', 'RHSA-2026:1002']);
    // the second advisory contributes its other CVE too
    expect(body.cves.map((c: any) => c.cve_id).sort()).toEqual(['CVE-2026-5000', 'CVE-2026-5001']);
  });

  it('fetches an errata id directly from the CSAF detail endpoint', async () => {
    const calls: string[] = [];
    global.fetch = vi.fn(async (url: any) => {
      const u = String(url);
      calls.push(u);
      if (u.includes('/csaf/RHSA-2026:2002.json')) {
        return { ok: true, json: async () => csafDoc('RHSA-2026:2002', ['CVE-2026-6000', 'CVE-2026-6001']) };
      }
      return { ok: false, json: async () => ({}) };
    }) as any;

    const ok = await new SyncService().fetchAndIngestQuery('RHSA-2026:2002');

    expect(ok).toBe(true);
    expect(calls.some((c) => c.includes('/csaf/RHSA-2026:2002.json'))).toBe(true);

    const body = mockInvoke.mock.calls[0][1].body;
    expect(body.advisories).toHaveLength(1);
    expect(body.cves.map((c: any) => c.cve_id).sort()).toEqual(['CVE-2026-6000', 'CVE-2026-6001']);
  });

  it('returns false when the reverse index finds no advisory', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => [] })) as any;

    const ok = await new SyncService().fetchAndIngestQuery('CVE-2026-9999');

    expect(ok).toBe(false);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('returns false when the errata id does not exist', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, json: async () => ({}) })) as any;

    const ok = await new SyncService().fetchAndIngestQuery('RHSA-2026:0000');

    expect(ok).toBe(false);
  });
});
