import React from 'react';
import { AppBar, Toolbar, Typography, Box, IconButton, Tooltip } from '@mui/material';
import { ShieldAlert, Github, Terminal, Moon, Sun, PanelLeft } from 'lucide-react';
import { useThemeMode } from '@/theme/ThemeContext';
import { useI18n } from '@/i18n/I18nContext';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';

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
  const { t } = useI18n();
  const sidebarLabel = isSidebarCollapsed ? t('sidebar.expand') : t('sidebar.collapse');
  const themeLabel = isDark ? t('theme.toLight') : t('theme.toDark');

  return (
    <AppBar
      position="sticky"
      sx={{
        bgcolor: 'background.paper',
        color: 'text.primary',
        borderBottom: 1,
        borderColor: 'divider',
        boxShadow: 'none',
        backgroundImage: 'none',
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between', minHeight: 64, px: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {onToggleSidebar && (
            <Tooltip title={sidebarLabel}>
              <IconButton
                onClick={onToggleSidebar}
                aria-label={sidebarLabel}
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
          <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}>
            <ShieldAlert size={22} aria-hidden />
          </Box>
          <Typography component="span" sx={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.01em' }}>
            VulnBeacon
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ display: { xs: 'none', lg: 'flex' }, alignItems: 'center', gap: 1, color: 'text.secondary', fontSize: '0.8125rem' }}>
            <Terminal size={16} />
            <span>Daily Shifts: 08:00 / 12:30 / 18:30 (Asia/Taipei)</span>
          </Box>

          <LanguageSwitcher />

          <Box role="group" aria-label="Theme mode switcher">
            <Tooltip title={themeLabel}>
              <IconButton
                onClick={() => setThemeMode(isDark ? 'light' : 'dark')}
                aria-label={themeLabel}
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
            </Tooltip>
          </Box>

          <Tooltip title={t('header.github')}>
            <IconButton
              component="a"
              href="https://github.com/CTJ425/vuln-beacon"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('header.github')}
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
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

