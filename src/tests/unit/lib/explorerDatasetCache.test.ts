import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: (...a: any[]) => mockRpc(...a) } }));

import { fetchExplorerDataset, readCachedDataset, writeCachedDataset } from '@/lib/explorerDataset';
import { dataset, dsAdvisory, dsCve, dsMapping } from '../../helpers/explorerDataset';

const sample = () =>
  dataset({ advisories: [dsAdvisory({ id: 'a1' })], cves: [dsCve({ id: 'c1' })], mappings: [dsMapping('a1', 'c1', null as any)] });

const clear = () =>
  new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('vulnbeacon');
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });

describe('explorer dataset browser cache', () => {
  beforeEach(async () => {
    mockRpc.mockReset();
    await clear();
  });

  it('has nothing cached on a first visit', async () => {
    expect(await readCachedDataset()).toBeNull();
  });

  it('stores every successful load for the next visit', async () => {
    mockRpc.mockResolvedValue({ data: sample(), error: null });
    await fetchExplorerDataset();
    expect(await readCachedDataset()).toEqual(sample());
  });

  it('keeps the previous copy when a load fails', async () => {
    await writeCachedDataset(sample());
    mockRpc.mockResolvedValue({ data: null, error: { message: 'offline' } });
    await expect(fetchExplorerDataset()).rejects.toBeTruthy();
    expect(await readCachedDataset()).toEqual(sample());
  });

  it('ignores a copy written in an older format', async () => {
    await writeCachedDataset(sample(), 'old-format');
    expect(await readCachedDataset()).toBeNull();
  });

  it('returns null instead of throwing when IndexedDB is unavailable', async () => {
    const original = globalThis.indexedDB;
    // @ts-expect-error simulate a browser without IndexedDB (private mode, blocked storage)
    delete globalThis.indexedDB;
    try {
      expect(await readCachedDataset()).toBeNull();
      await expect(writeCachedDataset(sample())).resolves.toBeUndefined();
    } finally {
      globalThis.indexedDB = original;
    }
  });
});
