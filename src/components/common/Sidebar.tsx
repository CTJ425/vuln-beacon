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
import { pathForNav } from '@/lib/routes';
import { useI18n } from '@/i18n/I18nContext';
import type { MessageKey } from '@/i18n/messages/en';

/**
 * Navigation state union for sidebar and page routing.
 * Note: 'sync' and 'settings' are legacy section identifiers preserved for
 * backwards compatibility; they are routed into 'admin' console in App.tsx.
 */
export type NavState =
  | { section: 'dashboard' | 'explorer' | 'sync' | 'settings' | 'admin' }
  | { section: 'vendor'; vendorCode: string };

export interface SidebarProps {
  /** null when the URL matches no page, so no item reads as current. */
  currentNav: NavState | null;
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
  const { t } = useI18n();
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

  const allStaticItems: { id: 'explorer' | 'sync' | 'settings' | 'admin'; labelKey: MessageKey; icon: React.ReactNode }[] = [
    { id: 'explorer', labelKey: 'nav.explorer', icon: <Shield size={18} /> },
    { id: 'sync', labelKey: 'nav.sync', icon: <Activity size={18} /> },
    { id: 'settings', labelKey: 'nav.settings', icon: <Settings size={18} /> },
    { id: 'admin', labelKey: 'nav.admin', icon: <Lock size={18} /> },
  ];
  const staticItems = allStaticItems
    .filter((item) => staticNavIds.includes(item.id))
    .map((item) => ({ ...item, label: t(item.labelKey) }));
  const overviewLabel = t('nav.overview');
  const collapseLabel = effectiveCollapsed ? t('sidebar.expand') : t('sidebar.collapse');

  // Items are real links (copy, middle-click, open in new tab); a plain click
  // stays in the app through onSelectNav, which may still gate on sign-in.
  const linkProps = (nav: NavState) => ({
    component: 'a' as const,
    href: pathForNav(nav),
    onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      onSelectNav(nav);
    },
  });

  const rowSx = (isSelected: boolean) => ({
    borderRadius: 1,
    py: 0.75,
    px: effectiveCollapsed ? 1 : 1.25,
    justifyContent: effectiveCollapsed ? 'center' : 'flex-start',
    minHeight: 36,
    bgcolor: isSelected ? 'action.selected' : 'transparent',
    color: isSelected ? 'text.primary' : 'text.secondary',
    '&:hover': {
      bgcolor: isSelected ? 'action.selected' : 'action.hover',
      color: 'text.primary',
    },
    '&.Mui-selected, &.Mui-selected:hover': { bgcolor: 'action.selected' },
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
        // Pin below the sticky 64px header so the bottom-left version stays
        // visible while the window scrolls.
        position: 'sticky',
        top: 64,
        alignSelf: 'flex-start',
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
          <Tooltip title={effectiveCollapsed ? overviewLabel : ''} placement="right">
            <ListItemButton
              {...linkProps({ section: 'dashboard' })}
              selected={currentNav?.section === 'dashboard'}
              aria-label={overviewLabel}
              sx={rowSx(currentNav?.section === 'dashboard')}
            >
              <ListItemIcon sx={{ color: 'inherit', minWidth: effectiveCollapsed ? 0 : 32, justifyContent: 'center' }}>
                <LayoutDashboard size={18} />
              </ListItemIcon>
              {!effectiveCollapsed && (
                <ListItemText
                  primary={overviewLabel}
                  primaryTypographyProps={{ fontSize: '0.8125rem', fontWeight: currentNav?.section === 'dashboard' ? 600 : 500 }}
                />
              )}
            </ListItemButton>
          </Tooltip>

          {taxonomy.map((vendor) => {
            const isSelected = currentNav?.section === 'vendor' && currentNav.vendorCode === vendor.vendorCode;
            return (
              <Tooltip
                key={vendor.vendorCode}
                title={effectiveCollapsed ? vendor.vendorName : ''}
                placement="right"
              >
                <ListItemButton
                  {...linkProps({ section: 'vendor', vendorCode: vendor.vendorCode })}
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
            const isSelected = currentNav?.section === item.id;
            return (
              <Tooltip key={item.id} title={effectiveCollapsed ? item.label : ''} placement="right">
                <ListItemButton
                  {...linkProps({ section: item.id })}
                  selected={isSelected}
                  aria-label={item.label}
                  sx={rowSx(isSelected)}
                >
                  <ListItemIcon sx={{ color: 'inherit', minWidth: effectiveCollapsed ? 0 : 32, justifyContent: 'center' }}>
                    {item.icon}
                  </ListItemIcon>
                  {!effectiveCollapsed && (
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{ fontSize: '0.8125rem', fontWeight: isSelected ? 600 : 500 }}
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
          title={collapseLabel}
          placement={effectiveCollapsed ? 'right' : 'top'}
        >
          <IconButton
            onClick={handleToggleCollapse}
            aria-label={collapseLabel}
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

