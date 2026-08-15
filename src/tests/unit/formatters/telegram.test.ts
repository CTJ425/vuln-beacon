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
});
