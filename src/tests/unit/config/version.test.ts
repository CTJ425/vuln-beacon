import { describe, it, expect } from 'vitest';
import { APP_VERSION, APP_NAME, getDisplayVersion } from '@/config/version';
import packageJson from '@/package.json';

describe('Version Config Module (TDD)', () => {
  it('exports APP_VERSION equal to package.json version', () => {
    expect(APP_VERSION).toBe(packageJson.version);
  });

  it('exports APP_NAME equal to package.json name', () => {
    expect(APP_NAME).toBe(packageJson.name);
    expect(APP_NAME).toBe('vuln-beacon');
  });

  it('formats display version with default "v" prefix', () => {
    expect(getDisplayVersion()).toBe(`v${APP_VERSION}`);
  });

  it('formats display version with custom prefix or preserves existing prefix', () => {
    expect(getDisplayVersion('ver ')).toBe(`ver ${APP_VERSION}`);
  });
});
