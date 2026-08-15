import { describe, it, expect } from 'vitest';
import { formatSlackAlert } from '@/formatters/slack';
import { WebhookAlertPayload } from '@/types';

describe('Slack Webhook Formatter', () => {
  const sampleAlert: WebhookAlertPayload = {
    vendorName: 'Nutanix',
    advisoryId: 'NTNX-SA-2024-0012',
    advisoryTitle: 'AOS and Prism Element Multiple Vulnerabilities',
    advisoryUrl: 'https://portal.nutanix.com/page/documents/security-advisories',
    cveId: 'CVE-2024-4321',
    cvssScore: 8.1,
    severity: 'HIGH',
    summary: 'Improper input validation in Nutanix Prism Element',
    dashboardUrl: 'https://beacon.example.com/cve/CVE-2024-4321',
  };

  it('should format valid Slack Block Kit payload', () => {
    const payload = formatSlackAlert(sampleAlert);

    expect(payload.blocks).toBeDefined();
    expect(payload.blocks.length).toBeGreaterThan(1);

    const header = payload.blocks[0] as { type: string; text: { text: string } };
    expect(header.type).toBe('header');
    expect(header.text.text).toContain('[HIGH] Security Alert');

    const fieldsSection = payload.blocks[1] as { type: string; fields: unknown[] };
    expect(fieldsSection.type).toBe('section');
    expect(fieldsSection.fields).toBeDefined();
  });
});
