import React from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import { Search, RotateCcw, ShieldCheck, Bug } from 'lucide-react';

interface CveFilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedVendor: string;
  onVendorChange: (value: string) => void;
  selectedSeverity: string;
  onSeverityChange: (value: string) => void;
  selectedStatus: string;
  onStatusChange: (value: string) => void;
  viewMode?: 'cve' | 'advisory';
  onViewModeChange?: (mode: 'cve' | 'advisory') => void;
  onReset: () => void;
}

export const CveFilterBar: React.FC<CveFilterBarProps> = ({
  searchTerm,
  onSearchChange,
  selectedVendor,
  onVendorChange,
  selectedSeverity,
  onSeverityChange,
  selectedStatus,
  onStatusChange,
  viewMode = 'cve',
  onViewModeChange,
  onReset,
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        bgcolor: 'background.paper',
        p: 2.5,
        borderRadius: 2.5,
        border: 1,
        borderColor: 'divider',
      }}
    >
      {/* Top row: View Mode Switcher + Search */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
        {onViewModeChange && (
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, val) => val && onViewModeChange(val)}
            size="small"
            sx={{ bgcolor: 'background.default' }}
          >
            <ToggleButton value="advisory" sx={{ fontWeight: 800, fontSize: '0.8rem', px: 2, py: 0.8 }}>
              <ShieldCheck size={16} style={{ marginRight: 6 }} color="#ee0000" />
              RHSA 公告視角 (Advisories)
            </ToggleButton>
            <ToggleButton value="cve" sx={{ fontWeight: 800, fontSize: '0.8rem', px: 2, py: 0.8 }}>
              <Bug size={16} style={{ marginRight: 6 }} color="#38bdf8" />
              CVE 弱點視角 (CVEs)
            </ToggleButton>
          </ToggleButtonGroup>
        )}

        <TextField
          size="small"
          placeholder="搜尋 RHSA 編號、CVE 弱點編號、元件名稱 (Components)、產品或 Errata..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={18} color="#94a3b8" />
              </InputAdornment>
            ),
          }}
          sx={{
            flexGrow: 1,
            minWidth: 280,
            '& .MuiOutlinedInput-root': {
              bgcolor: 'background.default',
            },
          }}
        />
      </Box>

      {/* Bottom row: Filters & Reset */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Product Family</InputLabel>
          <Select
            value={selectedVendor}
            label="Product Family"
            onChange={(e) => onVendorChange(e.target.value)}
            sx={{ bgcolor: 'background.default' }}
          >
            <MenuItem value="ALL">All Red Hat Ecosystem</MenuItem>
            <MenuItem value="rhel">Red Hat Enterprise Linux</MenuItem>
            <MenuItem value="openshift">OpenShift / Cloud Platform</MenuItem>
            <MenuItem value="rhoai">OpenShift AI (RHOAI)</MenuItem>
            <MenuItem value="ansible">Ansible Automation</MenuItem>
            <MenuItem value="middleware">JBoss / Middleware</MenuItem>
            <MenuItem value="storage">Ceph / Data Foundation</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Severity</InputLabel>
          <Select
            value={selectedSeverity}
            label="Severity"
            onChange={(e) => onSeverityChange(e.target.value)}
            sx={{ bgcolor: 'background.default' }}
          >
            <MenuItem value="ALL">All Severities</MenuItem>
            <MenuItem value="CRITICAL">Critical (≥ 9.0)</MenuItem>
            <MenuItem value="HIGH">High (7.0 - 8.9)</MenuItem>
            <MenuItem value="MEDIUM">Medium (4.0 - 6.9)</MenuItem>
            <MenuItem value="LOW">Low (&lt; 4.0)</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 170 }}>
          <InputLabel>Component State</InputLabel>
          <Select
            value={selectedStatus}
            label="Component State"
            onChange={(e) => onStatusChange(e.target.value)}
            sx={{ bgcolor: 'background.default' }}
          >
            <MenuItem value="ALL">All Impact States</MenuItem>
            <MenuItem value="AFFECTED">🔴 Affected (受影響)</MenuItem>
            <MenuItem value="FIX_DEFERRED">🟠 Fix deferred (延後修復)</MenuItem>
            <MenuItem value="FIXED">🟢 Fixed (已修復)</MenuItem>
            <MenuItem value="NOT_AFFECTED">🟢 Not affected (不受影響)</MenuItem>
          </Select>
        </FormControl>

        <Button
          variant="text"
          size="small"
          startIcon={<RotateCcw size={16} />}
          onClick={onReset}
          sx={{ color: 'text.secondary', ml: 'auto', fontWeight: 600 }}
        >
          重設篩選
        </Button>
      </Box>
    </Box>
  );
};
