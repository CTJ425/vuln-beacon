import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusChip } from '@/components/common/StatusChip';

describe('StatusChip Component', () => {
  it('should render Affected for AFFECTED status', () => {
    render(<StatusChip status="AFFECTED" />);
    expect(screen.getByText('Affected')).toBeInTheDocument();
  });

  it('should render Fix deferred for FIX_DEFERRED status', () => {
    render(<StatusChip status="FIX_DEFERRED" />);
    expect(screen.getByText('Fix deferred')).toBeInTheDocument();
  });

  it('should render Fixed for FIXED status', () => {
    render(<StatusChip status="FIXED" />);
    expect(screen.getByText('Fixed')).toBeInTheDocument();
  });
});
