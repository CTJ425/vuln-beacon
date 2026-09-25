import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = resolve(__dirname, '../../../supabase/migrations');
const load = (suffix: string) => {
  const file = readdirSync(dir).find((f) => f.endsWith(suffix));
  return { file, sql: file ? readFileSync(resolve(dir, file), 'utf8') : '' };
};
const fnRoot = resolve(__dirname, '../../../supabase/functions');
const fn = (p: string) => readFileSync(resolve(fnRoot, p), 'utf8');

describe('sync lease migration', () => {
  const { file, sql } = load('_sync_lease_lock.sql');

  it('exists and stores leases in a table every connection can see', () => {
    expect(file).toBeDefined();
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.sync_leases/);
  });

  it('only takes over a lease that has expired', () => {
    expect(sql).toMatch(/ON CONFLICT \(name\) DO UPDATE[\s\S]*WHERE l\.expires_at < now\(\)/);
  });

  it('releases only the holder\'s own lease', () => {
    expect(sql).toMatch(/DELETE FROM public\.sync_leases WHERE name = p_name AND holder = p_holder/);
  });

  it('drops the session-level advisory lock functions', () => {
    expect(sql).toMatch(/DROP FUNCTION IF EXISTS public\.try_acquire_sync_lock\(BIGINT\)/);
    expect(sql).toMatch(/DROP FUNCTION IF EXISTS public\.release_sync_lock\(BIGINT\)/);
  });

  it('is callable by service_role only', () => {
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.acquire_sync_lease\(TEXT, TEXT, INT\) TO service_role/);
    expect(sql).not.toMatch(/TO authenticated/);
  });
});

describe.each(['sync-cve/index.ts', 'scheduled-sync/index.ts'])('%s sync lease', (file) => {
  const src = fn(file);

  it('acquires and releases the shared lease with a per-run holder id', () => {
    expect(src).toContain("rpc('acquire_sync_lease'");
    expect(src).toContain("rpc('release_sync_lease'");
    expect(src).toContain('crypto.randomUUID()');
    expect(src).not.toContain('try_acquire_sync_lock');
  });
});

describe('scheduled tick HTTP error migration', () => {
  const { file, sql } = load('_surface_scheduled_sync_http_errors.sql');

  it('exists and records each tick\'s pg_net request id', () => {
    expect(file).toBeDefined();
    expect(sql).toMatch(/INSERT INTO public\.scheduled_sync_ticks \(request_id\) VALUES \(v_request_id\)/);
  });

  it('logs a FAILED row when the previous request came back with an HTTP error', () => {
    expect(sql).toMatch(/FROM net\._http_response r WHERE r\.id = last_request_id/);
    expect(sql).toMatch(/IF last_status >= 400 THEN/);
    expect(sql).toContain("'Scheduled sync request rejected: scheduled-sync returned HTTP '");
  });

  it('keeps the missing-secret diagnostics and the service_role-only grant', () => {
    expect(sql).toContain('Missing vault secrets');
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.tick_scheduled_syncs\(\) FROM PUBLIC, anon, authenticated/);
  });
});

describe('sync-cve default vendor list', () => {
  it('falls back to the shared SYNCED_VENDOR_CODES instead of a hard-coded subset', () => {
    const src = fn('sync-cve/index.ts');
    expect(src).toMatch(/import\s*\{[^}]*SYNCED_VENDOR_CODES[^}]*\}\s*from\s*"\.\.\/_shared\/ingest\.bundle\.js"/);
    expect(src).not.toContain("['redhat', 'nutanix', 'ubuntu', 'debian', 'suse']");
  });
});
