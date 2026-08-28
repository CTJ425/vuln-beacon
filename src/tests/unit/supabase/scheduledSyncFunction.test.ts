import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const fnRoot = resolve(__dirname, '../../../supabase/functions');
const scheduledSyncPath = resolve(fnRoot, 'scheduled-sync/index.ts');
const entryPath = resolve(fnRoot, '_shared/ingest.entry.ts');
const bundlePath = resolve(fnRoot, '_shared/ingest.bundle.js');
const syncCvePath = resolve(fnRoot, 'sync-cve/index.ts');

const read = (p: string) => readFileSync(p, 'utf8');

describe('scheduled-sync edge function', () => {
  it('exists', () => {
    expect(existsSync(scheduledSyncPath)).toBe(true);
  });

  it('requires the service role key as a bearer token', () => {
    const src = read(scheduledSyncPath);
    expect(src).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(src).toMatch(/Bearer/);
    expect(src).toContain('401');
    expect(src).toContain('Unauthorized');
  });

  it('reuses the shared ingestion bundle rather than a copied adapter', () => {
    const src = read(scheduledSyncPath);
    expect(src).toMatch(/_shared\/ingest\.bundle\.js/);
    expect(src).not.toContain('class RedHatCsafAdapter');
    expect(src).not.toContain('access.redhat.com');
  });

  it('filters vendors through the shared due-window helper', () => {
    expect(read(scheduledSyncPath)).toContain('isVendorDue');
  });

  it('loads active webhook configs and hands them to the engine', () => {
    const src = read(scheduledSyncPath);
    expect(src).toContain('webhook_configs');
    expect(src).toContain('registerWebhook');
    expect(src).toMatch(/new\s+IngestionEngine\(\s*\{[^}]*webhookService/);
  });

  it('writes exactly one sync log and stamps the run time', () => {
    const src = read(scheduledSyncPath);
    expect(src).toContain('vendor_sync_logs');
    expect(src).toContain('last_scheduled_run_at');
  });

  it('does not apply the browser http chunk limit server side', () => {
    expect(read(scheduledSyncPath)).not.toContain('PERSIST_CHUNK_MAX_BYTES');
  });

  it('does not share one ingestion engine across vendors', () => {
    // IngestionEngine accumulates advisories/cves/mappings in instance Maps and never
    // clears them. Reusing one instance across vendors leaks vendor A's rows into
    // vendor B's upsert, which then stamps them with vendor B's vendor_id.
    const src = read(scheduledSyncPath);
    const loopAt = src.search(/for\s*\(\s*const\s+\w+\s+of\s+\w*[Dd]ue\w*/);
    const engineAt = src.indexOf('new IngestionEngine(');
    expect(loopAt).toBeGreaterThan(-1);
    expect(engineAt).toBeGreaterThan(-1);
    expect(engineAt).toBeGreaterThan(loopAt);
  });

  it('refuses to run when the service role key is unset, instead of comparing to an empty token', () => {
    const src = read(scheduledSyncPath);
    // An empty env var must not collapse the check into `authHeader !== 'Bearer '`.
    expect(src).toMatch(/if\s*\(\s*!\s*serviceRoleKey/);
  });

  it('isolates the run-time stamp so one vendor cannot abort the remaining vendors', () => {
    const src = read(scheduledSyncPath);
    const stampAt = src.indexOf('last_scheduled_run_at');
    expect(stampAt).toBeGreaterThan(-1);
    const around = src.slice(Math.max(0, stampAt - 600), stampAt + 600);
    expect(around).toMatch(/try\s*\{/);
    expect(around).toMatch(/catch/);
  });

  it('persists the raw advisory payload the same way the manual path does', () => {
    const src = read(scheduledSyncPath);
    expect(src).toContain('raw_payload_path');
  });

  it('never discards the error half of a write result', () => {
    // `const { data: x } = await supabaseClient...` hides a failed insert or update.
    const src = read(scheduledSyncPath);
    expect(src).not.toMatch(/const\s*\{\s*data\s*:?\s*\w*\s*\}\s*=\s*await\s+supabaseClient/);
  });

  it('seeds the engine with already known cve ids so new_items_count stays honest', () => {
    expect(read(scheduledSyncPath)).toContain('knownCveIds');
  });

  it('removes uploaded raw payloads when the advisory upsert fails', () => {
    const src = read(scheduledSyncPath);
    expect(src).toMatch(/storage[\s\S]{0,200}?\.remove\(/);
  });

  it('uploads raw payloads inside the batch loop so no batch can be orphaned', () => {
    // Uploading every advisory up front means a failure on a middle batch leaves the
    // later batches' objects in the bucket with nothing to remove them.
    const src = read(scheduledSyncPath);
    const advisoryBatchAt = src.search(/for\s*\(\s*const\s+batch\s+of\s+chunk\(\s*advisories/);
    const uploadAt = src.indexOf('.upload(');
    expect(advisoryBatchAt).toBeGreaterThan(-1);
    expect(uploadAt).toBeGreaterThan(-1);
    expect(uploadAt).toBeGreaterThan(advisoryBatchAt);
  });
});

describe('shared ingestion bundle', () => {
  it('has an entry module re-exporting the app ingestion code', () => {
    expect(existsSync(entryPath)).toBe(true);
    const src = read(entryPath);
    for (const symbol of ['IngestionEngine', 'getAdapterByCode', 'isVendorDue']) {
      expect(src).toContain(symbol);
    }
  });

  it('re-exports the webhook service so scheduled runs can raise alerts', () => {
    expect(read(entryPath)).toContain('WebhookService');
  });

  it('has a generated bundle committed for deployment', () => {
    expect(existsSync(bundlePath)).toBe(true);
    expect(read(bundlePath).length).toBeGreaterThan(0);
  });
});

describe('sync-cve edge function', () => {
  it('accepts the schedule write action', () => {
    expect(read(syncCvePath)).toContain('update_vendor_schedule');
  });

  it('still supports persist_ingestion and still rejects unknown actions', () => {
    const src = read(syncCvePath);
    expect(src).toContain('persist_ingestion');
    expect(src).toContain('Unsupported action');
  });
});
