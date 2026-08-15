import React from 'react';
import { ToggleButtonGroup, ToggleButton, Tooltip } from '@mui/material';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useThemeMode, ThemeMode } from '@/theme/ThemeContext';

export const ThemeSwitcher: React.FC = () => {
  const { themeMode, setThemeMode } = useThemeMode();

  const handleChange = (
    _event: React.MouseEvent<HTMLElement>,
    newMode: ThemeMode | null
  ) => {
    if (newMode !== null) {
      setThemeMode(newMode);
    }
  };

  return (
    <ToggleButtonGroup
      value={themeMode}
      exclusive
      onChange={handleChange}
      size="small"
      aria-label="Theme mode switcher"
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        height: 32,
        '& .MuiToggleButtonGroup-grouped': {
          border: 0,
          px: 1,
          py: 0.5,
          color: 'text.secondary',
          '&.Mui-selected': {
            bgcolor: 'action.selected',
            color: 'primary.main',
          },
          '&:hover': {
            bgcolor: 'action.hover',
          },
        },
      }}
    >
      <Tooltip title="System (系統預設)">
        <ToggleButton value="system" aria-label="System theme">
          <Monitor size={15} />
        </ToggleButton>
      </Tooltip>
      <Tooltip title="Light (淺色模式)">
        <ToggleButton value="light" aria-label="Light theme">
          <Sun size={15} />
        </ToggleButton>
      </Tooltip>
      <Tooltip title="Dark (深色模式)">
        <ToggleButton value="dark" aria-label="Dark theme">
          <Moon size={15} />
        </ToggleButton>
      </Tooltip>
    </ToggleButtonGroup>
  );
};
