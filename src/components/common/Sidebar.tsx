import React from 'react';
import { Box, List, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import { LayoutDashboard, Shield, Activity, Settings, Lock } from 'lucide-react';
import { VendorIcon } from '@/components/common/VendorIcon';
import { VendorNode } from '@/services/productTaxonomy';
import { APP_VERSION } from '@/config/version';

export type NavState =
  | { section: 'dashboard' | 'explorer' | 'sync' | 'settings' | 'admin' }
  | { section: 'vendor'; vendorCode: string };

export interface SidebarProps {
  currentNav: NavState;
  onSelectNav: (nav: NavState) => void;
  taxonomy: VendorNode[];
  version?: string;
  /**
   * Which static nav entries to render. Sync Monitor and Webhooks & Config
   * are consolidated into the authenticated Admin Console (R1), so the app
   * only asks for 'explorer' and 'admin' here; the full default list is kept
   * so this component stays self-contained when used standalone.
   */
  staticNavIds?: Array<'explorer' | 'sync' | 'settings' | 'admin'>;
}

const DEFAULT_STATIC_NAV_IDS: Array<'explorer' | 'sync' | 'settings' | 'admin'> = [
  'explorer',
  'sync',
  'settings',
  'admin',
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentNav,
  onSelectNav,
  taxonomy,
  version = APP_VERSION,
  staticNavIds = DEFAULT_STATIC_NAV_IDS,
}) => {
  const allStaticItems: { id: 'explorer' | 'sync' | 'settings' | 'admin'; label: string; icon: React.ReactNode }[] = [
    { id: 'explorer', label: 'CVE Explorer', icon: <Shield size={20} /> },
    { id: 'sync', label: 'Sync Monitor', icon: <Activity size={20} /> },
    { id: 'settings', label: 'Webhooks & Config', icon: <Settings size={20} /> },
    { id: 'admin', label: 'Admin Console', icon: <Lock size={20} /> },
  ];
  const staticItems = allStaticItems.filter((item) => staticNavIds.includes(item.id));

  const rowSx = (isSelected: boolean) => ({
    borderRadius: 2,
    py: 1.25,
    px: 1.5,
    bgcolor: isSelected ? 'action.selected' : 'transparent',
    color: isSelected ? 'primary.main' : 'text.secondary',
    '&:hover': {
      bgcolor: isSelected ? 'action.selected' : 'action.hover',
      color: isSelected ? 'primary.main' : 'text.primary',
    },
  });

  const displayVersion = version.startsWith('v') ? version : `v${version}`;

  return (
    <Box
      component="aside"
      data-testid="sidebar-container"
      sx={{
        width: 240,
        flexShrink: 0,
        bgcolor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
        height: 'calc(100vh - 64px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
      }}
    >
      {/* Scrollable Navigation List */}
      <Box
        data-testid="sidebar-nav-list-wrapper"
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          py: 2,
        }}
      >
        <List sx={{ px: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <ListItemButton
            onClick={() => onSelectNav({ section: 'dashboard' })}
            selected={currentNav.section === 'dashboard'}
            sx={rowSx(currentNav.section === 'dashboard')}
          >
            <ListItemIcon sx={{ color: 'inherit', minWidth: 36 }}>
              <LayoutDashboard size={20} />
            </ListItemIcon>
            <ListItemText
              primary="Overview"
              primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: currentNav.section === 'dashboard' ? 700 : 500 }}
            />
          </ListItemButton>

          {taxonomy.map((vendor) => {
            const isSelected = currentNav.section === 'vendor' && currentNav.vendorCode === vendor.vendorCode;
            return (
              <ListItemButton
                key={vendor.vendorCode}
                onClick={() => onSelectNav({ section: 'vendor', vendorCode: vendor.vendorCode })}
                selected={isSelected}
                sx={rowSx(isSelected)}
              >
                <VendorIcon vendorCode={vendor.vendorCode} name={vendor.vendorName} size={16} />
              </ListItemButton>
            );
          })}

          {staticItems.map((item) => {
            const isSelected = currentNav.section === item.id;
            return (
              <ListItemButton
                key={item.id}
                onClick={() => onSelectNav({ section: item.id })}
                selected={isSelected}
                sx={rowSx(isSelected)}
              >
                <ListItemIcon sx={{ color: 'inherit', minWidth: 36 }}>{item.icon}</ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: isSelected ? 700 : 500 }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Box>

      {/* Pinned Bottom-Left Footer */}
      <Box
        data-testid="sidebar-footer"
        sx={{
          px: 2,
          py: 1.5,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
        }}
      >
        <Typography
          variant="caption"
          data-testid="sidebar-version"
          sx={{
            color: 'text.secondary',
            fontSize: '0.75rem',
            fontWeight: 500,
            letterSpacing: '0.02em',
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          {displayVersion}
        </Typography>
      </Box>
    </Box>
  );
};
