import React, { useMemo } from 'react';
import { Box, Typography, Stack } from '@mui/material';
import { MetricCards } from '@/components/dashboard/MetricCards';
import { ExplorerPage } from '@/pages/ExplorerPage';
import { AdvisoryRowItem } from '@/services/advisoryService';
import { CveTableRowItem } from '@/components/explorer/CveTable';
import { VendorNode, matchesProductFamily } from '@/services/productTaxonomy';

interface ProductPageProps {
  vendorId: string;
  productId?: string;
  advisories: AdvisoryRowItem[];
  cves: CveTableRowItem[];
  taxonomy: VendorNode[];
  onSelectCve: (cve: CveTableRowItem) => void;
  onSelectAdvisory: (item: AdvisoryRowItem) => void;
  onRefreshCves?: () => Promise<void>;
}

export const ProductPage: React.FC<ProductPageProps> = ({
  vendorId,
  productId,
  advisories,
  cves,
  taxonomy,
  onSelectCve,
  onSelectAdvisory,
  onRefreshCves,
}) => {
  const vendor = taxonomy.find((v) => v.vendorId === vendorId);
  const product = productId ? vendor?.products.find((p) => p.id === productId) : undefined;

  const scopedAdvisories = useMemo(() => {
    return advisories.filter((a) => {
      if (a.vendor_id !== vendorId) return false;
      if (productId && !matchesProductFamily(a, productId, taxonomy)) return false;
      return true;
    });
  }, [advisories, vendorId, productId, taxonomy]);

  const scopedAdvisoryIds = useMemo(
    () => new Set(scopedAdvisories.map((a) => a.advisory_id)),
    [scopedAdvisories]
  );

  const scopedCves = useMemo(
    () => cves.filter((c) => scopedAdvisoryIds.has(c.advisory_id) || (c.all_advisories || []).some((id) => scopedAdvisoryIds.has(id))),
    [cves, scopedAdvisoryIds]
  );

  const criticalCount = scopedAdvisories.filter((a) => a.severity === 'CRITICAL').length;
  const highCount = scopedAdvisories.filter((a) => a.severity === 'HIGH').length;
  let totalImpactedComponents = 0;
  scopedAdvisories.forEach((a) => {
    totalImpactedComponents += a.product_impacts ? a.product_impacts.length : 0;
  });

  const vendorName = vendor?.vendorName ?? vendorId;
  const heading = product ? `${vendorName} · ${product.name}` : vendorName;

  return (
    <Stack spacing={3.5}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em' }}>
          {heading}
        </Typography>
      </Box>

      <MetricCards
        totalCves={scopedAdvisories.length}
        criticalCount={criticalCount}
        highCount={highCount}
        totalImpactedComponents={totalImpactedComponents}
        labels={{
          critical: 'Critical RHSA',
          high: 'High Severity',
          components: 'Impacted Components',
          total: 'Tracked Advisories',
        }}
      />

      <ExplorerPage
        cves={scopedCves}
        advisories={scopedAdvisories}
        onSelectCve={onSelectCve}
        onSelectAdvisory={onSelectAdvisory}
        onRefreshCves={onRefreshCves}
        taxonomy={taxonomy}
        initialProductFamilyId={productId}
      />
    </Stack>
  );
};
