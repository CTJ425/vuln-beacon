import React from 'react';
import { Chip } from '@mui/material';
import { SeverityLevel } from '@/types';
import { severityColors, SeverityTone } from '@/theme/tokens';

interface SeverityBadgeProps {
  severity: SeverityLevel | string;
  size?: 'small' | 'medium';
  score?: number | null;
}

const SEVERITY_TONE: Record<string, SeverityTone> = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, size = 'small', score }) => {
  const norm = (severity || 'UNKNOWN').toUpperCase();
  const tone = SEVERITY_TONE[norm] ?? 'unknown';
  const name = tone === 'unknown' ? 'UNKNOWN' : norm;
  const label = score !== undefined && score !== null ? `${name} ${score.toFixed(1)}` : name;

  return (
    <Chip
      size={size}
      label={label}
      sx={{
        color: (theme) => severityColors(theme, tone).fg,
        bgcolor: (theme) => severityColors(theme, tone).bg,
        fontWeight: 700,
        fontSize: size === 'small' ? '0.6875rem' : '0.75rem',
        letterSpacing: '0.04em',
        fontVariantNumeric: 'tabular-nums',
      }}
    />
  );
};
