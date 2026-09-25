import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(resolve(__dirname, '../../../supabase/functions/sync-cve/index.ts'), 'utf8');

describe('sync-cve authorization', () => {
  it('uses the shared admin check from the ingest bundle', () => {
    expect(src).toMatch(/import\s*\{[^}]*authorizeAdminRequest[^}]*\}\s*from\s*"\.\.\/_shared\/ingest\.bundle\.js"/);
  });

  it('gates every action except health_check before any action runs', () => {
    const gateAt = src.indexOf('authorizeAdminRequest(');
    const healthAt = src.indexOf("action === 'health_check'");
    expect(gateAt).toBeGreaterThan(-1);
    expect(healthAt).toBeGreaterThan(-1);
    expect(healthAt).toBeLessThan(gateAt);
    for (const action of ['trigger_manual_sync', 'update_vendor_schedule', 'test_webhook', 'create_webhook', 'delete_webhook', 'persist_ingestion']) {
      const at = src.indexOf(`'${action}'`);
      expect(at, action).toBeGreaterThan(gateAt);
    }
  });

  it('no longer accepts a request just because an apikey header is present', () => {
    expect(src).not.toMatch(/hasApiKey/);
  });
});
