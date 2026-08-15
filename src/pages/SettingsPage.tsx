import React from 'react';
import { Box, Typography, Stack } from '@mui/material';
import { WebhookConfigPanel } from '@/components/settings/WebhookConfigPanel';
import { WebhookConfig } from '@/types';

interface SettingsPageProps {
  webhooks: WebhookConfig[];
  onAddWebhook: (webhook: Omit<WebhookConfig, 'id' | 'created_at'>) => void;
  onDeleteWebhook: (id: string) => void;
  onTestWebhook: (webhook: WebhookConfig) => Promise<boolean>;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  webhooks,
  onAddWebhook,
  onDeleteWebhook,
  onTestWebhook,
}) => {
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em' }}>
          Integrations & Notification Settings
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          Manage webhook endpoints for instant Discord, Telegram, and Slack security alerts.
        </Typography>
      </Box>

      <WebhookConfigPanel
        webhooks={webhooks}
        onAddWebhook={onAddWebhook}
        onDeleteWebhook={onDeleteWebhook}
        onTestWebhook={onTestWebhook}
      />
    </Stack>
  );
};
