import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Switch,
  TextField,
  Button,
  Typography,
  Box,
  Chip,
  Tooltip,
  Alert,
  Collapse,
} from '@mui/material';
import { Key, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Vendor } from '@/types';
import { isAdapterImplemented } from '@/adapters';
import { VendorIcon } from '@/components/common/VendorIcon';

export interface ScheduleSettingsProps {
  vendors: Vendor[];
  onSave: (
    vendorCode: string,
    schedule: { enabled: boolean; times: string[]; timezone: string }
  ) => Promise<{ success: boolean; error?: string }>;
  hasVaultError?: boolean;
  initialExpanded?: boolean;
}

const TIME_FORMAT = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

interface RowState {
  enabled: boolean;
  timesText: string;
  timezone: string;
  status: { kind: 'error' | 'success'; message: string } | null;
  saving: boolean;
}

function initialRowState(vendor: Vendor): RowState {
  return {
    enabled: vendor.schedule_enabled ?? false,
    timesText: (vendor.schedule_times ?? []).join(', '),
    timezone: vendor.schedule_timezone ?? 'Asia/Taipei',
    status: null,
    saving: false,
  };
}

export function getScheduledSyncUrl(): string {
  const envUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || '';
  if (envUrl && (envUrl.startsWith('http://') || envUrl.startsWith('https://'))) {
    return `${envUrl.replace(/\/$/, '')}/functions/v1/scheduled-sync`;
  }
  return 'https://<PROJECT_REF>.supabase.co/functions/v1/scheduled-sync';
}

export function generateVaultSqlSnippet(syncUrl: string = getScheduledSyncUrl()): string {
  return `-- 在 Supabase SQL Editor 執行設定指令以啟用背景排程：

-- 【方式一：使用專用設定函式 (推薦，一次完成)】
SELECT public.set_scheduled_sync_vault_secrets(
  '${syncUrl}',
  '<SUPABASE_SERVICE_ROLE_KEY>'
);

-- 【方式二：直接操作 Supabase Vault】
DELETE FROM vault.secrets WHERE name IN ('scheduled_sync_url', 'scheduled_sync_key');
SELECT vault.create_secret(
  '${syncUrl}',
  'scheduled_sync_url'
);
SELECT vault.create_secret(
  '<SUPABASE_SERVICE_ROLE_KEY>',
  'scheduled_sync_key'
);`;
}

export const VAULT_SQL_SNIPPET = generateVaultSqlSnippet();

export interface VaultSecretsGuideBannerProps {
  initialExpanded?: boolean;
  hasVaultError?: boolean;
}

export const VaultSecretsGuideBanner: React.FC<VaultSecretsGuideBannerProps> = ({
  initialExpanded = false,
  hasVaultError = false,
}) => {
  const [expanded, setExpanded] = useState(initialExpanded);
  const [copied, setCopied] = useState(false);
  const sqlText = useMemo(() => generateVaultSqlSnippet(), []);

  const handleCopySql = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(sqlText);
      } else if (typeof document !== 'undefined') {
        const ta = document.createElement('textarea');
        ta.value = sqlText;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2.5,
        bgcolor: (theme) =>
          hasVaultError
            ? theme.palette.mode === 'dark' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.04)'
            : theme.palette.mode === 'dark' ? 'rgba(56, 189, 248, 0.04)' : 'rgba(2, 132, 199, 0.03)',
        borderColor: (theme) =>
          hasVaultError
            ? theme.palette.mode === 'dark' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.3)'
            : theme.palette.mode === 'dark' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(2, 132, 199, 0.2)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              p: 0.75,
              borderRadius: 1.5,
              bgcolor: (theme) =>
                hasVaultError
                  ? 'rgba(239, 68, 68, 0.15)'
                  : theme.palette.mode === 'dark' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(2, 132, 199, 0.12)',
              color: hasVaultError ? 'error.main' : 'primary.main',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Key size={18} />
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                排程同步與 Supabase Vault 憑證指引
              </Typography>
              {hasVaultError && (
                <Chip
                  label="Missing Vault Secrets"
                  size="small"
                  color="warning"
                  sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                />
              )}
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              若日誌出現「Missing vault secrets」錯誤，表示尚未於資料庫配置 scheduled_sync_url 與 scheduled_sync_key。
            </Typography>
          </Box>
        </Box>
        <Button
          size="small"
          onClick={() => setExpanded((prev) => !prev)}
          endIcon={expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          sx={{ fontWeight: 600 }}
        >
          {expanded ? '收合指引' : '查看設定指令'}
        </Button>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ mt: 2, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
          <Alert severity={hasVaultError ? "warning" : "info"} sx={{ mb: 1.5, borderRadius: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              背景自動同步由 PostgreSQL 的 <strong>pg_cron</strong> 每 5 分鐘執行一次 <code>public.tick_scheduled_syncs()</code>，
              透過安全 Vault 讀取 <code>scheduled_sync_url</code> 與 <code>scheduled_sync_key</code> 發送 HTTP POST 到 Edge Function。
            </Typography>
          </Alert>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
              SQL 設定範本 (在 Supabase SQL Editor 執行一次即可)：
            </Typography>
            <Button
              size="small"
              variant="outlined"
              startIcon={copied ? <Check size={14} /> : <Copy size={14} />}
              onClick={handleCopySql}
              color={copied ? 'success' : 'primary'}
              sx={{ py: 0.25, px: 1, fontSize: '0.75rem' }}
            >
              {copied ? '已複製 SQL' : '複製 SQL 範本'}
            </Button>
          </Box>

          <Box
            component="pre"
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: (theme) => (theme.palette.mode === 'dark' ? '#0d1322' : '#f8fafc'),
              border: 1,
              borderColor: 'divider',
              fontSize: '0.75rem',
              overflowX: 'auto',
              fontFamily: 'monospace',
              color: 'text.primary',
              m: 0,
            }}
          >
            {sqlText}
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
};

const ScheduleRow: React.FC<{ vendor: Vendor; onSave: ScheduleSettingsProps['onSave'] }> = ({
  vendor,
  onSave,
}) => {
  const [row, setRow] = useState<RowState>(() => initialRowState(vendor));
  const isImplemented = isAdapterImplemented(vendor.code);

  const handleSave = async () => {
    if (!isImplemented) return;
    const times = row.timesText
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (times.some((t) => !TIME_FORMAT.test(t))) {
      setRow((prev) => ({ ...prev, status: { kind: 'error', message: 'Invalid time format' } }));
      return;
    }

    setRow((prev) => ({ ...prev, saving: true, status: null }));
    const result = await onSave(vendor.code, {
      enabled: row.enabled,
      times,
      timezone: row.timezone,
    });
    setRow((prev) => ({
      ...prev,
      saving: false,
      status: result.success
        ? { kind: 'success', message: 'Saved' }
        : { kind: 'error', message: result.error || 'Failed to save' },
    }));
  };

  return (
    <TableRow hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
      <TableCell sx={{ minWidth: 200 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <VendorIcon vendorCode={vendor.code} name={vendor.name} size={18} hideLabel />
          <Box>
            <Typography sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.9rem' }}>
              {vendor.name}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {vendor.code}
            </Typography>
            {!isImplemented && (
              <Box sx={{ mt: 0.5 }}>
                <Chip
                  label="Adapter not implemented"
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.65rem', height: 18 }}
                />
              </Box>
            )}
          </Box>
        </Box>
      </TableCell>

      <TableCell>
        <Tooltip title={!isImplemented ? 'Adapter not implemented yet' : ''}>
          <span>
            <Switch
              disabled={!isImplemented}
              checked={isImplemented && row.enabled}
              onChange={(e) => setRow((prev) => ({ ...prev, enabled: e.target.checked }))}
              inputProps={{ 'aria-label': `Enable schedule for ${vendor.name}` }}
            />
          </span>
        </Tooltip>
      </TableCell>

      <TableCell sx={{ minWidth: 220 }}>
        <TextField
          disabled={!isImplemented}
          label={`Schedule times for ${vendor.name}`}
          value={row.timesText}
          onChange={(e) => setRow((prev) => ({ ...prev, timesText: e.target.value }))}
          size="small"
          fullWidth
          placeholder="08:00, 12:30, 18:30"
        />
      </TableCell>

      <TableCell sx={{ minWidth: 160 }}>
        <TextField
          disabled={!isImplemented}
          label={`Timezone for ${vendor.name}`}
          value={row.timezone}
          onChange={(e) => setRow((prev) => ({ ...prev, timezone: e.target.value }))}
          size="small"
          fullWidth
        />
      </TableCell>

      <TableCell sx={{ minWidth: 140 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5 }}>
          <Button
            variant="contained"
            size="small"
            disabled={!isImplemented || row.saving}
            onClick={handleSave}
            sx={{ fontWeight: 600 }}
          >
            {`Save ${vendor.name}`}
          </Button>
          {row.status && (
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                color: row.status.kind === 'success' ? 'success.main' : 'error.main',
              }}
            >
              {row.status.message}
            </Typography>
          )}
        </Box>
      </TableCell>
    </TableRow>
  );
};

export const ScheduleSettings: React.FC<ScheduleSettingsProps> = ({
  vendors,
  onSave,
  hasVaultError = false,
  initialExpanded = false,
}) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <VaultSecretsGuideBanner hasVaultError={hasVaultError} initialExpanded={initialExpanded} />

      <TableContainer component={Paper} sx={{ bgcolor: 'background.paper', borderRadius: 2.5 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Vendor</TableCell>
              <TableCell>Enabled</TableCell>
              <TableCell>Times</TableCell>
              <TableCell>Timezone</TableCell>
              <TableCell>Save</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {vendors.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
                  No vendor records loaded.
                </TableCell>
              </TableRow>
            )}
            {vendors.map((vendor) => (
              <ScheduleRow key={vendor.id} vendor={vendor} onSave={onSave} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
