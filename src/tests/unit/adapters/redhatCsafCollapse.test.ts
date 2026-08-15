import { describe, it, expect } from 'vitest';
import { RedHatCsafAdapter } from '@/adapters/redhat-csaf';

const adapter = new RedHatCsafAdapter();

const BRANCH = 'BaseOS-9.0.Z:';

const doc = (fixedIds: unknown) => ({
  document: {
    aggregate_severity: { text: 'Important' },
    title: 'Red Hat Security Advisory: glibc security update',
    notes: [{ category: 'summary', text: 'An update for glibc is available.', title: 'Topic' }],
    tracking: {
      id: 'RHSA-2099:0001',
      initial_release_date: '2099-01-01T00:00:00+00:00',
      current_release_date: '2099-01-02T00:00:00+00:00',
    },
  },
  product_tree: {
    branches: [
      {
        category: 'vendor',
        name: 'Red Hat',
        branches: [
          {
            category: 'product_family',
            name: 'Red Hat Enterprise Linux',
            branches: [
              {
                category: 'product_name',
                name: 'Red Hat Enterprise Linux BaseOS (v. 9)',
                product: { product_id: 'BaseOS-9.0.Z', name: 'Red Hat Enterprise Linux BaseOS (v. 9)' },
              },
            ],
          },
        ],
      },
    ],
    relationships: [],
  },
  vulnerabilities: [
    {
      cve: 'CVE-2099-0001',
      notes: [{ category: 'description', text: 'A flaw was found.', title: 'Vulnerability description' }],
      product_status: { fixed: fixedIds },
      scores: [{ cvss_v3: { baseScore: 7.8, baseSeverity: 'HIGH', vectorString: 'CVSS:3.1/AV:L' } }],
      threats: [{ category: 'impact', details: 'Important' }],
      title: 'glibc: example flaw',
    },
  ],
});

describe('RedHatCsafAdapter collapses locale package families', () => {
  const localeIds = [
    `${BRANCH}glibc-0:2.34-100.el9.x86_64`,
    `${BRANCH}glibc-common-0:2.34-100.el9.x86_64`,
    `${BRANCH}glibc-langpack-aa-0:2.34-100.el9.x86_64`,
    `${BRANCH}glibc-langpack-ab-0:2.34-100.el9.x86_64`,
    `${BRANCH}glibc-langpack-zu-0:2.34-100.el9.x86_64`,
  ];

  it('replaces the per-locale rows with a single summarised row', () => {
    const [item] = adapter.parse([doc(localeIds)]);
    const impacts = item.cves[0].productImpacts || [];
    const components = impacts.map((p) => p.component);

    expect(components).toContain('glibc');
    expect(components).toContain('glibc-common');

    // no individual locale rows survive
    expect(components.filter((c) => /^glibc-langpack-[a-z]{2}$/.test(c))).toHaveLength(0);

    // exactly one collapsed row, and it states how many locales it stands for
    const collapsed = components.filter((c) => c.startsWith('glibc-langpack'));
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]).toContain('*');
    expect(collapsed[0]).toContain('3');
  });

  it('leaves an unrelated single locale package family intact in the count', () => {
    const [item] = adapter.parse([
      doc([`${BRANCH}glibc-0:2.34-100.el9.x86_64`, `${BRANCH}glibc-langpack-en-0:2.34-100.el9.x86_64`]),
    ]);
    const components = (item.cves[0].productImpacts || []).map((p) => p.component);

    const collapsed = components.filter((c) => c.startsWith('glibc-langpack'));
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]).toContain('1');
  });

  it('does not collapse ordinary sub-packages that merely share a prefix', () => {
    const [item] = adapter.parse([
      doc([
        `${BRANCH}glibc-0:2.34-100.el9.x86_64`,
        `${BRANCH}glibc-devel-0:2.34-100.el9.x86_64`,
        `${BRANCH}glibc-doc-0:2.34-100.el9.x86_64`,
      ]),
    ]);
    const components = (item.cves[0].productImpacts || []).map((p) => p.component).sort();

    expect(components).toEqual(['glibc', 'glibc-devel', 'glibc-doc']);
  });
});

describe('RedHatCsafAdapter tolerates malformed product_status', () => {
  it('skips a non-array product_status value instead of throwing', () => {
    expect(() => adapter.parse([doc('not-an-array' as unknown)])).not.toThrow();

    const items = adapter.parse([doc('not-an-array' as unknown)]);
    expect(items).toHaveLength(1);
    expect(items[0].cves[0].productImpacts).toEqual([]);
  });

  it('skips a null product_status value instead of throwing', () => {
    expect(() => adapter.parse([doc(null)])).not.toThrow();
  });
});
