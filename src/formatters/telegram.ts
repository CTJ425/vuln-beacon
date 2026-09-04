import { WebhookAlertPayload } from '@/types';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

  const advisoryLine = alert.advisoryUrl
    ? `<b>Advisory:</b> <a href="${escapeHtml(alert.advisoryUrl)}">${escapeHtml(alert.advisoryId || 'N/A')}</a>`
    : `<b>Advisory:</b> ${escapeHtml(alert.advisoryId || 'N/A')}`;

  const text = [
    `🚨 <b>[${alert.severity} Security Alert]</b>`,
    ``,
    `<b>CVE:</b> <code>${escapeHtml(alert.cveId || 'N/A')}</code>`,
    `<b>Vendor:</b> ${escapeHtml(alert.vendorName || 'Unknown Vendor')}`,
    advisoryLine,
    `<b>CVSS Score:</b> ${scoreText}`,
    `<b>Affected:</b> ${products}`,
    ``,
    `<b>Summary:</b> ${escapedSummary}`,
    alert.dashboardUrl ? `\n🔗 <a href="${escapeHtml(alert.dashboardUrl)}">Open in VulnBeacon Dashboard</a>` : '',
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
