import React, { useState, useMemo } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  TextField,
  Stack,
  Chip,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  InputAdornment,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  X,
  ExternalLink,
  Search,
  Copy,
  Check,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Layers,
  Wrench,
} from 'lucide-react';

import { CveTableRowItem } from './CveTable';
import { SeverityBadge } from '@/components/common/SeverityBadge';
import { VendorIcon } from '@/components/common/VendorIcon';
import { formatDate } from '@/utils/date';
import { getAdvisoryUrl } from '@/utils/advisoryUrl';
import { StateBadge } from '@/components/common/StateBadge';
import { isAffectedState, matchesImpactState } from '@/utils/statusUtils';

interface CveDetailDrawerProps {
  open: boolean;
  item: CveTableRowItem | null;
  onClose: () => void;
}

export const CveDetailDrawer: React.FC<CveDetailDrawerProps> = ({
  open,
  item,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [impactFilter, setImpactFilter] = useState<'ALL' | 'AFFECTED' | 'NOT_AFFECTED' | 'FIX_DEFERRED'>('ALL');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const impacts = item?.product_impacts || [];
  const copyTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleCopy = async (text: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else if (typeof document !== 'undefined') {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedText(text);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => {
        setCopiedText(null);
        copyTimerRef.current = null;
      }, 2000);
    } catch {}
  };

  // Group into Affected vs Not Affected vs Fix Deferred
  const affectedList = useMemo(() => {
    return impacts.filter((imp) => isAffectedState(imp.state));
  }, [impacts]);

  const notAffectedList = useMemo(() => {
    return impacts.filter(
      (imp) => matchesImpactState(imp.state, 'NOT_AFFECTED') || matchesImpactState(imp.state, 'FIXED')
    );
  }, [impacts]);

  const deferredList = useMemo(() => {
    return impacts.filter((imp) => matchesImpactState(imp.state, 'FIX_DEFERRED'));
  }, [impacts]);

  const filteredItems = useMemo(() => {
    let list = impacts;
    if (impactFilter === 'AFFECTED') {
      list = affectedList;
    } else if (impactFilter === 'NOT_AFFECTED') {
      list = notAffectedList;
    } else if (impactFilter === 'FIX_DEFERRED') {
      list = deferredList;
    }

    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (imp) =>
          (imp.product_name || '').toLowerCase().includes(term) ||
          (imp.component || '').toLowerCase().includes(term) ||
          (imp.errata && imp.errata.toLowerCase().includes(term))
      );
    }

    return list;
  }, [impacts, impactFilter, affectedList, notAffectedList, deferredList, searchTerm]);

  const realAdvisories = useMemo(() => {
    if (!item) return [];
    const isRedHat = item.vendor_code?.toLowerCase() === 'redhat';
    const isAdvisoryFormat = (a: string) => {
      if (!a || typeof a !== 'string') return false;
      const trimmed = a.trim();
      if (!trimmed || /^CVE-\d{4}-\d+$/i.test(trimmed)) return false;
      return isRedHat ? /^RH[SBE]A-\d{4}:\d+$/i.test(trimmed) : true;
    };

    if (item.all_advisories && item.all_advisories.length > 0) {
      return item.all_advisories.filter(isAdvisoryFormat);
    }
    if (item.advisory_id && isAdvisoryFormat(item.advisory_id)) {
      return [item.advisory_id];
    }
    return [];
  }, [item]);

  const primaryAdvisory = realAdvisories.length > 0 ? realAdvisories[0] : null;

  if (!item) return null;


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
      {/* Top Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2.5 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 0.5 }}>
            {item.vendor_code && (
              <VendorIcon vendorCode={item.vendor_code} size={20} hideLabel />
            )}
            <Typography variant="h5" sx={{ fontWeight: 800, fontFamily: 'JetBrains Mono', color: 'primary.main' }}>
              {primaryAdvisory || item.cve_id}
            </Typography>
            <SeverityBadge severity={item.severity} score={item.cvss_v3_score} />
            {!primaryAdvisory && (
              <Chip
                size="small"
                label="官方公告待發布"
                sx={{ bgcolor: 'action.hover', color: 'text.secondary', fontWeight: 700 }}
              />
            )}
            {item.is_known_exploited && (
              <Chip
                size="small"
                icon={<AlertTriangle size={13} color="#ef4444" />}
                label="CISA KEV"
                sx={{ bgcolor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 700 }}
              />
            )}
          </Box>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
            {primaryAdvisory ? 'Security Advisory' : 'CVE Vulnerability Record'} • 發布日期: {formatDate(item.published_date, 'yyyy-MM-dd')}
          </Typography>
        </Box>

        <IconButton onClick={onClose} size="small" aria-label="Close" sx={{ color: 'text.secondary' }}>
          <X size={20} />
        </IconButton>
      </Box>

      {/* 1. 公告指向之 CVE 清單卡片 */}
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
          此公告對應修復之 CVE 弱點 (Target CVEs)
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Chip
              label={item.cve_id}
              sx={{
                fontFamily: 'JetBrains Mono',
                fontWeight: 800,
                fontSize: '0.95rem',
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                py: 2,
                px: 0.5,
              }}
            />
            {item.cvss_v3_score && (
              <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                CVSS 分數: <strong style={{ color: '#ef4444' }}>{item.cvss_v3_score}</strong> ({item.severity})
              </Typography>
            )}
          </Box>

          <Button
            size="small"
            variant="outlined"
            component="a"
            href={
              item.vendor_code === 'nutanix'
                ? item.advisory_url && item.advisory_url.startsWith('http')
                  ? item.advisory_url
                  : item.advisory_id
                  ? `https://portal.nutanix.com/page/documents/security-advisories/release-advisories/details?id=${encodeURIComponent(item.advisory_id)}`
                  : 'https://portal.nutanix.com/page/documents/security-advisories'
                : item.vendor_code === 'ubuntu'
                ? `https://ubuntu.com/security/cves/${item.cve_id}`
                : item.vendor_code === 'debian'
                ? `https://security-tracker.debian.org/tracker/${item.cve_id}`
                : item.vendor_code === 'suse'
                ? `https://www.suse.com/security/cve/${item.cve_id}`
                : item.vendor_code === 'cisco' || item.vendor_code === 'vmware'
                ? getAdvisoryUrl(item.cve_id, item.vendor_code)
                : `https://access.redhat.com/security/cve/${item.cve_id}`
            }
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<ExternalLink size={14} />}
            sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.8rem' }}
          >
            檢視官方公告頁面
          </Button>
        </Box>

        <Typography variant="body2" sx={{ color: 'text.primary', mt: 1.5, lineHeight: 1.6 }}>
          {item.description}
        </Typography>

        {/* 若有其他關聯之公告編號 */}
        {realAdvisories.length > 1 && (
          <Box sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.8 }}>
              相關釋出之公告編號:
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.8}>
              {realAdvisories.map((adv, i) => {
                const advUrl = getAdvisoryUrl(adv, item.vendor_code);
                return advUrl ? (
                  <Chip
                    key={i}
                    label={adv}
                    size="small"
                    component="a"
                    href={advUrl}
                    target="_blank"
                    clickable
                    sx={{ fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: '0.75rem' }}
                  />
                ) : (
                  <Chip
                    key={i}
                    label={adv}
                    size="small"
                    sx={{ fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: '0.75rem' }}
                  />
                );
              })}
            </Stack>
          </Box>
        )}
      </Paper>

      {/* 2. 哪些產品有影響？哪些沒有？ (Product Impact Table) */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Layers size={18} color="#ee0000" /> 產品與元件受影響狀態 (Impact Analysis)
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              清楚標示哪些產品受到此漏洞影響、哪些不受影響或已完成修復。
            </Typography>
          </Box>

          <TextField
            size="small"
            placeholder="搜尋產品或元件名稱..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={14} />
                </InputAdornment>
              ),
            }}
            sx={{ width: 220, '& .MuiInputBase-input': { fontSize: '0.8125rem', py: 0.6 } }}
          />
        </Box>

        {/* 快速切換：全部 / 受影響 / 不受影響 / 延後修復 */}
        <Box sx={{ mb: 1.5 }}>
          <ToggleButtonGroup
            value={impactFilter}
            exclusive
            onChange={(_, val) => val && setImpactFilter(val)}
            size="small"
            sx={{ bgcolor: 'background.default' }}
          >
            <ToggleButton value="ALL" sx={{ fontWeight: 700, fontSize: '0.75rem', px: 1.5 }}>
              全部狀態 ({impacts.length})
            </ToggleButton>
            <ToggleButton
              value="AFFECTED"
              sx={{
                fontWeight: 700,
                fontSize: '0.75rem',
                px: 1.5,
                color: impactFilter === 'AFFECTED' ? '#ef4444 !important' : 'inherit',
              }}
            >
              <ShieldAlert size={14} style={{ marginRight: 4 }} />
              🔴 受影響 ({affectedList.length})
            </ToggleButton>
            <ToggleButton
              value="NOT_AFFECTED"
              sx={{
                fontWeight: 700,
                fontSize: '0.75rem',
                px: 1.5,
                color: impactFilter === 'NOT_AFFECTED' ? '#22c55e !important' : 'inherit',
              }}
            >
              <ShieldCheck size={14} style={{ marginRight: 4 }} />
              🟢 不受影響 / 已修復 ({notAffectedList.length})
            </ToggleButton>
            {deferredList.length > 0 && (
              <ToggleButton
                value="FIX_DEFERRED"
                sx={{
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  px: 1.5,
                  color: impactFilter === 'FIX_DEFERRED' ? '#f59e0b !important' : 'inherit',
                }}
              >
                🟠 延後修復 ({deferredList.length})
              </ToggleButton>
            )}
          </ToggleButtonGroup>
        </Box>

        {/* Impact List Table */}
        <TableContainer component={Paper} sx={{ bgcolor: 'background.default', border: 1, borderColor: 'divider', borderRadius: 2, maxHeight: 440 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 800, bgcolor: 'background.paper', fontSize: '0.75rem' }}>Products / services</TableCell>
                <TableCell sx={{ fontWeight: 800, bgcolor: 'background.paper', fontSize: '0.75rem' }}>Components</TableCell>
                <TableCell sx={{ fontWeight: 800, bgcolor: 'background.paper', fontSize: '0.75rem' }}>State (狀態)</TableCell>
                <TableCell sx={{ fontWeight: 800, bgcolor: 'background.paper', fontSize: '0.75rem' }}>Advisory</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                    無符合條件的產品紀錄
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((imp, idx) => (
                  <TableRow key={idx} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.8125rem' }}>
                      {imp.product_name}
                    </TableCell>

                    <TableCell sx={{ fontFamily: 'JetBrains Mono', fontSize: '0.775rem', color: 'primary.main' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                        <span>{imp.component}</span>
                        <Tooltip title={copiedText === imp.component ? '已複製！' : '複製元件名稱'}>
                          <IconButton
                            size="small"
                            onClick={() => handleCopy(imp.component)}
                            sx={{ p: 0.2, color: copiedText === imp.component ? 'success.main' : 'text.secondary' }}
                          >
                            {copiedText === imp.component ? <Check size={12} /> : <Copy size={12} />}
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>

                    <TableCell>
                      <StateBadge state={imp.state} />
                    </TableCell>

                    <TableCell sx={{ fontFamily: 'JetBrains Mono', fontSize: '0.775rem' }}>
                      {imp.errata && imp.errata !== '-' ? (
                        (() => {
                          const errataUrl = getAdvisoryUrl(imp.errata, item.vendor_code);
                          return errataUrl ? (
                            <Link
                              href={errataUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{ color: 'primary.main', fontWeight: 600 }}
                            >
                              {imp.errata}
                            </Link>
                          ) : (
                            <span>{imp.errata}</span>
                          );
                        })()
                      ) : (
                        <span style={{ color: '#94a3b8' }}>-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* 3. 官方修復指引與指令 (Solution) */}
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
          <Wrench size={16} color="#22c55e" /> 官方修正方案 (Solution)
        </Typography>

        <Typography variant="body2" sx={{ color: 'text.primary', lineHeight: 1.6, mb: 1.5 }}>
          {item.solution}
        </Typography>

        {item.vendor_code === 'redhat' ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.25, bgcolor: 'action.hover', borderRadius: 1.5, fontFamily: 'JetBrains Mono', fontSize: '0.8rem', color: 'primary.main' }}>
            <span>$ dnf upgrade -y {impacts[0]?.component || 'package-name'}</span>
            <Tooltip title={copiedText === `$ dnf upgrade -y ${impacts[0]?.component || 'package-name'}` ? '已複製指令！' : '複製升級指令'}>
              <IconButton
                size="small"
                onClick={() => handleCopy(`$ dnf upgrade -y ${impacts[0]?.component || 'package-name'}`)}
                sx={{ color: 'text.secondary' }}
              >
                {copiedText === `$ dnf upgrade -y ${impacts[0]?.component || 'package-name'}` ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
              </IconButton>
            </Tooltip>
          </Box>
        ) : item.vendor_code === 'nutanix' ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.25, bgcolor: 'action.hover', borderRadius: 1.5, fontFamily: 'JetBrains Mono', fontSize: '0.8rem', color: 'primary.main' }}>
            <span>Prism LCM Upgrade: {item.fixed_versions?.[0] || impacts[0]?.errata || item.advisory_id}</span>
            <Tooltip title={copiedText === (item.fixed_versions?.[0] || item.advisory_id) ? '已複製版本！' : '複製目標修復版本'}>
              <IconButton
                size="small"
                onClick={() => handleCopy(item.fixed_versions?.[0] || item.advisory_id)}
                sx={{ color: 'text.secondary' }}
              >
                {copiedText === (item.fixed_versions?.[0] || item.advisory_id) ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
              </IconButton>
            </Tooltip>
          </Box>
        ) : item.vendor_code === 'ubuntu' || item.vendor_code === 'debian' ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.25, bgcolor: 'action.hover', borderRadius: 1.5, fontFamily: 'JetBrains Mono', fontSize: '0.8rem', color: 'primary.main' }}>
            <span>$ sudo apt-get --only-upgrade install -y {impacts[0]?.component || 'package-name'}</span>
            <Tooltip title={copiedText === `$ sudo apt-get --only-upgrade install -y ${impacts[0]?.component || 'package-name'}` ? '已複製指令！' : '複製升級指令'}>
              <IconButton
                size="small"
                onClick={() => handleCopy(`$ sudo apt-get --only-upgrade install -y ${impacts[0]?.component || 'package-name'}`)}
                sx={{ color: 'text.secondary' }}
              >
                {copiedText === `$ sudo apt-get --only-upgrade install -y ${impacts[0]?.component || 'package-name'}` ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
              </IconButton>
            </Tooltip>
          </Box>
        ) : item.vendor_code === 'suse' ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.25, bgcolor: 'action.hover', borderRadius: 1.5, fontFamily: 'JetBrains Mono', fontSize: '0.8rem', color: 'primary.main' }}>
            <span>$ sudo zypper update -y {impacts[0]?.component || 'package-name'}</span>
            <Tooltip title={copiedText === `$ sudo zypper update -y ${impacts[0]?.component || 'package-name'}` ? '已複製指令！' : '複製升級指令'}>
              <IconButton
                size="small"
                onClick={() => handleCopy(`$ sudo zypper update -y ${impacts[0]?.component || 'package-name'}`)}
                sx={{ color: 'text.secondary' }}
              >
                {copiedText === `$ sudo zypper update -y ${impacts[0]?.component || 'package-name'}` ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
              </IconButton>
            </Tooltip>
          </Box>
        ) : null}
      </Paper>
    </Drawer>
  );
};
