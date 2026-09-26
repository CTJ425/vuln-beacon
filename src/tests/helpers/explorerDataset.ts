import type { ExplorerDataset } from '@/lib/explorerDataset';

// Builders for the explorer_dataset() RPC payload used by service tests.
export const dsAdvisory = (over: Record<string, any> = {}) => ({
  id: 'a1',
  advisory_id: 'RHSA-2026:1000',
  title: 'Important: kernel security update',
  severity: 'HIGH',
  published_at: '2026-08-01T00:00:00Z',
  url: null,
  summary: null,
  vendor_code: 'redhat',
  vendor_name: 'Red Hat',
  impacts: [],
  ...over,
});

export const dsCve = (over: Record<string, any> = {}) => ({
  id: 'c1',
  cve_id: 'CVE-2026-1000',
  description: 'kernel: flaw',
  cvss_v3_score: 7.5,
  cvss_v3_vector: null,
  severity: 'HIGH',
  is_known_exploited: false,
  published_date: '2026-08-01T00:00:00Z',
  last_modified_date: null,
  created_at: '2026-08-01T00:00:00Z',
  ...over,
});

export const dsMapping = (a: string, c: string, i: number[] = [], f: string[] = []) => ({ a, c, i, f });

export const dataset = (over: Partial<ExplorerDataset> = {}): ExplorerDataset => ({
  advisories: [],
  cves: [],
  mappings: [],
  ...over,
});
