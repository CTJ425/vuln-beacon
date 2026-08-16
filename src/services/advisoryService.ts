import { supabase } from '@/lib/supabase';
import { ProductImpactItem, SeverityLevel } from '@/types';

export interface AdvisoryRowItem {
  id: string;
  advisory_id: string; // e.g. RHSA-2026:2000
  title: string;
  severity: SeverityLevel;
  published_at: string;
  url?: string;
  summary?: string;
  vendor_code: string;
  vendor_name?: string;
  cves: {
    cve_id: string;
    description: string;
    severity: SeverityLevel;
    cvss_v3_score?: number;
    is_known_exploited: boolean;
  }[];
  product_impacts: ProductImpactItem[];
  affected_products: string[];
  fixed_versions: string[];
  solution?: string;
}

export class AdvisoryService {
  async fetchAdvisories(): Promise<AdvisoryRowItem[]> {
    try {
      const { data, error } = await supabase
        .from('advisories')
        .select(`
          id, advisory_id, title, severity, published_at, url, summary, vendor_id,
          vendors ( code, name ),
          advisory_cve_map (
            affected_products,
            fixed_versions,
            cves ( cve_id, description, cvss_v3_score, cvss_v3_vector, severity, is_known_exploited, published_date )
          )
        `)
        .order('published_at', { ascending: false });

      if (error) {
        console.warn('Error fetching advisories from Supabase:', error.message);
        return [];
      }

      if (!data) return [];

      return data.map((row: any): AdvisoryRowItem => {
        const vendor = Array.isArray(row.vendors) ? row.vendors[0] : row.vendors;
        const mappings = Array.isArray(row.advisory_cve_map) ? row.advisory_cve_map : [];

        // cves: one entry per mapping with a joined cve record, deduplicated by cve_id.
        const cves: AdvisoryRowItem['cves'] = [];
        const seenCveIds = new Set<string>();
        for (const map of mappings) {
          const cve = map.cves;
          if (!cve) continue;
          if (seenCveIds.has(cve.cve_id)) continue;
          seenCveIds.add(cve.cve_id);
          cves.push({
            cve_id: cve.cve_id,
            description: cve.description,
            severity: cve.severity || 'UNKNOWN',
            cvss_v3_score: cve.cvss_v3_score ? Number(cve.cvss_v3_score) : undefined,
            is_known_exploited: Boolean(cve.is_known_exploited),
          });
        }

        // product_impacts: parse affected_products from every mapping (same
        // normalisation as cveService.fetchCves()), concatenate, dedupe.
        const productImpacts: ProductImpactItem[] = [];
        for (const map of mappings) {
          const rawImpacts = map.affected_products;
          if (!Array.isArray(rawImpacts)) continue;
          for (const item of rawImpacts) {
            if (typeof item === 'object' && item !== null && (item.product_name || item.component)) {
              productImpacts.push({
                product_name: item.product_name || 'Enterprise Product',
                component: item.component || item.package_name || 'core-component',
                state: item.state || item.fix_state || 'Affected',
                justification: item.justification || 'None',
                errata: item.errata || item.advisory || '-',
                release_date: item.release_date || '-',
                cpe: item.cpe,
              });
            } else if (typeof item === 'string') {
              productImpacts.push({
                product_name: 'Enterprise System',
                component: item,
                state: 'Affected',
                justification: 'None',
                errata: row.advisory_id || '-',
                release_date: '-',
              });
            }
          }
        }

        const dedupedImpacts: ProductImpactItem[] = [];
        const seenImpactKeys = new Set<string>();
        for (const impact of productImpacts) {
          const key = `${impact.product_name}|${impact.component}|${impact.state}`;
          if (seenImpactKeys.has(key)) continue;
          seenImpactKeys.add(key);
          dedupedImpacts.push(impact);
        }

        const affectedProducts = Array.from(
          new Set(dedupedImpacts.map((p) => p.product_name))
        );

        // fixed_versions: union across all mappings, deduplicated.
        const fixedVersions: string[] = Array.from(
          new Set<string>(
            mappings.flatMap((map: any) =>
              Array.isArray(map.fixed_versions) ? (map.fixed_versions as string[]) : []
            )
          )
        );

        const isFixPending =
          fixedVersions.length === 0 ||
          fixedVersions.some((v: string) => v.toLowerCase().includes('pending'));

        let solution = '';
        if (!isFixPending) {
          solution = `請依據官方發佈之資安更新公告 (${fixedVersions.join(', ')}) 執行升級更新 (例如 dnf/yum update)。詳情請參閱官方指引：https://access.redhat.com/articles/11258`;
        } else {
          solution = `官方目前針對該漏洞分析處置中，請參閱公告 ${row.advisory_id} 密切關注後續 Errata 更新，並依資安指引採取適當網路隔離或緩解措施。`;
        }

        return {
          id: row.id,
          advisory_id: row.advisory_id,
          title: row.title,
          severity: row.severity || 'UNKNOWN',
          published_at: row.published_at,
          url: row.url || undefined,
          summary: row.summary || undefined,
          vendor_code: vendor?.code || 'redhat',
          vendor_name: vendor?.name,
          cves,
          product_impacts: dedupedImpacts,
          affected_products: affectedProducts,
          fixed_versions: fixedVersions,
          solution,
        };
      });
    } catch (err) {
      console.error('Failed to fetch advisories:', err);
      return [];
    }
  }
}
