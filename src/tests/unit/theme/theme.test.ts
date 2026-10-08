import { describe, it, expect } from 'vitest';
import { createAppTheme } from '@/theme/theme';
import { SEVERITY_LEVELS, VULN_STATE_TONES } from '@/theme/tokens';

// WCAG 2.x relative luminance and contrast ratio for #rrggbb colors.
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const HEX = /^#[0-9a-f]{6}$/i;

describe.each(['dark', 'light'] as const)('createAppTheme(%s)', (mode) => {
  const { palette, typography } = createAppTheme(mode);
  const grounds = [palette.background.default, palette.background.paper, palette.surface.raised];

  it('should define every surface and text color as an opaque hex value', () => {
    for (const color of [...grounds, palette.text.primary, palette.text.secondary, palette.primary.main]) {
      expect(color).toMatch(HEX);
    }
  });

  it('should keep body and secondary text at 4.5:1 or more on every surface', () => {
    for (const ground of grounds) {
      expect(contrast(palette.text.primary, ground)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(palette.text.secondary, ground)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('should keep the accent readable as link text on the page and paper', () => {
    expect(contrast(palette.primary.main, palette.background.default)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette.primary.main, palette.background.paper)).toBeGreaterThanOrEqual(4.5);
  });

  it('should give each severity a distinct readable foreground on its own tint and on paper', () => {
    const foregrounds = SEVERITY_LEVELS.map((level) => palette.severity[level].fg);
    expect(new Set(foregrounds.slice(0, 4)).size).toBe(4);
    for (const level of SEVERITY_LEVELS) {
      const { fg, bg } = palette.severity[level];
      expect(fg).toMatch(HEX);
      expect(bg).toMatch(HEX);
      expect(contrast(fg, bg), level).toBeGreaterThanOrEqual(4.5);
      expect(contrast(fg, palette.background.paper), level).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('should give each vulnerability state tone a readable foreground on its own tint', () => {
    for (const tone of VULN_STATE_TONES) {
      const { fg, bg } = palette.vulnState[tone];
      expect(contrast(fg, bg), tone).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('should fall back to Traditional Chinese system faces after the UI face', () => {
    expect(typography.fontFamily).toMatch(/^"Inter"/);
    expect(typography.fontFamily).toMatch(/PingFang TC/);
    expect(typography.fontFamily).toMatch(/Noto Sans TC/);
  });
});
