import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = resolve(__dirname, '../../../supabase/migrations');
const file = readdirSync(dir).find((f) => f.endsWith('_merge_cve_upsert.sql'));
const sql = file ? readFileSync(resolve(dir, file), 'utf8') : '';

describe('merge CVE upsert migration', () => {
  it('exists and defines upsert_cves(jsonb)', () => {
    expect(file).toBeDefined();
    expect(sql).toMatch(/FUNCTION public\.upsert_cves\(p_rows JSONB\)/i);
  });

  it('never replaces a stored value with NULL', () => {
    expect(sql).toMatch(/description = COALESCE\(i\.description, c\.description, i\.description_fallback\)/);
    expect(sql).toMatch(/cvss_v3_score = GREATEST\(c\.cvss_v3_score, i\.cvss_v3_score\)/);
    expect(sql).toMatch(/published_date = LEAST\(c\.published_date, i\.published_date\)/);
  });

  it('is callable by service_role only', () => {
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.upsert_cves\(JSONB\) FROM PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.upsert_cves\(JSONB\) TO service_role/);
  });
});
