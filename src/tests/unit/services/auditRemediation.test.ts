import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebhookService } from '@/services/webhook';
import { IngestionEngine } from '@/engine/ingestion';
import redhatFixture from '../../fixtures/redhat/csaf-e2e-sample.json';
import { WebhookConfig, WebhookAlertPayload } from '@/types';

/**
 * Regression coverage for the audit remediation recorded in
 * docs/agent/specs/audit-remediation.md (BUG-003, BUG-004, BUG-011).
 */

const makeConfig = (over: Partial<WebhookConfig> = {}): WebhookConfig =>
  ({
    id: 'hook-1',
    name: 'Ops',
    platform: 'discord',
    webhook_url: 'https://discord.com/api/webhooks/1/SUPERSECRETTOKEN',
    min_severity: 'HIGH',
    is_active: true,
    created_at: new Date().toISOString(),
    ...over,
  }) as WebhookConfig;

const alert: WebhookAlertPayload = {
  vendorName: 'Red Hat',
  advisoryId: 'RHSA-2026:0001',
  advisoryTitle: 'kernel security update',
  advisoryUrl: 'https://example.test/RHSA-2026:0001',
  cveId: 'CVE-2026-0001',
  cvssScore: 9.8,
  severity: 'CRITICAL',
  summary: 'summary',
} as WebhookAlertPayload;

describe('BUG-004: webhook delivery is bounded and isolated', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('aborts a hanging request instead of waiting forever', async () => {
    vi.useFakeTimers();

    // A server that accepts the connection and never answers.
    global.fetch = vi.fn(
      (_url: any, init: any) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new Error('AbortError')));
        })
    ) as any;

    const service = new WebhookService();
    const promise = service.dispatch(makeConfig(), alert);

    await vi.advanceTimersByTimeAsync(10000);

    await expect(promise).resolves.toBe(false);
  });

  it('never logs the webhook_url, which embeds a secret token', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    global.fetch = vi.fn().mockRejectedValue(new Error('network down')) as any;

    const config = makeConfig();
    await new WebhookService().dispatch(config, alert);

    expect(warn).toHaveBeenCalled();
    const logged = warn.mock.calls.flat().map(String).join(' ');
    expect(logged).not.toContain('SUPERSECRETTOKEN');
    expect(logged).not.toContain(config.webhook_url);
  });

  it('dispatches all hooks concurrently so one slow hook cannot block the rest', async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    global.fetch = vi.fn(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return { ok: true } as any;
    }) as any;

    const service = new WebhookService();
    service.registerWebhook(makeConfig({ id: 'a' }));
    service.registerWebhook(makeConfig({ id: 'b' }));
    service.registerWebhook(makeConfig({ id: 'c' }));

    const delivered = await service.notifyAll(alert);

    expect(delivered).toBe(3);
    // Sequential delivery would never exceed one request in flight.
    expect(maxInFlight).toBeGreaterThan(1);
  });

  it('counts only successful deliveries and survives a rejecting hook', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ ok: true }) as any;

    const service = new WebhookService();
    service.registerWebhook(makeConfig({ id: 'a' }));
    service.registerWebhook(makeConfig({ id: 'b' }));
    service.registerWebhook(makeConfig({ id: 'c' }));

    await expect(service.notifyAll(alert)).resolves.toBe(2);
  });
});

describe('BUG-011: a disabled webhook is distinguishable from a broken one', () => {
  afterEach(() => vi.restoreAllMocks());

  it('does not send for an inactive config during normal alert traffic', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as any;

    const sent = await new WebhookService().dispatch(makeConfig({ is_active: false }), alert);

    expect(sent).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('actually probes the URL when ignoreActiveState is set', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as any;

    const sent = await new WebhookService().dispatch(makeConfig({ is_active: false }), alert, {
      ignoreActiveState: true,
    });

    expect(sent).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('still applies the severity floor even when ignoring active state', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as any;

    const sent = await new WebhookService().dispatch(
      makeConfig({ is_active: false, min_severity: 'CRITICAL' }),
      { ...alert, severity: 'LOW' } as WebhookAlertPayload,
      { ignoreActiveState: true }
    );

    expect(sent).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('BUG-003: alerts are not re-sent for already-persisted CVEs', () => {
  let webhookService: WebhookService;

  beforeEach(() => {
    webhookService = new WebhookService();
    webhookService.registerWebhook(makeConfig());
  });

  afterEach(() => vi.restoreAllMocks());

  const alertedCveIds = async (knownCveIds?: string[]) => {
    const spy = vi.spyOn(webhookService, 'notifyAll').mockResolvedValue(1);
    const engine = new IngestionEngine(
      knownCveIds ? { webhookService, knownCveIds } : { webhookService }
    );
    await engine.ingestVendor('redhat', redhatFixture);
    return spy.mock.calls.map(([payload]) => (payload as WebhookAlertPayload).cveId);
  };

  it('alerts on a first sync when nothing is known yet', async () => {
    const alerted = await alertedCveIds();
    expect(alerted.length).toBeGreaterThan(0);
  });

  it('suppresses alerts for CVEs already persisted in the database', async () => {
    const firstRun = await alertedCveIds();

    // A later sync re-parses the same feed; every CVE is already stored.
    const secondRun = await alertedCveIds(firstRun);

    expect(firstRun.length).toBeGreaterThan(0);
    expect(secondRun).toEqual([]);
  });

  it('still alerts for a CVE that is new relative to what is stored', async () => {
    const firstRun = await alertedCveIds();
    const allButOne = firstRun.slice(1);

    const secondRun = await alertedCveIds(allButOne);

    expect(secondRun).toEqual([firstRun[0]]);
  });
});
