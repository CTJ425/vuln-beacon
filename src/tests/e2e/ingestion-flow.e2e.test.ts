import { describe, it, expect } from 'vitest';
import { IngestionEngine } from '@/engine/ingestion';
import redhatFixture from '../fixtures/redhat/cve-sample.json';

describe('E2E: Ingestion and Normalization Flow', () => {
  it('should run full ingestion for Red Hat security feed, deduplicate CVEs, and record execution logs', async () => {
    const engine = new IngestionEngine();

    // 1. Ingest RedHat feed
    const redhatResult = await engine.ingestVendor('redhat', redhatFixture);
    expect(redhatResult.status).toBe('SUCCESS');
    expect(redhatResult.advisoriesCount).toBe(2);
    expect(redhatResult.cvesCount).toBe(2);

    // 2. Inspect in-memory database store
    const allCves = engine.getCves();
    expect(allCves).toHaveLength(2);

    const rceCve = allCves.find((c) => c.cve_id === 'CVE-2024-38812');
    expect(rceCve).toBeDefined();
    expect(rceCve?.severity).toBe('CRITICAL');
    expect(rceCve?.cvss_v3_score).toBe(9.8);

    // 3. Verify advisory-CVE mapping links
    const mappings = engine.getMappings();
    expect(mappings.length).toBeGreaterThanOrEqual(2);

    // 4. Verify vendor sync log entries
    const logs = engine.getSyncLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].vendor_code).toBe('redhat');
  });
});
