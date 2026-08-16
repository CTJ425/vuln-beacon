import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// Importing the backfill script must stay side-effect free — the Supabase
// client is constructed lazily inside main(), which only runs when the file is
// executed directly.
import { sanitiseAdvisoryKey } from '../../../scripts/backfillAdvisoryStorage.mjs';

/**
 * BUG-008 regression cover.
 *
 * Advisory documents are already stored in Supabase Storage under keys built by
 * the legacy expression `advisory_id.replace(/:/g, '_')`. The hardened
 * sanitiser may only ADD protection against path characters that cannot occur
 * in real advisory ids. If it changes the key for any realistic id, every
 * already-stored object becomes unreachable.
 */

const legacyKey = (advisoryId: string) => String(advisoryId).replace(/:/g, '_');

const REALISTIC_IDS = [
  'RHSA-2026:0001',
  'RHBA-2025:1234',
  'RHEA-2024:9999',
  'RHSA-2020:5566',
  'CVE-2024-38812',
  'RHSA-2026:0001.2',
  'kernel-5.14.0-427.el9_4',
  'a.b_c-d:1',
];

describe('BUG-008: advisory storage key stays backward compatible', () => {
  it.each(REALISTIC_IDS)('maps %s byte-identically to the legacy key', (id) => {
    expect(sanitiseAdvisoryKey(id)).toBe(legacyKey(id));
  });

  it('still replaces the colon that Red Hat advisory ids contain', () => {
    expect(sanitiseAdvisoryKey('RHSA-2026:0001')).toBe('RHSA-2026_0001');
  });

  it('neutralises path traversal so a key cannot escape its vendor prefix', () => {
    const key = sanitiseAdvisoryKey('../../etc/passwd');
    expect(key).not.toContain('..');
    expect(key).not.toContain('/');
  });

  it('neutralises both slash directions', () => {
    expect(sanitiseAdvisoryKey('a/b')).not.toContain('/');
    expect(sanitiseAdvisoryKey('a\\b')).not.toContain('\\');
  });

  it('is defined identically in the Deno edge function and the Node script', () => {
    const root = resolve(__dirname, '../../..');
    const extract = (file: string) => {
      const src = readFileSync(resolve(root, file), 'utf8');
      const body = src.slice(src.indexOf('function sanitiseAdvisoryKey'));
      return body
        .slice(0, body.indexOf('\n}') + 2)
        // Strip the TypeScript annotations so the two runtimes compare equal.
        .replace(/advisoryId:\s*unknown/, 'advisoryId')
        .replace(/\):\s*string\s*{/, ') {');
    };

    expect(extract('supabase/functions/sync-cve/index.ts')).toBe(
      extract('scripts/backfillAdvisoryStorage.mjs')
    );
  });
});
