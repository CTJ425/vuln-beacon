import React, { useState } from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  LayoutDashboard,
  Shield,
  Activity,
  Settings,
  Lock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { VendorIcon } from '@/components/common/VendorIcon';
import { VendorNode } from '@/services/productTaxonomy';
import { APP_VERSION } from '@/config/version';

/**
 * Navigation state union for sidebar and page routing.
 * Note: 'sync' and 'settings' are legacy section identifiers preserved for
 * backwards compatibility; they are routed into 'admin' console in App.tsx.
 */
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
  defaultCollapsed?: boolean;
  isCollapsed?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
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
  defaultCollapsed = false,
  isCollapsed,
  collapsed,
  onToggleCollapse,
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const isControlled = typeof isCollapsed === 'boolean' || typeof collapsed === 'boolean';
  const effectiveCollapsed = isControlled ? Boolean(isCollapsed ?? collapsed) : internalCollapsed;

  const handleToggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    }
    if (!isControlled) {
      setInternalCollapsed((prev) => !prev);
    }
  };

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
    px: effectiveCollapsed ? 1 : 1.5,
    justifyContent: effectiveCollapsed ? 'center' : 'flex-start',
    minHeight: 44,
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
      data-collapsed={effectiveCollapsed ? 'true' : 'false'}
      sx={{
        width: effectiveCollapsed ? 64 : 240,
        flexShrink: 0,
        bgcolor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
        height: 'calc(100vh - 64px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
        transition: (theme) =>
          theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
      }}
    >
      {/* Scrollable Navigation List */}
      <Box
        data-testid="sidebar-nav-list-wrapper"
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          py: 2,
        }}
      >
        <List sx={{ px: effectiveCollapsed ? 1 : 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Tooltip title={effectiveCollapsed ? 'Overview' : ''} placement="right">
            <ListItemButton
              onClick={() => onSelectNav({ section: 'dashboard' })}
              selected={currentNav.section === 'dashboard'}
              aria-label="Overview"
              sx={rowSx(currentNav.section === 'dashboard')}
            >
              <ListItemIcon sx={{ color: 'inherit', minWidth: effectiveCollapsed ? 0 : 36, justifyContent: 'center' }}>
                <LayoutDashboard size={20} />
              </ListItemIcon>
              {!effectiveCollapsed && (
                <ListItemText
                  primary="Overview"
                  primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: currentNav.section === 'dashboard' ? 700 : 500 }}
                />
              )}
            </ListItemButton>
          </Tooltip>

          {taxonomy.map((vendor) => {
            const isSelected = currentNav.section === 'vendor' && currentNav.vendorCode === vendor.vendorCode;
            return (
              <Tooltip
                key={vendor.vendorCode}
                title={effectiveCollapsed ? vendor.vendorName : ''}
                placement="right"
              >
                <ListItemButton
                  onClick={() => onSelectNav({ section: 'vendor', vendorCode: vendor.vendorCode })}
                  selected={isSelected}
                  aria-label={vendor.vendorName}
                  sx={rowSx(isSelected)}
                >
                  <VendorIcon
                    vendorCode={vendor.vendorCode}
                    name={vendor.vendorName}
                    size={16}
                    hideLabel={effectiveCollapsed}
                  />
                </ListItemButton>
              </Tooltip>
            );
          })}

          {staticItems.map((item) => {
            const isSelected = currentNav.section === item.id;
            return (
              <Tooltip key={item.id} title={effectiveCollapsed ? item.label : ''} placement="right">
                <ListItemButton
                  onClick={() => onSelectNav({ section: item.id })}
                  selected={isSelected}
                  aria-label={item.label}
                  sx={rowSx(isSelected)}
                >
                  <ListItemIcon sx={{ color: 'inherit', minWidth: effectiveCollapsed ? 0 : 36, justifyContent: 'center' }}>
                    {item.icon}
                  </ListItemIcon>
                  {!effectiveCollapsed && (
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: isSelected ? 700 : 500 }}
                    />
                  )}
                </ListItemButton>
              </Tooltip>
            );
          })}
        </List>
      </Box>

      {/* Pinned Bottom-Left Footer */}
      <Box
        data-testid="sidebar-footer"
        sx={{
          px: effectiveCollapsed ? 1 : 2,
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
            display: effectiveCollapsed ? 'none' : 'block',
            whiteSpace: 'nowrap',
          }}
        >
          {displayVersion}
        </Typography>

        <Tooltip
          title={effectiveCollapsed ? '展開側邊欄' : '收起側邊欄'}
          placement={effectiveCollapsed ? 'right' : 'top'}
        >
          <IconButton
            onClick={handleToggleCollapse}
            aria-label={effectiveCollapsed ? '展開側邊欄' : '收起側邊欄'}
            data-testid="sidebar-collapse-button"
            size="small"
            sx={{
              ml: 'auto',
              mr: effectiveCollapsed ? 'auto' : 0,
              color: 'text.secondary',
              '&:hover': {
                color: 'text.primary',
                bgcolor: 'action.hover',
              },
            }}
          >
            {effectiveCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};

