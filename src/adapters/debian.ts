import {
  VendorAdapter,
  VendorEndpoint,
  NormalizedAdvisoryItem,
  SeverityLevel,
  ProductImpactItem,
} from '@/types';

function normalizeDebianUrgency(urgency: unknown): SeverityLevel {
  if (typeof urgency !== 'string') return 'MEDIUM';
  const u = urgency.trim().toLowerCase();
  if (u.includes('high') || u.includes('critical') || u.includes('emergency')) return 'HIGH';
  if (u.includes('medium') || u.includes('moderate')) return 'MEDIUM';
  if (u.includes('low') || u.includes('unimportant')) return 'LOW';
  return 'MEDIUM';
}

const CVE_ID_REGEX = /^CVE-\d{4}-\d{4,}$/i;
const DSA_HEADER_REGEX = /^\[(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\]\s+((?:DSA|DLA)-\d+-\d+)\s+([^\s]+)\s*-\s*(.*)$/;

export class DebianAdapter implements VendorAdapter {
  readonly vendorCode = 'debian';
  readonly vendorName = 'Debian';

  readonly trackerJsonUrl = 'https://security-tracker.debian.org/tracker/data/json';
  readonly dsaListUrl =
    'https://salsa.debian.org/security-tracker-team/security-tracker/-/raw/master/data/DSA/list';
  readonly dlaListUrl =
    'https://salsa.debian.org/security-tracker-team/security-tracker/-/raw/master/data/DLA/list';
  readonly trackerBaseUrl = 'https://security-tracker.debian.org/tracker';

  readonly endpoints: VendorEndpoint[] = [
    { label: 'Debian Security Tracker JSON', url: this.trackerJsonUrl },
    { label: 'Debian Security Advisories (DSA) list', url: this.dsaListUrl },
    { label: 'Debian LTS Advisories (DLA) list', url: this.dlaListUrl },
    { label: 'Security Tracker Lookup', url: `${this.trackerBaseUrl}/{cveOrDsa}` },
  ];

  dsaLookupUrl(dsaId: string): string {
    return `${this.trackerBaseUrl}/${encodeURIComponent(dsaId)}`;
  }

  cveLookupUrl(cveId: string): string {
    return `${this.trackerBaseUrl}/${encodeURIComponent(cveId)}`;
  }

  async fetchAdvisories(limit = 20): Promise<NormalizedAdvisoryItem[]> {
    const res = await fetch(this.dsaListUrl);
    if (!res.ok) {
      const msg = res.statusText || `HTTP ${res.status}`;
      throw new Error(`Failed to fetch Debian advisories: ${msg}`);
    }

    const text = await res.text();
    const items = this.parse(text);
    return items.slice(0, limit);
  }

  async fetchAdvisoryById(id: string): Promise<NormalizedAdvisoryItem | null> {
    const cleanId = id.trim().toUpperCase();
    const url = cleanId.startsWith('DLA-') ? this.dlaListUrl : this.dsaListUrl;
    const res = await fetch(url);
    if (!res.ok) return null;

    const text = await res.text();
    const idx = text.indexOf(cleanId);
    if (idx === -1) return null;

    const lineStart = text.lastIndexOf('\n', idx);
    const start = lineStart === -1 ? 0 : lineStart + 1;
    const nextEntry = text.indexOf('\n[', start + 1);
    const chunk = nextEntry === -1 ? text.slice(start) : text.slice(start, nextEntry);

    const items = this.parse(chunk);
    return items.find((item) => item.advisoryId.toUpperCase() === cleanId) || items[0] || null;
  }

  async fetchAdvisoryByCve(cveId: string): Promise<NormalizedAdvisoryItem | null> {
    const cleanCve = cveId.trim().toUpperCase();
    if (!CVE_ID_REGEX.test(cleanCve)) return null;

    for (const url of [this.dsaListUrl, this.dlaListUrl]) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;

        const text = await res.text();
        const idx = text.indexOf(cleanCve);
        if (idx === -1) continue;

        const prevEntry = text.lastIndexOf('\n[', idx);
        const start = prevEntry === -1 ? 0 : prevEntry + 1;
        const nextEntry = text.indexOf('\n[', idx);
        const chunk = nextEntry === -1 ? text.slice(start) : text.slice(start, nextEntry);

        const items = this.parse(chunk);
        const match = items.find((item) => item.cves.some((c) => c.cveId === cleanCve));
        if (match) return match;
      } catch {
        // Fall through to next list
      }
    }
    return null;
  }

  parse(rawPayload: unknown): NormalizedAdvisoryItem[] {
    if (!rawPayload) return [];

    if (typeof rawPayload === 'string') {
      return this.parseDsaListText(rawPayload);
    }

    if (Array.isArray(rawPayload)) {
      return rawPayload.flatMap((entry) => this.parse(entry));
    }

    if (typeof rawPayload === 'object') {
      const obj = rawPayload as Record<string, any>;
      if (typeof obj.advisoryId === 'string' && Array.isArray(obj.cves)) {
        return [obj as NormalizedAdvisoryItem];
      }
      if (
        (obj.id && typeof obj.id === 'string' && (obj.id.startsWith('DSA-') || obj.id.startsWith('DLA-'))) ||
        (obj.dsaId && typeof obj.dsaId === 'string')
      ) {
        return this.parseStructuredDsa(obj);
      }
      return this.parseTrackerJson(obj);
    }

    return [];
  }

  private parseDsaListText(text: string): NormalizedAdvisoryItem[] {
    const lines = text.split(/\r?\n/);
    const advisories: NormalizedAdvisoryItem[] = [];

    let currentAdv: {
      dateStr: string;
      dsaId: string;
      pkgName: string;
      titleDesc: string;
      cveIds: string[];
      releases: { release: string; pkg: string; version: string }[];
    } | null = null;

    const commitCurrent = () => {
      if (!currentAdv) return;

      if (currentAdv.cveIds.length === 0 && currentAdv.titleDesc) {
        const matches = currentAdv.titleDesc.match(/CVE-\d{4}-\d{4,}/gi);
        if (matches) {
          for (const m of matches) {
            const u = m.toUpperCase();
            if (!currentAdv.cveIds.includes(u)) {
              currentAdv.cveIds.push(u);
            }
          }
        }
      }

      if (currentAdv.cveIds.length === 0) return;

      const { dateStr, dsaId, pkgName, titleDesc, cveIds, releases } = currentAdv;
      const title = `[${pkgName}] Debian Security Advisory ${dsaId}`;
      const publishedAt = this.parseDebianDate(dateStr);
      const url = this.dsaLookupUrl(dsaId);
      const solution = `請透過 APT 工具執行更新：sudo apt-get update && sudo apt-get --only-upgrade install -y ${pkgName}`;
      const summary = `Debian 安全公告 ${dsaId} 修復了 ${pkgName} 套件中的資安弱點 (${cveIds.join(', ')})。`;

      const affectedProducts = releases.map((r) => `Debian ${r.release}`);
      const fixedVersions = Array.from(new Set(releases.map((r) => r.version).filter(Boolean)));

      const productImpacts: ProductImpactItem[] = releases.map((r) => ({
        product_name: `Debian ${r.release}`,
        component: pkgName,
        state: 'Fixed',
        justification: r.version,
        errata: dsaId,
        release_date: publishedAt,
      }));

      const parsedCves = cveIds.map((cveId) => ({
        cveId,
        description: `${pkgName} security update for ${cveId}`,
        severity: 'HIGH' as SeverityLevel,
        affectedProducts,
        productImpacts,
        fixedVersions,
        solution,
      }));

      advisories.push({
        advisoryId: dsaId,
        title,
        severity: 'HIGH',
        publishedAt,
        url,
        summary,
        solution,
        cves: parsedCves,
        rawPayload: {
          id: dsaId,
          dsaId,
          package: pkgName,
          pkgName,
          cves: cveIds,
          cveIds,
          releases,
          titleDesc,
          date: dateStr,
          description: summary,
        },
      });
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const headerMatch = line.match(DSA_HEADER_REGEX);
      if (headerMatch) {
        commitCurrent();
        currentAdv = {
          dateStr: headerMatch[1],
          dsaId: headerMatch[2],
          pkgName: headerMatch[3],
          titleDesc: headerMatch[4],
          cveIds: [],
          releases: [],
        };
        continue;
      }

      if (currentAdv) {
        if (line.startsWith('\t{') || line.startsWith('  {') || trimmed.startsWith('{')) {
          const cveMatches = line.match(/CVE-\d{4}-\d{4,}/gi);
          if (cveMatches) {
            for (const c of cveMatches) {
              const u = c.toUpperCase();
              if (!currentAdv.cveIds.includes(u)) {
                currentAdv.cveIds.push(u);
              }
            }
          }
        } else if (line.startsWith('\t[') || line.startsWith('  [') || trimmed.startsWith('[')) {
          // Release format: [trixie] - ruby-rack 3.1.20-0+deb13u2
          const relMatch = line.match(/\[([^\]]+)\]\s*-\s*([^\s]+)\s*(.*)/);
          if (relMatch) {
            currentAdv.releases.push({
              release: relMatch[1].trim(),
              pkg: relMatch[2].trim(),
              version: relMatch[3].trim(),
            });
          }
        }
      }
    }

    commitCurrent();
    return advisories;
  }

  private parseStructuredDsa(obj: Record<string, any>): NormalizedAdvisoryItem[] {
    const advisoryId = obj.id || obj.dsaId;
    const pkg = obj.package || obj.pkgName || 'package';
    const title = obj.title || `[${pkg}] Debian Security Advisory ${advisoryId}`;
    const publishedAt = obj.date ? this.parseDebianDate(obj.date) : new Date().toISOString();
    const url = this.dsaLookupUrl(advisoryId);
    const summary = obj.description || `Debian Security Advisory ${advisoryId} for ${pkg}`;
    const solution = `請透過 APT 工具執行更新：sudo apt-get update && sudo apt-get --only-upgrade install -y ${pkg}`;

    const rawCves = Array.isArray(obj.cves) ? obj.cves : (Array.isArray(obj.cveIds) ? obj.cveIds : []);
    const cveIds = rawCves.map((c: any) => String(c).toUpperCase()).filter((c: string) => CVE_ID_REGEX.test(c));

    const productImpacts: ProductImpactItem[] = [];
    const fixedVersions: string[] = [];
    const affectedProducts: string[] = [];

    if (Array.isArray(obj.releases)) {
      for (const r of obj.releases) {
        const prodName = `Debian ${r.release}`;
        affectedProducts.push(prodName);
        if (r.version) fixedVersions.push(r.version);
        productImpacts.push({
          product_name: prodName,
          component: pkg,
          state: 'Fixed',
          justification: r.version || undefined,
          errata: advisoryId,
          release_date: publishedAt,
        });
      }
    } else if (obj.releases && typeof obj.releases === 'object') {
      for (const [rel, data] of Object.entries(obj.releases)) {
        const prodName = `Debian ${rel}`;
        affectedProducts.push(prodName);
        const ver = (data as any)?.version || '';
        if (ver) fixedVersions.push(ver);
        productImpacts.push({
          product_name: prodName,
          component: pkg,
          state: 'Fixed',
          justification: ver || undefined,
          errata: advisoryId,
          release_date: publishedAt,
        });
      }
    }

    const parsedCves = cveIds.map((cveId: string) => ({
      cveId,
      description: summary,
      severity: 'HIGH' as SeverityLevel,
      affectedProducts,
      productImpacts,
      fixedVersions,
      solution,
    }));

    if (parsedCves.length === 0) return [];

    return [
      {
        advisoryId,
        title,
        severity: 'HIGH',
        publishedAt,
        url,
        summary,
        solution,
        cves: parsedCves,
        rawPayload: obj,
      },
    ];
  }

  private parseTrackerJson(data: Record<string, any>): NormalizedAdvisoryItem[] {
    const advisories: NormalizedAdvisoryItem[] = [];

    for (const [pkgName, cvesMap] of Object.entries(data)) {
      if (!cvesMap || typeof cvesMap !== 'object') continue;

      for (const [cveIdRaw, cveData] of Object.entries(cvesMap as Record<string, any>)) {
        const cveId = cveIdRaw.toUpperCase();
        if (!CVE_ID_REGEX.test(cveId)) continue;

        const description = typeof cveData.description === 'string' ? cveData.description : '';
        const releases = cveData.releases && typeof cveData.releases === 'object' ? cveData.releases : {};

        let highestSeverity: SeverityLevel = 'LOW';
        const productImpacts: ProductImpactItem[] = [];
        const fixedVersions: string[] = [];
        const affectedProducts: string[] = [];

        for (const [releaseName, relInfo] of Object.entries(releases as Record<string, any>)) {
          const prodName = `Debian ${releaseName}`;
          affectedProducts.push(prodName);

          const status = relInfo?.status === 'resolved' ? 'Fixed' : 'Affected';
          const urgency = normalizeDebianUrgency(relInfo?.urgency);
          if (urgency === 'HIGH') highestSeverity = 'HIGH';
          else if (urgency === 'MEDIUM' && highestSeverity !== 'HIGH') highestSeverity = 'MEDIUM';

          const fixedVer = relInfo?.fixed_version || relInfo?.repositories?.[releaseName] || '';
          if (fixedVer) fixedVersions.push(fixedVer);

          productImpacts.push({
            product_name: prodName,
            component: pkgName,
            state: status,
            justification: fixedVer || undefined,
            errata: `DSA-${pkgName}`,
          });
        }

        const advisoryId = `DEBIAN-${pkgName}-${cveId}`;
        const solution = `sudo apt-get update && sudo apt-get --only-upgrade install -y ${pkgName}`;

        advisories.push({
          advisoryId,
          title: `[${pkgName}] ${cveId}`,
          severity: highestSeverity,
          publishedAt: new Date().toISOString(),
          url: this.cveLookupUrl(cveId),
          summary: description || `Debian security issue for ${pkgName}`,
          solution,
          cves: [
            {
              cveId,
              description,
              severity: highestSeverity,
              affectedProducts,
              productImpacts,
              fixedVersions,
              solution,
            },
          ],
          rawPayload: { pkgName, cveId, cveData },
        });
      }
    }

    return advisories;
  }

  private parseDebianDate(dateStr: string): string {
    try {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    } catch {
      // Fallback
    }
    return new Date().toISOString();
  }
}
