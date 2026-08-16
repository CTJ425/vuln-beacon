import { describe, it, expect } from 'vitest';
import {
  normalizeProductFamily,
  slugify,
  deriveTaxonomy,
  matchesProductFamily,
} from '@/services/productTaxonomy';
import { AdvisoryRowItem } from '@/services/advisoryService';

const baseAdvisory = (over: Partial<AdvisoryRowItem> = {}): AdvisoryRowItem => ({
  id: over.id ?? 'a1',
  advisory_id: over.advisory_id ?? 'RHSA-2026:0001',
  title: 'Test advisory',
  severity: 'LOW',
  published_at: '2026-08-02T00:00:00Z',
  url: 'https://access.redhat.com/errata/RHSA-2026:0001',
  summary: 'test',
  vendor_code: 'redhat',
  cves: [],
  product_impacts: [],
  affected_products: [],
  fixed_versions: [],
  solution: undefined,
  ...over,
});

describe('normalizeProductFamily', () => {
  const cases: [string, string][] = [
    ['Red Hat Enterprise Linux AppStream (v. 9)', 'Red Hat Enterprise Linux'],
    ['Red Hat Enterprise Linux BaseOS (v. 9)', 'Red Hat Enterprise Linux'],
    ['Red Hat Enterprise Linux BaseOS (v. 8)', 'Red Hat Enterprise Linux'],
    ['Red Hat Enterprise Linux 9', 'Red Hat Enterprise Linux'],
    ['Red Hat Enterprise Linux 8', 'Red Hat Enterprise Linux'],
    ['Red Hat Enterprise Linux 10', 'Red Hat Enterprise Linux'],
    ['Red Hat OpenShift', 'Red Hat OpenShift'],
    ['Red Hat Hardened Images', 'Red Hat Hardened Images'],
  ];

  it.each(cases)('normalizes %s to %s', (input, expected) => {
    expect(normalizeProductFamily(input)).toBe(expected);
  });

  it('falls back to the original trimmed input when stripping would leave nothing', () => {
    expect(normalizeProductFamily('AppStream (v. 9)')).toBe('AppStream (v. 9)');
  });
});

describe('slugify', () => {
  it('lowercases, hyphenates, and trims punctuation', () => {
    expect(slugify('Red Hat Enterprise Linux')).toBe('red-hat-enterprise-linux');
    expect(slugify('OpenShift AI (RHOAI)!')).toBe('openshift-ai-rhoai');
  });
});

function makeFamilyAdvisories(
  familyCounts: Record<string, number>,
  vendorCode = 'redhat',
  severity: AdvisoryRowItem['severity'] = 'LOW',
): AdvisoryRowItem[] {
  const rows: AdvisoryRowItem[] = [];
  let n = 0;
  for (const [family, count] of Object.entries(familyCounts)) {
    for (let i = 0; i < count; i++) {
      n += 1;
      rows.push(
        baseAdvisory({
          id: `a${n}`,
          advisory_id: `RHSA-2026:${1000 + n}`,
          affected_products: [family],
          severity,
          vendor_code: vendorCode,
        } as Partial<AdvisoryRowItem>),
      );
    }
  }
  return rows;
}

describe('deriveTaxonomy', () => {
  it('keeps the top N families and folds the rest into an "other" node', () => {
    // f01..f15 with descending counts 15..1
    const familyCounts: Record<string, number> = {};
    for (let i = 1; i <= 15; i += 1) {
      familyCounts[`Family${String(i).padStart(2, '0')}`] = 16 - i;
    }
    const advisories = makeFamilyAdvisories(familyCounts, 'redhat');

    const taxonomy = deriveTaxonomy(advisories, 10);

    expect(taxonomy).toHaveLength(1);
    const redhat = taxonomy[0];
    expect(redhat.vendorCode).toBe('redhat');
    expect(redhat.products).toHaveLength(11); // 10 kept + 1 overflow

    const named = redhat.products.filter((p) => !p.isOverflow);
    expect(named).toHaveLength(10);
    expect(named.map((p) => p.name)).toEqual([
      'Family01', 'Family02', 'Family03', 'Family04', 'Family05',
      'Family06', 'Family07', 'Family08', 'Family09', 'Family10',
    ]);

    const other = redhat.products[redhat.products.length - 1];
    expect(other.isOverflow).toBe(true);
    expect(other.id).toBe('other');
    expect(other.name).toBe('Other products');
    // Family11..15 counts: 5,4,3,2,1 = 15
    expect(other.advisoryCount).toBe(15);
    expect(other.memberFamilyIds).toEqual(
      expect.arrayContaining(['family11', 'family12', 'family13', 'family14', 'family15']),
    );
    expect(other.memberFamilyIds).toHaveLength(5);
  });

  it('omits the "other" node when there is no overflow', () => {
    const familyCounts: Record<string, number> = {
      Alpha: 3,
      Beta: 2,
      Gamma: 1,
    };
    const advisories = makeFamilyAdvisories(familyCounts, 'redhat');

    const taxonomy = deriveTaxonomy(advisories, 10);

    expect(taxonomy[0].products).toHaveLength(3);
    expect(taxonomy[0].products.some((p) => p.isOverflow)).toBe(false);
  });

  it('produces one VendorNode per distinct vendor_code with correct counts', () => {
    const redhatAdvisories = makeFamilyAdvisories({ RHEL: 2, OpenShift: 1 }, 'redhat', 'CRITICAL');
    const otherVendorAdvisories = makeFamilyAdvisories({ 'Product X': 1 }, 'vmware', 'LOW');
    const advisories = [...redhatAdvisories, ...otherVendorAdvisories];

    const taxonomy = deriveTaxonomy(advisories, 10);

    expect(taxonomy).toHaveLength(2);
    const redhat = taxonomy.find((v) => v.vendorCode === 'redhat')!;
    const vmware = taxonomy.find((v) => v.vendorCode === 'vmware')!;
    expect(redhat.advisoryCount).toBe(3);
    expect(redhat.criticalCount).toBe(3);
    expect(vmware.advisoryCount).toBe(1);
    expect(vmware.criticalCount).toBe(0);
  });

  it('prefers advisory.vendor_name over the static VENDOR_NAMES lookup when present', () => {
    const advisories = [
      baseAdvisory({ vendor_code: 'redhat', vendor_name: 'Custom Red Hat Label', affected_products: ['RHEL'] } as Partial<AdvisoryRowItem>),
    ];

    const taxonomy = deriveTaxonomy(advisories, 10);

    expect(taxonomy[0].vendorName).toBe('Custom Red Hat Label');
  });
});

describe('matchesProductFamily', () => {
  it('matches an advisory to its own family id and rejects a different family', () => {
    const advisories = makeFamilyAdvisories({ RHEL: 1, OpenShift: 1 }, 'redhat');
    const taxonomy = deriveTaxonomy(advisories, 10);
    const rhelAdvisory = advisories.find((a) => a.affected_products.includes('RHEL'))!;
    const openshiftAdvisory = advisories.find((a) => a.affected_products.includes('OpenShift'))!;

    expect(matchesProductFamily(rhelAdvisory, 'rhel', taxonomy)).toBe(true);
    expect(matchesProductFamily(openshiftAdvisory, 'rhel', taxonomy)).toBe(false);
  });

  it('matches "other" only for advisories folded into the overflow node', () => {
    const familyCounts: Record<string, number> = {};
    for (let i = 1; i <= 12; i += 1) {
      familyCounts[`Family${String(i).padStart(2, '0')}`] = 13 - i;
    }
    const advisories = makeFamilyAdvisories(familyCounts, 'redhat');
    const taxonomy = deriveTaxonomy(advisories, 10);

    const overflowAdvisory = advisories.find((a) => a.affected_products.includes('Family11'))!;
    const keptAdvisory = advisories.find((a) => a.affected_products.includes('Family01'))!;

    expect(matchesProductFamily(overflowAdvisory, 'other', taxonomy)).toBe(true);
    expect(matchesProductFamily(keptAdvisory, 'other', taxonomy)).toBe(false);
  });
});
