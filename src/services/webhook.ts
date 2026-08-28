import { WebhookAlertPayload, WebhookConfig, SeverityLevel } from '@/types';
import { formatWebhookAlert } from '@/formatters';

const SEVERITY_RANKS: Record<SeverityLevel, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  UNKNOWN: 0,
};

export class WebhookService {
  private webhooks: WebhookConfig[] = [];

  registerWebhook(config: WebhookConfig) {
    this.webhooks.push(config);
  }

  clearWebhooks() {
    this.webhooks = [];
  }

  getWebhooks(): WebhookConfig[] {
    return [...this.webhooks];
  }

  async dispatch(
    config: WebhookConfig,
    alert: WebhookAlertPayload,
    { ignoreActiveState = false }: { ignoreActiveState?: boolean } = {}
  ): Promise<boolean> {
    const minRank = SEVERITY_RANKS[config.min_severity] || 0;
    const alertRank = SEVERITY_RANKS[alert.severity] || 0;

    // Filter out alerts below minimum configured severity
    if (alertRank < minRank || (!config.is_active && !ignoreActiveState)) {
      return false;
    }

    const payload = formatWebhookAlert(config.platform, alert);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(config.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      return response.ok;
    } catch (err) {
      // Never log config.webhook_url, it embeds a secret token.
      console.warn('Webhook dispatch failed:', config.id, config.platform, err);
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async notifyAll(alert: WebhookAlertPayload): Promise<number> {
    const results = await Promise.allSettled(
      this.webhooks.map((hook) => this.dispatch(hook, alert))
    );
    return results.filter((r) => r.status === 'fulfilled' && r.value).length;
  }
}
