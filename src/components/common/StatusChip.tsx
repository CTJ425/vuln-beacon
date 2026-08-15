import React from 'react';
import { Chip } from '@mui/material';

interface StatusChipProps {
  status: string;
  size?: 'small' | 'medium';
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  AFFECTED: { label: 'Affected', bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' },
  FIX_DEFERRED: { label: 'Fix deferred', bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' },
  FIXED: { label: 'Fixed', bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', border: 'rgba(34, 197, 94, 0.3)' },
  WILL_NOT_FIX: { label: 'Will not fix', bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8', border: 'rgba(148, 163, 184, 0.3)' },
  UNDER_INVESTIGATION: { label: 'Under investigation', bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8', border: 'rgba(56, 189, 248, 0.3)' },
};

export const StatusChip: React.FC<StatusChipProps> = ({ status, size = 'small' }) => {
  const norm = (status || 'AFFECTED').toUpperCase().replace(/[\s-]/g, '_');
  const config = STATUS_CONFIG[norm] || {
    label: status,
    bg: 'rgba(56, 189, 248, 0.15)',
    text: '#38bdf8',
    border: 'rgba(56, 189, 248, 0.3)',
  };

  return (
    <Chip
      size={size}
      label={config.label}
      sx={{
        backgroundColor: config.bg,
        color: config.text,
        border: `1px solid ${config.border}`,
        fontWeight: 700,
        fontSize: size === 'small' ? '0.75rem' : '0.8125rem',
      }}
    />
  );
};
