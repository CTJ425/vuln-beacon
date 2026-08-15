import React from 'react';
import { Box, Avatar } from '@mui/material';
import { Server, Shield, Layers, HardDrive, Cpu, Cloud, Database, Box as BoxIcon } from 'lucide-react';

interface VendorIconProps {
  vendorCode: string;
  size?: number;
}

const VENDOR_COLORS: Record<string, string> = {
  redhat: '#ee0000',
  vmware: '#0095d9',
  nutanix: '#7b1fa2',
  dell: '#007db8',
  hpe: '#01a982',
  netapp: '#0067c5',
  veeam: '#00b336',
  cohesity: '#ff5722',
};

const VENDOR_NAMES: Record<string, string> = {
  redhat: 'Red Hat',
  vmware: 'VMware',
  nutanix: 'Nutanix',
  dell: 'Dell',
  hpe: 'HPE',
  netapp: 'NetApp',
  veeam: 'Veeam',
  cohesity: 'Cohesity',
};

export const VendorIcon: React.FC<VendorIconProps> = ({ vendorCode, size = 20 }) => {
  const code = (vendorCode || '').toLowerCase();
  const color = VENDOR_COLORS[code] || '#38bdf8';
  const name = VENDOR_NAMES[code] || vendorCode;

  const renderIcon = () => {
    switch (code) {
      case 'redhat': return <Shield size={size} color={color} />;
      case 'vmware': return <Layers size={size} color={color} />;
      case 'nutanix': return <Cloud size={size} color={color} />;
      case 'dell': return <Server size={size} color={color} />;
      case 'hpe': return <Cpu size={size} color={color} />;
      case 'netapp': return <Database size={size} color={color} />;
      case 'veeam': return <HardDrive size={size} color={color} />;
      case 'cohesity': return <BoxIcon size={size} color={color} />;
      default: return <Server size={size} color={color} />;
    }
  };

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
      <Avatar
        sx={{
          width: size + 10,
          height: size + 10,
          bgcolor: `${color}18`,
          border: `1px solid ${color}33`,
        }}
      >
        {renderIcon()}
      </Avatar>
      <Box component="span" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
        {name}
      </Box>
    </Box>
  );
};
