import React from 'react';
import { Chip } from '@mui/material';
import { vulnStateColors, VulnStateTone } from '@/theme/tokens';

interface StatusChipProps {
  status: string;
  size?: 'small' | 'medium';
}

const STATUS_CONFIG: Record<string, { label: string; tone: VulnStateTone }> = {
  AFFECTED: { label: 'Affected', tone: 'affected' },
  FIX_DEFERRED: { label: 'Fix deferred', tone: 'deferred' },
  FIXED: { label: 'Fixed', tone: 'fixed' },
  WILL_NOT_FIX: { label: 'Will not fix', tone: 'wontfix' },
  UNDER_INVESTIGATION: { label: 'Under investigation', tone: 'investigating' },
};

export const StatusChip: React.FC<StatusChipProps> = ({ status, size = 'small' }) => {
  const norm = (status || 'AFFECTED').toUpperCase().replace(/[\s-]/g, '_');
  const config = STATUS_CONFIG[norm] || { label: status, tone: 'unknown' as const };

  return (
    <Chip
      size={size}
      label={config.label}
      sx={{
        color: (theme) => vulnStateColors(theme, config.tone).fg,
        bgcolor: (theme) => vulnStateColors(theme, config.tone).bg,
        fontWeight: 600,
        fontSize: size === 'small' ? '0.75rem' : '0.8125rem',
      }}
    />
  );
};
