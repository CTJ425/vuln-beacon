import { WebhookAlertPayload } from '@/types';

export function formatSlackAlert(alert: WebhookAlertPayload) {
  const scoreText = alert.cvssScore ? `${alert.cvssScore} (${alert.severity})` : alert.severity;

  const blocks: Array<Record<string, unknown>> = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `🚨 [${alert.severity}] Security Alert: ${alert.cveId}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Vendor:*\n${alert.vendorName}`,
        },
        {
          type: 'mrkdwn',
          text: `*Advisory ID:*\n<${alert.advisoryUrl}|${alert.advisoryId}>`,
        },
        {
          type: 'mrkdwn',
          text: `*Severity:*\n${scoreText}`,
        },
        {
          type: 'mrkdwn',
          text: `*CVE ID:*\n${alert.cveId}`,
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Summary:*\n${alert.summary || alert.advisoryTitle}`,
      },
    },
  ];

  if (alert.dashboardUrl) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '🛡️ Triage in VulnBeacon',
            emoji: true,
          },
          url: alert.dashboardUrl,
          style: alert.severity === 'CRITICAL' ? 'danger' : 'primary',
        },
      ],
    });
  }

  return { blocks };
}
