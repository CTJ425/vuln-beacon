import React from 'react';
import { AppBar, Toolbar, Typography, Box, Chip, IconButton, Tooltip } from '@mui/material';
import { ShieldAlert, Github, Terminal, Moon, Sun, PanelLeft } from 'lucide-react';
import { useThemeMode } from '@/theme/ThemeContext';

export interface HeaderProps {
  /** @deprecated Public manual sync is role-gated to Admin Console in M2 */
  onManualSync?: () => void;
  /** @deprecated Public manual sync is role-gated to Admin Console in M2 */
  isSyncing?: boolean;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  isSidebarCollapsed = false,
}) => {
  const { resolvedMode, setThemeMode } = useThemeMode();
  const isDark = resolvedMode === 'dark';

  return (
    <AppBar
      position="sticky"
      sx={{
        bgcolor: (theme) =>
          theme.palette.mode === 'dark' ? 'rgba(19, 27, 46, 0.90)' : 'rgba(255, 255, 255, 0.90)',
        backdropFilter: 'blur(12px)',
        borderBottom: 1,
        borderColor: 'divider',
        boxShadow: 'none',
        backgroundImage: 'none',
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between', minHeight: 64, px: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {onToggleSidebar && (
            <Tooltip title={isSidebarCollapsed ? '展開側邊欄' : '收起側邊欄'}>
              <IconButton
                onClick={onToggleSidebar}
                aria-label={isSidebarCollapsed ? '展開側邊欄' : '收起側邊欄'}
                data-testid="header-sidebar-toggle"
                size="small"
                sx={{
                  color: 'text.secondary',
                  mr: 0.5,
                  '&:hover': {
                    color: 'text.primary',
                  },
                }}
              >
                <PanelLeft size={20} />
              </IconButton>
            </Tooltip>
          )}
          <ShieldAlert size={28} color="#38bdf8" />
          <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.025em', color: 'text.primary' }}>
            VulnBeacon
          </Typography>
          <Chip
            size="small"
            label="Multi-Vendor Threat Feed"
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

          <Box role="group" aria-label="Theme mode switcher">
            <IconButton
              onClick={() => setThemeMode(isDark ? 'light' : 'dark')}
              aria-label={isDark ? '切換為淺色模式' : '切換為深色模式'}
              size="small"
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  color: 'text.primary',
                },
              }}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </IconButton>
          </Box>

          <IconButton
            component="a"
            href="https://github.com/CTJ425/vuln-beacon"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub Repository"
            data-testid="header-github-link"
            size="small"
            sx={{
              color: 'text.secondary',
              '&:hover': {
                color: 'text.primary',
              },
            }}
          >
            <Github size={20} />
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

