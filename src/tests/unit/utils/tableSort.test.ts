import { describe, it, expect } from 'vitest';
import { sortRows, nextSort, dateSortValue } from '@/utils/tableSort';

describe('sortRows', () => {
  const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

  it('orders CVE ids by their numeric parts, not as plain text', () => {
    const rows = [{ id: 'CVE-2026-10000' }, { id: 'CVE-2026-9999' }, { id: 'CVE-2025-50000' }];
    expect(ids(sortRows(rows, (r) => r.id, 'asc'))).toEqual(['CVE-2025-50000', 'CVE-2026-9999', 'CVE-2026-10000']);
    expect(ids(sortRows(rows, (r) => r.id, 'desc'))).toEqual(['CVE-2026-10000', 'CVE-2026-9999', 'CVE-2025-50000']);
  });

  it('ignores letter case for text', () => {
    const rows = [{ id: 'openssl' }, { id: 'Kernel' }, { id: 'bash' }];
    expect(ids(sortRows(rows, (r) => r.id, 'asc'))).toEqual(['bash', 'Kernel', 'openssl']);
  });

  it('keeps rows without a value at the end in both directions', () => {
    const rows = [{ id: 'b', v: 2 }, { id: 'none', v: null }, { id: 'a', v: 1 }];
    expect(ids(sortRows(rows, (r) => r.v, 'asc'))).toEqual(['a', 'b', 'none']);
    expect(ids(sortRows(rows, (r) => r.v, 'desc'))).toEqual(['b', 'a', 'none']);
  });

  it('does not mutate the input and keeps ties in input order', () => {
    const rows = [{ id: 'x', v: 1 }, { id: 'y', v: 1 }, { id: 'z', v: 0 }];
    expect(ids(sortRows(rows, (r) => r.v, 'asc'))).toEqual(['z', 'x', 'y']);
    expect(ids(rows)).toEqual(['x', 'y', 'z']);
  });
});

describe('dateSortValue', () => {
  it('turns ISO dates into comparable numbers and missing or bad dates into null', () => {
    expect(dateSortValue('2026-08-02T00:00:00Z')).toBeGreaterThan(dateSortValue('2026-08-01T00:00:00Z')!);
    expect(dateSortValue(undefined)).toBeNull();
    expect(dateSortValue('not a date')).toBeNull();
  });
});

describe('nextSort', () => {
  it('starts a new column in its default direction', () => {
    expect(nextSort(null, 'date', 'desc')).toEqual({ key: 'date', direction: 'desc' });
    expect(nextSort({ key: 'date', direction: 'desc' }, 'cve', 'asc')).toEqual({ key: 'cve', direction: 'asc' });
  });

  it('flips the direction when the same column is clicked again', () => {
    expect(nextSort({ key: 'date', direction: 'desc' }, 'date', 'desc')).toEqual({ key: 'date', direction: 'asc' });
    expect(nextSort({ key: 'date', direction: 'asc' }, 'date', 'desc')).toEqual({ key: 'date', direction: 'desc' });
  });
});
