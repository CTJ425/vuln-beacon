import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: { from: (...args: any[]) => mockFrom(...args) },
}));

import { AdvisoryService } from '@/services/advisoryService';
import { CveService } from '@/services/cveService';

const PAGE_SIZE = 1000;
const TOTAL = 1500;

/**
 * PostgREST caps a bare `.select()` at 1000 rows and truncates silently.
 * This mock serves rows only through `.range(from, to)`, so a service that
 * does not paginate reads nothing at all.
 */
const paginatedFrom = (total: number, makeRow: (i: number) => any) => {
  const rangeCalls: [number, number][] = [];
  const orderCalls: string[] = [];
  const orderChain: any = {
    order: (column: string) => {
      orderCalls.push(column);
      return orderChain;
    },
    range: (from: number, to: number) => {
      rangeCalls.push([from, to]);
      const end = Math.min(to, total - 1);
      const rows = [];
      for (let i = from; i <= end; i += 1) rows.push(makeRow(i));
      return Promise.resolve({ data: rows, error: null });
    },
  };
  const chain = { select: () => orderChain };
  return { chain, rangeCalls, orderCalls };
};

const advisoryRow = (i: number) => ({
  id: `a${i}`,
  advisory_id: `RHSA-2026:${1000 + i}`,
  title: `advisory ${i}`,
  severity: 'IMPORTANT',
  published_at: '2026-08-02T00:00:00Z',
  url: 'https://access.redhat.com/errata/x',
  summary: 'summary',
  vendor_id: 'redhat',
  vendors: { code: 'redhat', name: 'Red Hat' },
  advisory_cve_map: [],
});

const cveRow = (i: number) => ({
  id: `c${i}`,
  cve_id: `CVE-2026-${1000 + i}`,
  description: `flaw ${i}`,
  cvss_v3_score: 7.5,
  severity: 'IMPORTANT',
  is_known_exploited: false,
  published_date: '2026-08-02T00:00:00Z',
  last_modified_date: '2026-08-02T00:00:00Z',
  created_at: '2026-08-02T00:00:00Z',
  advisory_cve_map: [],
});

describe('read path pages past the PostgREST 1000-row cap', () => {
  beforeEach(() => mockFrom.mockReset());

  it('fetchAdvisories returns every row, not just the first page', async () => {
    const { chain, rangeCalls } = paginatedFrom(TOTAL, advisoryRow);
    mockFrom.mockReturnValue(chain);

    const advisories = await new AdvisoryService().fetchAdvisories();

    expect(advisories).toHaveLength(TOTAL);
    expect(rangeCalls[0]).toEqual([0, PAGE_SIZE - 1]);
    expect(rangeCalls[1]).toEqual([PAGE_SIZE, PAGE_SIZE * 2 - 1]);
  });

  it('fetchCves returns every row, not just the first page', async () => {
    const { chain, rangeCalls } = paginatedFrom(TOTAL, cveRow);
    mockFrom.mockReturnValue(chain);

    const cves = await new CveService().fetchCves();

    expect(cves).toHaveLength(TOTAL);
    expect(rangeCalls[0]).toEqual([0, PAGE_SIZE - 1]);
  });

  // Paging issues one request per page. Without a unique tiebreaker, rows sharing
  // a timestamp can be reordered between requests and land twice, or not at all.
  // Single-page fixtures here: the query is rebuilt per page, so a multi-page
  // fixture would record the same order columns once per page.
  it('orders advisories by a unique tiebreaker so pages do not overlap', async () => {
    const { chain, orderCalls } = paginatedFrom(10, advisoryRow);
    mockFrom.mockReturnValue(chain);

    await new AdvisoryService().fetchAdvisories();

    expect(orderCalls).toEqual(['published_at', 'id']);
  });

  it('orders cves by a unique tiebreaker so pages do not overlap', async () => {
    const { chain, orderCalls } = paginatedFrom(10, cveRow);
    mockFrom.mockReturnValue(chain);

    await new CveService().fetchCves();

    expect(orderCalls).toEqual(['published_date', 'id']);
  });

  it('rebuilds the query for each page instead of reusing one builder', async () => {
    const { chain, orderCalls } = paginatedFrom(TOTAL, advisoryRow);
    mockFrom.mockReturnValue(chain);

    await new AdvisoryService().fetchAdvisories();

    // 2 pages x 2 order columns — a reused builder would record only 2.
    expect(orderCalls).toEqual(['published_at', 'id', 'published_at', 'id']);
  });

  it('stops paging when a page comes back short, without an extra request', async () => {
    const { chain, rangeCalls } = paginatedFrom(10, advisoryRow);
    mockFrom.mockReturnValue(chain);

    const advisories = await new AdvisoryService().fetchAdvisories();

    expect(advisories).toHaveLength(10);
    expect(rangeCalls).toHaveLength(1);
  });

  it('returns an empty list when the first page errors', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        order: () => ({
          range: () => Promise.resolve({ data: null, error: { message: 'boom' } }),
        }),
      }),
    });

    expect(await new AdvisoryService().fetchAdvisories()).toEqual([]);
  });
});
