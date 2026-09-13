import {
  VendorAdapter,
  VendorEndpoint,
  NormalizedAdvisoryItem,
  SeverityLevel,
} from '@/types';

const CVE_ID_REGEX = /^CVE-\d{4}-\d{4,}$/i;

function normalizeCiscoSeverity(text: unknown, cvssScore?: number): SeverityLevel {
  if (typeof text === 'string') {
    const s = text.trim().toUpperCase();
    if (s === 'CRITICAL') return 'CRITICAL';
    if (s === 'HIGH') return 'HIGH';
    if (s === 'MEDIUM') return 'MEDIUM';
    if (s === 'LOW') return 'LOW';
  }

  if (cvssScore !== undefined && !isNaN(cvssScore)) {
    if (cvssScore >= 9.0) return 'CRITICAL';
    if (cvssScore >= 7.0) return 'HIGH';
    if (cvssScore >= 4.0) return 'MEDIUM';
    if (cvssScore > 0) return 'LOW';
  }

  return 'UNKNOWN';
}

const SEVERITY_RANK: Record<SeverityLevel, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  UNKNOWN: 0,
};

/**
 * Builds a CSAFPID -> product name lookup by walking the product_tree branches.
 * Cisco's tree nests vendor > product_family > product_version > service_pack,
 * with the leaf `product` node carrying the id/name pair.
 */
function buildProductIdMap(productTree: unknown): Map<string, string> {
  const map = new Map<string, string>();

  function walk(node: unknown): void {
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;

    const product = n.product;
    if (product && typeof product === 'object') {
      const p = product as Record<string, unknown>;
      if (typeof p.product_id === 'string' && typeof p.name === 'string') {
        map.set(p.product_id, p.name);
      }
    }

    if (Array.isArray(n.branches)) {
      for (const child of n.branches) walk(child);
    }
  }

  if (productTree && typeof productTree === 'object') {
    const branches = (productTree as Record<string, unknown>).branches;
    if (Array.isArray(branches)) {
      for (const branch of branches) walk(branch);
    }
  }

  return map;
}

export class CiscoAdapter implements VendorAdapter {
  readonly vendorCode = 'cisco';
  readonly vendorName = 'Cisco';

  readonly baseUrl = 'https://www.cisco.com/.well-known/csaf';
  readonly changesCsvUrl = 'https://www.cisco.com/.well-known/csaf/changes.csv';
  readonly advisoryBaseUrl = 'https://sec.cloudapps.cisco.com/security/center/content/CiscoSecurityAdvisory';

  readonly endpoints: VendorEndpoint[] = [
    { label: 'CSAF changes index', url: this.changesCsvUrl },
    { label: 'CSAF advisory detail', url: `${this.baseUrl}/{advisoryFile}` },
    { label: 'Cisco Security Advisory', url: `${this.advisoryBaseUrl}/{advisoryId}` },
  ];

  async fetchAdvisories(limit = 20): Promise<NormalizedAdvisoryItem[]> {
    const res = await fetch(this.changesCsvUrl);
    if (!res.ok) {
      const msg = res.statusText || `HTTP ${res.status}`;
      throw new Error(`Failed to fetch Cisco changes index: ${msg}`);
    }

    const csvText = await res.text();
    const lines = csvText.split(/\r?\n/).filter(Boolean);

    // Cisco's changes.csv rows are unquoted: "<year>/<file>.json,<ISO8601 timestamp>"
    const entries: { path: string; time: string }[] = [];
    for (const line of lines) {
      const match = line.trim().match(/^([^",]+\.json),(.+)$/i);
      if (match) {
        entries.push({ path: match[1], time: match[2] });
      }
    }

    // The index is descending by timestamp but not strictly, so sort ourselves.
    entries.sort((a, b) => b.time.localeCompare(a.time));

    const paths = entries.slice(0, limit).map((e) => e.path);

    if (paths.length === 0) return [];

    const detailDocuments: unknown[] = [];
    const BATCH_SIZE = 5;

    for (let i = 0; i < paths.length; i += BATCH_SIZE) {
      const batch = paths.slice(i, i + BATCH_SIZE);
      const batchDocs = await Promise.all(
        batch.map(async (path) => {
          try {
            const detailRes = await fetch(`${this.baseUrl}/${path}`);
            if (detailRes.ok) {
              return await detailRes.json();
            }
          } catch {
            // Error isolation: skip failed file
          }
          return null;
        })
      );

      for (const doc of batchDocs) {
        if (doc !== null) detailDocuments.push(doc);
      }
    }

    return this.parse(detailDocuments);
  }

  parse(rawPayload: unknown): NormalizedAdvisoryItem[] {
    if (!rawPayload || typeof rawPayload !== 'object') {
      return [];
    }

    const docs: unknown[] = Array.isArray(rawPayload) ? rawPayload : [rawPayload];
    const normalizedItems: NormalizedAdvisoryItem[] = [];

    for (const doc of docs) {
      if (!doc || typeof doc !== 'object') continue;
      const d = doc as Record<string, unknown>;
      const document = d.document as Record<string, unknown> | undefined;
      if (!document || typeof document !== 'object') continue;

      const tracking = document.tracking as Record<string, unknown> | undefined;
      const advisoryId = typeof tracking?.id === 'string' ? (tracking.id as string).trim() : '';
      if (!advisoryId) continue;

      const title = typeof document.title === 'string' ? (document.title as string).trim() : `[Cisco] ${advisoryId}`;
      const publishedAt =
        (typeof tracking?.initial_release_date === 'string' ? (tracking.initial_release_date as string) : undefined) ||
        (typeof tracking?.current_release_date === 'string' ? (tracking.current_release_date as string) : undefined) ||
        new Date().toISOString();
      const updatedAt =
        typeof tracking?.current_release_date === 'string' ? (tracking.current_release_date as string) : undefined;

      // Canonical advisory URL comes from the "self" reference.
      let url = `${this.advisoryBaseUrl}/${advisoryId}`;
      if (Array.isArray(document.references)) {
        const selfRef = (document.references as unknown[]).find(
          (r) => r && typeof r === 'object' && (r as Record<string, unknown>).category === 'self'
        ) as Record<string, unknown> | undefined;
        if (selfRef && typeof selfRef.url === 'string') {
          url = selfRef.url;
        }
      }

      const summary = Array.isArray(document.notes)
        ? ((document.notes as unknown[]).find(
            (n) => n && typeof n === 'object' && (n as Record<string, unknown>).category === 'summary'
          ) as Record<string, unknown> | undefined)?.text
        : undefined;

      const productIdMap = buildProductIdMap(d.product_tree);

      const rawVulns = Array.isArray(d.vulnerabilities) ? (d.vulnerabilities as unknown[]) : [];
      const parsedCves: NormalizedAdvisoryItem['cves'] = [];
      let overallSeverity: SeverityLevel = 'UNKNOWN';

      for (const rawVuln of rawVulns) {
        if (!rawVuln || typeof rawVuln !== 'object') continue;
        const v = rawVuln as Record<string, unknown>;

        const cveId = typeof v.cve === 'string' ? (v.cve as string).trim().toUpperCase() : '';
        if (!CVE_ID_REGEX.test(cveId)) continue;

        let cvssScore: number | undefined;
        let cvssVector: string | undefined;
        let vulnSeverity: SeverityLevel = 'UNKNOWN';

        if (Array.isArray(v.scores) && v.scores.length > 0) {
          const score0 = (v.scores as unknown[])[0];
          const s = score0 && typeof score0 === 'object' ? (score0 as Record<string, unknown>).cvss_v3 : undefined;
          if (s && typeof s === 'object') {
            const cvss = s as Record<string, unknown>;
            if (typeof cvss.baseScore === 'number') cvssScore = cvss.baseScore;
            if (typeof cvss.vectorString === 'string') cvssVector = cvss.vectorString;
            if (typeof cvss.baseSeverity === 'string') vulnSeverity = normalizeCiscoSeverity(cvss.baseSeverity, cvssScore);
          }
        }

        if (vulnSeverity === 'UNKNOWN') {
          vulnSeverity = normalizeCiscoSeverity(undefined, cvssScore);
        }

        if (SEVERITY_RANK[vulnSeverity] > SEVERITY_RANK[overallSeverity]) {
          overallSeverity = vulnSeverity;
        }

        const description = typeof v.title === 'string' ? (v.title as string) : title;

        const affectedProducts: string[] = [];
        const productStatus = v.product_status as Record<string, unknown> | undefined;
        const knownAffected = Array.isArray(productStatus?.known_affected)
          ? (productStatus!.known_affected as unknown[])
          : [];
        for (const pid of knownAffected) {
          if (typeof pid !== 'string') continue;
          const name = productIdMap.get(pid);
          if (!name) continue;
          if (!affectedProducts.includes(name)) affectedProducts.push(name);
        }

        let solution = '';
        const fixedVersions: string[] = [];
        if (Array.isArray(v.remediations)) {
          const remediations = v.remediations as unknown[];
          const fixRem = (remediations.find(
            (r) => r && typeof r === 'object' && (r as Record<string, unknown>).category === 'vendor_fix'
          ) || remediations[0]) as Record<string, unknown> | undefined;
          if (fixRem && typeof fixRem.details === 'string') {
            solution = fixRem.details.trim();
          }
          if (fixRem && Array.isArray(fixRem.product_ids)) {
            for (const pid of fixRem.product_ids as unknown[]) {
              if (typeof pid !== 'string') continue;
              const name = productIdMap.get(pid);
              if (!name) continue;
              if (!fixedVersions.includes(name)) fixedVersions.push(name);
            }
          }
        }

        parsedCves.push({
          cveId,
          description,
          cvssScore,
          cvssVector,
          severity: vulnSeverity,
          affectedProducts,
          fixedVersions,
          solution: solution || undefined,
        });
      }

      if (parsedCves.length === 0) continue;

      normalizedItems.push({
        advisoryId,
        title,
        severity: overallSeverity,
        publishedAt,
        updatedAt,
        url,
        summary: (typeof summary === 'string' ? summary : undefined) || title,
        solution: parsedCves[0]?.solution,
        cves: parsedCves,
        rawPayload: d,
      });
    }

    return normalizedItems;
  }
}
