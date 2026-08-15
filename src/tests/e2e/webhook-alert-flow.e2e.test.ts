import { describe, it, expect, vi } from 'vitest';
import { IngestionEngine } from '@/engine/ingestion';
import { WebhookService } from '@/services/webhook';
import redhatFixture from '../fixtures/redhat/csaf-e2e-sample.json';

describe('E2E: Webhook Alert Dispatch Flow', () => {
  it('should detect CRITICAL severity CVEs and dispatch alerts to active webhooks', async () => {
    const webhookService = new WebhookService();
    const engine = new IngestionEngine({ webhookService });

    // Register webhooks
    webhookService.registerWebhook({
      id: 'hook-1',
      name: 'Security Ops Discord',
      platform: 'discord',
      webhook_url: 'https://discord.com/api/webhooks/mock/test',
      min_severity: 'HIGH',
      is_active: true,
      created_at: new Date().toISOString(),
    });

    const dispatchSpy = vi.spyOn(webhookService, 'dispatch').mockResolvedValue(true);

    // Ingest Red Hat advisories (contains CRITICAL CVE-2024-38812)
    await engine.ingestVendor('redhat', redhatFixture);

    // Should have triggered webhook dispatch for critical/high vulnerabilities
    expect(dispatchSpy).toHaveBeenCalled();
    const calls = dispatchSpy.mock.calls;
    expect(calls.length).toBeGreaterThan(0);

    const alertPayload = calls[0][1];
    expect(alertPayload.vendorName).toBe('Red Hat');
    expect(alertPayload.severity).toBe('CRITICAL');
  });
});
