import {
  VendorAdapter,
  VendorEndpoint,
  NormalizedAdvisoryItem,
  SeverityLevel,
  ProductImpactItem,
} from '@/types';

function normalizeSeverity(severity: unknown): SeverityLevel {
  if (typeof severity !== 'string') return 'UNKNOWN';
  const s = severity.trim().toUpperCase();
  if (s === 'CRITICAL') return 'CRITICAL';
  if (s === 'HIGH' || s === 'IMPORTANT') return 'HIGH';
  if (s === 'MEDIUM' || s === 'MODERATE') return 'MEDIUM';
  if (s === 'LOW') return 'LOW';
  return 'UNKNOWN';
}

const CVE_ID_REGEX = /^CVE-\d{4}-\d{4,}$/i;

export class NutanixAdapter implements VendorAdapter {
  readonly vendorCode = 'nutanix';
  readonly vendorName = 'Nutanix';

  readonly baseUrl = 'https://portal.nutanix.com';
  readonly listUrl = 'https://portal.nutanix.com/api/v1/advisories';
  readonly detailUrlBase = 'https://portal.nutanix.com/api/v1/advisory';
  readonly vulnerabilitiesUrl = 'https://portal.nutanix.com/api/v1/vulnerabilities';

  readonly endpoints: VendorEndpoint[] = [
    { label: 'Advisories list', url: this.listUrl },
    { label: 'Advisory detail', url: `${this.detailUrlBase}?id={advisoryId}` },
    { label: 'Vulnerabilities search', url: this.vulnerabilitiesUrl },
  ];

  advisoryDetailUrl(advisoryId: string): string {
    return `${this.detailUrlBase}?id=${encodeURIComponent(advisoryId)}`;
  }

  vulnerabilityLookupUrl(): string {
    return this.vulnerabilitiesUrl;
  }

  advisoriesListUrl(): string {
    return this.listUrl;
  }

  async fetchAdvisories(limit = 20): Promise<NormalizedAdvisoryItem[]> {
    const listRes = await fetch(this.listUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page: 1,
        pageSize: limit,
        sort: 'DESC',
        sortColumn: 'MODIFIED',
      }),
    });

    if (!listRes.ok) {
      const msg = listRes.statusText || `HTTP ${listRes.status}`;
      throw new Error(`Failed to fetch Nutanix advisories list: ${msg}`);
    }

    const listData = (await listRes.json()) as { advisories?: { advisory_id: string }[] };
    const advisories = Array.isArray(listData?.advisories) ? listData.advisories : [];
    if (advisories.length === 0) return [];

    const detailDocuments: unknown[] = [];
    const BATCH_SIZE = 5;

    for (let i = 0; i < advisories.length; i += BATCH_SIZE) {
      const batch = advisories.slice(i, i + BATCH_SIZE);
      const batchDocs = await Promise.all(
        batch.map(async (entry) => {
          if (!entry?.advisory_id) return null;
          try {
            const detailRes = await fetch(this.advisoryDetailUrl(entry.advisory_id));
            if (detailRes.ok) {
              return await detailRes.json();
            }
          } catch {
            // Skip this advisory rather than failing the whole batch.
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

    let items: any[] = [];
    if (Array.isArray(rawPayload)) {
      items = rawPayload;
    } else if (Array.isArray((rawPayload as any).advisories)) {
      items = (rawPayload as any).advisories;
    } else {
      items = [rawPayload];
    }

    const normalizedItems: NormalizedAdvisoryItem[] = [];

    for (const raw of items) {
      if (!raw || typeof raw !== 'object') continue;

      const advisoryId = typeof raw.advisory_id === 'string' ? raw.advisory_id.trim() : '';
      if (!advisoryId) continue;

      const rawCveList = Array.isArray(raw.cvelist)
        ? raw.cvelist
        : (Array.isArray(raw.cveList) ? raw.cveList : []);
      const parsedCves: NormalizedAdvisoryItem['cves'] = [];

      const product = typeof raw.product === 'string' ? raw.product.trim() : '';
      const fixedRelease = typeof raw.fixedRelease === 'string'
        ? raw.fixedRelease.trim()
        : (typeof raw.release === 'string' ? raw.release.trim() : '');
      const affectedVersion = Array.isArray(raw.affected_version)
        ? raw.affected_version.filter((v: unknown): v is string => typeof v === 'string').join(', ')
        : (typeof raw.affected_version === 'string' ? raw.affected_version.trim() : '');
      const cpe = typeof raw.cpe === 'string' ? raw.cpe.trim() : undefined;
      const solution = typeof raw.solution === 'string' ? raw.solution.trim() : undefined;

      const affectedProducts: string[] = [];
      if (product) affectedProducts.push(product);
      if (fixedRelease && !affectedProducts.includes(fixedRelease)) {
        affectedProducts.push(fixedRelease);
      }

      const productImpacts: ProductImpactItem[] = [];
      if (product || fixedRelease) {
        productImpacts.push({
          product_name: product || 'Nutanix Product',
          component: product || 'Core',
          state: 'Affected',
          justification: affectedVersion || undefined,
          errata: fixedRelease || advisoryId,
          release_date: raw.lastModified || raw.lastModifiedDate || raw.advisoryPublicationDate || undefined,
          cpe,
        });
      }

      const fixedVersions = fixedRelease ? [fixedRelease] : [];

      const seenCveIdsInAdv = new Set<string>();
      for (const c of rawCveList) {
        if (!c) continue;
        const cveId = typeof c === 'string'
          ? c.trim().toUpperCase()
          : (typeof c?.cve_id === 'string' ? c.cve_id.trim().toUpperCase() : '');
        if (!CVE_ID_REGEX.test(cveId) || seenCveIdsInAdv.has(cveId)) continue;
        seenCveIdsInAdv.add(cveId);

        let cvssScore: number | undefined;
        const rawScore = typeof c === 'object' ? c.cvss : undefined;
        if (typeof rawScore === 'number' && !isNaN(rawScore)) {
          cvssScore = rawScore;
        } else if (typeof rawScore === 'string') {
          const parsed = parseFloat(rawScore);
          if (!isNaN(parsed)) cvssScore = parsed;
        } else if (typeof raw.overallCVSS === 'number' && !isNaN(raw.overallCVSS)) {
          cvssScore = raw.overallCVSS;
        } else if (typeof raw.overallCVSS === 'string') {
          const parsed = parseFloat(raw.overallCVSS);
          if (!isNaN(parsed)) cvssScore = parsed;
        }

        const cvssVector =
          typeof c === 'object' &&
          typeof c.cvss_scoring_vector === 'string' &&
          c.cvss_scoring_vector !== 'None' &&
          c.cvss_scoring_vector.trim() !== ''
            ? c.cvss_scoring_vector.trim()
            : undefined;

        let severity = normalizeSeverity(typeof c === 'object' ? (c.severity || raw.severity) : raw.severity);
        if (severity === 'UNKNOWN' && cvssScore !== undefined) {
          if (cvssScore >= 9.0) severity = 'CRITICAL';
          else if (cvssScore >= 7.0) severity = 'HIGH';
          else if (cvssScore >= 4.0) severity = 'MEDIUM';
          else if (cvssScore > 0) severity = 'LOW';
        }

        parsedCves.push({
          cveId,
          description: typeof c === 'object' && typeof c.description === 'string' ? c.description : '',
          cvssScore,
          cvssVector,
          severity,
          affectedProducts,
          productImpacts,
          fixedVersions,
          solution,
        });
      }

      // If advisory has no valid CVEs, skip it because VulnBeacon tracks security CVE advisories.
      if (parsedCves.length === 0) continue;

      const severity = normalizeSeverity(raw.severity);
      const title = `[${product || 'Nutanix'}] Nutanix Security Advisory ${advisoryId}${fixedRelease ? ` (${fixedRelease})` : ''}`;
      const publishedAt = raw.advisoryPublicationDate || new Date().toISOString();
      const updatedAt = raw.lastModified || raw.lastModifiedDate || raw.advisoryPublicationDate;
      const url = typeof raw.advisory_url === 'string' && raw.advisory_url.trim().startsWith('http')
        ? raw.advisory_url.trim()
        : `https://portal.nutanix.com/page/documents/security-advisories/release-advisories/details?id=${encodeURIComponent(advisoryId)}`;
      const summary = solution || (raw.description ? String(raw.description) : undefined);

      normalizedItems.push({
        advisoryId,
        title,
        severity,
        publishedAt,
        updatedAt,
        url,
        summary,
        solution,
        cves: parsedCves,
        rawPayload: raw as Record<string, unknown>,
      });
    }

    return normalizedItems;
  }
}
