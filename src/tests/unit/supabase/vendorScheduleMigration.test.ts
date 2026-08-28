import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  __dirname,
  '../../../supabase/migrations/20260828000000_vendor_schedule.sql'
);

describe('vendor schedule migration', () => {
  it('exists', () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  const sql = () => readFileSync(migrationPath, 'utf8');

  it('adds the four schedule columns to vendors', () => {
    const text = sql();
    expect(text).toMatch(/ALTER TABLE\s+public\.vendors/i);
    for (const column of [
      'schedule_enabled',
      'schedule_times',
      'schedule_timezone',
      'last_scheduled_run_at',
    ]) {
      expect(text).toContain(column);
    }
  });

  it('constrains the stored times to HH:MM', () => {
    expect(sql()).toContain('vendors_schedule_times_format');
  });

  it('enables pg_cron and pg_net', () => {
    const text = sql();
    expect(text).toMatch(/CREATE EXTENSION IF NOT EXISTS\s+pg_cron/i);
    expect(text).toMatch(/CREATE EXTENSION IF NOT EXISTS\s+pg_net/i);
  });

  it('registers a five minute cron tick', () => {
    const text = sql();
    expect(text).toContain('vuln-beacon-scheduled-sync');
    expect(text).toContain('*/5 * * * *');
    expect(text).toMatch(/cron\.schedule/i);
  });

  it('unschedules any existing job before registering, so re-runs do not duplicate', () => {
    expect(sql()).toMatch(/cron\.unschedule/i);
  });

  it('reads the endpoint and key from the vault instead of embedding them', () => {
    const text = sql();
    expect(text).toMatch(/tick_scheduled_syncs/);
    expect(text).toMatch(/vault\.decrypted_secrets/);
    expect(text).toMatch(/net\.http_post/i);
  });

  it('does not re-grant browser write access to vendors', () => {
    const text = sql();
    const grantsWrite = /CREATE POLICY[^;]*ON\s+public\.vendors[^;]*FOR\s+(ALL|INSERT|UPDATE)/is;
    expect(grantsWrite.test(text)).toBe(false);
  });

  it('contains no service role key and no concrete project url', () => {
    const text = sql();
    expect(text).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
    expect(text).not.toMatch(/https:\/\/[a-z]{15,}\.supabase\.co/);
  });
});
