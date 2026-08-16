import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  Stack,
} from '@mui/material';
import { Plus, Send, Trash2 } from 'lucide-react';
import { WebhookConfig, WebhookPlatform, SeverityLevel } from '@/types';

interface WebhookConfigPanelProps {
  webhooks: WebhookConfig[];
  onAddWebhook: (webhook: Omit<WebhookConfig, 'id' | 'created_at'>) => void;
  onDeleteWebhook: (id: string) => void;
  onTestWebhook: (webhook: WebhookConfig) => Promise<boolean>;
}

export const WebhookConfigPanel: React.FC<WebhookConfigPanelProps> = ({
  webhooks,
  onAddWebhook,
  onDeleteWebhook,
  onTestWebhook,
}) => {
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState<WebhookPlatform>('discord');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [minSeverity, setMinSeverity] = useState<SeverityLevel>('HIGH');
  const [isActive] = useState(true);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean } | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const isValidDestinationUrl = (value: string): boolean => {
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !webhookUrl) return;

    if (!isValidDestinationUrl(webhookUrl)) {
      setUrlError('Destination URL must be a valid https:// URL.');
      return;
    }
    setUrlError(null);

    onAddWebhook({
      name,
      platform,
      webhook_url: webhookUrl,
      min_severity: minSeverity,
      is_active: isActive,
    });

    setName('');
    setWebhookUrl('');
  };

  const handleDeleteClick = (id: string) => {
    if (pendingDeleteId === id) {
      setPendingDeleteId(null);
      onDeleteWebhook(id);
    } else {
      setPendingDeleteId(id);
    }
  };

  const maskWebhookUrl = (url: string): string => {
    try {
      const parsed = new URL(url);
      // The secret can live anywhere after the origin (e.g. ntfy-style
      // topics as the first path segment), so mask the whole path, query,
      // and fragment rather than revealing any part of it.
      return `${parsed.origin}/••••••••`;
    } catch {
      return '••••••••';
    }
  };

  const handleTest = async (hook: WebhookConfig) => {
    const success = await onTestWebhook(hook);
    setTestResult({ id: hook.id, success });
    setTimeout(() => setTestResult(null), 4000);
  };

  return (
    <Stack spacing={3}>
      <Card sx={{ bgcolor: 'background.paper', borderRadius: 2.5 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, color: 'text.primary' }}>
            Add Webhook Integration
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
            Configure real-time automated vulnerability alert destinations for Discord, Telegram, or Slack.
          </Typography>

          <Box component="form" onSubmit={handleAdd} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 2, alignItems: 'center' }}>
            <TextField
              size="small"
              label="Integration Name"
              placeholder="e.g. SOC Discord"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              sx={{ bgcolor: 'background.default' }}
            />

            <FormControl size="small">
              <InputLabel>Platform</InputLabel>
              <Select
                value={platform}
                label="Platform"
                onChange={(e) => setPlatform(e.target.value as WebhookPlatform)}
                sx={{ bgcolor: 'background.default' }}
              >
                <MenuItem value="discord">Discord (Embed Cards)</MenuItem>
                <MenuItem value="telegram">Telegram (HTML Alerts)</MenuItem>
                <MenuItem value="slack">Slack (Block Kit)</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small">
              <InputLabel>Min Severity</InputLabel>
              <Select
                value={minSeverity}
                label="Min Severity"
                onChange={(e) => setMinSeverity(e.target.value as SeverityLevel)}
                sx={{ bgcolor: 'background.default' }}
              >
                <MenuItem value="CRITICAL">Critical Only (≥ 9.0)</MenuItem>
                <MenuItem value="HIGH">High and Above (≥ 7.0)</MenuItem>
                <MenuItem value="MEDIUM">Medium and Above (≥ 4.0)</MenuItem>
                <MenuItem value="LOW">All Disclosures (≥ 0.1)</MenuItem>
              </Select>
            </FormControl>

            <Button
              type="submit"
              variant="contained"
              startIcon={<Plus size={18} />}
              sx={{
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                fontWeight: 700,
                height: 40,
                '&:hover': { bgcolor: 'primary.light' },
              }}
            >
              Add Endpoint
            </Button>

            <Box sx={{ gridColumn: { xs: '1', md: '1 / -1' } }}>
              <TextField
                fullWidth
                size="small"
                label="Webhook Destination URL"
                placeholder="https://discord.com/api/webhooks/... or https://hooks.slack.com/services/..."
                value={webhookUrl}
                onChange={(e) => {
                  setWebhookUrl(e.target.value);
                  if (urlError) setUrlError(null);
                }}
                required
                error={Boolean(urlError)}
                helperText={urlError}
                sx={{ bgcolor: 'background.default' }}
              />
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ bgcolor: 'background.paper', borderRadius: 2.5 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: 'text.primary' }}>
            Configured Notification Webhooks
          </Typography>

          {testResult && (
            <Alert severity={testResult.success ? 'success' : 'error'} sx={{ mb: 2 }}>
              {testResult.success
                ? 'Test alert dispatched successfully!'
                : 'Failed to dispatch test alert. Please verify webhook URL and connectivity.'}
            </Alert>
          )}

          <TableContainer component={Paper} sx={{ bgcolor: 'background.default', borderRadius: 2 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Platform</TableCell>
                  <TableCell>Min Severity</TableCell>
                  <TableCell>Endpoint URL</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {webhooks.map((hook) => (
                  <TableRow key={hook.id}>
                    <TableCell sx={{ fontWeight: 600, color: 'text.primary' }}>{hook.name}</TableCell>
                    <TableCell sx={{ textTransform: 'capitalize' }}>{hook.platform}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={hook.min_severity}
                        sx={{
                          bgcolor: hook.min_severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(249, 115, 22, 0.15)',
                          color: hook.min_severity === 'CRITICAL' ? '#ef4444' : '#ea580c',
                          fontWeight: 700,
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', maxWidth: 250, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {maskWebhookUrl(hook.webhook_url)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={hook.is_active ? 'Active' : 'Disabled'}
                        sx={{
                          bgcolor: hook.is_active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                          color: hook.is_active ? '#059669' : 'text.secondary',
                          fontWeight: 600,
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Send size={14} />}
                        onClick={() => handleTest(hook)}
                        sx={{ mr: 1, color: 'primary.main', borderColor: 'primary.main' }}
                      >
                        Test Alert
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        data-testid={`delete-webhook-${hook.id}`}
                        onClick={() => handleDeleteClick(hook.id)}
                        sx={pendingDeleteId === hook.id ? { fontWeight: 700 } : undefined}
                      >
                        {pendingDeleteId === hook.id ? 'Confirm?' : <Trash2 size={16} />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Stack>
  );
};
