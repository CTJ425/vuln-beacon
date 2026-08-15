import React from 'react';
import { AppBar, Toolbar, Typography, Box, Chip, Button, IconButton } from '@mui/material';
import { ShieldAlert, RefreshCw, Bell, Terminal } from 'lucide-react';
import { ThemeSwitcher } from './ThemeSwitcher';

interface HeaderProps {
  onManualSync?: () => void;
  isSyncing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onManualSync, isSyncing = false }) => {
  return (
    <AppBar
      position="sticky"
      sx={{
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
        boxShadow: 'none',
        backgroundImage: 'none',
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between', minHeight: 64, px: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ShieldAlert size={28} color="#38bdf8" />
          <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em', color: 'text.primary' }}>
            VulnBeacon
          </Typography>
          <Chip
            size="small"
            label="Red Hat Security & Errata"
            sx={{

              bgcolor: (theme) =>
                theme.palette.mode === 'dark' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(2, 132, 199, 0.10)',
              color: 'primary.main',
              border: '1px solid',
              borderColor: (theme) =>
                theme.palette.mode === 'dark' ? 'rgba(56, 189, 248, 0.3)' : 'rgba(2, 132, 199, 0.25)',
              fontWeight: 600,
              fontSize: '0.7rem',
              height: 22,
            }}
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ display: { xs: 'none', lg: 'flex' }, alignItems: 'center', gap: 1, color: 'text.secondary', fontSize: '0.8125rem' }}>
            <Terminal size={16} />
            <span>Daily Shifts: 08:00 / 12:30 / 18:30 (Asia/Taipei)</span>
          </Box>

          <ThemeSwitcher />

          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />}
            onClick={onManualSync}
            disabled={isSyncing}
            sx={{
              borderColor: 'primary.main',
              color: 'primary.main',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: (theme) =>
                  theme.palette.mode === 'dark' ? 'rgba(56, 189, 248, 0.08)' : 'rgba(2, 132, 199, 0.08)',
              },
            }}
          >
            {isSyncing ? 'Syncing...' : 'Sync All Feeds'}
          </Button>

          <IconButton size="small" sx={{ color: 'text.secondary' }}>
            <Bell size={20} />
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

