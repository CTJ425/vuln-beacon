export type SortDirection = 'asc' | 'desc';

export interface SortState<K extends string = string> {
  key: K;
  direction: SortDirection;
}

export type SortValue = string | number | null | undefined;

// Numeric collation so CVE-2026-9999 sorts before CVE-2026-10000.
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

const isMissing = (v: SortValue): v is null | undefined | '' => v === null || v === undefined || v === '';

// Returns a sorted copy. Rows without a value stay at the end in both
// directions; ties keep their input order (Array.prototype.sort is stable).
export function sortRows<T>(rows: T[], value: (row: T) => SortValue, direction: SortDirection): T[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (isMissing(va) || isMissing(vb)) {
      return Number(isMissing(va)) - Number(isMissing(vb));
    }
    const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : collator.compare(String(va), String(vb));
    return cmp * sign;
  });
}

export function dateSortValue(dateString?: string | null): number | null {
  if (!dateString) return null;
  const time = Date.parse(dateString);
  return Number.isNaN(time) ? null : time;
}

// Clicking a new column starts in its default direction; clicking the active
// column flips it.
export function nextSort<K extends string>(
  current: SortState<K> | null,
  key: K,
  defaultDirection: SortDirection
): SortState<K> {
  if (current?.key === key) {
    return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { key, direction: defaultDirection };
}

export function ariaSort(current: SortState | null, key: string): 'ascending' | 'descending' | undefined {
  if (current?.key !== key) return undefined;
  return current.direction === 'asc' ? 'ascending' : 'descending';
}
