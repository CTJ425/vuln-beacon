import React, { useState } from 'react';
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
} from '@mui/material';
import { Vendor } from '@/types';

interface ScheduleSettingsProps {
  vendors: Vendor[];
  onSave: (
    vendorCode: string,
    schedule: { enabled: boolean; times: string[]; timezone: string }
  ) => Promise<{ success: boolean; error?: string }>;
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

const ScheduleRow: React.FC<{ vendor: Vendor; onSave: ScheduleSettingsProps['onSave'] }> = ({
  vendor,
  onSave,
}) => {
  const [row, setRow] = useState<RowState>(() => initialRowState(vendor));

  const handleSave = async () => {
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
    <TableRow hover>
      <TableCell>
        <Typography sx={{ fontWeight: 700, color: 'text.primary' }}>{vendor.name}</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {vendor.code}
        </Typography>
      </TableCell>

      <TableCell>
        <Switch
          checked={row.enabled}
          onChange={(e) => setRow((prev) => ({ ...prev, enabled: e.target.checked }))}
          inputProps={{ 'aria-label': `Enable schedule for ${vendor.name}` }}
        />
      </TableCell>

      <TableCell>
        <TextField
          label={`Schedule times for ${vendor.name}`}
          value={row.timesText}
          onChange={(e) => setRow((prev) => ({ ...prev, timesText: e.target.value }))}
          size="small"
          fullWidth
        />
      </TableCell>

      <TableCell>
        <TextField
          label={`Timezone for ${vendor.name}`}
          value={row.timezone}
          onChange={(e) => setRow((prev) => ({ ...prev, timezone: e.target.value }))}
          size="small"
          fullWidth
        />
      </TableCell>

      <TableCell>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5 }}>
          <Button variant="contained" size="small" disabled={row.saving} onClick={handleSave}>
            {`Save ${vendor.name}`}
          </Button>
          {row.status && (
            <Typography
              variant="caption"
              sx={{ color: row.status.kind === 'success' ? 'success.main' : 'error.main' }}
            >
              {row.status.message}
            </Typography>
          )}
        </Box>
      </TableCell>
    </TableRow>
  );
};

export const ScheduleSettings: React.FC<ScheduleSettingsProps> = ({ vendors, onSave }) => {
  return (
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
              <TableCell colSpan={5} sx={{ color: 'text.secondary', textAlign: 'center' }}>
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
  );
};
