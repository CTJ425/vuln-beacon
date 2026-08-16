import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { VendorPage } from '@/pages/VendorPage';
import { AdvisoryRowItem } from '@/services/advisoryService';
import { VendorNode } from '@/services/productTaxonomy';

const advisory = (over: Partial<AdvisoryRowItem> = {}): AdvisoryRowItem => ({
  id: 'a1',
  advisory_id: 'RHSA-2026:2000',
  title: 'Important: kernel security update',
  severity: 'CRITICAL',
  published_at: '2026-08-02T00:00:00Z',
  url: 'https://access.redhat.com/errata/RHSA-2026:2000',
  summary: 'kernel security update',
  vendor_code: 'redhat',
  cves: [],
  product_impacts: [
    { product_name: 'Red Hat Enterprise Linux 9', component: 'kernel', state: 'Fixed', errata: 'RHSA-2026:2000' },
  ],
  affected_products: ['Red Hat Enterprise Linux 9'],
  fixed_versions: [],
  ...over,
});

const taxonomy: VendorNode[] = [
  {
    vendorCode: 'redhat',
    vendorName: 'Red Hat',
    advisoryCount: 2,
    criticalCount: 1,
    products: [
      { id: 'red-hat-enterprise-linux', name: 'Red Hat Enterprise Linux', advisoryCount: 1 },
      { id: 'red-hat-openshift', name: 'Red Hat OpenShift', advisoryCount: 1 },
    ],
  },
];

describe('VendorPage', () => {
  it('renders the vendor name as heading and shows every advisory for that vendor', () => {
    const rhelAdvisory = advisory({ id: 'a1', advisory_id: 'RHSA-2026:2000', vendor_code: 'redhat', affected_products: ['Red Hat Enterprise Linux 9'] });
    const openshiftAdvisory = advisory({ id: 'a2', advisory_id: 'RHSA-2026:2100', vendor_code: 'redhat', affected_products: ['Red Hat OpenShift'] });

    render(
      <VendorPage
        vendorCode="redhat"
        advisories={[rhelAdvisory, openshiftAdvisory]}
        cves={[]}
        taxonomy={taxonomy}
        onSelectCve={() => {}}
        onSelectAdvisory={() => {}}
      />
    );

    expect(screen.getByRole('heading', { name: 'Red Hat' })).toBeInTheDocument();
    expect(screen.getByText('RHSA-2026:2000')).toBeInTheDocument();
    expect(screen.getByText('RHSA-2026:2100')).toBeInTheDocument();
  });

  it('excludes advisories belonging to a different vendor', () => {
    const rhelAdvisory = advisory({ id: 'a1', advisory_id: 'RHSA-2026:2000', vendor_code: 'redhat' });
    const otherVendorAdvisory = advisory({ id: 'a2', advisory_id: 'VMSA-2026:0001', vendor_code: 'vmware' });

    render(
      <VendorPage
        vendorCode="redhat"
        advisories={[rhelAdvisory, otherVendorAdvisory]}
        cves={[]}
        taxonomy={taxonomy}
        onSelectCve={() => {}}
        onSelectAdvisory={() => {}}
      />
    );

    expect(screen.getByText('RHSA-2026:2000')).toBeInTheDocument();
    expect(screen.queryByText('VMSA-2026:0001')).not.toBeInTheDocument();
  });
});
