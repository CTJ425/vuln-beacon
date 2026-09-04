import { WebhookAlertPayload } from '@/types';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export interface TelegramAlertPayload {
  text: string;
  parse_mode: 'HTML';
  disable_web_page_preview: boolean;
  chat_id?: string | number;
}

export function formatTelegramAlert(
  alert: WebhookAlertPayload,
  chatId?: string | number
): TelegramAlertPayload {
  const scoreText = alert.cvssScore ? `${alert.cvssScore} (${alert.severity})` : alert.severity;
  const products = (alert.affectedProducts || []).slice(0, 3).map(escapeHtml).join(', ') || 'N/A';
  const rawSummary = alert.summary || alert.advisoryTitle || '';
  const escapedSummary = escapeHtml(rawSummary);

  const text = [
    `🚨 <b>[${alert.severity} Security Alert]</b>`,
    ``,
    `<b>CVE:</b> <code>${escapeHtml(alert.cveId)}</code>`,
    `<b>Vendor:</b> ${escapeHtml(alert.vendorName)}`,
    `<b>Advisory:</b> <a href="${alert.advisoryUrl}">${escapeHtml(alert.advisoryId)}</a>`,
    `<b>CVSS Score:</b> ${scoreText}`,
    `<b>Affected:</b> ${products}`,
    ``,
    `<b>Summary:</b> ${escapedSummary}`,
    alert.dashboardUrl ? `\n🔗 <a href="${alert.dashboardUrl}">Open in VulnBeacon Dashboard</a>` : '',
  ].filter(Boolean).join('\n');

  const truncatedText = text.length > 4000 ? text.slice(0, 3997) + '...' : text;

  const result: TelegramAlertPayload = {
    text: truncatedText,
    parse_mode: 'HTML',
    disable_web_page_preview: false,
  };

  if (chatId !== undefined && chatId !== '') {
    result.chat_id = chatId;
  }

  return result;
}
