import React, { useState, useMemo } from 'react';
import { Box, Typography, Stack, Alert, Button, CircularProgress } from '@mui/material';
import { Search, DownloadCloud } from 'lucide-react';
import { CveFilterBar } from '@/components/explorer/CveFilterBar';
import { CveTable, CveTableRowItem } from '@/components/explorer/CveTable';
import { AdvisoryTable } from '@/components/explorer/AdvisoryTable';
import { AdvisoryRowItem } from '@/services/advisoryService';
import { SyncService } from '@/services/syncService';
import { VendorNode, matchesProductFamily } from '@/services/productTaxonomy';
import { matchesImpactState } from '@/utils/statusUtils';


interface ExplorerPageProps {
  cves: CveTableRowItem[];
  advisories: AdvisoryRowItem[];
  onSelectCve: (cve: CveTableRowItem) => void;
  onSelectAdvisory: (item: AdvisoryRowItem) => void;
  onRefreshCves?: () => Promise<void>;
  taxonomy?: VendorNode[];
  isAuthenticated?: boolean;
}

export const ExplorerPage: React.FC<ExplorerPageProps> = ({
  cves,
  advisories,
  onSelectCve,
  onSelectAdvisory,
  onRefreshCves,
  taxonomy = [],
  isAuthenticated = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductFamily, setSelectedProductFamily] = useState('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [viewMode, setViewMode] = useState<'advisory' | 'cve'>('advisory');
  const [isFetchingDirect, setIsFetchingDirect] = useState(false);
  const [fetchMessage, setFetchMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);


  const syncService = useMemo(() => new SyncService(), []);

  const filteredCves = useMemo(() => {
    return cves.filter((item) => {
      // Product Family filter
      if (selectedProductFamily !== 'ALL') {
        if (!matchesProductFamily(item, selectedProductFamily, taxonomy)) {
          return false;
        }
      }

      // Severity filter
      if (selectedSeverity !== 'ALL' && item.severity !== selectedSeverity) {
        return false;
      }

      // Component State filter
      if (selectedStatus !== 'ALL') {
        const impacts = item.product_impacts || [];
        const hasMatchingState = impacts.some((imp) => matchesImpactState(imp.state, selectedStatus));
        if (!hasMatchingState) {
          return false;
        }
      }

      // Search keyword filter (CVE, Advisory, Component name, Product name, Errata, Description)
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const matchCve = (item.cve_id || '').toLowerCase().includes(term);
        const matchAdv = (item.advisory_id || '').toLowerCase().includes(term);
        const matchAllAdv = (item.all_advisories || []).some((a) => (a || '').toLowerCase().includes(term));
        const matchTitle = (item.advisory_title || '').toLowerCase().includes(term);
        const matchDesc = (item.description || '').toLowerCase().includes(term);
        const matchProd = (item.affected_products || []).some((p) => (p || '').toLowerCase().includes(term));
        const matchImpact = (item.product_impacts || []).some(
          (imp) =>
            (imp.component || '').toLowerCase().includes(term) ||
            (imp.product_name || '').toLowerCase().includes(term) ||
            (imp.errata && imp.errata.toLowerCase().includes(term))
        );

        if (!matchCve && !matchAdv && !matchAllAdv && !matchTitle && !matchDesc && !matchProd && !matchImpact) {
          return false;
        }
      }

      return true;
    });
  }, [cves, selectedProductFamily, selectedSeverity, selectedStatus, searchTerm, taxonomy]);

  const filteredAdvisories = useMemo(() => {
    return advisories.filter((item) => {
      // Product Family filter
      if (selectedProductFamily !== 'ALL') {
        if (!matchesProductFamily(item, selectedProductFamily, taxonomy)) {
          return false;
        }
      }

      // Severity filter
      if (selectedSeverity !== 'ALL' && item.severity !== selectedSeverity) {
        return false;
      }

      // Component State filter
      if (selectedStatus !== 'ALL') {
        const impacts = item.product_impacts || [];
        const hasMatchingState = impacts.some((imp) => matchesImpactState(imp.state, selectedStatus));
        if (!hasMatchingState) {
          return false;
        }
      }

      // Search keyword filter (Advisory id, title, summary, CVEs, products, impacts)
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const matchAdv = (item.advisory_id || '').toLowerCase().includes(term);
        const matchTitle = (item.title || '').toLowerCase().includes(term);
        const matchSummary = (item.summary || '').toLowerCase().includes(term);
        const matchCve = (item.cves || []).some((cve: any) => {
          if (typeof cve === 'string') return cve.toLowerCase().includes(term);
          const cveId = (cve?.cve_id || '').toLowerCase();
          const desc = (cve?.description || '').toLowerCase();
          return cveId.includes(term) || desc.includes(term);
        });
        const matchProd = (item.affected_products || []).some((p) => (p || '').toLowerCase().includes(term));
        const matchImpact = (item.product_impacts || []).some(
          (imp) =>
            (imp.component || '').toLowerCase().includes(term) ||
            (imp.product_name || '').toLowerCase().includes(term) ||
            (imp.errata && imp.errata.toLowerCase().includes(term))
        );

        if (!matchAdv && !matchTitle && !matchSummary && !matchCve && !matchProd && !matchImpact) {
          return false;
        }
      }

      return true;
    });
  }, [advisories, selectedProductFamily, selectedSeverity, selectedStatus, searchTerm, taxonomy]);

  const productOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const vendor of taxonomy) {
      for (const product of vendor.products) {
        if (!seen.has(product.id)) {
          seen.set(product.id, product.name);
        }
      }
    }
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
  }, [taxonomy]);

  const handleReset = () => {
    setSearchTerm('');
    setSelectedProductFamily('ALL');
    setSelectedSeverity('ALL');
    setSelectedStatus('ALL');
    setFetchMessage(null);
  };

  const handleFetchDirectly = async () => {
    // R2: fetchAndIngestQuery performs a live vendor sync and persists data.
    // It must never run for an unauthenticated visitor, even if this handler
    // is somehow invoked without the gated button being rendered.
    if (!isAuthenticated) return;
    if (!searchTerm.trim()) return;
    setIsFetchingDirect(true);
    setFetchMessage(null);

    try {
      const ok = await syncService.fetchAndIngestQuery(searchTerm);
      if (ok) {
        setFetchMessage({
          type: 'success',
          text: `成功抓取 ${searchTerm} 並寫入資料庫！`,
        });
        if (onRefreshCves) {
          await onRefreshCves();
        }
      } else {
        setFetchMessage({
          type: 'error',
          text: `未找到與「${searchTerm}」相關的安全公告或 CVE。請檢查編號格式。`,
        });
      }
    } catch (e: any) {
      setFetchMessage({
        type: 'error',
        text: `抓取失敗: ${e.message || '連線錯誤'}`,
      });
    } finally {
      setIsFetchingDirect(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em' }}>
          Security Advisory & CVE Explorer
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          Search, cross-correlate, and inspect affected enterprise products, packages, container states, and official advisory solutions.
        </Typography>
      </Box>

      <CveFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedVendor={selectedProductFamily}
        onVendorChange={setSelectedProductFamily}
        selectedSeverity={selectedSeverity}
        onSeverityChange={setSelectedSeverity}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onReset={handleReset}
        productOptions={productOptions}
      />

      {fetchMessage && (
        <Alert severity={fetchMessage.type} onClose={() => setFetchMessage(null)}>
          {fetchMessage.text}
        </Alert>
      )}

      {(viewMode === 'advisory' ? filteredAdvisories : filteredCves).length === 0 && searchTerm.trim() !== '' && (
        <Alert
          severity="info"
          icon={<Search size={20} />}
          action={
            isAuthenticated ? (
              <Button
                color="primary"
                size="small"
                variant="contained"
                disabled={isFetchingDirect}
                startIcon={isFetchingDirect ? <CircularProgress size={14} color="inherit" /> : <DownloadCloud size={16} />}
                onClick={handleFetchDirectly}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                {isFetchingDirect ? '正在即時抓取...' : `即時抓取「${searchTerm}」`}
              </Button>
            ) : undefined
          }
        >
          本地資料庫目前尚未收錄「<strong>{searchTerm}</strong>」。
        </Alert>
      )}

      {viewMode === 'advisory' ? (
        <AdvisoryTable items={filteredAdvisories} onSelectRow={onSelectAdvisory} />
      ) : (
        <CveTable items={filteredCves} onSelectRow={onSelectCve} viewMode={viewMode} />
      )}

    </Stack>
  );
};
