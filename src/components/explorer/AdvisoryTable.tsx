import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Typography,
  Chip,
  Tooltip,
  IconButton,
} from '@mui/material';
import { ChevronRight } from 'lucide-react';

import { AdvisoryRowItem } from '@/services/advisoryService';
import { SeverityBadge } from '@/components/common/SeverityBadge';
import { formatDate } from '@/utils/date';

interface AdvisoryTableProps {
  items: AdvisoryRowItem[];
  onSelectRow: (item: AdvisoryRowItem) => void;
}

export const AdvisoryTable: React.FC<AdvisoryTableProps> = ({ items, onSelectRow }) => {
  if (items.length === 0) {
    return (
      <Paper sx={{ p: 6, textAlign: 'center', bgcolor: 'background.paper', borderRadius: 2, border: 1, borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 700 }}>
          無符合條件的資安資料
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
          請嘗試清除搜尋關鍵字或放寬篩選條件。
        </Typography>
      </Paper>
    );
  }

  return (
    <TableContainer component={Paper} sx={{ bgcolor: 'background.paper', borderRadius: 2, border: 1, borderColor: 'divider' }}>
      <Table sx={{ minWidth: 700 }}>
        <TableHead>
          <TableRow sx={{ bgcolor: 'action.hover' }}>
            <TableCell sx={{ fontWeight: 800, color: 'text.primary', width: '18%' }}>Red Hat Errata (RHSA)</TableCell>
            <TableCell sx={{ fontWeight: 800, color: 'text.primary', width: '18%' }}>修補的 CVE (Fixed CVEs)</TableCell>
            <TableCell sx={{ fontWeight: 800, color: 'text.primary', width: '12%' }}>嚴重等級</TableCell>
            <TableCell sx={{ fontWeight: 800, color: 'text.primary', width: '24%' }}>公告主旨 (Synopsis)</TableCell>
            <TableCell sx={{ fontWeight: 800, color: 'text.primary', width: '16%' }}>受影響產品</TableCell>
            <TableCell sx={{ fontWeight: 800, color: 'text.primary', width: '12%' }}>發布日期</TableCell>
            <TableCell sx={{ width: 40 }} />
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => {
            const cveIds = item.cves.map((c) => c.cve_id);
            const visibleCveIds = cveIds.slice(0, 2);
            const extraCveCount = cveIds.length - visibleCveIds.length;

            return (
              <TableRow
                key={item.id}
                hover
                onClick={() => onSelectRow(item)}
                sx={{
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
              >
                {/* RHSA ID */}
                <TableCell sx={{ fontWeight: 800, fontFamily: 'JetBrains Mono', color: 'primary.main' }}>
                  {item.advisory_id}
                </TableCell>

                {/* Fixed CVEs */}
                <TableCell sx={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: 'text.primary' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap' }}>
                    {visibleCveIds.map((cveId) => (
                      <span key={cveId}>{cveId}</span>
                    ))}
                    {extraCveCount > 0 && (
                      <Chip
                        label={`+${extraCveCount}`}
                        size="small"
                        sx={{ height: 18, fontSize: '0.675rem', fontWeight: 700 }}
                      />
                    )}
                  </Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    共 {cveIds.length} 個 CVE
                  </Typography>
                </TableCell>

                {/* Severity */}
                <TableCell>
                  <SeverityBadge severity={item.severity} />
                </TableCell>

                {/* Synopsis */}
                <TableCell sx={{ maxWidth: 280 }}>
                  <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500 }} noWrap>
                    {item.title}
                  </Typography>
                  {item.product_impacts.length > 0 && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                      共涉及 {item.product_impacts.length} 個元件
                    </Typography>
                  )}
                </TableCell>

                {/* Affected Products */}
                <TableCell sx={{ maxWidth: 280 }}>
                  {item.affected_products && item.affected_products.length > 0 ? (
                    <Tooltip title={item.affected_products.join(' | ')}>
                      <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }} noWrap>
                        {item.affected_products[0]}
                        {item.affected_products.length > 1 && (
                          <span style={{ color: '#94a3b8', fontWeight: 400, marginLeft: 4 }}>
                            +{item.affected_products.length - 1} 產品
                          </span>
                        )}
                      </Typography>
                    </Tooltip>
                  ) : (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>-</Typography>
                  )}
                </TableCell>

                {/* Published Date */}
                <TableCell sx={{ color: 'text.secondary', fontSize: '0.8125rem' }}>
                  {formatDate(item.published_at, 'yyyy-MM-dd')}
                </TableCell>

                {/* Action Arrow */}
                <TableCell align="right">
                  <IconButton size="small" sx={{ color: 'text.secondary' }}>
                    <ChevronRight size={18} />
                  </IconButton>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
