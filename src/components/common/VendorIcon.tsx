import React from 'react';
import { Box, Avatar } from '@mui/material';
import {
  RedHatLogo,
  NetAppLogo,
  VmwareLogo,
  NutanixLogo,
  DellLogo,
  HpeLogo,
  VeeamLogo,
  CohesityLogo,
  UbuntuLogo,
  DebianLogo,
  SuseLogo,
  CiscoLogo,
  DefaultVendorLogo,
} from '@/components/icons/VendorLogos';

export interface VendorIconProps {
  vendorCode: string;
  name?: string;
  size?: number;
  hideLabel?: boolean;
}

export const VENDOR_COLORS: Record<string, string> = {
  redhat: '#ee0000',
  vmware: '#0095d9',
  nutanix: '#024da1',
  dell: '#007db8',
  hpe: '#01a982',
  netapp: '#0067c5',
  veeam: '#00b336',
  cohesity: '#ff5722',
  ubuntu: '#E95420',
  debian: '#D70A53',
  suse: '#30BA78',
  cisco: '#1BA0D7',
};

export const VENDOR_NAMES: Record<string, string> = {
  redhat: 'Red Hat',
  vmware: 'VMware',
  nutanix: 'Nutanix',
  dell: 'Dell',
  hpe: 'HPE',
  netapp: 'NetApp',
  veeam: 'Veeam',
  cohesity: 'Cohesity',
  ubuntu: 'Ubuntu',
  debian: 'Debian',
  suse: 'SUSE',
  cisco: 'Cisco',
};

export const VendorIcon: React.FC<VendorIconProps> = ({
  vendorCode,
  name: nameProp,
  size = 20,
  hideLabel = false,
}) => {
  const code = (vendorCode || '').toLowerCase();
  const color = VENDOR_COLORS[code] || '#38bdf8';
  const name = nameProp || VENDOR_NAMES[code] || vendorCode;

  const renderIcon = () => {
    switch (code) {
      case 'redhat': return <RedHatLogo size={size} color={color} />;
      case 'netapp': return <NetAppLogo size={size} color={color} />;
      case 'vmware': return <VmwareLogo size={size} color={color} />;
      case 'nutanix': return <NutanixLogo size={size} color={color} />;
      case 'dell': return <DellLogo size={size} color={color} />;
      case 'hpe': return <HpeLogo size={size} color={color} />;
      case 'veeam': return <VeeamLogo size={size} color={color} />;
      case 'cohesity': return <CohesityLogo size={size} color={color} />;
      case 'ubuntu': return <UbuntuLogo size={size} color={color} />;
      case 'debian': return <DebianLogo size={size} color={color} />;
      case 'suse': return <SuseLogo size={size} color={color} />;
      case 'cisco': return <CiscoLogo size={size} color={color} />;
      default: return <DefaultVendorLogo size={size} color={color} />;
    }
  };

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: hideLabel ? 0 : 1 }}>
      <Avatar
        aria-label={hideLabel ? name : undefined}
        sx={{
          width: size + 10,
          height: size + 10,
          bgcolor: `${color}14`,
          border: `1px solid ${color}33`,
          boxShadow: `0 2px 8px ${color}12`,
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          '&:hover': {
            boxShadow: `0 4px 12px ${color}28`,
          },
        }}
      >
        {renderIcon()}
      </Avatar>
      {!hideLabel && (
        <Box component="span" sx={{ fontWeight: 600, fontSize: '0.875rem', color: 'inherit' }}>
          {name}
        </Box>
      )}
    </Box>
  );
};
