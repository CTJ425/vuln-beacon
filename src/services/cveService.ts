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
        const resolveAdvisory = (m: any) => (Array.isArray(m?.advisories) ? m.advisories[0] : m?.advisories);
        const resolveVendor = (adv: any) => (Array.isArray(adv?.vendors) ? adv.vendors[0] : adv?.vendors);

        mappings.sort((a: any, b: any) => {
          const idA = resolveAdvisory(a)?.advisory_id ?? '';
          const idB = resolveAdvisory(b)?.advisory_id ?? '';
          return idA < idB ? -1 : idA > idB ? 1 : 0;
        });
        const firstMap = mappings[0];
        const advisory = resolveAdvisory(firstMap);
        const vendor = resolveVendor(advisory);

        // Parse structured product_impacts across every mapping (not just the first).
        const productImpacts: ProductImpactItem[] = [];

        for (const map of mappings) {
          const rawImpacts = map?.affected_products;
          const mapAdvisory = resolveAdvisory(map);
          const mapVendor = resolveVendor(mapAdvisory);
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
          } else if (advisory?.advisory_id && (advisory.advisory_id.startsWith('RHSA-') || advisory.advisory_id.startsWith('NXSA-'))) {
            fixedVersions = [`Released in ${advisory.advisory_id}`];
          }
        }

        const isFixPending =
          fixedVersions.length === 0 ||
          fixedVersions.some((v) => v.toLowerCase().includes('pending'));

        const advId = advisory?.advisory_id || '';
        const vendorCode =
          vendor?.code ||
          (advId.startsWith('NXSA-')
            ? 'nutanix'
            : advId.startsWith('USN-') || advId.startsWith('LSN-')
            ? 'ubuntu'
            : advId.startsWith('DSA-') || advId.startsWith('DLA-') || advId.startsWith('DEBIAN-')
            ? 'debian'
            : advId.startsWith('SUSE-') || advId.startsWith('openSUSE-')
            ? 'suse'
            : 'redhat');

        let solution = '';
        if (advisory?.summary) {
          solution = advisory.summary;
        } else if (vendorCode === 'nutanix') {
          if (!isFixPending) {
            solution = `請依據 Nutanix 官方公告 (${advisory?.advisory_id || 'NXSA'}) 與修復版本 (${fixedVersions.join(', ') || '最新修復版'}) 執行系統升級。詳情請參閱官方公告指引。`;
          } else {
            solution = `官方目前針對該漏洞分析處置中，請參閱 Nutanix 公告 ${advisory?.advisory_id || 'NXSA'} 密切關注後續更新。`;
          }
        } else if (vendorCode === 'ubuntu') {
          if (!isFixPending) {
            solution = `請透過 APT 工具執行更新：sudo apt-get update && sudo apt-get --only-upgrade install -y <package>`;
          } else {
            solution = `Ubuntu 原廠目前正在分析處置該漏洞，請參閱公告 ${advisory?.advisory_id || 'USN'} 密切關注後續更新。`;
          }
        } else if (vendorCode === 'debian') {
          if (!isFixPending) {
            solution = `請透過 APT 工具執行更新：sudo apt-get update && sudo apt-get --only-upgrade install -y <package>`;
          } else {
            solution = `Debian 資安團隊目前正在處理該漏洞，請參閱公告 ${advisory?.advisory_id || 'DSA'} 密切關注後續更新。`;
          }
        } else if (vendorCode === 'suse') {
          if (!isFixPending) {
            solution = `請使用 Zypper 執行更新：sudo zypper update -y <package>`;
          } else {
            solution = `SUSE 官方目前正在處置該漏洞，請參閱公告 ${advisory?.advisory_id || 'SUSE-SU'} 密切關注後續更新。`;
          }
        } else if (!isFixPending) {
          solution = `請依據官方發佈之資安更新公告 (${fixedVersions.join(', ')}) 執行升級更新 (例如 dnf/yum update)。詳情請參閱官方指引：https://access.redhat.com/articles/11258`;
        } else if (advisory?.advisory_id && advisory.advisory_id !== 'N/A') {
          solution = `官方目前針對該漏洞分析處置中，請參閱公告 ${advisory.advisory_id} 密切關注後續 Errata 更新，並依資安指引採取適當網路隔離或緩解措施。`;
        } else {
          solution = '原廠目前正在積極調查分析該漏洞，請持續監控官方安全性更新公告，並留意後續發布之 Errata / Hotfix。';
        }

        const mappedAdvisoryIds = Array.from(
          new Set(
            mappings
              .map((map: any) => resolveAdvisory(map)?.advisory_id)
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
          vendor_code: vendorCode,
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
