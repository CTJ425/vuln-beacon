import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  __dirname,
  '../../../supabase/migrations/20260908000000_harden_vault_secrets_scheduler.sql'
);

const setupScriptPath = resolve(
  __dirname,
  '../../../supabase/setup_vault_secrets.sql'
);

describe('Harden Vault Secrets Scheduler Migration', () => {
  it('migration file exists', () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it('setup vault secrets script exists', () => {
    expect(existsSync(setupScriptPath)).toBe(true);
  });

  const sql = () => readFileSync(migrationPath, 'utf8');

  it('throttles duplicate missing vault secrets error logs within 1 hour', () => {
    const text = sql();
    expect(text).toContain("INTERVAL '1 hour'");
    expect(text).toContain('NOT EXISTS');
    expect(text).toContain('Missing vault secrets');
  });

  it('provides helper function to configure vault secrets safely for service_role', () => {
    const text = sql();
    expect(text).toContain('public.set_scheduled_sync_vault_secrets');
    expect(text).toContain('vault.create_secret');
    expect(text).toMatch(/REVOKE EXECUTE ON FUNCTION public\.set_scheduled_sync_vault_secrets\(TEXT,\s*TEXT\) FROM PUBLIC,\s*anon,\s*authenticated/i);
    expect(text).toMatch(/GRANT EXECUTE ON FUNCTION public\.set_scheduled_sync_vault_secrets\(TEXT,\s*TEXT\) TO service_role/i);
  });
});
