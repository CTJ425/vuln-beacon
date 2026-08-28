import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Box,
  Typography,
} from '@mui/material';
import { Vendor, VendorSyncLog } from '@/types';
import { getAdapterByCode } from '@/adapters';
import { SYNCED_VENDOR_CODES } from '@/services/syncService';
import { formatDate } from '@/utils/date';

interface FeedSourceTableProps {
  vendors: Vendor[];
  logs: VendorSyncLog[];
}

/** Newest log entry for a vendor code, or undefined when it has never synced. */
function newestLogFor(vendorCode: string, logs: VendorSyncLog[]): VendorSyncLog | undefined {
  return logs
    .filter((log) => log.vendor_code === vendorCode)
    .reduce<VendorSyncLog | undefined>((newest, log) => {
      if (!newest || new Date(log.started_at) > new Date(newest.started_at)) return log;
      return newest;
    }, undefined);
}

type ChipTone = 'success' | 'warning' | 'default';

function integrationChip(vendorCode: string): { label: string; color: ChipTone } {
  const adapter = getAdapterByCode(vendorCode);
  if (!adapter) return { label: 'Not implemented', color: 'default' };
  const isSynced = (SYNCED_VENDOR_CODES as readonly string[]).includes(vendorCode);
  return isSynced ? { label: 'Connected', color: 'success' } : { label: 'Adapter idle', color: 'warning' };
}

export const FeedSourceTable: React.FC<FeedSourceTableProps> = ({ vendors, logs }) => {
  return (
    <TableContainer component={Paper} sx={{ bgcolor: 'background.paper', borderRadius: 2.5 }}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Vendor</TableCell>
            <TableCell>Integration</TableCell>
            <TableCell>API endpoint</TableCell>
            <TableCell>Last sync</TableCell>
            <TableCell>Detail</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {vendors.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} sx={{ color: 'text.secondary', textAlign: 'center' }}>
                No vendor records loaded.
              </TableCell>
            </TableRow>
          )}
          {vendors.map((vendor) => {
            const adapter = getAdapterByCode(vendor.code);
            const chip = integrationChip(vendor.code);
            const log = newestLogFor(vendor.code, logs);

            return (
              <TableRow key={vendor.id} hover>
                <TableCell>
                  <Typography sx={{ fontWeight: 700, color: 'text.primary' }}>{vendor.name}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {vendor.code}
                  </Typography>
                </TableCell>

                <TableCell>
                  <Chip size="small" label={chip.label} color={chip.color} sx={{ fontWeight: 700 }} />
                </TableCell>

                <TableCell>
                  {adapter ? (
                    adapter.endpoints.map((endpoint) => (
                      <Box key={endpoint.label} sx={{ mb: 0.5 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                          {endpoint.label}
                        </Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {endpoint.url}
                        </Typography>
                      </Box>
                    ))
                  ) : (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      No adapter implemented
                    </Typography>
                  )}
                </TableCell>

                <TableCell>
                  {log ? (
                    <>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                        {log.status}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {formatDate(log.started_at, 'yyyy-MM-dd HH:mm:ss')}
                      </Typography>
                    </>
                  ) : (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Never
                    </Typography>
                  )}
                </TableCell>

                <TableCell sx={{ color: 'error.main', fontSize: '0.8125rem' }}>
                  {log?.error_message || '—'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
