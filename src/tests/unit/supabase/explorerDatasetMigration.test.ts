import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = resolve(__dirname, '../../../supabase/migrations');
const file = readdirSync(dir).find((f) => f.endsWith('_explorer_dataset.sql'));
const sql = file ? readFileSync(resolve(dir, file), 'utf8') : '';
// Every migration that (re)defines the function must keep the same guarantees.
const definitions = readdirSync(dir)
  .filter((f) => /CREATE OR REPLACE FUNCTION public\.explorer_dataset\(/.test(readFileSync(resolve(dir, f), 'utf8')))
  .map((f) => [f, readFileSync(resolve(dir, f), 'utf8')] as const);

describe('explorer_dataset migration', () => {
  it.each(definitions)('%s keeps RLS, grants and excludes raw_payload', (_f, body) => {
    expect(body).toMatch(/SECURITY INVOKER/i);
    expect(body).not.toMatch(/SECURITY DEFINER/i);
    expect(body).not.toMatch(/raw_payload/);
    expect(body).toMatch(/GRANT EXECUTE ON FUNCTION public\.explorer_dataset\((boolean)?\) TO anon, authenticated/i);
  });

  it('is redefined without per-row correlated index lookups', () => {
    const latest = definitions[definitions.length - 1][1];
    expect(definitions.length).toBeGreaterThan(1);
    expect(latest).toMatch(/join impact_idx x on x\.advisory_id = e\.advisory_id and x\.item = e\.item/);
  });

  it('exists and defines explorer_dataset() returning jsonb', () => {
    expect(file).toBeDefined();
    expect(sql).toMatch(/FUNCTION public\.explorer_dataset\(\)\s*RETURNS jsonb/i);
  });

  it('runs as the caller so table RLS still applies', () => {
    expect(sql).toMatch(/SECURITY INVOKER/i);
    expect(sql).not.toMatch(/SECURITY DEFINER/i);
  });

  it('ships each distinct impact once per advisory and indexes into it per mapping', () => {
    expect(sql).toContain("'impacts'");
    expect(sql).toContain("'i'");
  });

  it('never ships raw advisory documents', () => {
    expect(sql).not.toMatch(/raw_payload/);
  });

  it('is callable by the public site', () => {
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.explorer_dataset\(\) TO anon, authenticated/i);
  });

  it('offers a compact format behind a parameter that defaults to the old one', () => {
    const latest = definitions[definitions.length - 1][1];
    expect(latest).toMatch(/explorer_dataset\(p_compact boolean DEFAULT false\)/i);
    expect(latest).toMatch(/when p_compact and mi\.in_order and mi\.n = ai\.n then null/i);
  });
});
