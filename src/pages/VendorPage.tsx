import React, { useMemo } from 'react';
import { Box, Typography, Stack } from '@mui/material';
import { MetricCards } from '@/components/dashboard/MetricCards';
import { ExplorerPage } from '@/pages/ExplorerPage';
import { AdvisoryRowItem } from '@/services/advisoryService';
import { CveTableRowItem } from '@/components/explorer/CveTable';
import { VendorNode } from '@/services/productTaxonomy';
import { VendorIcon, VENDOR_NAMES } from '@/components/common/VendorIcon';

interface VendorPageProps {
  vendorCode: string;
  advisories: AdvisoryRowItem[];
  cves: CveTableRowItem[];
  taxonomy: VendorNode[];
  onSelectCve: (cve: CveTableRowItem) => void;
  onSelectAdvisory: (item: AdvisoryRowItem) => void;
  onRefreshCves?: () => Promise<void>;
  isAuthenticated?: boolean;
}

export const VendorPage: React.FC<VendorPageProps> = ({
  vendorCode,
  advisories,
  cves,
  taxonomy,
  onSelectCve,
  onSelectAdvisory,
  onRefreshCves,
  isAuthenticated,
}) => {
  const vendor = taxonomy.find((v) => v.vendorCode?.toLowerCase() === vendorCode?.toLowerCase());

  const scopedAdvisories = useMemo(
    () => advisories.filter((a) => a.vendor_code?.toLowerCase() === vendorCode?.toLowerCase()),
    [advisories, vendorCode]
  );

  const scopedAdvisoryIds = useMemo(
    () => new Set(scopedAdvisories.map((a) => a.advisory_id)),
    [scopedAdvisories]
  );

  const scopedCves = useMemo(
    () =>
      cves.filter(
        (c) =>
          c.vendor_code?.toLowerCase() === vendorCode?.toLowerCase() ||
          scopedAdvisoryIds.has(c.advisory_id) ||
          (c.all_advisories || []).some((id) => scopedAdvisoryIds.has(id))
      ),
    [cves, scopedAdvisoryIds, vendorCode]
  );

  const criticalCount = scopedAdvisories.filter((a) => a.severity === 'CRITICAL').length;
  const highCount = scopedAdvisories.filter((a) => a.severity === 'HIGH').length;
  let totalImpactedComponents = 0;
  scopedAdvisories.forEach((a) => {
    totalImpactedComponents += a.product_impacts ? a.product_impacts.length : 0;
  });

  const vendorName = vendor?.vendorName ?? VENDOR_NAMES[vendorCode.toLowerCase()] ?? vendorCode;

  return (
    <Stack spacing={3.5}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <VendorIcon vendorCode={vendorCode} name={vendorName} size={28} hideLabel />
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
          critical: 'Critical Advisories',
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
        isAuthenticated={isAuthenticated}
      />
    </Stack>
  );
};
