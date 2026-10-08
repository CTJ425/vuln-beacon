import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider, LOCALE_STORAGE_KEY } from '@/i18n/I18nContext';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    window.localStorage.removeItem(LOCALE_STORAGE_KEY);
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['en-US']);
  });

  it('should show both languages in their own script and mark the active one', () => {
    render(
      <I18nProvider>
        <LanguageSwitcher />
      </I18nProvider>
    );
    expect(screen.getByRole('group', { name: 'Language' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '繁體中文' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('should switch the interface language when the other language is chosen', () => {
    render(
      <I18nProvider>
        <LanguageSwitcher />
      </I18nProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: '繁體中文' }));
    expect(screen.getByRole('group', { name: '語言' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '繁體中文' })).toHaveAttribute('aria-pressed', 'true');
  });
});
