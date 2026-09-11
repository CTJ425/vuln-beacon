import {
  VendorAdapter,
  VendorEndpoint,
  NormalizedAdvisoryItem,
  SeverityLevel,
  ProductImpactItem,
} from '@/types';

function normalizeSeverity(priority: unknown, cvssScore?: number): SeverityLevel {
  if (typeof priority === 'string') {
    const p = priority.trim().toLowerCase();
    if (p === 'critical') return 'CRITICAL';
    if (p === 'high') return 'HIGH';
    if (p === 'medium') return 'MEDIUM';
    if (p === 'low' || p === 'negligible') return 'LOW';
  }

  if (cvssScore !== undefined && !isNaN(cvssScore)) {
    if (cvssScore >= 9.0) return 'CRITICAL';
    if (cvssScore >= 7.0) return 'HIGH';
    if (cvssScore >= 4.0) return 'MEDIUM';
    if (cvssScore > 0) return 'LOW';
  }

  return 'UNKNOWN';
}

const CVE_ID_REGEX = /^CVE-\d{4}-\d{4,}$/i;
const USN_ID_REGEX = /^(?:USN|LSN)-\d+-\d+$/i;

export class UbuntuAdapter implements VendorAdapter {
  readonly vendorCode = 'ubuntu';
  readonly vendorName = 'Ubuntu';

  readonly baseUrl = 'https://ubuntu.com/security';
  readonly listUrl = 'https://ubuntu.com/security/notices.json';
  readonly detailUrlBase = 'https://ubuntu.com/security/notices';
  readonly cveUrlBase = 'https://ubuntu.com/security/cves';

  readonly endpoints: VendorEndpoint[] = [
    { label: 'Security notices list', url: this.listUrl },
    { label: 'Notice detail', url: `${this.detailUrlBase}/{noticeId}.json` },
    { label: 'CVE lookup', url: `${this.cveUrlBase}/{cveId}.json` },
  ];

  noticeDetailUrl(noticeId: string): string {
    const trimmed = noticeId.trim();
    const id = trimmed.toUpperCase().startsWith('USN-') || trimmed.toUpperCase().startsWith('LSN-')
      ? trimmed
      : `USN-${trimmed}`;
    return `${this.detailUrlBase}/${encodeURIComponent(id)}.json`;
  }

  cveLookupUrl(cveId: string): string {
    return `${this.cveUrlBase}/${encodeURIComponent(cveId)}.json`;
  }

  noticesListUrl(limit = 20): string {
    return `${this.listUrl}?limit=${limit}`;
  }

  async fetchAdvisories(limit = 20): Promise<NormalizedAdvisoryItem[]> {
    const res = await fetch(this.noticesListUrl(limit));
    if (!res.ok) {
      const msg = res.statusText || `HTTP ${res.status}`;
      throw new Error(`Failed to fetch Ubuntu security notices: ${msg}`);
    }

    const data = (await res.json()) as { notices?: unknown[] };
    const notices = Array.isArray(data?.notices) ? data.notices : [];
    return this.parse(notices);
  }

  parse(rawPayload: unknown): NormalizedAdvisoryItem[] {
    if (!rawPayload || typeof rawPayload !== 'object') {
      return [];
    }

    let items: any[] = [];
    if (Array.isArray(rawPayload)) {
      items = rawPayload;
    } else if (Array.isArray((rawPayload as any).notices)) {
      items = (rawPayload as any).notices;
    } else if (typeof (rawPayload as any).id === 'string' && (rawPayload as any).notices) {
      // CVE detail payload containing nested notices
      const cveDoc = rawPayload as any;
      const cveId = cveDoc.id.toUpperCase();
      const nestedNotices = Array.isArray(cveDoc.notices) ? cveDoc.notices : [];
      return nestedNotices.flatMap((notice: any) => {
        const parsed = this.parse(notice);
        // Ensure the querying CVE is attached
        for (const item of parsed) {
          if (!item.cves.some((c) => c.cveId === cveId)) {
            item.cves.push({
              cveId,
              description: cveDoc.description || item.summary || '',
              cvssScore: typeof cveDoc.cvss3 === 'number' ? cveDoc.cvss3 : undefined,
              severity: normalizeSeverity(cveDoc.priority, typeof cveDoc.cvss3 === 'number' ? cveDoc.cvss3 : undefined),
            });
          }
        }
        return parsed;
      });
    } else {
      items = [rawPayload];
    }

    const normalizedItems: NormalizedAdvisoryItem[] = [];

    for (const raw of items) {
      if (!raw || typeof raw !== 'object') continue;

      const advisoryId = typeof raw.id === 'string' ? raw.id.trim() : '';
      if (!advisoryId || !USN_ID_REGEX.test(advisoryId)) continue;

      const title = typeof raw.title === 'string' && raw.title.trim()
        ? raw.title.trim()
        : `[Ubuntu] Security Notice ${advisoryId}`;

      const summary = typeof raw.summary === 'string' && raw.summary.trim()
        ? raw.summary.trim()
        : (typeof raw.description === 'string' ? raw.description.trim() : undefined);

      const instructions = typeof raw.instructions === 'string' && raw.instructions.trim()
        ? raw.instructions.trim()
        : undefined;

      const solution = instructions || (summary
        ? `${summary} In general, a standard system update will make all the necessary changes: sudo apt-get update && sudo apt-get --only-upgrade install -y <package>`
        : 'In general, a standard system update will make all the necessary changes.');

      const publishedAt = raw.published || new Date().toISOString();
      const updatedAt = raw.updated_at || raw.published;
      const url = `https://ubuntu.com/security/notices/${encodeURIComponent(advisoryId)}`;

      // Parse release_packages for product impacts and fixed versions
      const productImpacts: ProductImpactItem[] = [];
      const fixedVersionsSet = new Set<string>();
      const affectedProductsSet = new Set<string>();

      if (raw.release_packages && typeof raw.release_packages === 'object') {
        for (const [releaseCodename, pkgList] of Object.entries(raw.release_packages)) {
          const productName = `Ubuntu ${releaseCodename}`;
          affectedProductsSet.add(productName);

          if (Array.isArray(pkgList)) {
            for (const pkg of pkgList) {
              if (!pkg || typeof pkg !== 'object') continue;
              const pkgName = typeof pkg.name === 'string' ? pkg.name.trim() : '';
              const pkgVer = typeof pkg.version === 'string' ? pkg.version.trim() : '';
              if (!pkgName) continue;

              if (pkgVer) fixedVersionsSet.add(pkgVer);

              // Add source package or unique binary component
              if (pkg.is_source !== false || !productImpacts.some(p => p.product_name === productName && p.component === pkgName)) {
                productImpacts.push({
                  product_name: productName,
                  component: pkgName,
                  state: 'Fixed',
                  justification: pkgVer || undefined,
                  errata: advisoryId,
                  release_date: publishedAt,
                });
              }
            }
          }
        }
      }

      // Parse CVEs
      let rawCves = Array.isArray(raw.cves)
        ? raw.cves
        : (Array.isArray(raw.cves_ids) ? raw.cves_ids.map((id: string) => ({ id })) : []);

      if (rawCves.length === 0) {
        const textToScan = `${raw.description || ''} ${raw.summary || ''}`;
        const matched = textToScan.match(/CVE-\d{4}-\d{4,}/gi);
        if (matched) {
          const uniqueMatched = Array.from(new Set(matched.map((m) => m.toUpperCase())));
          rawCves = uniqueMatched.map((id) => ({ id }));
        }
      }

      const parsedCves: NormalizedAdvisoryItem['cves'] = [];
      const seenCveIds = new Set<string>();

      let highestScore: number | undefined;

      for (const c of rawCves) {
        if (!c) continue;
        const cveId = (typeof c === 'string' ? c : c?.id || '').trim().toUpperCase();
        if (!CVE_ID_REGEX.test(cveId) || seenCveIds.has(cveId)) continue;
        seenCveIds.add(cveId);

        let cvssScore: number | undefined;
        let cvssVector: string | undefined;

        if (typeof c === 'object') {
          if (typeof c.cvss3 === 'number') {
            cvssScore = c.cvss3;
          } else if (typeof c.cvss3?.base_score === 'number') {
            cvssScore = c.cvss3.base_score;
          } else if (typeof c.impact?.baseMetricV3?.cvssV3?.baseScore === 'number') {
            cvssScore = c.impact.baseMetricV3.cvssV3.baseScore;
          }
          if (typeof c.cvss3_vector === 'string') {
            cvssVector = c.cvss3_vector;
          } else if (typeof c.impact?.baseMetricV3?.cvssV3?.vectorString === 'string') {
            cvssVector = c.impact.baseMetricV3.cvssV3.vectorString;
          }
        }

        if (cvssScore !== undefined && (highestScore === undefined || cvssScore > highestScore)) {
          highestScore = cvssScore;
        }

        const priority = typeof c === 'object' ? c.priority : undefined;
        const severity = normalizeSeverity(priority, cvssScore);

        parsedCves.push({
          cveId,
          description: typeof c === 'object' && typeof c.description === 'string'
            ? c.description
            : (summary || ''),
          cvssScore,
          cvssVector,
          severity,
          affectedProducts: Array.from(affectedProductsSet),
          productImpacts,
          fixedVersions: Array.from(fixedVersionsSet),
          solution,
        });
      }

      if (parsedCves.length === 0) continue;

      const advisorySeverity = normalizeSeverity(raw.priority, highestScore);

      normalizedItems.push({
        advisoryId,
        title,
        severity: advisorySeverity,
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
