import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SeverityBadge } from '@/components/common/SeverityBadge';

describe('SeverityBadge Component', () => {
  it('should render CRITICAL label with score', () => {
    render(<SeverityBadge severity="CRITICAL" score={9.8} />);
    expect(screen.getByText('CRITICAL 9.8')).toBeInTheDocument();
  });

  it('should render HIGH badge without score when score is undefined', () => {
    render(<SeverityBadge severity="HIGH" />);
    expect(screen.getByText('HIGH')).toBeInTheDocument();
  });

  it('should fallback to UNKNOWN for unrecognized severities', () => {
    render(<SeverityBadge severity="CUSTOM_INVALID" />);
    expect(screen.getByText('UNKNOWN')).toBeInTheDocument();
  });
});
