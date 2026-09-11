import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VendorIcon, VendorIconProps } from '@/components/common/VendorIcon';

describe('VendorIcon Component (TDD)', () => {
  it('renders vendor name label by default', () => {
    const props: VendorIconProps = { vendorCode: 'redhat', name: 'Red Hat' };
    render(<VendorIcon {...props} />);
    expect(screen.getByText('Red Hat')).toBeInTheDocument();
  });

  it('hides vendor name label and sets accessible aria-label on Avatar when hideLabel={true}', () => {
    const props: VendorIconProps = { vendorCode: 'redhat', name: 'Red Hat', hideLabel: true };
    render(<VendorIcon {...props} />);
    expect(screen.queryByText('Red Hat')).not.toBeInTheDocument();
    const avatar = screen.getByLabelText('Red Hat');
    expect(avatar).toBeInTheDocument();
  });

  it('renders authentic Red Hat SVG logo for redhat vendor code', () => {
    render(<VendorIcon vendorCode="redhat" />);
    const logo = screen.getByLabelText('Red Hat logo');
    expect(logo).toBeInTheDocument();
    expect(logo.tagName.toLowerCase()).toBe('svg');
  });

  it('renders authentic NetApp SVG logo for netapp vendor code', () => {
    render(<VendorIcon vendorCode="netapp" />);
    const logo = screen.getByLabelText('NetApp logo');
    expect(logo).toBeInTheDocument();
    expect(logo.tagName.toLowerCase()).toBe('svg');
  });

  it('renders authentic SVG logos for all target enterprise vendors', () => {
    const vendors = [
      { code: 'vmware', label: 'VMware logo' },
      { code: 'nutanix', label: 'Nutanix logo' },
      { code: 'dell', label: 'Dell logo' },
      { code: 'hpe', label: 'HPE logo' },
      { code: 'veeam', label: 'Veeam logo' },
      { code: 'cohesity', label: 'Cohesity logo' },
      { code: 'ubuntu', label: 'Ubuntu logo' },
      { code: 'debian', label: 'Debian logo' },
      { code: 'suse', label: 'SUSE logo' },
    ];

    for (const v of vendors) {
      const { unmount } = render(<VendorIcon vendorCode={v.code} />);
      const logo = screen.getByLabelText(v.label);
      expect(logo).toBeInTheDocument();
      expect(logo.tagName.toLowerCase()).toBe('svg');
      unmount();
    }
  });

  it('renders fallback SVG logo for unknown vendor code', () => {
    render(<VendorIcon vendorCode="unknown_vendor" name="Unknown Vendor" />);
    const logo = screen.getByLabelText('Vendor logo');
    expect(logo).toBeInTheDocument();
    expect(logo.tagName.toLowerCase()).toBe('svg');
  });
});
