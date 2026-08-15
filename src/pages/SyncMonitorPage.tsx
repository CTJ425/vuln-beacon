import React from 'react';
import { Box, Typography, Stack, Button } from '@mui/material';
import { RefreshCw } from 'lucide-react';
import { VendorSyncLog } from '@/types';
import { SyncLogTable } from '@/components/sync/SyncLogTable';

interface SyncMonitorPageProps {
  logs: VendorSyncLog[];
  onManualSync: () => void;
  isSyncing: boolean;
}

export const SyncMonitorPage: React.FC<SyncMonitorPageProps> = ({ logs, onManualSync, isSyncing }) => {
  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em' }}>
            Feed Synchronization Monitor
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Real-time execution status, disclosure counts, and duration history for all 8 vendors.
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

      <SyncLogTable logs={logs} />
    </Stack>
  );
};
