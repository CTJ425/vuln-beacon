import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  __dirname,
  '../../../supabase/migrations/20260907000000_add_sync_log_details.sql'
);

describe('sync log details migration', () => {
  it('exists in supabase migrations folder', () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  const sql = () => readFileSync(migrationPath, 'utf8');

  it('adds details JSONB column to vendor_sync_logs', () => {
    const text = sql();
    expect(text).toMatch(/ALTER TABLE public\.vendor_sync_logs/i);
    expect(text).toMatch(/ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb/i);
  });

  it('creates indexing for status, vendor_code and details GIN', () => {
    const text = sql();
    expect(text).toMatch(/idx_sync_logs_status_vendor/i);
    expect(text).toMatch(/idx_sync_logs_details_gin/i);
  });
});
