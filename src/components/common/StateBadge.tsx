import React from 'react';
import { Chip } from '@mui/material';
import { getStateBadgeConfig } from '@/utils/statusUtils';

export interface StateBadgeProps {
  state?: string | null;
}

export const StateBadge: React.FC<StateBadgeProps> = ({ state }) => {
  const config = getStateBadgeConfig(state);
  return (
    <Chip
      label={config.label}
      size="small"
      sx={{
        fontWeight: 700,
        fontSize: '0.75rem',
        bgcolor: config.bg,
        color: config.color,
        border: config.border || 'none',
      }}
    />
  );
};
