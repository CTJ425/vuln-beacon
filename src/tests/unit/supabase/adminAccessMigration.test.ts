import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = resolve(__dirname, '../../../supabase/migrations');
const file = readdirSync(dir).find((f) => f.endsWith('_admin_role_access.sql'));
const sql = file ? readFileSync(resolve(dir, file), 'utf8') : '';

describe('admin role access migration', () => {
  it('exists', () => {
    expect(file).toBeDefined();
  });

  it('defines is_admin() from the JWT app_metadata role', () => {
    expect(sql).toMatch(/FUNCTION public\.is_admin\(\)/i);
    expect(sql).toMatch(/auth\.jwt\(\)\s*->\s*'app_metadata'\s*->>\s*'role'/i);
  });

  it('removes anonymous and any-authenticated access to webhook_configs', () => {
    expect(sql).toMatch(/DROP POLICY IF EXISTS "Allow anon read webhook_configs"/i);
    expect(sql).toMatch(/DROP POLICY IF EXISTS "Allow authenticated manage webhook_configs"/i);
  });

  it('grants webhook_configs access to admins only', () => {
    expect(sql).toMatch(/ON public\.webhook_configs FOR ALL\s+TO authenticated\s+USING \(public\.is_admin\(\)\)\s+WITH CHECK \(public\.is_admin\(\)\)/i);
    expect(sql).not.toMatch(/TO anon/i);
  });
});
