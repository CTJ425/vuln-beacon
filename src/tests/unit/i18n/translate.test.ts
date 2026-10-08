import { describe, it, expect } from 'vitest';
import { translate } from '@/i18n/translate';
import { en } from '@/i18n/messages/en';
import { zhTW } from '@/i18n/messages/zh-TW';

describe('translate', () => {
  it('should return the message for a key', () => {
    expect(translate(en, 'nav.overview')).toBe('Overview');
    expect(translate(zhTW, 'nav.overview')).toBe('總覽');
  });

  it('should fill named placeholders and leave unknown ones untouched', () => {
    expect(translate({ greet: 'Hi {name}, {missing}' } as any, 'greet' as any, { name: 'Ops' })).toBe(
      'Hi Ops, {missing}'
    );
  });

  it('should fall back to the key when a catalog lacks it', () => {
    expect(translate({} as any, 'nav.overview')).toBe('nav.overview');
  });
});

describe('message catalogs', () => {
  it('should give zh-TW exactly the keys of en, none of them empty', () => {
    expect(Object.keys(zhTW).sort()).toEqual(Object.keys(en).sort());
    for (const [key, value] of Object.entries(zhTW)) {
      expect(value.trim(), key).not.toBe('');
    }
  });

  it('should keep the same placeholders in both languages', () => {
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(zhTW[key]), key).toEqual(placeholders(en[key]));
    }
  });
});
