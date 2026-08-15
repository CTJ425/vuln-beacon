import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricCards } from '@/components/dashboard/MetricCards';

describe('MetricCards Component', () => {
  it('should render all 4 metric counters with exact values', () => {
    render(
      <MetricCards
        totalCves={42}
        criticalCount={8}
        highCount={15}
        totalImpactedComponents={37}
      />
    );

    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('37')).toBeInTheDocument();

    expect(screen.getByText('Critical CVEs')).toBeInTheDocument();
    expect(screen.getByText('High Severity')).toBeInTheDocument();
    expect(screen.getByText('Impacted Components')).toBeInTheDocument();
  });
});
