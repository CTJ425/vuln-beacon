import { createTheme } from '@mui/material/styles';
import { FONT_MONO, FONT_UI, MODE_TOKENS, SeverityTone, ToneColors, VulnStateTone } from './tokens';

declare module '@mui/material/styles' {
  interface Palette {
    severity: Record<SeverityTone, ToneColors>;
    vulnState: Record<VulnStateTone, ToneColors>;
    surface: { raised: string; borderStrong: string };
  }
  interface PaletteOptions {
    severity?: Record<SeverityTone, ToneColors>;
    vulnState?: Record<VulnStateTone, ToneColors>;
    surface?: { raised: string; borderStrong: string };
  }
  interface TypographyVariants {
    mono: React.CSSProperties;
  }
  interface TypographyVariantsOptions {
    mono?: React.CSSProperties;
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    mono: true;
  }
}

export const createAppTheme = (mode: 'dark' | 'light') => {
  const tk = MODE_TOKENS[mode];

  return createTheme({
    palette: {
      mode,
      primary: { main: tk.accent, light: tk.accentStrong, dark: tk.accent, contrastText: tk.onAccent },
      secondary: { main: tk.textMuted, contrastText: tk.paper },
      background: { default: tk.ground, paper: tk.paper },
      text: { primary: tk.text, secondary: tk.textMuted },
      error: { main: tk.severity.critical.fg },
      warning: { main: tk.severity.high.fg },
      info: { main: tk.vulnState.investigating.fg },
      success: { main: tk.vulnState.fixed.fg },
      divider: tk.divider,
      action: { hover: tk.hover, selected: tk.accentTint },
      severity: tk.severity,
      vulnState: tk.vulnState,
      surface: { raised: tk.raised, borderStrong: tk.borderStrong },
    },
    typography: {
      fontFamily: FONT_UI,
      fontSize: 14,
      h1: { fontSize: '1.75rem', fontWeight: 650, letterSpacing: '-0.02em', lineHeight: 1.25 },
      h2: { fontSize: '1.5rem', fontWeight: 650, letterSpacing: '-0.015em', lineHeight: 1.3 },
      h3: { fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.35 },
      h4: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.4 },
      h5: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.4 },
      h6: { fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.4 },
      body1: { fontSize: '0.875rem', lineHeight: 1.55 },
      body2: { fontSize: '0.8125rem', lineHeight: 1.5 },
      caption: { fontSize: '0.75rem', lineHeight: 1.4 },
      button: { textTransform: 'none', fontWeight: 600, fontSize: '0.8125rem' },
      mono: { fontFamily: FONT_MONO, fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' },
    },
    shape: { borderRadius: 6 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: { colorScheme: mode, '--vb-scrollbar': tk.borderStrong },
          body: { backgroundColor: tk.ground, caretColor: tk.accent },
          '::selection': { backgroundColor: tk.accentTint, color: tk.text },
          '*': { scrollbarColor: `${tk.borderStrong} transparent`, scrollbarWidth: 'thin' },
          ':focus-visible': { outline: `2px solid ${tk.accent}`, outlineOffset: 2 },
          'code, pre, kbd': { fontFamily: FONT_MONO },
          a: { color: tk.accent, textUnderlineOffset: '0.2em' },
        },
      },
      MuiButtonBase: { defaultProps: { disableRipple: true } },
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: 6, boxShadow: 'none', '&:hover': { boxShadow: 'none' } },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: { root: { backgroundImage: 'none', border: `1px solid ${tk.divider}` } },
      },
      MuiAppBar: {
        styleOverrides: { root: { border: 0 } },
      },
      MuiDrawer: {
        styleOverrides: { paper: { border: 0, borderLeft: `1px solid ${tk.divider}` } },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderBottom: `1px solid ${tk.divider}`, padding: '8px 12px', fontVariantNumeric: 'tabular-nums' },
          head: {
            fontWeight: 600,
            fontSize: '0.75rem',
            color: tk.textMuted,
            backgroundColor: tk.raised,
          },
        },
      },
      MuiTableRow: {
        styleOverrides: { hover: { '&:hover': { backgroundColor: `${tk.hover} !important` } } },
      },
      MuiChip: {
        styleOverrides: { root: { fontWeight: 600, borderRadius: 4 } },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: mode === 'dark' ? tk.raised : tk.text,
            color: mode === 'dark' ? tk.text : tk.paper,
            border: mode === 'dark' ? `1px solid ${tk.borderStrong}` : 'none',
            fontSize: '0.75rem',
          },
        },
      },
    },
  });
};

export const theme = createAppTheme('dark');
