import React, { useState } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  Stack,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
} from '@mui/material';
import { X, ExternalLink, Copy, Check, Flame, Layers, Wrench } from 'lucide-react';

import { AdvisoryRowItem } from '@/services/advisoryService';
import { SeverityBadge } from '@/components/common/SeverityBadge';
import { formatDate } from '@/utils/date';

interface AdvisoryDetailDrawerProps {
  open: boolean;
  item: AdvisoryRowItem | null;
  onClose: () => void;
}

export const AdvisoryDetailDrawer: React.FC<AdvisoryDetailDrawerProps> = ({
  open,
  item,
  onClose,
}) => {
  const [copiedText, setCopiedText] = useState<string | null>(null);

  if (!item) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const getStateBadge = (state: string) => {
    const s = state.toLowerCase();
    if (s === 'affected') {
      return (
        <Chip
          label="🔴 受影響 (Affected)"
          size="small"
          sx={{
            fontWeight: 700,
            fontSize: '0.75rem',
            bgcolor: 'rgba(239, 68, 68, 0.15)',
            color: '#ef4444',
            border: '1px solid rgba(239, 68, 68, 0.3)',
          }}
        />
      );
    }
    if (s.includes('not affected') || s === 'not_affected') {
      return (
        <Chip
          label="🟢 不受影響 (Not affected)"
          size="small"
          sx={{
            fontWeight: 700,
            fontSize: '0.75rem',
            bgcolor: 'rgba(34, 197, 94, 0.15)',
            color: '#22c55e',
            border: '1px solid rgba(34, 197, 94, 0.3)',
          }}
        />
      );
    }
    if (s === 'fixed') {
      return (
        <Chip
          label="🟢 已修復 (Fixed)"
          size="small"
          sx={{
            fontWeight: 700,
            fontSize: '0.75rem',
            bgcolor: 'rgba(34, 197, 94, 0.15)',
            color: '#22c55e',
            border: '1px solid rgba(34, 197, 94, 0.3)',
          }}
        />
      );
    }
    if (s === 'fix deferred') {
      return (
        <Chip
          label="🟠 延後修復 (Fix deferred)"
          size="small"
          sx={{
            fontWeight: 700,
            fontSize: '0.75rem',
            bgcolor: 'rgba(245, 158, 11, 0.15)',
            color: '#f59e0b',
            border: '1px solid rgba(245, 158, 11, 0.3)',
          }}
        />
      );
    }
    return (
      <Chip
        label={state}
        size="small"
        sx={{
          fontWeight: 600,
          fontSize: '0.75rem',
          bgcolor: 'action.hover',
          color: 'text.secondary',
        }}
      />
    );
  };

  const firstComponent = item.product_impacts[0]?.component;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 780, md: 880 },
          bgcolor: 'background.paper',
          borderLeft: 1,
          borderColor: 'divider',
          p: { xs: 2.5, sm: 3.5 },
        },
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2.5 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 0.5 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, fontFamily: 'JetBrains Mono', color: 'primary.main' }}>
              {item.advisory_id}
            </Typography>
            <SeverityBadge severity={item.severity} />
          </Box>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
            Red Hat Security Advisory (RHSA) • 發布日期: {formatDate(item.published_at, 'yyyy-MM-dd')}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          {item.url && (
            <Button
              size="small"
              variant="outlined"
              component="a"
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              endIcon={<ExternalLink size={14} />}
              sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.8rem' }}
            >
              Red Hat Errata 官方頁面
            </Button>
          )}
          <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
            <X size={20} />
          </IconButton>
        </Box>
      </Box>

      {/* 影響內容 (Impact) */}
      <Paper
        sx={{
          p: 2.5,
          mb: 3,
          bgcolor: 'background.default',
          border: 1,
          borderColor: 'divider',
          borderRadius: 2.5,
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', mb: 1.5 }}>
          影響內容 (Impact)
        </Typography>
        <Typography variant="body1" sx={{ fontWeight: 700, color: 'text.primary' }}>
          {item.title}
        </Typography>
        {item.summary && (
          <Typography variant="body2" sx={{ color: 'text.primary', mt: 1, lineHeight: 1.6 }}>
            {item.summary}
          </Typography>
        )}
      </Paper>

      {/* 修補的 CVE 弱點 (Fixed CVEs) */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Layers size={18} color="#ee0000" /> 修補的 CVE 弱點 (Fixed CVEs)
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
          共 {item.cves.length} 個 CVE
        </Typography>

        <Stack spacing={1.5}>
          {item.cves.map((cve) => (
            <Paper
              key={cve.cve_id}
              sx={{
                p: 2,
                bgcolor: 'background.default',
                border: 1,
                borderColor: 'divider',
                borderRadius: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 0.8 }}>
                <Typography sx={{ fontFamily: 'JetBrains Mono', fontWeight: 800, color: 'primary.main' }}>
                  {cve.cve_id}
                </Typography>
                <SeverityBadge severity={cve.severity} score={cve.cvss_v3_score} />
                {cve.is_known_exploited && (
                  <Chip
                    size="small"
                    icon={<Flame size={13} color="#ef4444" />}
                    label="CISA KEV"
                    sx={{ bgcolor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 700 }}
                  />
                )}
              </Box>
              <Typography variant="body2" sx={{ color: 'text.primary', lineHeight: 1.6 }}>
                {cve.description}
              </Typography>
            </Paper>
          ))}
        </Stack>
      </Box>

      {/* 受影響產品與元件 (Affected products & components) */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Layers size={18} color="#ee0000" /> 受影響產品與元件 (Affected products &amp; components)
        </Typography>

        <TableContainer component={Paper} sx={{ bgcolor: 'background.default', border: 1, borderColor: 'divider', borderRadius: 2, maxHeight: 440 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 800, bgcolor: 'background.paper', fontSize: '0.75rem' }}>Products / services</TableCell>
                <TableCell sx={{ fontWeight: 800, bgcolor: 'background.paper', fontSize: '0.75rem' }}>Components</TableCell>
                <TableCell sx={{ fontWeight: 800, bgcolor: 'background.paper', fontSize: '0.75rem' }}>State</TableCell>
                <TableCell sx={{ fontWeight: 800, bgcolor: 'background.paper', fontSize: '0.75rem' }}>Errata</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {item.product_impacts.map((imp, idx) => (
                <TableRow key={idx} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                  <TableCell sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.8125rem' }}>
                    {imp.product_name}
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'JetBrains Mono', fontSize: '0.775rem', color: 'primary.main' }}>
                    {imp.component}
                  </TableCell>
                  <TableCell>{getStateBadge(imp.state)}</TableCell>
                  <TableCell sx={{ fontFamily: 'JetBrains Mono', fontSize: '0.775rem' }}>
                    {imp.errata && imp.errata !== '-' ? `Errata: ${imp.errata}` : <span style={{ color: '#94a3b8' }}>-</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* 修正方式 (Solution) */}
      <Paper
        sx={{
          p: 2.5,
          bgcolor: 'background.default',
          border: 1,
          borderColor: 'divider',
          borderRadius: 2.5,
          borderLeft: 4,
          borderLeftColor: 'success.main',
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Wrench size={16} color="#22c55e" /> 修正方式 (Solution)
        </Typography>

        <Typography variant="body2" sx={{ color: 'text.primary', lineHeight: 1.6, mb: 1.5 }}>
          {item.solution}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.25, bgcolor: 'action.hover', borderRadius: 1.5, fontFamily: 'JetBrains Mono', fontSize: '0.8rem', color: 'primary.main' }}>
          <span>$ dnf upgrade -y {firstComponent || 'package-name'}</span>
          <Tooltip title={copiedText === `$ dnf upgrade -y ${firstComponent || 'package-name'}` ? '已複製指令！' : '複製升級指令'}>
            <IconButton
              size="small"
              onClick={() => handleCopy(`$ dnf upgrade -y ${firstComponent || 'package-name'}`)}
              sx={{ color: 'text.secondary' }}
            >
              {copiedText === `$ dnf upgrade -y ${firstComponent || 'package-name'}` ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
            </IconButton>
          </Tooltip>
        </Box>

        {item.url && (
          <Box sx={{ mt: 1.5 }}>
            <Button
              size="small"
              variant="text"
              component="a"
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              endIcon={<ExternalLink size={14} />}
              sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.8rem', px: 0 }}
            >
              查看 Errata 公告
            </Button>
          </Box>
        )}
      </Paper>
    </Drawer>
  );
};
