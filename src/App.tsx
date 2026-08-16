import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Box, CircularProgress, Typography, Alert, Button } from '@mui/material';
import { ThemeProvider } from '@/theme/ThemeContext';
import { Header } from '@/components/common/Header';
import { Sidebar, NavState } from '@/components/common/Sidebar';
import { DashboardPage } from '@/pages/DashboardPage';
import { ExplorerPage } from '@/pages/ExplorerPage';
import { VendorPage } from '@/pages/VendorPage';
import { SyncMonitorPage } from '@/pages/SyncMonitorPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { CveDetailDrawer } from '@/components/explorer/CveDetailDrawer';
import { AdvisoryDetailDrawer } from '@/components/explorer/AdvisoryDetailDrawer';
import { CveTableRowItem } from '@/components/explorer/CveTable';
import { WebhookConfig, VendorSyncLog } from '@/types';
import { CveService } from '@/services/cveService';
import { SyncService } from '@/services/syncService';
import { WebhookConfigService } from '@/services/webhookConfigService';
import { AdvisoryService, AdvisoryRowItem } from '@/services/advisoryService';
import { deriveTaxonomy } from '@/services/productTaxonomy';
import { RefreshCw } from 'lucide-react';

export const AppContent: React.FC = () => {
  const [currentNav, setCurrentNav] = useState<NavState>({ section: 'dashboard' });
  const [cves, setCves] = useState<CveTableRowItem[]>([]);
  const [advisories, setAdvisories] = useState<AdvisoryRowItem[]>([]);
  const [syncLogs, setSyncLogs] = useState<VendorSyncLog[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [selectedCve, setSelectedCve] = useState<CveTableRowItem | null>(null);
  const [selectedAdvisory, setSelectedAdvisory] = useState<AdvisoryRowItem | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const taxonomy = useMemo(() => deriveTaxonomy(advisories), [advisories]);

  const cveService = useMemo(() => new CveService(), []);
  const syncService = useMemo(() => new SyncService(), []);
  const webhookConfigService = useMemo(() => new WebhookConfigService(), []);
  const advisoryService = useMemo(() => new AdvisoryService(), []);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [fetchedCves, fetchedLogs, fetchedWebhooks, fetchedAdvisories] = await Promise.all([
        cveService.fetchCves(),
        syncService.fetchSyncLogs(),
        webhookConfigService.fetchWebhooks(),
        advisoryService.fetchAdvisories(),
      ]);

      setCves(fetchedCves);
      setSyncLogs(fetchedLogs);
      setWebhooks(fetchedWebhooks);
      setAdvisories(fetchedAdvisories);
    } catch (err) {
      console.error('Error loading Supabase live data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [cveService, syncService, webhookConfigService, advisoryService]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncMessage(null);

    try {
      const result = await syncService.syncVendors();
      if (result.success) {
        setSyncMessage('Ingestion complete! Fetched and updated feeds in Supabase.');
      }
      // Refresh live records from Supabase
      const [updatedCves, updatedLogs, updatedAdvisories] = await Promise.all([
        cveService.fetchCves(),
        syncService.fetchSyncLogs(),
        advisoryService.fetchAdvisories(),
      ]);
      setCves(updatedCves);
      setSyncLogs(updatedLogs);
      setAdvisories(updatedAdvisories);
    } catch (err: any) {
      setSyncMessage(`Sync failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  const handleAddWebhook = async (hook: Omit<WebhookConfig, 'id' | 'created_at'>) => {
    const created = await webhookConfigService.createWebhook(hook);
    if (created) {
      setWebhooks((prev) => [created, ...prev]);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    setWebhooks((prev) => prev.filter((h) => h.id !== id));
    await webhookConfigService.deleteWebhook(id);
  };

  const handleTestWebhook = async (hook: WebhookConfig): Promise<boolean> => {
    return webhookConfigService.testWebhook(hook);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Header onManualSync={handleManualSync} isSyncing={isSyncing} />

      <Box sx={{ display: 'flex', flexGrow: 1 }}>
        <Sidebar
          currentNav={currentNav}
          onSelectNav={setCurrentNav}
          taxonomy={taxonomy}
        />

        <Box component="main" sx={{ flexGrow: 1, p: 3.5, overflowY: 'auto', bgcolor: 'background.default' }}>
          {syncMessage && (
            <Alert
              severity={syncMessage.includes('failed') ? 'error' : 'success'}
              sx={{ mb: 3 }}
              onClose={() => setSyncMessage(null)}
            >
              {syncMessage}
            </Alert>
          )}

          {isLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 2 }}>
              <CircularProgress size={36} color="primary" />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Connecting to live Supabase database...
              </Typography>
            </Box>
          ) : (
            <>
              {cves.length === 0 && advisories.length === 0 && currentNav.section === 'dashboard' && (
                <Alert
                  severity="info"
                  action={
                    <Button
                      color="inherit"
                      size="small"
                      startIcon={<RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />}
                      onClick={handleManualSync}
                      disabled={isSyncing}
                    >
                      {isSyncing ? 'Syncing...' : 'Sync All Feeds Now'}
                    </Button>
                  }
                  sx={{ mb: 3 }}
                >
                  Connected to Supabase live project. Database is initialized. Click &ldquo;Sync All Feeds Now&rdquo; to start the first multi-vendor security disclosure ingestion.
                </Alert>
              )}

              {currentNav.section === 'dashboard' && (
                <DashboardPage
                  advisories={advisories}
                  cves={cves}
                  onSelectAdvisory={setSelectedAdvisory}
                  onSelectCve={setSelectedCve}
                  onNavigateToExplorer={() => setCurrentNav({ section: 'explorer' })}
                  taxonomy={taxonomy}
                  onSelectVendor={(vendorCode) => setCurrentNav({ section: 'vendor', vendorCode })}
                />
              )}
              {currentNav.section === 'explorer' && (
                <ExplorerPage
                  cves={cves}
                  advisories={advisories}
                  onSelectCve={setSelectedCve}
                  onSelectAdvisory={setSelectedAdvisory}
                  onRefreshCves={loadData}
                  taxonomy={taxonomy}
                />
              )}

              {currentNav.section === 'vendor' && (
                <VendorPage
                  vendorCode={currentNav.vendorCode}
                  advisories={advisories}
                  cves={cves}
                  taxonomy={taxonomy}
                  onSelectCve={setSelectedCve}
                  onSelectAdvisory={setSelectedAdvisory}
                  onRefreshCves={loadData}
                />
              )}

              {currentNav.section === 'sync' && (
                <SyncMonitorPage
                  logs={syncLogs}
                  onManualSync={handleManualSync}
                  isSyncing={isSyncing}
                />
              )}
              {currentNav.section === 'settings' && (
                <SettingsPage
                  webhooks={webhooks}
                  onAddWebhook={handleAddWebhook}
                  onDeleteWebhook={handleDeleteWebhook}
                  onTestWebhook={handleTestWebhook}
                />
              )}
            </>
          )}
        </Box>
      </Box>

      <CveDetailDrawer
        open={Boolean(selectedCve)}
        item={selectedCve}
        onClose={() => setSelectedCve(null)}
      />

      <AdvisoryDetailDrawer
        open={Boolean(selectedAdvisory)}
        item={selectedAdvisory}
        onClose={() => setSelectedAdvisory(null)}
      />
    </Box>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};
