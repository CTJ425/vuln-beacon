import React from 'react';

export interface VendorLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  color?: string;
  className?: string;
}

/**
 * Red Hat official fedora silhouette logo
 */
export const RedHatLogo: React.FC<VendorLogoProps> = ({
  size = 20,
  color = '#EE0000',
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Red Hat logo"
    {...props}
  >
    <path
      d="M16.009 13.386c1.577 0 3.86-.326 3.86-2.202a1.765 1.765 0 0 0-.04-.431l-.94-4.08c-.216-.898-.406-1.305-1.982-2.093-1.223-.625-3.888-1.658-4.676-1.658-.733 0-.947.946-1.822.946-.842 0-1.467-.706-2.255-.706-.757 0-1.25.515-1.63 1.576 0 0-1.06 2.99-1.197 3.424a.81.81 0 0 0-.028.245c0 1.162 4.577 4.974 10.71 4.974m4.101-1.435c.218 1.032.218 1.14.218 1.277 0 1.765-1.984 2.745-4.593 2.745-5.895.004-11.06-3.451-11.06-5.734a2.326 2.326 0 0 1 .19-.925C2.746 9.415 0 9.794 0 12.217c0 3.969 9.405 8.861 16.851 8.861 5.71 0 7.149-2.582 7.149-4.62 0-1.605-1.387-3.425-3.887-4.512"
      fill={color}
    />
  </svg>
);

/**
 * NetApp official arch / gateway logo
 */
export const NetAppLogo: React.FC<VendorLogoProps> = ({
  size = 20,
  color = '#0067C5',
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="NetApp logo"
    {...props}
  >
    <path
      d="M0 2v20h9.33V10h5.34v12H24V2Z"
      fill={color}
    />
  </svg>
);

/**
 * VMware official virtualization blocks logo
 */
export const VmwareLogo: React.FC<VendorLogoProps> = ({
  size = 20,
  color = '#0095D9',
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="VMware logo"
    {...props}
  >
    <rect x="2" y="3.5" width="9" height="7.5" rx="1.2" fill={color} />
    <rect x="13" y="3.5" width="9" height="7.5" rx="1.2" fill={color} opacity="0.8" />
    <rect x="2" y="13" width="9" height="7.5" rx="1.2" fill={color} opacity="0.8" />
    <rect x="13" y="13" width="9" height="7.5" rx="1.2" fill={color} />
  </svg>
);

/**
 * Nutanix official geometric cloud arc logo
 */
export const NutanixLogo: React.FC<VendorLogoProps> = ({
  size = 20,
  color = '#024DA1',
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Nutanix logo"
    {...props}
  >
    <path
      d="M.394 3.617a.395.395 0 0 0-.393.395c0 .12.054.225.14.297l8.506 7.404a.39.39 0 0 1-.013.588l-8.52 7.412a.393.393 0 0 0 .28.67h4.86a.39.39 0 0 0 .265-.104l9.17-7.98a.396.396 0 0 0 0-.596L5.52 3.721a.386.386 0 0 0-.264-.104zm18.358 0a.389.389 0 0 0-.273.113l-4.716 4.106a.392.392 0 0 0-.04.564l2.427 2.114a.393.393 0 0 0 .291.13.394.394 0 0 0 .278-.119l7.127-6.203a.389.389 0 0 0 .154-.31.395.395 0 0 0-.393-.395zm-2.31 9.742c-.116 0-.22.05-.292.13l-2.426 2.113a.392.392 0 0 0 .039.564l4.716 4.104c.07.07.166.113.273.113h4.855a.393.393 0 0 0 .239-.705l-7.127-6.203a.393.393 0 0 0-.278-.116z"
      fill={color}
    />
  </svg>
);

/**
 * Dell Technologies official circular emblem
 */
export const DellLogo: React.FC<VendorLogoProps> = ({
  size = 20,
  color = '#007DB8',
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Dell logo"
    {...props}
  >
    <path
      d="M17.963 14.6V9.324h1.222v4.204h2.14v1.07h-3.362zm-9.784-3.288l2.98-2.292c.281.228.56.458.841.687l-2.827 2.14.611.535 2.827-2.216c.281.228.56.458.841.688a295.83 295.83 0 0 1-2.827 2.216l.61.536 2.83-2.295-.001-1.986h1.223v4.204h2.216v1.07h-3.362v-1.987c-.995.763-1.987 1.529-2.981 2.292l-2.981-2.292c-.144.729-.653 1.36-1.312 1.694-.285.147-.597.24-.915.276-.183.022-.367.017-.551.017H3.516V9.325H5.69a2.544 2.544 0 0 1 1.563.557c.454.36.778.872.927 1.43m-3.516-.917v3.21l.953-.001a1.377 1.377 0 0 0 1.036-.523 1.74 1.74 0 0 0 .182-1.889 1.494 1.494 0 0 0-.976-.766c-.166-.04-.338-.03-.507-.032h-.688zM11.82 0h.337a11.94 11.94 0 0 1 5.405 1.373 12.101 12.101 0 0 1 4.126 3.557A11.93 11.93 0 0 1 24 11.82v.36a11.963 11.963 0 0 1-3.236 8.033A11.967 11.967 0 0 1 12.182 24h-.361a11.993 11.993 0 0 1-4.145-.806 12.04 12.04 0 0 1-4.274-2.836A12.057 12.057 0 0 1 .576 15.67 12.006 12.006 0 0 1 0 12.181v-.361a11.924 11.924 0 0 1 1.992-6.396 12.211 12.211 0 0 1 4.71-4.172A11.875 11.875 0 0 1 11.82 0m-.153 1.23a10.724 10.724 0 0 0-6.43 2.375 10.78 10.78 0 0 0-3.319 4.573 10.858 10.858 0 0 0 .193 8.12 10.788 10.788 0 0 0 3.546 4.421 10.698 10.698 0 0 0 4.786 1.946c1.456.209 2.955.124 4.376-.26a10.756 10.756 0 0 0 5.075-3.062 10.742 10.742 0 0 0 2.686-5.28 10.915 10.915 0 0 0-.122-4.682 10.77 10.77 0 0 0-7.098-7.626 10.78 10.78 0 0 0-3.693-.525z"
      fill={color}
    />
  </svg>
);

/**
 * Hewlett Packard Enterprise (HPE) official green rectangle logo
 */
export const HpeLogo: React.FC<VendorLogoProps> = ({
  size = 20,
  color = '#01A982',
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="HPE logo"
    {...props}
  >
    {/* The iconic HPE Element Green rectangular frame */}
    <rect
      x="2.5"
      y="5.5"
      width="19"
      height="13"
      rx="1"
      stroke={color}
      strokeWidth="2.8"
      fill="none"
    />
  </svg>
);

/**
 * Veeam official twin-chevron arrow logo
 */
export const VeeamLogo: React.FC<VendorLogoProps> = ({
  size = 20,
  color = '#00B336',
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Veeam logo"
    {...props}
  >
    {/* Twin chevrons forming the dynamic Veeam V-arrow */}
    <path
      d="M3 5.5L10 12L3 18.5V15L7 12L3 9V5.5Z"
      fill={color}
    />
    <path
      d="M10 5.5L17 12L10 18.5V15L14 12L10 9V5.5Z"
      fill={color}
    />
    <circle cx="19.5" cy="12" r="1.5" fill={color} />
  </svg>
);

/**
 * Cohesity official connected node diamond logo
 */
export const CohesityLogo: React.FC<VendorLogoProps> = ({
  size = 20,
  color = '#FF5722',
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Cohesity logo"
    {...props}
  >
    {/* 4 diamond cluster nodes */}
    <rect x="10" y="2.5" width="4" height="4" rx="0.8" transform="rotate(45 12 4.5)" fill={color} />
    <rect x="10" y="15.5" width="4" height="4" rx="0.8" transform="rotate(45 12 17.5)" fill={color} />
    <rect x="3.5" y="9" width="4" height="4" rx="0.8" transform="rotate(45 5.5 11)" fill={color} />
    <rect x="16.5" y="9" width="4" height="4" rx="0.8" transform="rotate(45 18.5 11)" fill={color} />
    <circle cx="12" cy="12" r="2.2" fill={color} opacity="0.75" />
    <path d="M12 7V10M12 14V17M7 12H10M14 12H17" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

/**
 * Ubuntu official Circle of Friends logo
 */
export const UbuntuLogo: React.FC<VendorLogoProps> = ({
  size = 20,
  color = '#E95420',
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Ubuntu logo"
    {...props}
  >
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2.2" fill="none" />
    <circle cx="12" cy="4.5" r="1.8" fill={color} />
    <circle cx="5.5" cy="15.8" r="1.8" fill={color} />
    <circle cx="18.5" cy="15.8" r="1.8" fill={color} />
  </svg>
);

/**
 * Debian official swirl logo
 */
export const DebianLogo: React.FC<VendorLogoProps> = ({
  size = 20,
  color = '#D70A53',
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Debian logo"
    {...props}
  >
    <path
      d="M12.8 2.2c4.8.4 8.7 4.2 9.1 9 .4 5.3-3.6 9.9-8.9 10.3-5.2.4-9.8-3.4-10.4-8.6C2 8.4 4.8 4.4 9.1 3c.7-.2 1.3.3 1.3 1 0 .6-.4 1.1-1 1.3-3.3 1.1-5.5 4.3-5 7.9.6 4.1 4.2 7.2 8.4 6.8 4.2-.4 7.4-4 7.1-8.2-.3-3.8-3.3-6.9-7.1-7.2-.6 0-1.1-.5-1.1-1.1s.5-1.1 1.1-1.3z"
      fill={color}
    />
    <path
      d="M12 7.5c2.5 0 4.5 2 4.5 4.5 0 2.2-1.6 4-3.7 4.4-.6.1-1.1-.3-1.1-.9 0-.5.4-.9.9-1 1.4-.3 2.4-1.5 2.4-3 0-1.7-1.3-3-3-3-1.4 0-2.6 1-2.9 2.4-.1.5-.6.9-1.1.8-.5-.1-.9-.6-.8-1.1.4-2.3 2.4-4.1 4.8-4.1z"
      fill={color}
    />
  </svg>
);

/**
 * SUSE official chameleon / geometric logo
 */
export const SuseLogo: React.FC<VendorLogoProps> = ({
  size = 20,
  color = '#30BA78',
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="SUSE logo"
    {...props}
  >
    <path
      d="M4 14c0-4.4 3.6-8 8-8s8 3.6 8 8c0 1.5-.4 2.9-1.1 4.1-.4.7-1.3.9-2 .5-.7-.4-.9-1.3-.5-2 .5-.8.6-1.7.6-2.6 0-2.8-2.2-5-5-5s-5 2.2-5 5c0 2.8 2.2 5 5 5 .8 0 1.5-.2 2.2-.5.7-.3 1.5 0 1.8.7.3.7 0 1.5-.7 1.8-1 .5-2.1.8-3.3.8-5.5 0-10-3.6-10-8.8Z"
      fill={color}
    />
    <circle cx="8.5" cy="11.5" r="1.5" fill={color} />
  </svg>
);

/**
 * Generic Fallback Logo
 */
export const DefaultVendorLogo: React.FC<VendorLogoProps> = ({
  size = 20,
  color = '#38bdf8',
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Vendor logo"
    {...props}
  >
    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
    <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
    <line x1="6" y1="6" x2="6.01" y2="6" />
    <line x1="6" y1="18" x2="6.01" y2="18" />
  </svg>
);
