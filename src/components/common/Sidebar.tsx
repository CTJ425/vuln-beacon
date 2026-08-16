import React from 'react';
import { Box, List, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { LayoutDashboard, Shield, Activity, Settings } from 'lucide-react';
import { VendorIcon } from '@/components/common/VendorIcon';
import { VendorNode } from '@/services/productTaxonomy';

export type NavState =
  | { section: 'dashboard' | 'explorer' | 'sync' | 'settings' }
  | { section: 'vendor'; vendorCode: string };

interface SidebarProps {
  currentNav: NavState;
  onSelectNav: (nav: NavState) => void;
  taxonomy: VendorNode[];
}

export const Sidebar: React.FC<SidebarProps> = ({ currentNav, onSelectNav, taxonomy }) => {
  const staticItems: { id: 'explorer' | 'sync' | 'settings'; label: string; icon: React.ReactNode }[] = [
    { id: 'explorer', label: 'CVE Explorer', icon: <Shield size={20} /> },
    { id: 'sync', label: 'Sync Monitor', icon: <Activity size={20} /> },
    { id: 'settings', label: 'Webhooks & Config', icon: <Settings size={20} /> },
  ];

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

  return (
    <Box
      sx={{
        width: 240,
        flexShrink: 0,
        bgcolor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
        height: 'calc(100vh - 64px)',
        py: 2,
        overflowY: 'auto',
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
  );
};
