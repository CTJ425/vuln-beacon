import {
  NormalizedAdvisoryItem,
  VendorAdapter,
  VendorEndpoint,
  ProductImpactItem,
  SecurityFixItem,
  UpdatedPackageItem,
} from '@/types';
import { calculateSeverityFromCvss, normalizeSeverity } from '@/utils/cvss';

interface RedHatRawPackageState {
  product_name?: string;
  fix_state?: string;
  package_name?: string;
  cpe?: string;
  justification?: string;
  advisory?: string;
  release_date?: string;
}

interface RedHatRawAffectedRelease {
  product_name?: string;
  release_date?: string;
  advisory?: string;
  cpe?: string;
  package?: string;
}

interface RedHatRawItem {
  CVE?: string;
  severity?: string;
  public_date?: string;
  advisories?: string[];
  bugzilla?: string | { id?: string; description?: string; url?: string };
  bugzilla_description?: string;
  cvss3_score?: string | number;
  cvss3_scoring_vector?: string;
  resource_url?: string;
  affected_packages?: string[];
  package_state?: RedHatRawPackageState[];
  affected_release?: RedHatRawAffectedRelease[];
  statement?: string;
  mitigation?: { value?: string } | string;
  details?: string[];
  references?: string[];
  // Fields only present in the "CVE detail" endpoint shape (/cve/<id>.json).
  name?: string;
  threat_severity?: string;
  cvss3?: { cvss3_base_score?: string | number; cvss3_scoring_vector?: string };
}

// NOTE: this adapter is intentionally absent from ALL_ADAPTERS (src/adapters/index.ts).
// It shares vendorCode 'redhat' with RedHatCsafAdapter, which is the adapter that must
// resolve for 'redhat' (SyncService.fetchAndIngestQuery feeds it CSAF documents). This
// class stays exported for callers that construct it explicitly (see BUG-015).
export class RedHatAdapter implements VendorAdapter {
  readonly vendorCode = 'redhat';
  readonly vendorName = 'Red Hat';
  private readonly apiUrl = 'https://access.redhat.com/hydra/rest/securitydata/cve.json';
  private readonly detailUrlBase = 'https://access.redhat.com/hydra/rest/securitydata/cve';
  readonly endpoints: VendorEndpoint[] = [
    { label: 'CVE list (legacy Security Data API)', url: `${this.apiUrl}?per_page=60` },
    { label: 'CVE detail (legacy Security Data API)', url: `${this.detailUrlBase}/{cveId}.json` },
  ];

  async fetchAdvisories(): Promise<NormalizedAdvisoryItem[]> {
    // Fetch recent CVEs from Red Hat Security Data API
    const response = await fetch(`${this.apiUrl}?per_page=60`);
    if (!response.ok) {
      throw new Error(`Failed to fetch Red Hat advisories: ${response.statusText}`);
    }
    const list = (await response.json()) as RedHatRawItem[];
    if (!Array.isArray(list)) return [];

    // Fetch individual CVE details in parallel batches to extract package_state, affected_release, statement, mitigation
    const enrichedItems: RedHatRawItem[] = await Promise.all(
      list.map(async (item) => {
        if (!item.CVE) return item;
        try {
          const detailRes = await fetch(`${this.detailUrlBase}/${item.CVE}.json`);
          if (detailRes.ok) {
            const detail = await detailRes.json();
            return {
              ...item,
              severity: detail.threat_severity || item.severity,
              public_date: detail.public_date || item.public_date,
              advisories: (detail.advisories && detail.advisories.length > 0)
                ? detail.advisories
                : item.advisories || (detail.affected_release ? detail.affected_release.map((ar: any) => ar.advisory).filter(Boolean) : []),
              bugzilla: detail.bugzilla || item.bugzilla,
              bugzilla_description: detail.bugzilla_description || item.bugzilla_description,
              cvss3_score: detail.cvss3_score || detail.cvss3?.cvss3_base_score || item.cvss3_score,
              cvss3_scoring_vector: detail.cvss3_scoring_vector || detail.cvss3?.cvss3_scoring_vector || item.cvss3_scoring_vector,
              package_state: detail.package_state,
              affected_release: detail.affected_release,
              statement: detail.statement,
              mitigation: detail.mitigation,
              details: detail.details,
              references: detail.references,
            };
          }
        } catch {
          // Fallback to list item
        }
        return item;
      })
    );

    return this.parse(enrichedItems);
  }

  parse(rawPayload: unknown): NormalizedAdvisoryItem[] {
    if (!Array.isArray(rawPayload)) {
      return [];
    }

    const items: NormalizedAdvisoryItem[] = [];

    for (const rawInput of rawPayload as RedHatRawItem[]) {
      // Normalize the "CVE detail" endpoint shape (/cve/<id>.json) onto the
      // same fields the "CVE list" endpoint (/cve.json) already uses, so the
      // rest of this loop can keep reading `raw.CVE`, `raw.severity`, etc.
      const bugzillaIsObject = typeof rawInput.bugzilla === 'object' && rawInput.bugzilla !== null;
      const normalizedBugzilla: string | undefined = bugzillaIsObject
        ? (rawInput.bugzilla as { id?: string }).id
        : (rawInput.bugzilla as string | undefined);
      const raw: Omit<RedHatRawItem, 'bugzilla'> & { bugzilla?: string } = {
        ...rawInput,
        CVE: rawInput.CVE || rawInput.name,
        severity: rawInput.severity || rawInput.threat_severity,
        cvss3_score: rawInput.cvss3_score || rawInput.cvss3?.cvss3_base_score,
        cvss3_scoring_vector: rawInput.cvss3_scoring_vector || rawInput.cvss3?.cvss3_scoring_vector,
        bugzilla: normalizedBugzilla,
        bugzilla_description: rawInput.bugzilla_description
          || (bugzillaIsObject ? (rawInput.bugzilla as { description?: string }).description : undefined),
      };

      if (!raw.CVE) continue;

      // Deduplicated: an upstream record may list the same errata id more than
      // once, which would otherwise emit duplicate advisories and mappings.
      const advisoriesList = Array.from(new Set(
        raw.advisories && raw.advisories.length > 0
          ? raw.advisories.filter((a) => /^RH[SBE]A-\d{4}:\d+$/i.test(a))
          : (raw.affected_release ? raw.affected_release.map((ar) => ar.advisory).filter(Boolean) as string[] : [])
      ));

      const hasRealAdvisory = advisoriesList.length > 0;
      const primaryAdvisoryId = hasRealAdvisory ? advisoriesList[0] : raw.CVE;

      const cvssScore = raw.cvss3_score ? Number(raw.cvss3_score) : null;
      const severity = cvssScore
        ? calculateSeverityFromCvss(cvssScore)
        : normalizeSeverity(raw.severity);

      // Extract Products & Components Impact Matrix (Both Affected and Not Affected)
      const productImpacts: ProductImpactItem[] = [];

      // 1. Parse package_state (Affected, Not affected, Fix deferred, Will not fix)
      if (raw.package_state && Array.isArray(raw.package_state)) {
        for (const ps of raw.package_state) {
          if (ps.product_name || ps.package_name) {
            productImpacts.push({
              product_name: ps.product_name || 'Red Hat Enterprise Linux Ecosystem',
              component: ps.package_name || 'core-component',
              state: ps.fix_state || 'Affected',
              justification: ps.justification || 'None',
              errata: ps.advisory || '-',
              release_date: ps.release_date || '-',
              cpe: ps.cpe,
            });
          }
        }
      }

      // 2. Parse affected_release (Fixed)
      const updatedPackages: UpdatedPackageItem[] = [];
      if (raw.affected_release && Array.isArray(raw.affected_release)) {
        for (const ar of raw.affected_release) {
          if (ar.product_name || ar.package) {
            productImpacts.push({
              product_name: ar.product_name || 'Red Hat Enterprise Linux',
              component: ar.package || 'package-release',
              state: 'Fixed',
              justification: 'None',
              errata: ar.advisory || primaryAdvisoryId,
              release_date: ar.release_date || raw.public_date || '-',
              cpe: ar.cpe,
            });

            updatedPackages.push({
              package_name: ar.package || 'updated-package',
              product: ar.product_name,
              advisory: ar.advisory || primaryAdvisoryId,
              release_date: ar.release_date,
            });
          }
        }
      }

      // 3. Fallback for fixtures or simple list
      if (productImpacts.length === 0 && raw.affected_packages && Array.isArray(raw.affected_packages) && raw.affected_packages.length > 0) {
        for (const pkg of raw.affected_packages) {
          productImpacts.push({
            product_name: 'Red Hat Enterprise Linux Ecosystem',
            component: pkg,
            state: advisoriesList.length > 0 ? 'Fixed' : 'Affected',
            justification: 'None',
            errata: advisoriesList[0] || '-',
            release_date: raw.public_date || '-',
          });
        }
      }

      if (productImpacts.length === 0) {
        let component = 'core-component';
        if (raw.bugzilla_description) {
          const colonIdx = raw.bugzilla_description.indexOf(':');
          if (colonIdx > 0 && colonIdx < 50) {
            component = raw.bugzilla_description.substring(0, colonIdx).trim();
          }
        }

        productImpacts.push({
          product_name: 'Red Hat Enterprise Linux Ecosystem',
          component,
          state: advisoriesList.length > 0 ? 'Fixed' : 'Affected',
          justification: 'None',
          errata: advisoriesList[0] || '-',
          release_date: raw.public_date || '-',
        });
      }

      const affectedProducts = Array.from(
        new Set([
          ...(raw.affected_packages || []),
          ...productImpacts.map((p) => p.product_name),
        ])
      );

      const hasRhsa = advisoriesList.length > 0;

      const componentName = productImpacts[0]?.component || 'system components';
      const topic = `An update for ${componentName} is now available for Red Hat Enterprise Linux and container ecosystem products. Red Hat Product Security has rated this update as having a security impact of ${severity}.`;

      const mitigationText = typeof raw.mitigation === 'object' ? raw.mitigation?.value : raw.mitigation;

      const securityFixes: SecurityFixItem[] = [
        {
          cve_id: raw.CVE,
          component: componentName,
          summary: raw.bugzilla_description || raw.CVE,
          bugzilla_id: raw.bugzilla,
          bugzilla_url: raw.bugzilla ? `https://bugzilla.redhat.com/show_bug.cgi?id=${raw.bugzilla}` : undefined,
        },
      ];

      // One item per RHSA (or the single CVE-id fallback when no errata has been released yet).
      const advisoryIdsToEmit = hasRhsa ? advisoriesList : [primaryAdvisoryId];

      for (const advisoryId of advisoryIdsToEmit) {
        const fixedVersions = hasRhsa
          ? [`Released in ${advisoryId}`]
          : productImpacts.filter((p) => p.state === 'Fixed').map((p) => `Fixed in ${p.errata || p.component}`);

        if (fixedVersions.length === 0) {
          fixedVersions.push('Vendor errata release pending');
        }

        const solution = hasRhsa
          ? `請依據官方發佈之資安更新公告 (${advisoryId}) 執行 dnf/yum update 升級至最新修復套件。詳情請參閱官方指引：https://access.redhat.com/articles/11258`
          : '官方目前針對該漏洞分析處置中，請密切關注 Red Hat Errata 公告更新，或依安全指引評估暫時緩解措施。';

        items.push({
          advisoryId,
          title: raw.bugzilla_description || `Red Hat Advisory for ${raw.CVE}`,
          severity,
          publishedAt: raw.public_date || new Date().toISOString(),
          url: hasRhsa ? `https://access.redhat.com/errata/${advisoryId}` : `https://access.redhat.com/security/cve/${raw.CVE}`,
          summary: raw.bugzilla_description,
          solution,
          topic,
          mitigation: mitigationText,
          statement: raw.statement,
          securityFixes,
          updatedPackages,
          cves: [
            {
              cveId: raw.CVE,
              description: raw.bugzilla_description,
              cvssScore: cvssScore ?? undefined,
              cvssVector: raw.cvss3_scoring_vector,
              severity,
              affectedProducts,
              productImpacts,
              fixedVersions,
              solution,
            },
          ],
          rawPayload: {
            ...raw,
            all_advisories: advisoriesList,
          } as unknown as Record<string, unknown>,
        });
      }
    }

    return items;
  }
}
