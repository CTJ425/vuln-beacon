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
import { ChevronRight, Flame } from 'lucide-react';

import { CveRecord, ProductImpactItem, AdvisoryDetailData } from '@/types';
import { SeverityBadge } from '@/components/common/SeverityBadge';
import { formatDate } from '@/utils/date';

export interface CveTableRowItem extends CveRecord {
  vendor_code: string;
  advisory_id: string;
  advisory_title: string;
  advisory_url?: string;
  all_advisories?: string[];
  affected_products: string[];
  product_impacts: ProductImpactItem[];
  fixed_versions?: string[];
  solution?: string;
  advisory_detail?: AdvisoryDetailData;
}

interface CveTableProps {
  items: CveTableRowItem[];
  onSelectRow: (item: CveTableRowItem) => void;
  viewMode?: 'cve' | 'advisory';
}

export const CveTable: React.FC<CveTableProps> = ({ items, onSelectRow, viewMode = 'cve' }) => {
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
            {viewMode === 'advisory' ? (
              <>
                <TableCell sx={{ fontWeight: 800, color: 'text.primary', width: '22%' }}>Red Hat Errata (RHSA)</TableCell>
                <TableCell sx={{ fontWeight: 800, color: 'text.primary', width: '18%' }}>對應 CVE 弱點 (Target CVEs)</TableCell>
                <TableCell sx={{ fontWeight: 800, color: 'text.primary', width: '12%' }}>嚴重等級</TableCell>
                <TableCell sx={{ fontWeight: 800, color: 'text.primary', width: '28%' }}>公告主旨 (Synopsis)</TableCell>
                <TableCell sx={{ fontWeight: 800, color: 'text.primary', width: '12%' }}>發布日期</TableCell>
                <TableCell sx={{ width: 40 }} />
              </>
            ) : (
              <>
                <TableCell sx={{ fontWeight: 800, color: 'text.primary', width: '22%' }}>CVE 漏洞編號</TableCell>
                <TableCell sx={{ fontWeight: 800, color: 'text.primary', width: '20%' }}>關聯官方 Errata (RHSA)</TableCell>
                <TableCell sx={{ fontWeight: 800, color: 'text.primary', width: '12%' }}>嚴重等級</TableCell>
                <TableCell sx={{ fontWeight: 800, color: 'text.primary', width: '26%' }}>受影響產品與元件</TableCell>
                <TableCell sx={{ fontWeight: 800, color: 'text.primary', width: '12%' }}>發布日期</TableCell>
                <TableCell sx={{ width: 40 }} />
              </>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => {
            const realAdvList = (item.all_advisories && item.all_advisories.length > 0)
              ? item.all_advisories.filter((a) => /^RH[SBE]A-\d{4}:\d+$/i.test(a))
              : (/^RH[SBE]A-\d{4}:\d+$/i.test(item.advisory_id) ? [item.advisory_id] : []);

            const primaryAdv = realAdvList.length > 0 ? realAdvList[0] : null;

            const totalImpacts = item.product_impacts ? item.product_impacts.length : 0;
            const affectedCount = item.product_impacts
              ? item.product_impacts.filter((p) => p.state.toLowerCase() === 'affected').length
              : 0;

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
                {viewMode === 'advisory' ? (
                  <>
                    {/* RHSA ID */}
                    <TableCell sx={{ fontWeight: 800, fontFamily: 'JetBrains Mono', color: 'primary.main' }}>
                      {primaryAdv ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <span>{primaryAdv}</span>
                          {realAdvList.length > 1 && (
                            <Chip
                              label={`+${realAdvList.length - 1}`}
                              size="small"
                              sx={{ height: 18, fontSize: '0.675rem', fontWeight: 700 }}
                            />
                          )}
                        </Box>
                      ) : (
                        <Chip
                          label="Errata 待發布"
                          size="small"
                          sx={{ fontSize: '0.725rem', fontWeight: 600, bgcolor: 'action.hover', color: 'text.secondary' }}
                        />
                      )}
                    </TableCell>

                    {/* Target CVE */}
                    <TableCell sx={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: 'text.primary' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                        <span>{item.cve_id}</span>
                        {item.is_known_exploited && (
                          <Chip
                            size="small"
                            icon={<Flame size={12} color="#ef4444" />}
                            label="KEV"
                            sx={{ bgcolor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 700, height: 18, fontSize: '0.65rem' }}
                          />
                        )}
                      </Box>
                    </TableCell>

                    {/* Severity */}
                    <TableCell>
                      <SeverityBadge severity={item.severity} score={item.cvss_v3_score} />
                    </TableCell>

                    {/* Synopsis */}
                    <TableCell sx={{ maxWidth: 280 }}>
                      <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500 }} noWrap>
                        {item.advisory_title || item.description}
                      </Typography>
                      {totalImpacts > 0 && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                          共涉及 {totalImpacts} 個元件 ({affectedCount} 項受影響)
                        </Typography>
                      )}
                    </TableCell>

                    {/* Date */}
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.8125rem' }}>
                      {formatDate(item.published_date, 'yyyy-MM-dd')}
                    </TableCell>
                  </>
                ) : (
                  <>
                    {/* CVE ID */}
                    <TableCell sx={{ fontWeight: 800, fontFamily: 'JetBrains Mono', color: 'text.primary' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span>{item.cve_id}</span>
                        {item.is_known_exploited && (
                          <Tooltip title="CISA Known Exploited Vulnerability (KEV)">
                            <Chip
                              size="small"
                              icon={<Flame size={14} color="#ef4444" />}
                              label="KEV"
                              sx={{
                                bgcolor: 'rgba(239, 68, 68, 0.15)',
                                color: '#ef4444',
                                fontWeight: 700,
                                height: 20,
                              }}
                            />
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>

                    {/* Advisory */}
                    <TableCell>
                      {primaryAdv ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main', fontFamily: 'JetBrains Mono' }}>
                            {primaryAdv}
                          </Typography>
                          {realAdvList.length > 1 && (
                            <Chip
                              label={`+${realAdvList.length - 1}`}
                              size="small"
                              sx={{ height: 18, fontSize: '0.675rem', fontWeight: 700 }}
                            />
                          )}
                        </Box>
                      ) : (
                        <Chip
                          label="Errata 待發布"
                          size="small"
                          sx={{
                            fontSize: '0.725rem',
                            fontWeight: 600,
                            bgcolor: 'action.hover',
                            color: 'text.secondary',
                          }}
                        />
                      )}
                    </TableCell>

                    {/* Severity */}
                    <TableCell>
                      <SeverityBadge severity={item.severity} score={item.cvss_v3_score} />
                    </TableCell>

                    {/* Products / Components */}
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

                      {totalImpacts > 0 && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                          共 {totalImpacts} 個元件 ({affectedCount} 項受影響)
                        </Typography>
                      )}
                    </TableCell>

                    {/* Published Date */}
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.8125rem' }}>
                      {formatDate(item.published_date, 'yyyy-MM-dd')}
                    </TableCell>
                  </>
                )}

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
