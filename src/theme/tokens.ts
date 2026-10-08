// Design tokens for both themes. Every color is an opaque hex so contrast can
// be checked (tests/unit/theme/theme.test.ts); tints are pre-composited.

export const SEVERITY_LEVELS = ['critical', 'high', 'medium', 'low', 'unknown'] as const;
export type SeverityTone = (typeof SEVERITY_LEVELS)[number];

export const VULN_STATE_TONES = [
  'affected',
  'wontfix',
  'deferred',
  'investigating',
  'fixed',
  'notAffected',
  'unknown',
] as const;
export type VulnStateTone = (typeof VULN_STATE_TONES)[number];

export interface ToneColors {
  fg: string;
  bg: string;
}

export interface ModeTokens {
  ground: string;
  paper: string;
  raised: string;
  divider: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  accent: string;
  accentStrong: string;
  onAccent: string;
  accentTint: string;
  hover: string;
  severity: Record<SeverityTone, ToneColors>;
  vulnState: Record<VulnStateTone, ToneColors>;
}

const dark: ModeTokens = {
  ground: '#0e1013',
  paper: '#15181d',
  raised: '#1b1f25',
  divider: '#262b33',
  borderStrong: '#363c46',
  text: '#e8eaed',
  textMuted: '#a2a9b3',
  accent: '#9ba5ff',
  accentStrong: '#b7beff',
  onAccent: '#0e1013',
  accentTint: '#232845',
  hover: '#1d2128',
  // Low is deliberately neutral: colour is reserved for what needs action.
  severity: {
    critical: { fg: '#ff8080', bg: '#3a1b1d' },
    high: { fg: '#ffa060', bg: '#3a2416' },
    medium: { fg: '#f2c94c', bg: '#352d14' },
    low: { fg: '#b4bac3', bg: '#23272e' },
    unknown: { fg: '#949ba5', bg: '#1f2329' },
  },
  vulnState: {
    affected: { fg: '#ff8080', bg: '#3a1b1d' },
    wontfix: { fg: '#e8a5a5', bg: '#2e2023' },
    deferred: { fg: '#ffa060', bg: '#3a2416' },
    investigating: { fg: '#9ba5ff', bg: '#232845' },
    fixed: { fg: '#5fd39a', bg: '#15302a' },
    notAffected: { fg: '#b4bac3', bg: '#23272e' },
    unknown: { fg: '#949ba5', bg: '#1f2329' },
  },
};

const light: ModeTokens = {
  ground: '#f5f6f8',
  paper: '#ffffff',
  raised: '#f0f2f5',
  divider: '#e1e4e9',
  borderStrong: '#c9ced6',
  text: '#15181d',
  textMuted: '#525a66',
  accent: '#4a52d4',
  accentStrong: '#3a41b8',
  onAccent: '#ffffff',
  accentTint: '#eceefd',
  hover: '#eef0f3',
  severity: {
    critical: { fg: '#b42318', bg: '#fdecea' },
    high: { fg: '#b04506', bg: '#fdf0e4' },
    medium: { fg: '#855d00', bg: '#fbf3d9' },
    low: { fg: '#525a66', bg: '#eef0f3' },
    unknown: { fg: '#5f6672', bg: '#f0f2f5' },
  },
  vulnState: {
    affected: { fg: '#b42318', bg: '#fdecea' },
    wontfix: { fg: '#9b2c2c', bg: '#f8eeee' },
    deferred: { fg: '#b04506', bg: '#fdf0e4' },
    investigating: { fg: '#4a52d4', bg: '#eceefd' },
    fixed: { fg: '#067647', bg: '#e6f4ec' },
    notAffected: { fg: '#525a66', bg: '#eef0f3' },
    unknown: { fg: '#5f6672', bg: '#f0f2f5' },
  },
};

export const MODE_TOKENS: Record<'dark' | 'light', ModeTokens> = { dark, light };

export const FONT_UI =
  '"Inter", "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", system-ui, -apple-system, "Segoe UI", sans-serif';
export const FONT_MONO = '"JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';

// Resolve tone colors from the app theme, or from the token table when a
// component renders under a theme without the custom palette (e.g. MUI's default).
interface ThemeLike {
  palette: {
    mode: 'dark' | 'light';
    severity?: Record<SeverityTone, ToneColors>;
    vulnState?: Record<VulnStateTone, ToneColors>;
  };
}

export const severityColors = (theme: ThemeLike, tone: SeverityTone): ToneColors =>
  theme.palette.severity?.[tone] ?? MODE_TOKENS[theme.palette.mode].severity[tone];

export const vulnStateColors = (theme: ThemeLike, tone: VulnStateTone): ToneColors =>
  theme.palette.vulnState?.[tone] ?? MODE_TOKENS[theme.palette.mode].vulnState[tone];
