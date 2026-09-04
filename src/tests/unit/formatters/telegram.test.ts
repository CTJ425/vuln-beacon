import { describe, it, expect } from 'vitest';
import { formatTelegramAlert } from '@/formatters/telegram';
import { WebhookAlertPayload } from '@/types';

describe('Telegram Webhook Formatter', () => {
  const sampleAlert: WebhookAlertPayload = {
    vendorName: 'Red Hat',
    advisoryId: 'RHSA-2024:6821',
    advisoryTitle: 'vCenter Server RCE',
    advisoryUrl: 'https://access.redhat.com/errata/RHSA-2024:6821',
    cveId: 'CVE-2024-38812',
    cvssScore: 9.8,
    severity: 'CRITICAL',
    summary: 'Spring Framework RCE vulnerability',
    affectedProducts: ['spring-framework'],
  };

  it('should generate valid HTML message for Telegram', () => {
    const payload = formatTelegramAlert(sampleAlert);

    expect(payload.parse_mode).toBe('HTML');
    expect(payload.text).toContain('🚨 <b>[CRITICAL Security Alert]</b>');
    expect(payload.text).toContain('CVE-2024-38812');
    expect(payload.text).toContain('Red Hat');
    expect(payload.text).toContain('RHSA-2024:6821');
  });

  it('includes chat_id when provided', () => {
    const payload = formatTelegramAlert(sampleAlert, '12345678');
    expect(payload.chat_id).toBe('12345678');
  });

  it('escapes HTML special characters in summary to prevent parse errors', () => {
    const alertWithHtml: WebhookAlertPayload = {
      ...sampleAlert,
      summary: 'Vulnerability in kernel < 5.14 & glibc > 2.28',
    };
    const payload = formatTelegramAlert(alertWithHtml);
    expect(payload.text).toContain('&lt; 5.14 &amp; glibc &gt; 2.28');
    expect(payload.text).not.toContain('< 5.14 & glibc >');
  });

  it('truncates message to 4000 characters if summary is very long', () => {
    const longAlert: WebhookAlertPayload = {
      ...sampleAlert,
      summary: 'A'.repeat(5000),
    };
    const payload = formatTelegramAlert(longAlert);
    expect(payload.text.length).toBeLessThanOrEqual(4000);
  });
});
