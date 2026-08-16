import { supabase } from '@/lib/supabase';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { CveTableRowItem } from '@/components/explorer/CveTable';
import { ProductImpactItem } from '@/types';

export class CveService {
  async fetchCves(): Promise<CveTableRowItem[]> {
    try {
      const { data, error } = await fetchAllRows((from, to) =>
        supabase
          .from('cves')
          .select(`
            id,
            cve_id,
            description,
            cvss_v3_score,
            cvss_v3_vector,
            severity,
            is_known_exploited,
            published_date,
            last_modified_date,
            created_at,
            advisory_cve_map (
              affected_products,
              fixed_versions,
              advisories (
                advisory_id,
                title,
                url,
                summary,
                vendors (
                  code,
                  name
                )
              )
            )
          `)
          .order('published_date', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to)
      );

      if (error) {
        console.warn('Error fetching CVEs from Supabase:', error.message);
        return [];
      }

      if (!data) return [];

      return data.map((row: any): CveTableRowItem => {
        // Supabase does not order embedded resources, so sort mappings by
        // advisory_id ascending here to make the canonical advisory (mappings[0])
        // deterministic across identical fetches.
        const mappings: any[] = Array.isArray(row.advisory_cve_map) ? row.advisory_cve_map : [];
        mappings.sort((a: any, b: any) => {
          const idA = a?.advisories?.advisory_id ?? '';
          const idB = b?.advisories?.advisory_id ?? '';
          return idA < idB ? -1 : idA > idB ? 1 : 0;
        });
        const firstMap = mappings[0];
        const advisory = firstMap?.advisories;
        const vendor = advisory?.vendors;

        // Parse structured product_impacts across every mapping (not just the first).
        const productImpacts: ProductImpactItem[] = [];

        for (const map of mappings) {
          const rawImpacts = map?.affected_products;
          const mapAdvisory = map?.advisories;
          const mapVendor = mapAdvisory?.vendors;
          if (!Array.isArray(rawImpacts) || rawImpacts.length === 0) continue;
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
                product_name: mapVendor?.name || 'Enterprise System',
                component: item,
                state: 'Affected',
                justification: 'None',
                errata: mapAdvisory?.advisory_id || '-',
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
        productImpacts.length = 0;
        productImpacts.push(...dedupedImpacts);

        // If still empty, fallback
        if (productImpacts.length === 0) {
          let compName = 'infrastructure-core';
          if (row.description) {
            const colonIdx = row.description.indexOf(':');
            if (colonIdx > 0 && colonIdx < 50) {
              compName = row.description.substring(0, colonIdx).trim();
            }
          }
          productImpacts.push({
            product_name: vendor?.name ? `${vendor.name} Ecosystem` : 'Enterprise System',
            component: compName,
            state: 'Affected',
            justification: 'None',
            errata: advisory?.advisory_id || '-',
            release_date: '-',
          });
        }

        const affectedProducts = Array.from(
          new Set(productImpacts.map((p) => p.product_name))
        );

        // Extract fixed versions: union across every mapping, deduplicated.
        let fixedVersions: string[] = Array.from(
          new Set(
            mappings.flatMap((map: any) =>
              Array.isArray(map?.fixed_versions) ? map.fixed_versions : []
            )
          )
        );
        if (fixedVersions.length === 0) {
          const releasedErrata = productImpacts
            .filter((p) => p.state === 'Fixed' && p.errata && p.errata !== '-')
            .map((p) => p.errata!);
          if (releasedErrata.length > 0) {
            fixedVersions = Array.from(new Set(releasedErrata));
          } else if (advisory?.advisory_id && advisory.advisory_id.startsWith('RHSA-')) {
            fixedVersions = [`Released in ${advisory.advisory_id}`];
          }
        }

        const isFixPending =
          fixedVersions.length === 0 ||
          fixedVersions.some((v) => v.toLowerCase().includes('pending'));

        let solution = '';
        if (!isFixPending) {
          solution = `請依據官方發佈之資安更新公告 (${fixedVersions.join(', ')}) 執行升級更新 (例如 dnf/yum update)。詳情請參閱官方指引：https://access.redhat.com/articles/11258`;
        } else if (advisory?.advisory_id && advisory.advisory_id !== 'N/A') {
          solution = `官方目前針對該漏洞分析處置中，請參閱公告 ${advisory.advisory_id} 密切關注後續 Errata 更新，並依資安指引採取適當網路隔離或緩解措施。`;
        } else {
          solution = '原廠目前正在積極調查分析該漏洞，請持續監控官方安全性更新公告，並留意後續發布之 Errata / Hotfix。';
        }

        const mappedAdvisoryIds = Array.from(
          new Set(
            mappings
              .map((map: any) => map?.advisories?.advisory_id)
              .filter((id: string | undefined): id is string => Boolean(id) && id !== 'N/A')
          )
        );

        const allAdvisories: string[] = mappedAdvisoryIds;

        return {
          id: row.id,
          cve_id: row.cve_id,
          description: row.description || '',
          cvss_v3_score: row.cvss_v3_score ? Number(row.cvss_v3_score) : undefined,
          cvss_v3_vector: row.cvss_v3_vector || undefined,
          severity: row.severity || 'UNKNOWN',
          is_known_exploited: Boolean(row.is_known_exploited),
          published_date: row.published_date || row.created_at,
          last_modified_date: row.last_modified_date,
          created_at: row.created_at,
          vendor_code: vendor?.code || 'redhat',
          advisory_id: advisory?.advisory_id || 'N/A',
          advisory_title: advisory?.title || row.description || row.cve_id,
          advisory_url: advisory?.url || undefined,
          all_advisories: allAdvisories,
          affected_products: affectedProducts,
          product_impacts: productImpacts,
          fixed_versions: fixedVersions,
          solution,
        };

      });
    } catch (err) {
      console.error('Failed to fetch CVEs:', err);
      return [];
    }
  }
}
