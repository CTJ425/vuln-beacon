import React from 'react';
import { Card, CardContent, Typography, Box, LinearProgress } from '@mui/material';
import { Layers } from 'lucide-react';

interface ProductDistributionProps {
  distributionCounts: Record<string, number>;
  total: number;
}

export const VendorDistributionChart: React.FC<ProductDistributionProps> = ({ distributionCounts, total }) => {
  const products = Object.entries(distributionCounts).sort((a, b) => b[1] - a[1]);

  return (
    <Card sx={{ bgcolor: 'background.paper', borderRadius: 2.5, height: '100%', border: 1, borderColor: 'divider' }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Layers size={20} color="#ee0000" />
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
            Red Hat Product Distribution
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
          Breakdown of active advisories across Red Hat enterprise product families.
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {products.map(([productName, count]) => {
            const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <Box key={productName}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.8125rem' }}>
                    {productName}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                      {count}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 32, textAlign: 'right' }}>
                      {percentage}%
                    </Typography>
                  </Box>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={percentage}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    bgcolor: (theme) =>
                      theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 3,
                      bgcolor: '#ee0000',
                    },
                  }}
                />
              </Box>
            );
          })}
        </Box>
      </CardContent>
    </Card>
  );
};
