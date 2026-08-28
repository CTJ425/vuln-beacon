import React from 'react';
import { Box, Typography, Stack, Button } from '@mui/material';
import { RefreshCw } from 'lucide-react';
import { Vendor, VendorSyncLog } from '@/types';
import { SyncLogTable } from '@/components/sync/SyncLogTable';
import { FeedSourceTable } from '@/components/sync/FeedSourceTable';
import { ScheduleSettings } from '@/components/sync/ScheduleSettings';

interface SyncMonitorPageProps {
  vendors: Vendor[];
  logs: VendorSyncLog[];
  onManualSync: () => void;
  isSyncing: boolean;
  onSaveSchedule?: (
    vendorCode: string,
    schedule: { enabled: boolean; times: string[]; timezone: string }
  ) => Promise<{ success: boolean; error?: string }>;
}

export const SyncMonitorPage: React.FC<SyncMonitorPageProps> = ({
  vendors,
  logs,
  onManualSync,
  isSyncing,
  onSaveSchedule,
}) => {
  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em' }}>
            Feed Synchronization Monitor
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Live feed sources, connection status, and execution history.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />}
          onClick={onManualSync}
          disabled={isSyncing}
          sx={{
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            fontWeight: 700,
            '&:hover': { bgcolor: 'primary.light' },
          }}
        >
          {isSyncing ? 'Triggering Ingestion...' : 'Trigger Sync Run'}
        </Button>
      </Box>

      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', mb: 1.5 }}>
          Feed Sources
        </Typography>
        <FeedSourceTable vendors={vendors} logs={logs} />
      </Box>

      {onSaveSchedule && (
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', mb: 1.5 }}>
            Schedule
          </Typography>
          <ScheduleSettings vendors={vendors} onSave={onSaveSchedule} />
        </Box>
      )}

      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', mb: 1.5 }}>
          Execution History
        </Typography>
        <SyncLogTable logs={logs} />
      </Box>
    </Stack>
  );
};
