import { describe, it, expect } from 'vitest';
import { formatWebhookAlert } from '@/formatters';
import { WebhookAlertPayload } from '@/types';

describe('Webhook Formatters Smoke Test', () => {
  const alert: WebhookAlertPayload = {
    vendorName: 'Red Hat',
    advisoryId: 'RHSA-2024:6821',
    advisoryTitle: 'Critical RCE in Spring Framework',
    advisoryUrl: 'https://access.redhat.com/errata/RHSA-2024:6821',
    cveId: 'CVE-2024-38812',
    cvssScore: 9.8,
    severity: 'CRITICAL',
    summary: 'Remote code execution vulnerability',
    affectedProducts: ['spring-framework-0:5.3.39-1.el9'],
  };

  it('should format alerts for discord without throwing', () => {
    const discordPayload = formatWebhookAlert('discord', alert);
    expect(discordPayload).toHaveProperty('embeds');
  });

  it('should format alerts for telegram without throwing', () => {
    const telegramPayload = formatWebhookAlert('telegram', alert);
    expect(telegramPayload).toHaveProperty('text');
    expect(telegramPayload).toHaveProperty('parse_mode', 'HTML');
  });

  it('should format alerts for slack without throwing', () => {
    const slackPayload = formatWebhookAlert('slack', alert);
    expect(slackPayload).toHaveProperty('blocks');
  });

  it('should throw error for unsupported platform', () => {
    // @ts-expect-error testing invalid platform
    expect(() => formatWebhookAlert('unknown', alert)).toThrow('Unsupported webhook platform');
  });
});
