import React from 'react';
import { Chip, ChipProps } from '@mui/material';
import { SeverityLevel } from '@/types';

interface SeverityBadgeProps {
  severity: SeverityLevel | string;
  size?: 'small' | 'medium';
  score?: number | null;
}

const SEVERITY_CONFIG: Record<string, { label: string; color: ChipProps['color']; bg: string; text: string; border: string }> = {
  CRITICAL: { label: 'CRITICAL', color: 'error', bg: 'rgba(239, 68, 68, 0.15)', text: '#fca5a5', border: 'rgba(239, 68, 68, 0.3)' },
  HIGH: { label: 'HIGH', color: 'warning', bg: 'rgba(249, 115, 22, 0.15)', text: '#fdba74', border: 'rgba(249, 115, 22, 0.3)' },
  MEDIUM: { label: 'MEDIUM', color: 'info', bg: 'rgba(234, 179, 8, 0.15)', text: '#fde047', border: 'rgba(234, 179, 8, 0.3)' },
  LOW: { label: 'LOW', color: 'success', bg: 'rgba(16, 185, 129, 0.15)', text: '#6ee7b7', border: 'rgba(16, 185, 129, 0.3)' },
  UNKNOWN: { label: 'UNKNOWN', color: 'default', bg: 'rgba(148, 163, 184, 0.15)', text: '#cbd5e1', border: 'rgba(148, 163, 184, 0.3)' },
};

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, size = 'small', score }) => {
  const norm = (severity || 'UNKNOWN').toUpperCase();
  const config = SEVERITY_CONFIG[norm] || SEVERITY_CONFIG.UNKNOWN;
  const label = score !== undefined && score !== null ? `${config.label} ${score.toFixed(1)}` : config.label;

  return (
    <Chip
      size={size}
      label={label}
      sx={{
        backgroundColor: config.bg,
        color: config.text,
        border: `1px solid ${config.border}`,
        fontWeight: 700,
        fontSize: size === 'small' ? '0.75rem' : '0.8125rem',
        letterSpacing: '0.02em',
      }}
    />
  );
};
