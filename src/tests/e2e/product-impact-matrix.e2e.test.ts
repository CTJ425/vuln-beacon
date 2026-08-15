import { describe, it, expect } from 'vitest';
import { IngestionEngine } from '@/engine/ingestion';
import redhatFixture from '../fixtures/redhat/csaf-e2e-sample.json';

describe('E2E: Product & Component Impact Matrix Flow', () => {
  it('should ingest CVE and extract structured products and component packages with impact states', async () => {
    const engine = new IngestionEngine();

    // 1. Ingest CVEs
    const result = await engine.ingestVendor('redhat', redhatFixture);
    expect(result.status).toBe('SUCCESS');

    // 2. Verify CVE records
    const cves = engine.getCves();
    expect(cves.length).toBeGreaterThan(0);
    const targetCve = cves[0];
    expect(targetCve.cve_id).toBe('CVE-2024-38812');

    // 3. Verify Advisory CVE Map with Product Impact Matrix
    const mappings = engine.getMappings();
    expect(mappings.length).toBeGreaterThan(0);
    const map = mappings[0];

    expect(map.product_impacts).toBeDefined();
    expect(map.product_impacts!.length).toBeGreaterThan(0);
    // the package NVR is reduced to a base component name, and the composite
    // product id is resolved to its human-readable product name
    expect(map.product_impacts!.map((p) => p.component)).toContain('spring-framework');
    expect(map.product_impacts![0].product_name).toBe('Red Hat Enterprise Linux AppStream (v. 9)');
    expect(map.product_impacts![0].state).toBe('Fixed');
  });
});
