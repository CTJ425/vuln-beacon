import { describe, it, expect, vi } from 'vitest';

const fakeAdapter = {
  vendorCode: 'redhat',
  vendorName: 'Red Hat',
  endpoints: [],
  fetchAdvisories: async () => [],
  parse: (raw: unknown) => raw as any[],
};

vi.mock('@/adapters', () => ({
  getAdapterByCode: () => fakeAdapter,
  ALL_ADAPTERS: [],
}));

import { IngestionEngine } from '@/engine/ingestion';
import { WebhookService } from '@/services/webhook';

const item = (advisoryId: string, cves: { cveId: string; severity: string; description?: string }[]) => ({
  advisoryId,
  title: `Advisory ${advisoryId}`,
  severity: 'HIGH',
  publishedAt: '2026-01-01T00:00:00.000Z',
  url: `https://example.test/${advisoryId}`,
  cves,
});

function setup(knownCveIds: string[] = []) {
  const webhookService = new WebhookService();
  const notifyAll = vi.spyOn(webhookService, 'notifyAll').mockResolvedValue(1);
  const engine = new IngestionEngine({ webhookService, knownCveIds });
  return { engine, notifyAll };
}

describe('IngestionEngine alert dispatch', () => {
  it('does not send alerts while ingesting, before anything is persisted', async () => {
    const { engine, notifyAll } = setup();
    await engine.ingestVendor('redhat', [item('RHSA-1', [{ cveId: 'CVE-2026-0001', severity: 'CRITICAL' }])]);
    expect(notifyAll).not.toHaveBeenCalled();
  });

  it('sends each queued alert once when dispatchPendingAlerts is called', async () => {
    const { engine, notifyAll } = setup();
    await engine.ingestVendor('redhat', [item('RHSA-1', [{ cveId: 'CVE-2026-0001', severity: 'CRITICAL' }])]);

    await engine.dispatchPendingAlerts();
    await engine.dispatchPendingAlerts();

    expect(notifyAll).toHaveBeenCalledTimes(1);
    expect(notifyAll.mock.calls[0][0]).toMatchObject({ cveId: 'CVE-2026-0001', severity: 'CRITICAL' });
  });

  it('queues MEDIUM and LOW CVEs too, leaving the threshold to each webhook', async () => {
    const { engine, notifyAll } = setup();
    await engine.ingestVendor('redhat', [
      item('RHSA-1', [
        { cveId: 'CVE-2026-0002', severity: 'MEDIUM' },
        { cveId: 'CVE-2026-0003', severity: 'LOW' },
      ]),
    ]);
    await engine.dispatchPendingAlerts();
    expect(notifyAll.mock.calls.map((c) => c[0].severity).sort()).toEqual(['LOW', 'MEDIUM']);
  });

  it('never queues a CVE that is already stored', async () => {
    const { engine, notifyAll } = setup(['CVE-2026-0001']);
    await engine.ingestVendor('redhat', [item('RHSA-1', [{ cveId: 'CVE-2026-0001', severity: 'CRITICAL' }])]);
    await engine.dispatchPendingAlerts();
    expect(notifyAll).not.toHaveBeenCalled();
  });
});

describe('IngestionEngine CVE description', () => {
  it('leaves description empty when the vendor has none, carrying the advisory title only as a fallback', async () => {
    const { engine } = setup();
    await engine.ingestVendor('redhat', [item('RHSA-1', [{ cveId: 'CVE-2026-0004', severity: 'HIGH' }])]);
    const [cve] = engine.getCves();
    expect(cve.description).toBeNull();
    expect(cve.description_fallback).toBe('Advisory RHSA-1');
  });

  it('keeps a real vendor description', async () => {
    const { engine } = setup();
    await engine.ingestVendor('redhat', [item('RHSA-1', [{ cveId: 'CVE-2026-0005', severity: 'HIGH', description: 'heap overflow' }])]);
    expect(engine.getCves()[0].description).toBe('heap overflow');
  });
});
