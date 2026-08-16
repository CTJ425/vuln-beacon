import React, { useState } from 'react';
import { Box, List, ListItemButton, ListItemIcon, ListItemText, Collapse } from '@mui/material';
import { LayoutDashboard, Shield, Activity, Settings, ChevronDown, ChevronRight } from 'lucide-react';
import { VendorIcon } from '@/components/common/VendorIcon';
import { VendorNode } from '@/services/productTaxonomy';

export type NavState =
  | { section: 'dashboard' | 'explorer' | 'sync' | 'settings' }
  | { section: 'vendor'; vendorId: string }
  | { section: 'product'; vendorId: string; productId: string };

interface SidebarProps {
  currentNav: NavState;
  onSelectNav: (nav: NavState) => void;
  taxonomy: VendorNode[];
}

export const Sidebar: React.FC<SidebarProps> = ({ currentNav, onSelectNav, taxonomy }) => {
  const isVendorActive = (vendorId: string) =>
    (currentNav.section === 'vendor' || currentNav.section === 'product') && currentNav.vendorId === vendorId;

  const [openVendors, setOpenVendors] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    taxonomy.forEach((vendor) => {
      initial[vendor.vendorId] = isVendorActive(vendor.vendorId);
    });
    return initial;
  });

  const toggleVendor = (vendorId: string) => {
    setOpenVendors((prev) => ({ ...prev, [vendorId]: !prev[vendorId] }));
  };

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
          const vendorActive = isVendorActive(vendor.vendorId);
          const isOpen = openVendors[vendor.vendorId] ?? vendorActive;

          return (
            <Box key={vendor.vendorId}>
              <ListItemButton
                onClick={() => onSelectNav({ section: 'vendor', vendorId: vendor.vendorId })}
                selected={currentNav.section === 'vendor' && currentNav.vendorId === vendor.vendorId}
                sx={rowSx(currentNav.section === 'vendor' && currentNav.vendorId === vendor.vendorId)}
              >
                <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
                  <VendorIcon vendorCode={vendor.vendorId} size={16} />
                </Box>
                <Box
                  component="span"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleVendor(vendor.vendorId);
                  }}
                  sx={{ display: 'flex', alignItems: 'center' }}
                >
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </Box>
              </ListItemButton>

              <Collapse in={isOpen} timeout="auto" unmountOnExit>
                <List component="div" disablePadding sx={{ pl: 3 }}>
                  {vendor.products.map((product) => {
                    const isSelected =
                      currentNav.section === 'product' &&
                      currentNav.vendorId === vendor.vendorId &&
                      currentNav.productId === product.id;
                    return (
                      <ListItemButton
                        key={product.id}
                        onClick={() => onSelectNav({ section: 'product', vendorId: vendor.vendorId, productId: product.id })}
                        selected={isSelected}
                        sx={rowSx(isSelected)}
                      >
                        <ListItemText
                          primary={product.name}
                          secondary={product.advisoryCount}
                          primaryTypographyProps={{ fontSize: '0.8125rem', fontWeight: isSelected ? 700 : 500 }}
                        />
                      </ListItemButton>
                    );
                  })}
                </List>
              </Collapse>
            </Box>
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
