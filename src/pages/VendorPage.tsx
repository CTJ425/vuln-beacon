import React, { useMemo } from 'react';
import { Box, Typography, Stack } from '@mui/material';
import { MetricCards } from '@/components/dashboard/MetricCards';
import { ExplorerPage } from '@/pages/ExplorerPage';
import { AdvisoryRowItem } from '@/services/advisoryService';
import { CveTableRowItem } from '@/components/explorer/CveTable';
import { VendorNode } from '@/services/productTaxonomy';

interface VendorPageProps {
  vendorCode: string;
  advisories: AdvisoryRowItem[];
  cves: CveTableRowItem[];
  taxonomy: VendorNode[];
  onSelectCve: (cve: CveTableRowItem) => void;
  onSelectAdvisory: (item: AdvisoryRowItem) => void;
  onRefreshCves?: () => Promise<void>;
}

export const VendorPage: React.FC<VendorPageProps> = ({
  vendorCode,
  advisories,
  cves,
  taxonomy,
  onSelectCve,
  onSelectAdvisory,
  onRefreshCves,
}) => {
  const vendor = taxonomy.find((v) => v.vendorCode === vendorCode);

  const scopedAdvisories = useMemo(
    () => advisories.filter((a) => a.vendor_code === vendorCode),
    [advisories, vendorCode]
  );

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

  const vendorName = vendor?.vendorName ?? vendorCode;

  return (
    <Stack spacing={3.5}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em' }}>
          {vendorName}
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
      />
    </Stack>
  );
};
