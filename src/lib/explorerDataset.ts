import { supabase } from '@/lib/supabase';

// Payload of the explorer_dataset() RPC (migrations 20260926*). Each advisory
// carries its distinct product impacts once; each mapping lists the indexes
// of the impacts it has, so per-CVE impacts survive without shipping the same
// objects once per CVE. In the compact format a mapping that carries every
// impact of its advisory, in order, sends i: null instead of the full list.
export interface DatasetAdvisory {
  id: string;
  advisory_id: string;
  title: string;
  severity: string | null;
  published_at: string | null;
  url: string | null;
  summary: string | null;
  vendor_code: string | null;
  vendor_name: string | null;
  impacts: unknown[];
}

export interface DatasetCve {
  id: string;
  cve_id: string;
  description: string | null;
  cvss_v3_score: number | null;
  cvss_v3_vector: string | null;
  severity: string | null;
  is_known_exploited: boolean | null;
  published_date: string | null;
  last_modified_date: string | null;
  created_at: string | null;
}

export interface DatasetMapping {
  a: string; // advisories.id
  c: string; // cves.id
  i: number[] | null; // indexes into the advisory's impacts; null = all of them
  f: string[] | null; // fixed_versions
}

export interface ExplorerDataset {
  advisories: DatasetAdvisory[];
  cves: DatasetCve[];
  mappings: DatasetMapping[];
}

let inflight: Promise<ExplorerDataset> | null = null;

/**
 * Loads the dataset with one RPC. The advisory and CVE services both call this
 * during the same page load; concurrent callers share one request, and the
 * next call after it settles fetches fresh data. Each successful load is kept
 * in the browser cache for the next visit.
 */
export function fetchExplorerDataset(): Promise<ExplorerDataset> {
  if (!inflight) {
    inflight = (async () => {
      const { data, error } = await supabase.rpc('explorer_dataset', { p_compact: true });
      if (error) throw error;
      const ds = (data ?? { advisories: [], cves: [], mappings: [] }) as ExplorerDataset;
      await writeCachedDataset(ds);
      return ds;
    })().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

const vendorOf = (a: DatasetAdvisory) => (a.vendor_code ? { code: a.vendor_code, name: a.vendor_name } : null);
const impactsOf = (a: DatasetAdvisory | undefined, m: DatasetMapping) => {
  if (!a) return [];
  if (m.i === null) return a.impacts;
  return (m.i || []).map((idx) => a.impacts[idx]).filter((x) => x !== undefined);
};

/** Rows shaped like the former PostgREST advisories query with embedded mappings. */
export function toAdvisoryRows(ds: ExplorerDataset): any[] {
  const cveById = new Map(ds.cves.map((c) => [c.id, c]));
  const mapsByAdvisory = new Map<string, DatasetMapping[]>();
  for (const m of ds.mappings) {
    const list = mapsByAdvisory.get(m.a) ?? [];
    list.push(m);
    mapsByAdvisory.set(m.a, list);
  }
  return ds.advisories.map((a) => ({
    id: a.id,
    advisory_id: a.advisory_id,
    title: a.title,
    severity: a.severity,
    published_at: a.published_at,
    url: a.url,
    summary: a.summary,
    vendors: vendorOf(a),
    advisory_cve_map: (mapsByAdvisory.get(a.id) ?? []).map((m) => ({
      affected_products: impactsOf(a, m),
      fixed_versions: m.f ?? [],
      cves: cveById.get(m.c) ?? null,
    })),
  }));
}

/** Rows shaped like the former PostgREST cves query with embedded mappings. */
export function toCveRows(ds: ExplorerDataset): any[] {
  const advisoryById = new Map(ds.advisories.map((a) => [a.id, a]));
  const mapsByCve = new Map<string, DatasetMapping[]>();
  for (const m of ds.mappings) {
    const list = mapsByCve.get(m.c) ?? [];
    list.push(m);
    mapsByCve.set(m.c, list);
  }
  return ds.cves.map((c) => ({
    ...c,
    advisory_cve_map: (mapsByCve.get(c.id) ?? []).map((m) => {
      const a = advisoryById.get(m.a);
      return {
        affected_products: impactsOf(a, m),
        fixed_versions: m.f ?? [],
        advisories: a
          ? { advisory_id: a.advisory_id, title: a.title, url: a.url, summary: a.summary, vendors: vendorOf(a) }
          : null,
      };
    }),
  }));
}

// Browser cache: the last loaded dataset, shown on the next visit while a
// fresh copy loads (the data is public, the same rows any visitor can read).
// Bump CACHE_FORMAT whenever the dataset shape changes so old copies are
// ignored. Every failure (private mode, blocked storage, quota) degrades to
// "no cache" and never breaks the page.
const CACHE_DB = 'vulnbeacon';
const CACHE_STORE = 'cache';
const CACHE_KEY = 'explorer-dataset';
export const CACHE_FORMAT = 'explorer-dataset/compact-v1';

function openCacheDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(CACHE_DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(CACHE_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function readCachedDataset(): Promise<ExplorerDataset | null> {
  const db = await openCacheDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(CACHE_STORE, 'readonly').objectStore(CACHE_STORE).get(CACHE_KEY);
      req.onsuccess = () => {
        const entry = req.result as { format?: string; dataset?: ExplorerDataset } | undefined;
        resolve(entry?.format === CACHE_FORMAT && entry.dataset ? entry.dataset : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    } finally {
      db.close();
    }
  });
}

export async function writeCachedDataset(ds: ExplorerDataset, format: string = CACHE_FORMAT): Promise<void> {
  const db = await openCacheDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(CACHE_STORE, 'readwrite');
      tx.objectStore(CACHE_STORE).put({ format, savedAt: new Date().toISOString(), dataset: ds }, CACHE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    } finally {
      db.close();
    }
  });
}
