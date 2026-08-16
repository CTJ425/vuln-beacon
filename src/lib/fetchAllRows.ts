export const SUPABASE_PAGE_SIZE = 1000;

// PostgREST caps a bare select() at 1000 rows and truncates silently, so
// callers must page through .range(from, to) to read every row.
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>
): Promise<{ data: T[] | null; error: any }> {
  const allRows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await page(from, from + SUPABASE_PAGE_SIZE - 1);

    if (error) {
      return { data: null, error };
    }

    if (!data || data.length === 0) {
      break;
    }

    allRows.push(...data);

    if (data.length < SUPABASE_PAGE_SIZE) {
      break;
    }

    from += SUPABASE_PAGE_SIZE;
  }

  return { data: allRows, error: null };
}
