import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { en, MessageKey, Messages } from './messages/en';
import { zhTW } from './messages/zh-TW';
import { translate, MessageParams } from './translate';

export const LOCALES = ['en', 'zh-TW'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_STORAGE_KEY = 'vulnbeacon-locale';

const CATALOGS: Record<Locale, Messages> = { en, 'zh-TW': zhTW };

const isLocale = (value: unknown): value is Locale => LOCALES.includes(value as Locale);

export const detectLocale = (): Locale => {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // Storage can be blocked; fall through to the browser language.
  }
  const languages = typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : [];
  return languages.some((lang) => lang?.toLowerCase().startsWith('zh')) ? 'zh-TW' : 'en';
};

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, params?: MessageParams) => string;
}

// Outside a provider (a component rendered on its own) the UI reads in English
// and the language cannot change; the app always mounts the provider.
const FALLBACK: I18nContextValue = {
  locale: 'en',
  setLocale: () => {},
  t: (key, params) => translate(en, key, params),
};

const I18nContext = createContext<I18nContextValue>(FALLBACK);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // The choice still applies for this visit.
    }
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t: (key, params) => translate(CATALOGS[locale], key, params) }),
    [locale, setLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextValue => useContext(I18nContext);
