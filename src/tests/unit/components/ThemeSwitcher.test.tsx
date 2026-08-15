import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import React from 'react';
import { ThemeProvider, useThemeMode } from '@/theme/ThemeContext';
import { ThemeSwitcher } from '@/components/common/ThemeSwitcher';

describe('ThemeContext & Theme Switcher (TDD)', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
  });

  it('should provide default system theme and allow switching to light and dark', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    );

    const { result } = renderHook(() => useThemeMode(), { wrapper });

    expect(result.current.themeMode).toBe('system');
    // System defaults to dark if matchMedia returns true or fallback
    expect(['dark', 'light']).toContain(result.current.resolvedMode);

    act(() => {
      result.current.setThemeMode('light');
    });

    expect(result.current.themeMode).toBe('light');
    expect(result.current.resolvedMode).toBe('light');
    expect(window.localStorage.getItem('vulnbeacon-theme-mode')).toBe('light');

    act(() => {
      result.current.setThemeMode('dark');
    });

    expect(result.current.themeMode).toBe('dark');
    expect(result.current.resolvedMode).toBe('dark');
    expect(window.localStorage.getItem('vulnbeacon-theme-mode')).toBe('dark');
  });

  it('should render ThemeSwitcher and switch mode when buttons are clicked', () => {
    render(
      <ThemeProvider>
        <ThemeSwitcher />
      </ThemeProvider>
    );

    const systemBtn = screen.getByLabelText('System theme');
    const lightBtn = screen.getByLabelText('Light theme');
    const darkBtn = screen.getByLabelText('Dark theme');

    expect(systemBtn).toBeInTheDocument();
    expect(lightBtn).toBeInTheDocument();
    expect(darkBtn).toBeInTheDocument();

    // Click light button
    fireEvent.click(lightBtn);
    expect(window.localStorage.getItem('vulnbeacon-theme-mode')).toBe('light');

    // Click dark button
    fireEvent.click(darkBtn);
    expect(window.localStorage.getItem('vulnbeacon-theme-mode')).toBe('dark');

    // Click system button
    fireEvent.click(systemBtn);
    expect(window.localStorage.getItem('vulnbeacon-theme-mode')).toBe('system');
  });
});
