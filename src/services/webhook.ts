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

  getWebhooks(): WebhookConfig[] {
    return [...this.webhooks];
  }

  async dispatch(config: WebhookConfig, alert: WebhookAlertPayload): Promise<boolean> {
    const minRank = SEVERITY_RANKS[config.min_severity] || 0;
    const alertRank = SEVERITY_RANKS[alert.severity] || 0;

    // Filter out alerts below minimum configured severity
    if (alertRank < minRank || !config.is_active) {
      return false;
    }

    const payload = formatWebhookAlert(config.platform, alert);

    try {
      const response = await fetch(config.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async notifyAll(alert: WebhookAlertPayload): Promise<number> {
    let successCount = 0;
    for (const hook of this.webhooks) {
      const success = await this.dispatch(hook, alert);
      if (success) successCount++;
    }
    return successCount;
  }
}
