import React from 'react';
import { Box, List, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { LayoutDashboard, Shield, Activity, Settings } from 'lucide-react';

export type NavTab = 'dashboard' | 'explorer' | 'sync' | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const items: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Overview', icon: <LayoutDashboard size={20} /> },
    { id: 'explorer', label: 'CVE Explorer', icon: <Shield size={20} /> },
    { id: 'sync', label: 'Sync Monitor', icon: <Activity size={20} /> },
    { id: 'settings', label: 'Webhooks & Config', icon: <Settings size={20} /> },
  ];

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
      }}
    >
      <List sx={{ px: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {items.map((item) => {
          const isSelected = currentTab === item.id;
          return (
            <ListItemButton
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              selected={isSelected}
              sx={{
                borderRadius: 2,
                py: 1.25,
                px: 1.5,
                bgcolor: isSelected ? 'action.selected' : 'transparent',
                color: isSelected ? 'primary.main' : 'text.secondary',
                '&:hover': {
                  bgcolor: isSelected ? 'action.selected' : 'action.hover',
                  color: isSelected ? 'primary.main' : 'text.primary',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: 'inherit',
                  minWidth: 36,
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontSize: '0.875rem',
                  fontWeight: isSelected ? 700 : 500,
                }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
};
