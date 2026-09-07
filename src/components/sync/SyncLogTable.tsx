import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
} from '@mui/material';
import { Search } from 'lucide-react';
import { VendorSyncLog } from '@/types';
import { VendorIcon } from '@/components/common/VendorIcon';
import { formatDate } from '@/utils/date';
import { LogDetailModal } from '@/components/sync/LogDetailModal';

interface SyncLogTableProps {
  logs: VendorSyncLog[];
}

export const SyncLogTable: React.FC<SyncLogTableProps> = ({ logs }) => {
  const [selectedLog, setSelectedLog] = useState<VendorSyncLog | null>(null);

  return (
    <>
      <TableContainer component={Paper} sx={{ bgcolor: 'background.paper', borderRadius: 2.5 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Vendor</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Items Discovered</TableCell>
              <TableCell>New CVEs</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Execution Time</TableCell>
              <TableCell>Error Info</TableCell>
              <TableCell align="center">Log Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id} hover>
                <TableCell>
                  <VendorIcon vendorCode={log.vendor_code || ''} size={16} />
                </TableCell>

                <TableCell>
                  <Chip
                    size="small"
                    label={log.status}
                    sx={{
                      bgcolor:
                        log.status === 'SUCCESS'
                          ? 'rgba(16, 185, 129, 0.15)'
                          : log.status === 'FAILED'
                          ? 'rgba(239, 68, 68, 0.15)'
                          : 'rgba(245, 158, 11, 0.15)',
                      color:
                        log.status === 'SUCCESS'
                          ? '#059669'
                          : log.status === 'FAILED'
                          ? '#ef4444'
                          : '#d97706',
                      fontWeight: 700,
                    }}
                  />
                </TableCell>

                <TableCell sx={{ color: 'text.primary' }}>{log.items_fetched}</TableCell>
                <TableCell
                  sx={{
                    fontWeight: 700,
                    color: log.new_items_count > 0 ? 'primary.main' : 'text.secondary',
                  }}
                >
                  {log.new_items_count}
                </TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>
                  {log.duration_ms ? `${log.duration_ms}ms` : '-'}
                </TableCell>
                <TableCell sx={{ color: 'text.secondary', fontSize: '0.8125rem' }}>
                  {formatDate(log.started_at, 'yyyy-MM-dd HH:mm:ss')}
                </TableCell>
                <TableCell sx={{ color: 'error.main', fontSize: '0.8125rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {log.error_message || '-'}
                </TableCell>
                <TableCell align="center">
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Search size={13} />}
                    onClick={() => setSelectedLog(log)}
                    sx={{
                      textTransform: 'none',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      py: 0.25,
                      px: 1,
                      borderRadius: 1.5,
                    }}
                  >
                    Inspect
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <LogDetailModal
        open={Boolean(selectedLog)}
        log={selectedLog}
        onClose={() => setSelectedLog(null)}
      />
    </>
  );
};
