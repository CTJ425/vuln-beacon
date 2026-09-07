import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  InputAdornment,
} from '@mui/material';
import { Search, RefreshCw, Download, FileText } from 'lucide-react';
import { VendorSyncLog } from '@/types';
import { VendorIcon } from '@/components/common/VendorIcon';
import { formatDate } from '@/utils/date';
import { LogDetailModal } from '@/components/sync/LogDetailModal';

interface AdminLogQueryProps {
  logs: VendorSyncLog[];
  onRefreshLogs?: () => void;
  isRefreshing?: boolean;
}

export const AdminLogQuery: React.FC<AdminLogQueryProps> = ({
  logs,
  onRefreshLogs,
  isRefreshing = false,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [vendorFilter, setVendorFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<VendorSyncLog | null>(null);

  // Collect unique vendor codes
  const uniqueVendors = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((log) => {
      if (log.vendor_code) set.add(log.vendor_code);
    });
    return Array.from(set).sort();
  }, [logs]);

  // Filter logs based on criteria
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (statusFilter !== 'ALL' && log.status !== statusFilter) {
        return false;
      }
      if (vendorFilter !== 'ALL' && log.vendor_code !== vendorFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesVendor = log.vendor_code?.toLowerCase().includes(query) ?? false;
        const matchesError = log.error_message?.toLowerCase().includes(query) ?? false;
        const matchesDetails = JSON.stringify(log.details || {}).toLowerCase().includes(query);
        const matchesId = log.id.toLowerCase().includes(query);
        if (!matchesVendor && !matchesError && !matchesDetails && !matchesId) {
          return false;
        }
      }
      return true;
    });
  }, [logs, statusFilter, vendorFilter, searchQuery]);

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `vulnbeacon-sync-logs-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.01em' }}>
            Log 資料查詢與排錯
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            查詢各廠商同步執行歷程、深入檢查日誌觀察欄位（Details）、除錯錯誤堆疊與效能耗時。
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5 }}>
          {onRefreshLogs && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />}
              onClick={onRefreshLogs}
              disabled={isRefreshing}
            >
              重新整理日誌
            </Button>
          )}
          <Button
            variant="outlined"
            size="small"
            startIcon={<Download size={15} />}
            onClick={handleExportJson}
            disabled={filteredLogs.length === 0}
          >
            匯出日誌 JSON
          </Button>
        </Box>
      </Box>

      {/* Filter Controls Bar */}
      <Paper sx={{ p: 2, borderRadius: 2.5, bgcolor: 'background.paper' }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="status-filter-label">狀態篩選</InputLabel>
            <Select
              labelId="status-filter-label"
              id="status-filter-select"
              label="狀態篩選"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              inputProps={{ 'aria-label': '狀態篩選' }}
            >
              <MenuItem value="ALL">全部狀態 (All)</MenuItem>
              <MenuItem value="SUCCESS">成功 (SUCCESS)</MenuItem>
              <MenuItem value="FAILED">失敗 (FAILED)</MenuItem>
              <MenuItem value="PARTIAL_SUCCESS">部分成功 (PARTIAL)</MenuItem>
              <MenuItem value="RUNNING">執行中 (RUNNING)</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="vendor-filter-label">廠商篩選</InputLabel>
            <Select
              labelId="vendor-filter-label"
              id="vendor-filter-select"
              label="廠商篩選"
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              inputProps={{ 'aria-label': '廠商篩選' }}
            >
              <MenuItem value="ALL">全部廠商 (All)</MenuItem>
              {uniqueVendors.map((code) => (
                <MenuItem key={code} value={code}>
                  {code.toUpperCase()}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small"
            placeholder="搜尋錯誤訊息、廠商或 details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ flexGrow: 1, minWidth: 240 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} />
                </InputAdornment>
              ),
            }}
          />

          <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600, ml: 'auto' }}>
            顯示 {filteredLogs.length} 筆日誌 (共 {logs.length} 筆)
          </Typography>
        </Box>
      </Paper>

      {/* Logs Table */}
      <TableContainer component={Paper} sx={{ bgcolor: 'background.paper', borderRadius: 2.5 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>廠商 (Vendor)</TableCell>
              <TableCell>狀態 (Status)</TableCell>
              <TableCell>已擷取公告 (Advisories)</TableCell>
              <TableCell>新增 CVE (New CVEs)</TableCell>
              <TableCell>執行耗時 (Duration)</TableCell>
              <TableCell>啟動時間 (Started At)</TableCell>
              <TableCell>錯誤訊息 (Error Info)</TableCell>
              <TableCell align="center">觀測欄位 (Details)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                  未找到符合條件的日誌記錄 (No matching logs found)
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => (
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
                  <TableCell
                    sx={{
                      color: 'error.main',
                      fontSize: '0.8125rem',
                      maxWidth: 220,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {log.error_message || '-'}
                  </TableCell>
                  <TableCell align="center">
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<FileText size={13} />}
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
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <LogDetailModal
        open={Boolean(selectedLog)}
        log={selectedLog}
        onClose={() => setSelectedLog(null)}
      />
    </Stack>
  );
};
