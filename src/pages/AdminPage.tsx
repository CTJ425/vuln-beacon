import React, { useState } from 'react';
import {
  Box,
  Typography,
  Stack,
  Tabs,
  Tab,
  Button,
  Paper,
  Chip,
} from '@mui/material';
import {
  Bell,
  RefreshCw,
  Terminal,
  Activity,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { WebhookConfig, VendorSyncLog, Vendor } from '@/types';
import { WebhookConfigPanel } from '@/components/settings/WebhookConfigPanel';
import { AdminLogQuery } from '@/components/admin/AdminLogQuery';
import { SystemHealthMonitor } from '@/components/admin/SystemHealthMonitor';
import { SyncMonitorPage } from '@/pages/SyncMonitorPage';

interface AdminPageProps {
  userEmail?: string;
  webhooks: WebhookConfig[];
  onAddWebhook: (webhook: Omit<WebhookConfig, 'id' | 'created_at'>) => void;
  onDeleteWebhook: (id: string) => void;
  onTestWebhook: (webhook: WebhookConfig) => Promise<boolean>;
  logs: VendorSyncLog[];
  onRefreshLogs?: () => void;
  isRefreshingLogs?: boolean;
  onSignOut: () => void;
  vendors?: Vendor[];
  onManualSync?: () => void;
  isSyncing?: boolean;
  onSaveSchedule?: (
    vendorCode: string,
    schedule: { enabled: boolean; times: string[]; timezone: string }
  ) => Promise<{ success: boolean; error?: string }>;
  activeTab?: number;
  onTabChange?: (tab: number) => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({
  userEmail,
  webhooks,
  onAddWebhook,
  onDeleteWebhook,
  onTestWebhook,
  logs,
  onRefreshLogs,
  isRefreshingLogs = false,
  onSignOut,
  vendors = [],
  onManualSync = () => {},
  isSyncing = false,
  onSaveSchedule,
  activeTab: controlledTab,
  onTabChange,
}) => {
  const [internalTab, setInternalTab] = useState<number>(0);
  const activeTab = controlledTab !== undefined ? controlledTab : internalTab;

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    if (onTabChange) {
      onTabChange(newValue);
    }
    setInternalTab(newValue);
  };

  return (
    <Stack spacing={3}>
      {/* Top Banner & Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
          pb: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em' }}>
              後台管理系統
            </Typography>
            <Chip
              size="small"
              icon={<ShieldCheck size={14} />}
              label="Supabase Authenticated"
              color="primary"
              variant="outlined"
              sx={{ fontWeight: 600 }}
            />
          </Box>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            管理 Webhook 告警、檢索與排錯日誌（含觀察欄位）、即時監控 API 與 Supabase 運作狀態。
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {userEmail && (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              登入身分: <strong style={{ color: 'var(--mui-palette-text-primary)' }}>{userEmail}</strong>
            </Typography>
          )}
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<LogOut size={16} />}
            onClick={onSignOut}
            sx={{ fontWeight: 600 }}
          >
            登出
          </Button>
        </Box>
      </Box>

      {/* Tabs Navigation */}
      <Paper sx={{ borderRadius: 2.5, bgcolor: 'background.paper' }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          sx={{
            px: 2,
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': {
              fontWeight: 700,
              fontSize: '0.875rem',
              py: 2,
              minHeight: 52,
            },
          }}
        >
          <Tab
            icon={<Bell size={18} />}
            iconPosition="start"
            label="Webhook 設定"
            id="admin-tab-0"
            aria-controls="admin-tabpanel-0"
          />
          <Tab
            icon={<RefreshCw size={18} />}
            iconPosition="start"
            label="同步監控"
            id="admin-tab-1"
            aria-controls="admin-tabpanel-1"
          />
          <Tab
            icon={<Terminal size={18} />}
            iconPosition="start"
            label="Log 資料查詢"
            id="admin-tab-2"
            aria-controls="admin-tabpanel-2"
          />
          <Tab
            icon={<Activity size={18} />}
            iconPosition="start"
            label="API 與 Supabase 運作狀態"
            id="admin-tab-3"
            aria-controls="admin-tabpanel-3"
          />
        </Tabs>
      </Paper>

      {/* Tab Panels */}
      <Box sx={{ mt: 1 }}>
        {activeTab === 0 && (
          <Box role="tabpanel" id="admin-tabpanel-0" aria-labelledby="admin-tab-0">
            <WebhookConfigPanel
              webhooks={webhooks}
              onAddWebhook={onAddWebhook}
              onDeleteWebhook={onDeleteWebhook}
              onTestWebhook={onTestWebhook}
            />
          </Box>
        )}

        {activeTab === 1 && (
          <Box role="tabpanel" id="admin-tabpanel-1" aria-labelledby="admin-tab-1">
            <SyncMonitorPage
              vendors={vendors}
              logs={logs}
              onManualSync={onManualSync}
              isSyncing={isSyncing}
              onSaveSchedule={onSaveSchedule}
            />
          </Box>
        )}

        {activeTab === 2 && (
          <Box role="tabpanel" id="admin-tabpanel-2" aria-labelledby="admin-tab-2">
            <AdminLogQuery
              logs={logs}
              onRefreshLogs={onRefreshLogs}
              isRefreshing={isRefreshingLogs}
            />
          </Box>
        )}

        {activeTab === 3 && (
          <Box role="tabpanel" id="admin-tabpanel-3" aria-labelledby="admin-tab-3">
            <SystemHealthMonitor />
          </Box>
        )}
      </Box>
    </Stack>
  );
};
