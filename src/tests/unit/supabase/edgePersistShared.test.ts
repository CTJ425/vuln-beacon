import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const fnRoot = resolve(__dirname, '../../../supabase/functions');
const read = (p: string) => readFileSync(resolve(fnRoot, p), 'utf8');

describe.each([
  ['sync-cve', 'sync-cve/index.ts'],
  ['scheduled-sync', 'scheduled-sync/index.ts'],
])('%s persistence', (_name, file) => {
  const src = read(file);

  it('persists through the shared persistIngestion module', () => {
    expect(src).toMatch(/import\s*\{[^}]*persistIngestion[^}]*\}\s*from\s*"\.\.\/_shared\/ingest\.bundle\.js"/);
    expect(src).toContain('persistIngestion(supabaseClient');
  });

  it('no longer upserts cves directly, which overwrote other vendors with NULL', () => {
    expect(src).not.toMatch(/from\('cves'\)\s*\.upsert/);
  });

  it('dispatches alerts only after the run is persisted and logged', () => {
    const persistAt = src.indexOf('persistIngestion(supabaseClient');
    const logAt = src.indexOf(".from('vendor_sync_logs')", persistAt);
    const dispatchAt = src.indexOf('dispatchPendingAlerts()');
    expect(dispatchAt).toBeGreaterThan(logAt);
    expect(logAt).toBeGreaterThan(persistAt);
  });
});

describe('ingest bundle entry', () => {
  it('exports persistIngestion for the Edge Functions', () => {
    expect(read('_shared/ingest.entry.ts')).toMatch(/export \{ persistIngestion \} from '@\/engine\/persistIngestion'/);
  });
});
