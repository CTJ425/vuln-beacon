import { WebhookAlertPayload } from '@/types';

const SEVERITY_COLORS: Record<string, number> = {
  CRITICAL: 0xd32f2f, // Red
  HIGH: 0xf57c00,     // Orange
  MEDIUM: 0xfbc02d,   // Yellow
  LOW: 0x388e3c,      // Green
  UNKNOWN: 0x757575,  // Grey
};

export function formatDiscordAlert(alert: WebhookAlertPayload) {
  const color = SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.UNKNOWN;
  const scoreText = alert.cvssScore ? `${alert.cvssScore} (${alert.severity})` : alert.severity;

  const fields = [
    { name: 'Vendor', value: alert.vendorName, inline: true },
    { name: 'Advisory ID', value: alert.advisoryId, inline: true },
    { name: 'CVSS Score', value: scoreText, inline: true },
  ];

  const rawDescription = alert.summary || alert.advisoryTitle || '';
  const truncatedDescription =
    rawDescription.length > 3500 ? rawDescription.slice(0, 3497) + '...' : rawDescription;

  if (alert.affectedProducts && alert.affectedProducts.length > 0) {
    const productsText = alert.affectedProducts.slice(0, 5).join('\n');
    fields.push({
      name: 'Affected Products',
      value: productsText.length > 1000 ? productsText.slice(0, 997) + '...' : productsText,
      inline: false,
    });
  }

  if (alert.fixedVersions && alert.fixedVersions.length > 0) {
    const fixedText = alert.fixedVersions.slice(0, 5).join('\n');
    fields.push({
      name: 'Fixed In',
      value: fixedText.length > 1000 ? fixedText.slice(0, 997) + '...' : fixedText,
      inline: false,
    });
  }

  return {
    embeds: [
      {
        title: `🚨 [${alert.severity}] Security Alert: ${alert.cveId}`,
        description: truncatedDescription,
        url: alert.advisoryUrl,
        color,
        fields,
        footer: {
          text: 'VulnBeacon • Automated Multi-Vendor CVE Intel',
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}
