import { describe, it, expect } from 'vitest';
import { formatDiscordAlert } from '@/formatters/discord';
import { WebhookAlertPayload } from '@/types';

describe('Discord Webhook Formatter', () => {
  const sampleAlert: WebhookAlertPayload = {
    vendorName: 'Dell',
    advisoryId: 'DSA-2024-001',
    advisoryTitle: 'Dell PowerStore Security Update',
    advisoryUrl: 'https://www.dell.com/support/security/dsa-2024-001',
    cveId: 'CVE-2024-1111',
    cvssScore: 9.8,
    severity: 'CRITICAL',
    summary: 'Critical buffer overflow in management interface',
  };

  it('formats valid Discord embed payload', () => {
    const payload = formatDiscordAlert(sampleAlert);
    expect(payload.embeds).toBeDefined();
    expect(payload.embeds.length).toBe(1);
    expect(payload.embeds[0].title).toContain('CVE-2024-1111');
  });

  it('truncates overly long descriptions and fields to stay within Discord limits', () => {
    const longAlert: WebhookAlertPayload = {
      ...sampleAlert,
      summary: 'D'.repeat(5000),
      affectedProducts: ['P'.repeat(1500)],
      fixedVersions: ['V'.repeat(1500)],
    };
    const payload = formatDiscordAlert(longAlert);
    const embed = payload.embeds[0];
    expect(embed.description?.length).toBeLessThanOrEqual(3500);
    expect(embed.description).toContain('...');

    const productsField = embed.fields?.find((f) => f.name === 'Affected Products');
    expect(productsField?.value.length).toBeLessThanOrEqual(1000);
    expect(productsField?.value).toContain('...');

    const fixedField = embed.fields?.find((f) => f.name === 'Fixed In');
    expect(fixedField?.value.length).toBeLessThanOrEqual(1000);
    expect(fixedField?.value).toContain('...');
  });
});
