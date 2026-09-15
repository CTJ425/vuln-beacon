import React from 'react';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';

export interface PageStateProps {
  variant: 'loading' | 'empty' | 'error';
  message: React.ReactNode;
  action?: React.ReactNode;
}

// Presentational only: unifies the loading / empty / error visual treatments
// that used to be duplicated inline in App.tsx, so a failed load can never be
// mistaken for an empty database again.
export const PageState: React.FC<PageStateProps> = ({ variant, message, action }) => {
  if (variant === 'loading') {
    return (
      <Box
        data-testid="page-state-loading"
        sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 2 }}
      >
        <CircularProgress size={36} color="primary" />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {message}
        </Typography>
      </Box>
    );
  }

  return (
    <Alert
      data-testid={`page-state-${variant}`}
      severity={variant === 'error' ? 'error' : 'info'}
      action={action}
      sx={{ mb: 3 }}
    >
      {message}
    </Alert>
  );
};
