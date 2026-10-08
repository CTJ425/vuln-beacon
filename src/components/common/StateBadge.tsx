import React from 'react';
import { Chip } from '@mui/material';
import { getStateBadgeConfig } from '@/utils/statusUtils';
import { vulnStateColors } from '@/theme/tokens';

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
        fontWeight: 600,
        fontSize: '0.75rem',
        color: (theme) => vulnStateColors(theme, config.tone).fg,
        bgcolor: (theme) => vulnStateColors(theme, config.tone).bg,
      }}
    />
  );
};
