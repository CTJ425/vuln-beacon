import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider, useI18n, detectLocale, LOCALE_STORAGE_KEY } from '@/i18n/I18nContext';

const Probe = () => {
  const { t, locale, setLocale } = useI18n();
  return (
    <div>
      <span data-testid="label">{t('nav.overview')}</span>
      <span data-testid="locale">{locale}</span>
      <button onClick={() => setLocale(locale === 'en' ? 'zh-TW' : 'en')}>switch</button>
    </div>
  );
};

const setLanguages = (languages: string[]) =>
  vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(languages);

describe('detectLocale', () => {
  beforeEach(() => {
    window.localStorage.removeItem(LOCALE_STORAGE_KEY);
    vi.restoreAllMocks();
  });

  it('should prefer a stored choice', () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'zh-TW');
    setLanguages(['en-US']);
    expect(detectLocale()).toBe('zh-TW');
  });

  it('should pick zh-TW for any Chinese browser language and en otherwise', () => {
    setLanguages(['zh-Hant-TW', 'en']);
    expect(detectLocale()).toBe('zh-TW');
    setLanguages(['zh-CN']);
    expect(detectLocale()).toBe('zh-TW');
    setLanguages(['de-DE', 'en']);
    expect(detectLocale()).toBe('en');
  });

  it('should ignore an unknown stored value', () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'fr');
    setLanguages(['en-US']);
    expect(detectLocale()).toBe('en');
  });
});

describe('I18nProvider', () => {
  beforeEach(() => {
    window.localStorage.removeItem(LOCALE_STORAGE_KEY);
    vi.restoreAllMocks();
    setLanguages(['en-US']);
  });

  it('should translate, switch language, remember the choice and set the document language', () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    );
    expect(screen.getByTestId('label')).toHaveTextContent('Overview');
    expect(document.documentElement.lang).toBe('en');

    fireEvent.click(screen.getByText('switch'));

    expect(screen.getByTestId('label')).toHaveTextContent('總覽');
    expect(document.documentElement.lang).toBe('zh-TW');
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('zh-TW');
  });

  it('should fall back to English when a component renders outside the provider', () => {
    render(<Probe />);
    expect(screen.getByTestId('label')).toHaveTextContent('Overview');
    expect(screen.getByTestId('locale')).toHaveTextContent('en');
  });
});
