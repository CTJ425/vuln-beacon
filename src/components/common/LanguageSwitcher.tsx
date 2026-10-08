import React from 'react';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { Locale, useI18n } from '@/i18n/I18nContext';

// Each language is named in its own script so a reader who cannot read the
// current interface language can still find theirs.
const OPTIONS: { locale: Locale; short: string; name: string }[] = [
  { locale: 'en', short: 'EN', name: 'English' },
  { locale: 'zh-TW', short: '中', name: '繁體中文' },
];

export const LanguageSwitcher: React.FC = () => {
  const { locale, setLocale, t } = useI18n();

  return (
    <ToggleButtonGroup
      value={locale}
      exclusive
      size="small"
      aria-label={t('language.label')}
      onChange={(_event, next: Locale | null) => {
        if (next) setLocale(next);
      }}
      sx={{
        height: 30,
        '& .MuiToggleButton-root': {
          px: 1,
          py: 0,
          minWidth: 34,
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'text.secondary',
          borderColor: 'divider',
          '&.Mui-selected': { color: 'text.primary', bgcolor: 'action.selected' },
        },
      }}
    >
      {OPTIONS.map((option) => (
        <ToggleButton key={option.locale} value={option.locale} aria-label={option.name} lang={option.locale}>
          {option.short}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
};
