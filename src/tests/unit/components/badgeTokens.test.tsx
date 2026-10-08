import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { createAppTheme } from '@/theme/theme';
import { SeverityBadge } from '@/components/common/SeverityBadge';
import { StatusChip } from '@/components/common/StatusChip';
import { StateBadge } from '@/components/common/StateBadge';

const theme = createAppTheme('dark');
const withTheme = (ui: React.ReactElement) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
const chipOf = (text: string | RegExp) => screen.getByText(text).closest('.MuiChip-root') as HTMLElement;

describe('badges take their colors from the theme tokens', () => {
  it.each([
    ['CRITICAL', 'critical'],
    ['HIGH', 'high'],
    ['MEDIUM', 'medium'],
    ['LOW', 'low'],
  ] as const)('should paint a %s severity badge with the %s tone', (severity, tone) => {
    withTheme(<SeverityBadge severity={severity} />);
    expect(chipOf(severity)).toHaveStyle({
      color: theme.palette.severity[tone].fg,
      backgroundColor: theme.palette.severity[tone].bg,
    });
  });

  it('should paint a FIXED status chip with the fixed tone', () => {
    withTheme(<StatusChip status="FIXED" />);
    expect(chipOf('Fixed')).toHaveStyle({ color: theme.palette.vulnState.fixed.fg });
  });

  it('should paint an affected product state with the affected tone', () => {
    withTheme(<StateBadge state="Affected" />);
    expect(chipOf(/Affected/)).toHaveStyle({ color: theme.palette.vulnState.affected.fg });
  });
});
