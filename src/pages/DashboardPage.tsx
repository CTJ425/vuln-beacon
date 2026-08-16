import React from 'react';
import { Box, Typography, Grid, Button, Stack, Card, CardActionArea, CardContent } from '@mui/material';
import { ArrowRight } from 'lucide-react';
import { MetricCards } from '@/components/dashboard/MetricCards';
import { AdvisoryTable } from '@/components/explorer/AdvisoryTable';
import { CveTableRowItem } from '@/components/explorer/CveTable';
import { AdvisoryRowItem } from '@/services/advisoryService';
import { VendorIcon } from '@/components/common/VendorIcon';
import { VendorNode } from '@/services/productTaxonomy';

interface DashboardPageProps {
  advisories: AdvisoryRowItem[];
  cves: CveTableRowItem[];
  onSelectAdvisory: (item: AdvisoryRowItem) => void;
  onSelectCve: (item: CveTableRowItem) => void;
  onNavigateToExplorer: () => void;
  taxonomy?: VendorNode[];
  onSelectVendor?: (vendorCode: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  advisories,
  onSelectAdvisory,
  onNavigateToExplorer,
  taxonomy = [],
  onSelectVendor,
}) => {
  const criticalCount = advisories.filter((a) => a.severity === 'CRITICAL').length;
  const highCount = advisories.filter((a) => a.severity === 'HIGH').length;

  let totalImpactedComponents = 0;
  advisories.forEach((a) => {
    totalImpactedComponents += a.product_impacts ? a.product_impacts.length : 0;
  });

  const recentCriticalOrHigh = advisories
    .filter((a) => a.severity === 'CRITICAL' || a.severity === 'HIGH')
    .slice(0, 5);

  return (
    <Stack spacing={3.5}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em' }}>
            Security Intelligence Overview
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Automated multi-vendor security advisory feeds, Errata updates, and component impact matrix.
          </Typography>
        </Box>
      </Box>

      <MetricCards
        totalCves={advisories.length}
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

      {taxonomy.length > 0 && (
        <Grid container spacing={2}>
          {taxonomy.map((vendor) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={vendor.vendorCode}>
              <Card sx={{ bgcolor: 'background.paper', borderRadius: 2.5, border: 1, borderColor: 'divider' }}>
                <CardActionArea
                  onClick={() => onSelectVendor && onSelectVendor(vendor.vendorCode)}
                  sx={{ p: 2 }}
                >
                  <CardContent sx={{ p: 0 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <VendorIcon vendorCode={vendor.vendorCode} name={vendor.vendorName} size={18} />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Advisories: {vendor.advisoryCount}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 700 }}>
                        Critical: {vendor.criticalCount}
                      </Typography>
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Box sx={{ bgcolor: 'background.paper', p: 3, borderRadius: 2.5, border: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
              Urgent Vulnerabilities Requiring Attention
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Critical &amp; High severity Red Hat advisories recently published.
            </Typography>
          </Box>
          <Button
            size="small"
            endIcon={<ArrowRight size={16} />}
            onClick={onNavigateToExplorer}
            sx={{ color: 'primary.main' }}
          >
            View All Errata Explorer
          </Button>
        </Box>

        <AdvisoryTable items={recentCriticalOrHigh} onSelectRow={onSelectAdvisory} />
      </Box>
    </Stack>
  );
};
