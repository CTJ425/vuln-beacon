import { NormalizedAdvisoryItem, VendorAdapter, VendorEndpoint, ProductImpactItem } from '@/types';
import { normalizeSeverity } from '@/utils/cvss';

interface CsafNote {
  category?: string;
  text?: string;
  title?: string;
}

interface CsafRemediation {
  category?: string;
  details?: string;
  product_ids?: string[];
}

interface CsafThreat {
  category?: string;
  details?: string;
}

interface CsafScore {
  cvss_v3?: {
    baseScore?: number;
    baseSeverity?: string;
    vectorString?: string;
  };
}

interface CsafVulnerability {
  cve?: string;
  title?: string;
  notes?: CsafNote[];
  remediations?: CsafRemediation[];
  scores?: CsafScore[];
  threats?: CsafThreat[];
  product_status?: Record<string, string[]>;
}

interface CsafProductNameNode {
  category?: string;
  product?: {
    product_id?: string;
    name?: string;
  };
  branches?: CsafProductNameNode[];
}

interface CsafDocument {
  document?: {
    title?: string;
    aggregate_severity?: { text?: string };
    tracking?: {
      id?: string;
      initial_release_date?: string;
      current_release_date?: string;
    };
    notes?: CsafNote[];
  };
  product_tree?: {
    branches?: CsafProductNameNode[];
  };
  vulnerabilities?: CsafVulnerability[];
}

const STATE_LABELS: Record<string, string> = {
  fixed: 'Fixed',
  known_affected: 'Affected',
  known_not_affected: 'Not affected',
  under_investigation: 'Under investigation',
};

function labelForState(key: string): string {
  if (STATE_LABELS[key]) return STATE_LABELS[key];
  return key
    .split('_')
    .map((word, idx) => (idx === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

function indexProductNames(
  nodes: CsafProductNameNode[] | undefined,
  index: Map<string, string>
): void {
  if (!nodes) return;
  for (const node of nodes) {
    if (node.category === 'product_name' && node.product?.product_id && node.product?.name) {
      index.set(node.product.product_id, node.product.name);
    }
    if (node.branches) {
      indexProductNames(node.branches, index);
    }
  }
}

const LANGPACK_RE = /^(.+)-langpack-[a-zA-Z]+(?:_[a-zA-Z]+)?$/;

/**
 * Red Hat ships one package per locale (e.g. glibc-langpack-aa, glibc-langpack-ab, ...).
 * Collapse each (product_name, state) locale family into a single summary row so the
 * impact matrix is not drowned by dozens of near-identical entries.
 */
function collapseLocalePackages(productImpacts: ProductImpactItem[]): ProductImpactItem[] {
  const result: ProductImpactItem[] = [];
  const families = new Map<string, { base: string; members: Map<string, ProductImpactItem> }>();

  for (const item of productImpacts) {
    const match = item.component.match(LANGPACK_RE);
    if (!match) {
      result.push(item);
      continue;
    }
    const base = match[1];
    const familyKey = `${item.product_name}|${item.state}|${base}-langpack`;
    let family = families.get(familyKey);
    if (!family) {
      family = { base, members: new Map() };
      families.set(familyKey, family);
    }
    if (!family.members.has(item.component)) {
      family.members.set(item.component, item);
    }
  }

  for (const family of families.values()) {
    const first = family.members.values().next().value as ProductImpactItem;
    const count = family.members.size;
    result.push({
      ...first,
      component: `${family.base}-langpack-* (${count} 個語系)`,
    });
  }

  return result;
}

function componentFromNvr(nvr: string): string {
  // Container image references carry a per-architecture digest, e.g.
  // "registry.redhat.io/openshift4/ose-hypershift-rhel9@sha256:<hex>_arm64".
  // Collapse to the repository path so every digest/arch dedupes to one row
  // (BUG-003). Applied before the NVR cut below.
  const digestMatch = nvr.match(/@sha256:/i);
  if (digestMatch && digestMatch.index !== undefined) {
    return nvr.slice(0, digestMatch.index);
  }
  // Cut at the first "-<digits>:" occurrence (e.g. "glibc-0:2.28-225.el8_8.6.x86_64" -> "glibc").
  const match = nvr.match(/-\d+:/);
  if (!match || match.index === undefined) return nvr;
  return nvr.slice(0, match.index);
}

export class RedHatCsafAdapter implements VendorAdapter {
  readonly vendorCode = 'redhat';
  readonly vendorName = 'Red Hat';
  readonly listUrl = 'https://access.redhat.com/hydra/rest/securitydata/csaf.json';
  readonly detailUrlBase = 'https://access.redhat.com/hydra/rest/securitydata/csaf';
  readonly endpoints: VendorEndpoint[] = [
    { label: 'Advisory list (CSAF)', url: `${this.listUrl}?per_page=50` },
    { label: 'Advisory detail (CSAF)', url: `${this.detailUrlBase}/{advisoryId}.json` },
    { label: 'CVE reverse lookup', url: `${this.listUrl}?cve={cveId}` },
  ];

  advisoryDetailUrl(advisoryId: string): string {
    return `${this.detailUrlBase}/${advisoryId}.json`;
  }

  cveLookupUrl(cveId: string): string {
    return `${this.listUrl}?cve=${cveId}`;
  }

  async fetchAdvisories(): Promise<NormalizedAdvisoryItem[]> {
    const response = await fetch(`${this.listUrl}?per_page=50`);
    if (!response.ok) {
      throw new Error(`Failed to fetch Red Hat CSAF advisories: ${response.statusText}`);
    }
    const list = (await response.json()) as { RHSA?: string }[];
    if (!Array.isArray(list)) return [];

    const detailDocuments: unknown[] = (
      await Promise.all(
        list.map(async (entry) => {
          if (!entry.RHSA) return null;
          try {
            const detailRes = await fetch(this.advisoryDetailUrl(entry.RHSA));
            if (detailRes.ok) {
              return await detailRes.json();
            }
          } catch {
            // Skip this advisory rather than failing the whole batch.
          }
          return null;
        })
      )
    ).filter((doc) => doc !== null);

    return this.parse(detailDocuments);
  }

  parse(rawPayload: unknown): NormalizedAdvisoryItem[] {
    if (!Array.isArray(rawPayload)) {
      return [];
    }

    const items: NormalizedAdvisoryItem[] = [];

    for (const doc of rawPayload as CsafDocument[]) {
      const advisoryId = doc?.document?.tracking?.id;
      const vulnerabilities = doc?.vulnerabilities;
      if (!advisoryId || !Array.isArray(vulnerabilities) || vulnerabilities.length === 0) {
        continue;
      }

      const document = doc.document!;
      const notes = document.notes || [];

      const rawTitle = document.title || '';
      const title = rawTitle.replace(
        /^Red Hat (Security|Bug Fix|Enhancement) Advisory: /,
        ''
      );

      const severity = normalizeSeverity(document.aggregate_severity?.text);
      const publishedAt = document.tracking?.initial_release_date || '';
      const updatedAt = document.tracking?.current_release_date;
      const url = `https://access.redhat.com/errata/${advisoryId}`;

      const summaryText = notes.find((n) => n.category === 'summary')?.text;
      const summary = summaryText;
      const topic = summaryText;
      const statement = notes.find((n) => n.category === 'general')?.text;

      let solution: string | undefined;
      let mitigation: string | undefined;
      for (const vuln of vulnerabilities) {
        if (!solution) {
          const vendorFix = vuln.remediations?.find((r) => r.category === 'vendor_fix');
          if (vendorFix?.details) solution = vendorFix.details;
        }
        if (!mitigation) {
          const workaround = vuln.remediations?.find((r) => r.category === 'workaround');
          if (workaround?.details) mitigation = workaround.details;
        }
        if (solution && mitigation) break;
      }

      const productNameIndex = new Map<string, string>();
      indexProductNames(doc.product_tree?.branches, productNameIndex);

      const cves = vulnerabilities.map((vuln) => {
        const cveId = vuln.cve || '';
        const description =
          vuln.notes?.find((n) => n.category === 'description')?.text || vuln.title;

        const primaryScore = vuln.scores?.[0]?.cvss_v3;
        const cvssScore = primaryScore?.baseScore;
        const cvssVector = primaryScore?.vectorString;

        const impactDetails = vuln.threats?.find((t) => t.category === 'impact')?.details;
        const cveSeverity = impactDetails
          ? normalizeSeverity(impactDetails)
          : primaryScore?.baseSeverity
            ? normalizeSeverity(primaryScore.baseSeverity)
            : severity;

        const productImpacts: ProductImpactItem[] = [];
        const seenKeys = new Set<string>();
        const productStatus = vuln.product_status || {};

        for (const [stateKey, compositeIds] of Object.entries(productStatus)) {
          if (!Array.isArray(compositeIds)) continue;
          const state = labelForState(stateKey);
          for (const compositeId of compositeIds) {
            const sepIdx = compositeId.indexOf(':');
            if (sepIdx === -1) continue;
            const branchId = compositeId.slice(0, sepIdx);
            const nvr = compositeId.slice(sepIdx + 1);

            const productName = productNameIndex.get(branchId) || branchId;
            const component = componentFromNvr(nvr);

            if (component.endsWith('-debuginfo') || component.endsWith('-debugsource')) {
              continue;
            }

            const key = `${productName}|${component}|${state}`;
            if (seenKeys.has(key)) continue;
            seenKeys.add(key);

            productImpacts.push({
              product_name: productName,
              component,
              state,
              justification: 'None',
              errata: advisoryId,
              release_date: document.tracking?.initial_release_date,
            });
          }
        }

        const collapsedProductImpacts = collapseLocalePackages(productImpacts);

        const affectedProducts = Array.from(
          new Set(collapsedProductImpacts.map((p) => p.product_name))
        );

        return {
          cveId,
          description,
          cvssScore: cvssScore ?? undefined,
          cvssVector,
          severity: cveSeverity,
          fixedVersions: [`Released in ${advisoryId}`],
          solution,
          productImpacts: collapsedProductImpacts,
          affectedProducts,
        };
      });

      const allCveIds = cves.map((c) => c.cveId);

      items.push({
        advisoryId,
        title,
        severity,
        publishedAt,
        updatedAt,
        url,
        summary,
        topic,
        solution,
        mitigation,
        statement,
        cves,
        rawPayload: {
          csaf_document_id: advisoryId,
          cve_ids: allCveIds,
        },
      });
    }

    return items;
  }
}
