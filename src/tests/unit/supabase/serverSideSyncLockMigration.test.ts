import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  __dirname,
  '../../../supabase/migrations/20260909000000_server_side_sync_lock.sql'
);

describe('Migration: 20260909000000_server_side_sync_lock.sql (TDD)', () => {
  const sql = readFileSync(migrationPath, 'utf-8');

  it('defines try_acquire_sync_lock with default lock id 7425001', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.try_acquire_sync_lock(lock_id BIGINT DEFAULT 7425001)');
    expect(sql).toContain('pg_try_advisory_lock(lock_id)');
  });

  it('defines release_sync_lock with default lock id 7425001', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.release_sync_lock(lock_id BIGINT DEFAULT 7425001)');
    expect(sql).toContain('pg_advisory_unlock(lock_id)');
  });

  it('revokes execution from anon and public', () => {
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.try_acquire_sync_lock(BIGINT) FROM PUBLIC, anon;');
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.release_sync_lock(BIGINT) FROM PUBLIC, anon;');
  });

  it('grants execution to authenticated and service_role', () => {
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.try_acquire_sync_lock(BIGINT) TO authenticated, service_role;');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.release_sync_lock(BIGINT) TO authenticated, service_role;');
  });
});
