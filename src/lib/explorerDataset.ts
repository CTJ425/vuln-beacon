import { supabase } from '@/lib/supabase';

// Payload of the explorer_dataset() RPC (migration 20260926000000). Each
// advisory carries its distinct product impacts once; each mapping lists the
// indexes of the impacts it has, so per-CVE impacts survive without shipping
// the same objects once per CVE.
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
  i: number[]; // indexes into the advisory's impacts
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
 * next call after it settles fetches fresh data.
 */
export function fetchExplorerDataset(): Promise<ExplorerDataset> {
  if (!inflight) {
    inflight = (async () => {
      const { data, error } = await supabase.rpc('explorer_dataset');
      if (error) throw error;
      return (data ?? { advisories: [], cves: [], mappings: [] }) as ExplorerDataset;
    })().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

const vendorOf = (a: DatasetAdvisory) => (a.vendor_code ? { code: a.vendor_code, name: a.vendor_name } : null);
const impactsOf = (a: DatasetAdvisory | undefined, m: DatasetMapping) =>
  a ? (m.i || []).map((idx) => a.impacts[idx]).filter((x) => x !== undefined) : [];

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
