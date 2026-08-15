import { WebhookAlertPayload, WebhookPlatform } from '@/types';
import { formatDiscordAlert } from './discord';
import { formatTelegramAlert } from './telegram';
import { formatSlackAlert } from './slack';

export { formatDiscordAlert, formatTelegramAlert, formatSlackAlert };

export function formatWebhookAlert(platform: WebhookPlatform, payload: WebhookAlertPayload) {
  switch (platform) {
    case 'discord':
      return formatDiscordAlert(payload);
    case 'telegram':
      return formatTelegramAlert(payload);
    case 'slack':
      return formatSlackAlert(payload);
    default:
      throw new Error(`Unsupported webhook platform: ${platform}`);
  }
}
