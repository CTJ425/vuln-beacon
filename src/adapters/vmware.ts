import {
  VendorAdapter,
  VendorEndpoint,
  NormalizedAdvisoryItem,
  SeverityLevel,
} from '@/types';

function normalizeSeverity(severity: unknown): SeverityLevel {
  if (typeof severity !== 'string') return 'UNKNOWN';
  const s = severity.trim().toUpperCase();
  if (s === 'CRITICAL') return 'CRITICAL';
  if (s === 'HIGH') return 'HIGH';
  if (s === 'MEDIUM') return 'MEDIUM';
  if (s === 'LOW') return 'LOW';
  return 'UNKNOWN';
}

// affectedCve mixes ", ", "," (no space), non-breaking space, and " and " before the
// final id as separators. Extracting every CVE-shaped substring sidesteps all of them.
const CVE_ID_GLOBAL_REGEX = /CVE-\d{4}-\d{4,}/gi;
const VMSA_ID_REGEX = /VMSA-\d{4}-\d{4,}/i;

const MONTH_NAMES: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

// NVD measured 429s at concurrency >= 5; enrichment must stay strictly sequential.
const NVD_MAX_REQUESTS = 60;

function extractCveIds(affectedCve: unknown): string[] {
  if (typeof affectedCve !== 'string' || affectedCve.length === 0) return [];
  const matches = affectedCve.match(CVE_ID_GLOBAL_REGEX) ?? [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const m of matches) {
    const id = m.toUpperCase();
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

// "03 September 2026" -> ISO date, parsed explicitly (not via Date.parse) to avoid
// locale/timezone drift.
function parsePublishedDate(published: unknown): string | undefined {
  if (typeof published !== 'string') return undefined;
  const m = published.trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!m) return undefined;
  const day = parseInt(m[1], 10);
  const month = MONTH_NAMES[m[2].toLowerCase()];
  const year = parseInt(m[3], 10);
  if (month === undefined || Number.isNaN(day) || Number.isNaN(year)) return undefined;
  const d = new Date(Date.UTC(year, month, day));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

// "updated" carries no timezone suffix and 0/3/6 fractional digits. It must be treated
// as UTC explicitly, and the fractional part truncated to milliseconds for Date to parse.
function parseUpdatedAsUtc(updated: unknown): string | undefined {
  if (typeof updated !== 'string') return undefined;
  const trimmed = updated.trim();
  const m = trimmed.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/);
  if (!m) return undefined;
  const [, base, frac, tz] = m;
  const millis = frac ? `.${frac.slice(1, 4).padEnd(3, '0')}` : '.000';
  const timezone = tz ?? 'Z';
  const d = new Date(`${base}${millis}${timezone}`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

interface NvdResult {
  cvssScore?: number;
  cvssVector?: string;
  description?: string;
  severity: SeverityLevel;
}

export class VmwareAdapter implements VendorAdapter {
  readonly vendorCode = 'vmware';
  readonly vendorName = 'VMware / Broadcom';

  readonly listUrl =
    'https://support.broadcom.com/web/ecx/security-advisory/-/securityadvisory/getSecurityAdvisoryList';
  readonly nvdUrl = 'https://services.nvd.nist.gov/rest/json/cves/2.0';

  readonly endpoints: VendorEndpoint[] = [
    { label: 'Advisories list', url: this.listUrl },
    { label: 'NVD CVE lookup', url: `${this.nvdUrl}?cveId={cveId}` },
  ];

  async fetchAdvisories(limit = 20): Promise<NormalizedAdvisoryItem[]> {
    const res = await fetch(this.listUrl, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({
        pageNumber: 0,
        pageSize: limit,
        searchVal: '',
        segment: 'VC',
        sortInfo: { column: '', order: '' },
      }),
    });

    if (!res.ok) {
      const msg = res.statusText || `HTTP ${res.status}`;
      throw new Error(`Failed to fetch VMware advisories list: ${msg}`);
    }

    const listData = await res.json();
    const items = this.parse(listData).slice(0, limit);

    await this.enrichWithNvd(items);

    return items;
  }

  parse(rawPayload: unknown): NormalizedAdvisoryItem[] {
    if (!rawPayload || typeof rawPayload !== 'object') {
      return [];
    }

    let rows: unknown[];
    if (Array.isArray(rawPayload)) {
      rows = rawPayload;
    } else {
      const data = (rawPayload as any).data;
      const list = Array.isArray(data?.list)
        ? data.list
        : Array.isArray((rawPayload as any).list)
          ? (rawPayload as any).list
          : null;
      if (!list) return [];
      rows = list;
    }

    const normalizedItems: NormalizedAdvisoryItem[] = [];

    for (const raw of rows) {
      if (!raw || typeof raw !== 'object') continue;
      const row = raw as Record<string, unknown>;

      const title = typeof row.title === 'string' ? row.title : '';
      const documentId = typeof row.documentId === 'string' ? row.documentId : '';
      const vmsaMatch = title.match(VMSA_ID_REGEX);
      const advisoryId = vmsaMatch ? vmsaMatch[0].toUpperCase() : documentId;

      const severity = normalizeSeverity(row.severity);
      const publishedAt = parsePublishedDate(row.published) ?? '';
      const updatedAt = parseUpdatedAsUtc(row.updated);
      const url = typeof row.notificationUrl === 'string' ? row.notificationUrl : '';

      const workAround = typeof row.workAround === 'string' ? row.workAround.trim() : '';
      const mitigation = workAround && workAround !== 'None' ? workAround : undefined;

      const cves = extractCveIds(row.affectedCve).map((cveId) => ({
        cveId,
        severity,
      }));

      normalizedItems.push({
        advisoryId,
        title,
        severity,
        publishedAt,
        updatedAt,
        url,
        mitigation,
        cves,
        rawPayload: row,
      });
    }

    return normalizedItems;
  }

  private async enrichWithNvd(items: NormalizedAdvisoryItem[]): Promise<void> {
    const uniqueCveIds: string[] = [];
    const seen = new Set<string>();
    for (const item of items) {
      for (const cve of item.cves) {
        if (!seen.has(cve.cveId)) {
          seen.add(cve.cveId);
          uniqueCveIds.push(cve.cveId);
        }
      }
    }

    const nvdResults = new Map<string, NvdResult>();

    // Strictly sequential: NVD returns 429s at concurrency >= 5 in this project's
    // measurements. Do not switch this to Promise.all / batching.
    for (let i = 0; i < uniqueCveIds.length && i < NVD_MAX_REQUESTS; i++) {
      const cveId = uniqueCveIds[i];

      let res: Response;
      try {
        res = await fetch(`${this.nvdUrl}?cveId=${encodeURIComponent(cveId)}`);
      } catch {
        continue;
      }

      if (res.status === 429) {
        break;
      }
      if (!res.ok) {
        continue;
      }

      let body: any;
      try {
        body = await res.json();
      } catch {
        continue;
      }

      if (body?.totalResults === 0) continue;
      const cveEntry = body?.vulnerabilities?.[0]?.cve;
      if (!cveEntry) continue;

      const cvssData = cveEntry?.metrics?.cvssMetricV31?.[0]?.cvssData;
      const description = cveEntry?.descriptions?.[0]?.value;

      nvdResults.set(cveId, {
        cvssScore: typeof cvssData?.baseScore === 'number' ? cvssData.baseScore : undefined,
        cvssVector: typeof cvssData?.vectorString === 'string' ? cvssData.vectorString : undefined,
        description: typeof description === 'string' ? description : undefined,
        severity: normalizeSeverity(cvssData?.baseSeverity),
      });
    }

    // Broadcom's own severity is the source of truth for advisory severity; a missing
    // or unresolved NVD record must never change or clear it.
    for (const item of items) {
      for (const cve of item.cves) {
        const result = nvdResults.get(cve.cveId);
        if (!result) continue;
        cve.cvssScore = result.cvssScore;
        cve.cvssVector = result.cvssVector;
        cve.description = result.description;
        if (result.severity !== 'UNKNOWN') {
          cve.severity = result.severity;
        }
      }
    }
  }
}
