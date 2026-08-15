import React from 'react';
import { Box, Typography, Grid, Button, Stack } from '@mui/material';
import { ArrowRight } from 'lucide-react';
import { MetricCards } from '@/components/dashboard/MetricCards';
import { VendorDistributionChart } from '@/components/dashboard/VendorDistributionChart';
import { AdvisoryTable } from '@/components/explorer/AdvisoryTable';
import { CveTableRowItem } from '@/components/explorer/CveTable';
import { AdvisoryRowItem } from '@/services/advisoryService';

interface DashboardPageProps {
  advisories: AdvisoryRowItem[];
  cves: CveTableRowItem[];
  onSelectAdvisory: (item: AdvisoryRowItem) => void;
  onSelectCve: (item: CveTableRowItem) => void;
  onNavigateToExplorer: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  advisories,
  onSelectAdvisory,
  onNavigateToExplorer,
}) => {
  const criticalCount = advisories.filter((a) => a.severity === 'CRITICAL').length;
  const highCount = advisories.filter((a) => a.severity === 'HIGH').length;

  let totalImpactedComponents = 0;
  advisories.forEach((a) => {
    totalImpactedComponents += a.product_impacts ? a.product_impacts.length : 0;
  });

  const productDistribution: Record<string, number> = {
    'Red Hat Enterprise Linux': 0,
    'OpenShift & Cloud Native': 0,
    'OpenShift AI (RHOAI)': 0,
    'Ansible Automation Platform': 0,
    'JBoss / Application Middleware': 0,
  };

  for (const advisory of advisories) {
    const products = advisory.affected_products.join(' ').toLowerCase();
    if (products.includes('enterprise linux') || products.includes('rhel')) {
      productDistribution['Red Hat Enterprise Linux']++;
    }
    if (products.includes('openshift') || products.includes('cluster') || products.includes('container')) {
      productDistribution['OpenShift & Cloud Native']++;
    }
    if (products.includes('rhoai') || products.includes('ai') || products.includes('odh')) {
      productDistribution['OpenShift AI (RHOAI)']++;
    }
    if (products.includes('ansible')) {
      productDistribution['Ansible Automation Platform']++;
    }
    if (products.includes('jboss') || products.includes('spring') || products.includes('keycloak') || products.includes('mta')) {
      productDistribution['JBoss / Application Middleware']++;
    }
  }

  const recentCriticalOrHigh = advisories
    .filter((a) => a.severity === 'CRITICAL' || a.severity === 'HIGH')
    .slice(0, 5);

  return (
    <Stack spacing={3.5}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em' }}>
            Red Hat Security Intelligence Dashboard
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Automated Red Hat Security Advisory (RHSA) feeds, Errata updates, and component impact matrix.
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

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <Box sx={{ bgcolor: 'background.paper', p: 3, borderRadius: 2.5, height: '100%', border: 1, borderColor: 'divider' }}>
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
        </Grid>

        <Grid item xs={12} lg={4}>
          <VendorDistributionChart distributionCounts={productDistribution} total={advisories.length} />
        </Grid>
      </Grid>
    </Stack>
  );
};
