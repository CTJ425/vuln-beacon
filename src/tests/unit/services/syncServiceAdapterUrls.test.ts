import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
    functions: { invoke: (...args: any[]) => mockInvoke(...args) },
  },
}));

vi.mock('@/services/webhook', () => ({
  WebhookService: vi.fn().mockImplementation(() => ({
    clearWebhooks: vi.fn(),
    registerWebhook: vi.fn(),
  })),
}));

import { SyncService, SYNCED_VENDOR_CODES } from '@/services/syncService';
import { RedHatCsafAdapter } from '@/adapters/redhat-csaf';

/**
 * TASK-13. The Sync page reads endpoint URLs from the adapter. That is only honest if the
 * sync path fetches those same URLs instead of its own hardcoded copies.
 */
const adapter = new RedHatCsafAdapter();

describe('SyncService builds its request URLs from the adapter', () => {
  beforeEach(() => {
    mockInvoke.mockReset().mockResolvedValue({ data: { success: true, log: null }, error: null });
    mockFrom.mockReset().mockImplementation(() => ({
      select: () => {
        const query: any = Promise.resolve({ data: [], error: null });
        query.range = () => query;
        query.eq = () => query;
        query.order = () => query;
        return query;
      },
    }));
  });

  it('publishes the vendor codes it actually syncs', () => {
    expect([...SYNCED_VENDOR_CODES]).toEqual(['redhat', 'nutanix']);
  });

  it('looks a CVE up through the adapter reverse-lookup url', async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: any) => {
        seen.push(String(url));
        return { ok: true, json: async () => [] };
      })
    );

    await new SyncService().fetchAndIngestQuery('CVE-2026-1');

    expect(seen[0]).toBe(adapter.cveLookupUrl('CVE-2026-1'));
    vi.unstubAllGlobals();
  });

  it('fetches an errata id through the adapter detail url', async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: any) => {
        seen.push(String(url));
        return { ok: true, json: async () => ({ document: { tracking: { id: 'RHSA-2026:1' } } }) };
      })
    );

    await new SyncService().fetchAndIngestQuery('RHSA-2026:1');

    expect(seen[0]).toBe(adapter.advisoryDetailUrl('RHSA-2026:1'));
    vi.unstubAllGlobals();
  });

  it('fetches a Nutanix NXSA advisory through the Nutanix adapter detail url', async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: any) => {
        seen.push(String(url));
        return { ok: true, json: async () => ({ advisory_id: 'NXSA-AOS-1.0', cvelist: [{ cve_id: 'CVE-2026-1' }] }) };
      })
    );

    await new SyncService().fetchAndIngestQuery('NXSA-AOS-1.0');

    expect(seen[0]).toBe('https://portal.nutanix.com/api/v1/advisory?id=NXSA-AOS-1.0');
    vi.unstubAllGlobals();
  });

  it('leaves no hardcoded Red Hat or Nutanix url literals in the service source', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    // cwd differs between `npm --prefix src test` (src/) and a repo-root vitest run.
    const candidates = ['services/syncService.ts', 'src/services/syncService.ts'];
    let src = '';
    for (const rel of candidates) {
      try {
        src = await fs.readFile(path.join(process.cwd(), rel), 'utf8');
        break;
      } catch {
        /* try the next candidate */
      }
    }
    expect(src.length).toBeGreaterThan(0);
    expect(src).not.toContain('https://access.redhat.com');
    expect(src).not.toContain('https://portal.nutanix.com');
  });
});
