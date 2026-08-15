import { describe, it, expect } from 'vitest';
import { formatDiscordAlert } from '@/formatters/discord';
import { WebhookAlertPayload } from '@/types';

describe('Discord Webhook Formatter', () => {
  const sampleAlert: WebhookAlertPayload = {
    vendorName: 'VMware / Broadcom',
    advisoryId: 'VMSA-2024-0019',
    advisoryTitle: 'VMware vCenter Server Remote Code Execution',
    advisoryUrl: 'https://support.broadcom.com/vmsa',
    cveId: 'CVE-2024-38812',
    cvssScore: 9.8,
    severity: 'CRITICAL',
    summary: 'Heap overflow vulnerability in DCERPC implementation',
    affectedProducts: ['VMware vCenter Server 8.0'],
    fixedVersions: ['8.0 U3b'],
    dashboardUrl: 'https://beacon.example.com/cve/CVE-2024-38812',
  };

  it('should format valid Discord embed payload for CRITICAL alert', () => {
    const payload = formatDiscordAlert(sampleAlert);

    expect(payload.embeds).toBeDefined();
    expect(payload.embeds).toHaveLength(1);

    const embed = payload.embeds[0];
    expect(embed.title).toContain('CRITICAL');
    expect(embed.title).toContain('CVE-2024-38812');
    expect(embed.color).toBe(0xd32f2f); // Red for Critical
    expect(embed.url).toBe(sampleAlert.advisoryUrl);
    expect(embed.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Vendor', value: 'VMware / Broadcom' }),
        expect.objectContaining({ name: 'CVSS Score', value: '9.8 (CRITICAL)' }),
      ])
    );
  });

  it('should format HIGH severity with orange color', () => {
    const highAlert: WebhookAlertPayload = { ...sampleAlert, severity: 'HIGH', cvssScore: 8.5 };
    const payload = formatDiscordAlert(highAlert);
    expect(payload.embeds[0].color).toBe(0xf57c00); // Orange for High
  });
});
