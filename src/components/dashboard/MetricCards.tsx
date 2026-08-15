import React from 'react';
import { Grid, Card, CardContent, Typography, Box } from '@mui/material';
import { ShieldAlert, AlertTriangle, Layers, CheckCircle2 } from 'lucide-react';

interface MetricCardsProps {
  totalCves: number;
  criticalCount: number;
  highCount: number;
  totalImpactedComponents?: number;
  labels?: {
    critical?: string;
    high?: string;
    components?: string;
    total?: string;
  };
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  totalCves,
  criticalCount,
  highCount,
  totalImpactedComponents = 0,
  labels,
}) => {
  const cards = [
    {
      title: labels?.critical ?? 'Critical CVEs',
      value: criticalCount,
      icon: <ShieldAlert size={26} color="#ef4444" />,
      subtext: 'CVSS ≥ 9.0 (Immediate action)',
      border: 'rgba(239, 68, 68, 0.3)',
      bg: 'rgba(239, 68, 68, 0.06)',
    },
    {
      title: labels?.high ?? 'High Severity',
      value: highCount,
      icon: <AlertTriangle size={26} color="#f97316" />,
      subtext: 'CVSS 7.0 - 8.9 (Patch window)',
      border: 'rgba(249, 115, 22, 0.3)',
      bg: 'rgba(249, 115, 22, 0.06)',
    },
    {
      title: labels?.components ?? 'Impacted Components',
      value: totalImpactedComponents,
      icon: <Layers size={26} color="#38bdf8" />,
      subtext: 'Affected services & packages',
      border: 'rgba(56, 189, 248, 0.3)',
      bg: 'rgba(56, 189, 248, 0.06)',
    },
    {
      title: labels?.total ?? 'Tracked CVE Records',
      value: totalCves,
      icon: <CheckCircle2 size={26} color="#22c55e" />,
      subtext: 'Red Hat Enterprise Feeds',
      border: 'rgba(34, 197, 94, 0.3)',
      bg: 'rgba(34, 197, 94, 0.06)',
    },

  ];

  return (
    <Grid container spacing={2.5}>
      {cards.map((card, index) => (
        <Grid item xs={12} sm={6} md={3} key={index}>
          <Card
            sx={{
              bgcolor: 'background.paper',
              border: `1px solid ${card.border}`,
              borderRadius: 2.5,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {card.title}
                </Typography>
                <Box
                  sx={{
                    p: 1,
                    borderRadius: 2,
                    bgcolor: card.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {card.icon}
                </Box>
              </Box>
              <Typography variant="h3" sx={{ mt: 1.5, mb: 0.5, fontWeight: 800, color: 'text.primary' }}>
                {card.value}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                {card.subtext}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};
