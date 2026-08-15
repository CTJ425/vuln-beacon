import { WebhookAlertPayload } from '@/types';

export function formatTelegramAlert(alert: WebhookAlertPayload) {
  const scoreText = alert.cvssScore ? `${alert.cvssScore} (${alert.severity})` : alert.severity;
  const products = (alert.affectedProducts || []).slice(0, 3).join(', ') || 'N/A';

  const text = [
    `🚨 <b>[${alert.severity} Security Alert]</b>`,
    ``,
    `<b>CVE:</b> <code>${alert.cveId}</code>`,
    `<b>Vendor:</b> ${alert.vendorName}`,
    `<b>Advisory:</b> <a href="${alert.advisoryUrl}">${alert.advisoryId}</a>`,
    `<b>CVSS Score:</b> ${scoreText}`,
    `<b>Affected:</b> ${products}`,
    ``,
    `<b>Summary:</b> ${alert.summary || alert.advisoryTitle}`,
    alert.dashboardUrl ? `\n🔗 <a href="${alert.dashboardUrl}">Open in VulnBeacon Dashboard</a>` : '',
  ].filter(Boolean).join('\n');

  return {
    text,
    parse_mode: 'HTML' as const,
    disable_web_page_preview: false,
  };
}
