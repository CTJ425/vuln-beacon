import {
  VendorAdapter,
  VendorEndpoint,
  NormalizedAdvisoryItem,
  SeverityLevel,
  ProductImpactItem,
} from '@/types';

function normalizeSuseSeverity(text: unknown, cvssScore?: number): SeverityLevel {
  if (typeof text === 'string') {
    const s = text.trim().toLowerCase();
    if (s === 'critical') return 'CRITICAL';
    if (s === 'important' || s === 'high') return 'HIGH';
    if (s === 'moderate' || s === 'medium') return 'MEDIUM';
    if (s === 'low') return 'LOW';
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

function componentFromPackageName(pkgFull: string): string {
  // Strip architecture, e.g. "erlang-23.3.4.19-150300.3.42.1.x86_64" -> "erlang"
  const match = pkgFull.match(/^([a-zA-Z0-9_\-+]+?)-\d+/);
  if (match) return match[1];
  return pkgFull.split('-')[0] || pkgFull;
}

export class SuseAdapter implements VendorAdapter {
  readonly vendorCode = 'suse';
  readonly vendorName = 'SUSE';

  readonly baseUrl = 'https://ftp.suse.com/pub/projects/security/csaf';
  readonly changesCsvUrl = 'https://ftp.suse.com/pub/projects/security/csaf/changes.csv';
  readonly cveBaseUrl = 'https://www.suse.com/security/cve';

  readonly endpoints: VendorEndpoint[] = [
    { label: 'CSAF changes index', url: this.changesCsvUrl },
    { label: 'CSAF advisory detail', url: `${this.baseUrl}/{advisoryFile}` },
    { label: 'SUSE CVE page', url: `${this.cveBaseUrl}/{cveId}` },
  ];

  advisoryDetailUrl(advisoryId: string): string {
    let clean = advisoryId.trim().toLowerCase().replace(/\.json$/i, '');
    clean = clean.replace(/^(suse-su|opensuse-su)-(\d{4})[-:]/i, '$1-$2_');
    clean = clean.replace(/:/g, '_');
    return `${this.baseUrl}/${clean}.json`;
  }

  cveLookupUrl(cveId: string): string {
    return `${this.cveBaseUrl}/${encodeURIComponent(cveId)}`;
  }

  async fetchAdvisories(limit = 20): Promise<NormalizedAdvisoryItem[]> {
    const res = await fetch(this.changesCsvUrl);
    if (!res.ok) {
      const msg = res.statusText || `HTTP ${res.status}`;
      throw new Error(`Failed to fetch SUSE changes index: ${msg}`);
    }

    const csvText = await res.text();
    const lines = csvText.split(/\r?\n/).filter(Boolean);

    // Parse changes.csv entries: "filename.json","timestamp"
    const entries: { file: string; time: string }[] = [];
    for (const line of lines) {
      const match = line.trim().match(/^"([^"]+\.json)","([^"]+)"/i);
      if (match) {
        const file = match[1];
        const time = match[2];
        if (file.toLowerCase().startsWith('suse-su-') || file.toLowerCase().startsWith('opensuse-su-')) {
          entries.push({ file, time });
        }
      }
    }

    // Sort by timestamp descending to ensure the newest advisories are fetched
    entries.sort((a, b) => b.time.localeCompare(a.time));

    const filenames = entries.slice(0, limit).map((e) => e.file);

    if (filenames.length === 0) return [];

    const detailDocuments: unknown[] = [];
    const BATCH_SIZE = 5;

    for (let i = 0; i < filenames.length; i += BATCH_SIZE) {
      const batch = filenames.slice(i, i + BATCH_SIZE);
      const batchDocs = await Promise.all(
        batch.map(async (file) => {
          try {
            const detailRes = await fetch(`${this.baseUrl}/${file}`);
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

    let docs: any[] = [];
    if (Array.isArray(rawPayload)) {
      docs = rawPayload;
    } else {
      docs = [rawPayload];
    }

    const normalizedItems: NormalizedAdvisoryItem[] = [];

    for (const doc of docs) {
      if (!doc || typeof doc !== 'object') continue;
      const document = doc.document;
      if (!document || typeof document !== 'object') continue;

      const tracking = document.tracking;
      const advisoryId = typeof tracking?.id === 'string' ? tracking.id.trim() : '';
      if (!advisoryId) continue;

      const title = typeof document.title === 'string' ? document.title.trim() : `[SUSE] ${advisoryId}`;
      const publishedAt = tracking?.current_release_date || tracking?.initial_release_date || new Date().toISOString();
      const updatedAt = tracking?.current_release_date || tracking?.initial_release_date;

      // Extract official advisory URL from references
      let url = `https://www.suse.com/support/update/announcement/`;
      if (Array.isArray(document.references)) {
        const selfRef = document.references.find(
          (r: any) =>
            typeof r?.url === 'string' &&
            (r.url.includes('/announcement/') || r.category === 'self') &&
            !r.url.endsWith('.json')
        );
        if (selfRef && selfRef.url) {
          url = selfRef.url;
        }
      }

      const summary = Array.isArray(document.notes)
        ? document.notes.find((n: any) => n?.category === 'summary' || n?.category === 'general')?.text
        : undefined;

      const rawVulns = Array.isArray(doc.vulnerabilities) ? doc.vulnerabilities : [];
      const parsedCves: NormalizedAdvisoryItem['cves'] = [];

      let overallSeverity: SeverityLevel = normalizeSuseSeverity(document.aggregate_severity?.text);

      for (const v of rawVulns) {
        if (!v || typeof v !== 'object') continue;
        const cveId = typeof v.cve === 'string' ? v.cve.trim().toUpperCase() : '';
        if (!CVE_ID_REGEX.test(cveId)) continue;

        let cvssScore: number | undefined;
        let cvssVector: string | undefined;
        let vulnSeverity: SeverityLevel = 'UNKNOWN';

        if (Array.isArray(v.scores) && v.scores.length > 0) {
          const s = v.scores[0]?.cvss_v3;
          if (s) {
            if (typeof s.baseScore === 'number') cvssScore = s.baseScore;
            if (typeof s.vectorString === 'string') cvssVector = s.vectorString;
            if (typeof s.baseSeverity === 'string') vulnSeverity = normalizeSuseSeverity(s.baseSeverity, cvssScore);
          }
        }

        if (vulnSeverity === 'UNKNOWN' && Array.isArray(v.threats) && v.threats.length > 0) {
          const t = v.threats.find((item: any) => item?.category === 'impact');
          if (t?.details) {
            vulnSeverity = normalizeSuseSeverity(t.details, cvssScore);
          }
        }

        if (vulnSeverity === 'UNKNOWN') {
          vulnSeverity = normalizeSuseSeverity(document.aggregate_severity?.text, cvssScore);
        }

        if (overallSeverity === 'UNKNOWN' && vulnSeverity !== 'UNKNOWN') {
          overallSeverity = vulnSeverity;
        }

        const description = Array.isArray(v.notes)
          ? v.notes.find((n: any) => n?.category === 'general' || n?.category === 'description')?.text || v.title || ''
          : (v.title || '');

        let solution = '';
        const productImpacts: ProductImpactItem[] = [];
        const fixedVersions: string[] = [];
        const affectedProducts: string[] = [];

        // Parse remediations
        if (Array.isArray(v.remediations)) {
          const fixRem = v.remediations.find((r: any) => r?.category === 'vendor_fix') || v.remediations[0];
          if (fixRem?.details) {
            solution = fixRem.details.trim();
          }

          if (Array.isArray(fixRem?.product_ids)) {
            for (const pid of fixRem.product_ids) {
              if (typeof pid !== 'string') continue;
              // Format: "Product Name:package-version.arch"
              const colonIdx = pid.indexOf(':');
              const prodName = colonIdx !== -1 ? pid.slice(0, colonIdx).trim() : 'SUSE Linux Enterprise';
              const pkgFull = colonIdx !== -1 ? pid.slice(colonIdx + 1).trim() : pid.trim();
              const component = componentFromPackageName(pkgFull);

              if (!affectedProducts.includes(prodName)) affectedProducts.push(prodName);
              if (!fixedVersions.includes(pkgFull)) fixedVersions.push(pkgFull);

              productImpacts.push({
                product_name: prodName,
                component,
                state: 'Fixed',
                justification: pkgFull,
                errata: advisoryId,
                release_date: publishedAt,
              });
            }
          }
        }

        if (!solution) {
          solution = `請使用 Zypper 執行更新：sudo zypper update -y ${productImpacts[0]?.component || 'package'}`;
        }

        parsedCves.push({
          cveId,
          description,
          cvssScore,
          cvssVector,
          severity: vulnSeverity,
          affectedProducts,
          productImpacts,
          fixedVersions,
          solution,
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
        summary: summary || title,
        solution: parsedCves[0]?.solution,
        cves: parsedCves,
        rawPayload: doc,
      });
    }

    return normalizedItems;
  }
}
