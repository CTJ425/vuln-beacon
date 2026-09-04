import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  __dirname,
  '../../../supabase/migrations/20260905000000_security_and_reliability_fixes.sql'
);

describe('security and reliability fixes migration', () => {
  it('exists', () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  const sql = () => readFileSync(migrationPath, 'utf8');

  it('revokes public/anon/authenticated execute on tick_scheduled_syncs', () => {
    const text = sql();
    expect(text).toMatch(/REVOKE EXECUTE ON FUNCTION public\.tick_scheduled_syncs\(\) FROM PUBLIC,\s*anon,\s*authenticated/i);
    expect(text).toMatch(/GRANT EXECUTE ON FUNCTION public\.tick_scheduled_syncs\(\) TO service_role/i);
  });

  it('adds an advisory lock to prevent concurrent tick executions', () => {
    const text = sql();
    expect(text).toContain('pg_try_advisory_xact_lock');
  });

  it('logs failure diagnostics when vault secrets are missing', () => {
    const text = sql();
    expect(text).toContain('vendor_sync_logs');
    expect(text).toContain('Missing vault secrets');
  });

  it('restricts public write access on webhook_configs', () => {
    const text = sql();
    expect(text).toMatch(/DROP POLICY IF EXISTS "Allow public all access on webhook_configs"/i);
    expect(text).toMatch(/CREATE POLICY "Allow anon read webhook_configs"/i);
    expect(text).toMatch(/CREATE POLICY "Allow authenticated manage webhook_configs"/i);
  });
});
