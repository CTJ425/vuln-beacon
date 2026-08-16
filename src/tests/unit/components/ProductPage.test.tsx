import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ProductPage } from '@/pages/ProductPage';
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
  vendor_id: 'redhat',
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
    vendorId: 'redhat',
    vendorName: 'Red Hat',
    advisoryCount: 2,
    criticalCount: 1,
    products: [
      { id: 'red-hat-enterprise-linux', name: 'Red Hat Enterprise Linux', advisoryCount: 1 },
      { id: 'red-hat-openshift', name: 'Red Hat OpenShift', advisoryCount: 1 },
    ],
  },
];

describe('ProductPage', () => {
  it('renders a heading combining vendor and product family name, filtering the advisory list to that family', () => {
    const rhelAdvisory = advisory({ id: 'a1', advisory_id: 'RHSA-2026:2000', vendor_id: 'redhat', affected_products: ['Red Hat Enterprise Linux 9'] } as Partial<AdvisoryRowItem>);
    const openshiftAdvisory = advisory({ id: 'a2', advisory_id: 'RHSA-2026:2100', vendor_id: 'redhat', affected_products: ['Red Hat OpenShift'] } as Partial<AdvisoryRowItem>);

    render(
      <ProductPage
        vendorId="redhat"
        productId="red-hat-enterprise-linux"
        advisories={[rhelAdvisory, openshiftAdvisory]}
        cves={[]}
        taxonomy={taxonomy}
        onSelectCve={() => {}}
        onSelectAdvisory={() => {}}
      />
    );

    expect(screen.getByRole('heading', { name: 'Red Hat · Red Hat Enterprise Linux' })).toBeInTheDocument();
    expect(screen.getByText('RHSA-2026:2000')).toBeInTheDocument();
    expect(screen.queryByText('RHSA-2026:2100')).not.toBeInTheDocument();
  });

  it('shows every vendor advisory, unfiltered by product family, when productId is absent', () => {
    const rhelAdvisory = advisory({ id: 'a1', advisory_id: 'RHSA-2026:2000', vendor_id: 'redhat', affected_products: ['Red Hat Enterprise Linux 9'] } as Partial<AdvisoryRowItem>);
    const openshiftAdvisory = advisory({ id: 'a2', advisory_id: 'RHSA-2026:2100', vendor_id: 'redhat', affected_products: ['Red Hat OpenShift'] } as Partial<AdvisoryRowItem>);

    render(
      <ProductPage
        vendorId="redhat"
        advisories={[rhelAdvisory, openshiftAdvisory]}
        cves={[]}
        taxonomy={taxonomy}
        onSelectCve={() => {}}
        onSelectAdvisory={() => {}}
      />
    );

    expect(screen.getByText('RHSA-2026:2000')).toBeInTheDocument();
    expect(screen.getByText('RHSA-2026:2100')).toBeInTheDocument();
  });
});
