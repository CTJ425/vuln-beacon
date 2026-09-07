import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Grid,
  Alert,
  Paper,
  IconButton,
} from '@mui/material';
import { Copy, Check, X, Terminal, Clock, FileText } from 'lucide-react';
import { VendorSyncLog } from '@/types';
import { VendorIcon } from '@/components/common/VendorIcon';
import { formatDate } from '@/utils/date';

interface LogDetailModalProps {
  open: boolean;
  log: VendorSyncLog | null;
  onClose: () => void;
}

export const LogDetailModal: React.FC<LogDetailModalProps> = ({ open, log, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!log) return null;

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(log, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const statusColor =
    log.status === 'SUCCESS'
      ? { bg: 'rgba(16, 185, 129, 0.15)', text: '#059669' }
      : log.status === 'FAILED'
      ? { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' }
      : { bg: 'rgba(245, 158, 11, 0.15)', text: '#d97706' };

  const detailsObj = log.details || {};
  const errorStack = (detailsObj as any).error_stack || (detailsObj as any).stack;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'background.paper',
          backgroundImage: 'none',
          borderRadius: 3,
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'divider',
          pb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ p: 1, bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: 1.5 }}>
            <Terminal size={18} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.01em' }}>
              Log Observability & Diagnostics
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1 }}>
              Log ID: {log.id} • {formatDate(log.started_at, 'yyyy-MM-dd HH:mm:ss')}
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
          <X size={18} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ py: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* Top Status & Metrics */}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={3}>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                Vendor & Status
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75 }}>
                <VendorIcon vendorCode={log.vendor_code || ''} size={18} />
                <Chip
                  size="small"
                  label={log.status}
                  sx={{
                    bgcolor: statusColor.bg,
                    color: statusColor.text,
                    fontWeight: 700,
                  }}
                />
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={6} sm={3}>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                Items Discovered
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, mt: 0.5 }}>
                {log.items_fetched}
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={6} sm={3}>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                New CVEs
              </Typography>
              <Typography
                variant="h6"
                sx={{ fontWeight: 800, mt: 0.5, color: log.new_items_count > 0 ? 'primary.main' : 'text.primary' }}
              >
                {log.new_items_count}
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={12} sm={3}>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                Duration
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
                <Clock size={16} color="gray" />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  {log.duration_ms ? `${log.duration_ms}ms` : '-'}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>

        {/* Error Alert & Stack Trace (if any) */}
        {log.error_message && (
          <Alert severity="error" sx={{ borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
              Failure Reason:
            </Typography>
            <Typography variant="body2">{log.error_message}</Typography>
            {errorStack && (
              <Box
                component="pre"
                sx={{
                  mt: 1.5,
                  p: 1.5,
                  bgcolor: 'rgba(0,0,0,0.5)',
                  color: '#f87171',
                  borderRadius: 1.5,
                  fontSize: '0.75rem',
                  overflowX: 'auto',
                  fontFamily: 'monospace',
                }}
              >
                {errorStack}
              </Box>
            )}
          </Alert>
        )}

        {/* Structured Observability Payload Field */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
              <FileText size={16} /> Structured Observability Field (`details`)
            </Typography>
            <Button
              size="small"
              variant="outlined"
              startIcon={copied ? <Check size={14} /> : <Copy size={14} />}
              onClick={handleCopyJson}
            >
              {copied ? 'Copied' : 'Copy Log JSON'}
            </Button>
          </Box>

          <Paper
            variant="outlined"
            component="pre"
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: (theme) => (theme.palette.mode === 'dark' ? '#0d1117' : '#f6f8fa'),
              color: 'text.primary',
              fontSize: '0.8125rem',
              maxHeight: 260,
              overflowY: 'auto',
              fontFamily: 'monospace',
              m: 0,
            }}
          >
            {Object.keys(detailsObj).length > 0
              ? JSON.stringify(detailsObj, null, 2)
              : JSON.stringify({ note: 'No extra details recorded for this run.' }, null, 2)}
          </Paper>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button onClick={onClose} variant="contained" sx={{ fontWeight: 700 }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
