import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { Box, CircularProgress, Typography, Alert, Button } from '@mui/material';
import { ThemeProvider } from '@/theme/ThemeContext';
import { Header } from '@/components/common/Header';
import { Sidebar, NavState } from '@/components/common/Sidebar';
import { PageState } from '@/components/common/PageState';
import { DashboardPage } from '@/pages/DashboardPage';
import { CveTableRowItem } from '@/components/explorer/CveTable';
import { WebhookConfig, VendorSyncLog, Vendor } from '@/types';
import { CveService } from '@/services/cveService';
import { SyncService } from '@/services/syncService';
import { VendorService } from '@/services/vendorService';
import { WebhookConfigService } from '@/services/webhookConfigService';
import { AdvisoryService, AdvisoryRowItem } from '@/services/advisoryService';
import { deriveTaxonomy } from '@/services/productTaxonomy';
import { supabase } from '@/lib/supabase';
import { isAdminUser } from '@/lib/adminAuth';
import { RefreshCw } from 'lucide-react';

const ExplorerPage = lazy(() => import('@/pages/ExplorerPage').then((m) => ({ default: m.ExplorerPage })));
const VendorPage = lazy(() => import('@/pages/VendorPage').then((m) => ({ default: m.VendorPage })));
const AdminPage = lazy(() => import('@/pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const AdminLoginModal = lazy(() => import('@/components/admin/AdminLoginModal').then((m) => ({ default: m.AdminLoginModal })));
const CveDetailDrawer = lazy(() => import('@/components/explorer/CveDetailDrawer').then((m) => ({ default: m.CveDetailDrawer })));
const AdvisoryDetailDrawer = lazy(() => import('@/components/explorer/AdvisoryDetailDrawer').then((m) => ({ default: m.AdvisoryDetailDrawer })));

const LazyFallback: React.FC = () => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 2 }}>
    <CircularProgress size={36} color="primary" />
  </Box>
);

// The backstage and every write path require an admin, so a signed-in
// account without the admin role is treated exactly like a signed-out one.
const adminOrNull = (user: any) => (isAdminUser(user) ? user : null);

export const AppContent: React.FC = () => {
  const [currentNav, setCurrentNav] = useState<NavState>({ section: 'dashboard' });
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showAdminLogin, setShowAdminLogin] = useState<boolean>(false);
  const [adminTab, setAdminTab] = useState<number>(0);
  const [pendingAdminTab, setPendingAdminTab] = useState<number | null>(null);
  const [cves, setCves] = useState<CveTableRowItem[]>([]);
  const [advisories, setAdvisories] = useState<AdvisoryRowItem[]>([]);
  const [syncLogs, setSyncLogs] = useState<VendorSyncLog[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [selectedCve, setSelectedCve] = useState<CveTableRowItem | null>(null);
  const [selectedAdvisory, setSelectedAdvisory] = useState<AdvisoryRowItem | null>(null);
  const [hasOpenedCveDrawer, setHasOpenedCveDrawer] = useState(false);
  const [hasOpenedAdvisoryDrawer, setHasOpenedAdvisoryDrawer] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshingLogs, setIsRefreshingLogs] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem('vulnbeacon-sidebar-collapsed') === 'true';
      }
    } catch {
      // Ignore localStorage access in non-browser or restricted environments
    }
    return false;
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('vulnbeacon-sidebar-collapsed', String(isSidebarCollapsed));
      }
    } catch {
      // Ignore localStorage write errors
    }
  }, [isSidebarCollapsed]);

  useEffect(() => {
    if (selectedCve && !hasOpenedCveDrawer) {
      setHasOpenedCveDrawer(true);
    }
  }, [selectedCve, hasOpenedCveDrawer]);

  useEffect(() => {
    if (selectedAdvisory && !hasOpenedAdvisoryDrawer) {
      setHasOpenedAdvisoryDrawer(true);
    }
  }, [selectedAdvisory, hasOpenedAdvisoryDrawer]);

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => !prev);
  }, []);

  const taxonomy = useMemo(() => deriveTaxonomy(advisories), [advisories]);

  const cveService = useMemo(() => new CveService(), []);
  const syncService = useMemo(() => new SyncService(), []);
  const vendorService = useMemo(() => new VendorService(), []);
  const webhookConfigService = useMemo(() => new WebhookConfigService(), []);
  const advisoryService = useMemo(() => new AdvisoryService(), []);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
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
      setLoadError('Unable to load security data from Supabase. Check the connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [cveService, syncService, webhookConfigService, advisoryService]);

  const handleRefreshLogs = useCallback(async () => {
    try {
      setIsRefreshingLogs(true);
      const fetchedLogs = await syncService.fetchSyncLogs();
      setSyncLogs(fetchedLogs);
    } catch (err) {
      console.error('Error refreshing sync logs:', err);
    } finally {
      setIsRefreshingLogs(false);
    }
  }, [syncService]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    // If user is viewing the admin section but the session expires/is revoked,
    // immediately return to dashboard to protect backstage access.
    if (currentNav.section === 'admin' && !currentUser && !isLoading) {
      setCurrentNav({ section: 'dashboard' });
    }
  }, [currentNav.section, currentUser, isLoading]);

  useEffect(() => {
    // A slow or unreachable vendors query must never delay or block the rest
    // of the dashboard: load it independently of the main isLoading gate.
    vendorService.fetchVendors().then(setVendors);
  }, [vendorService]);

  useEffect(() => {
    // A drawer opened from one page must not persist over an unrelated page.
    setSelectedCve(null);
    setSelectedAdvisory(null);
  }, [currentNav]);

  useEffect(() => {
    if (!syncMessage) return;
    const timer = setTimeout(() => {
      setSyncMessage(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [syncMessage]);

  useEffect(() => {
    if (supabase?.auth?.getSession) {
      supabase.auth.getSession().then(({ data }) => {
        if (data?.session?.user) {
          setCurrentUser(adminOrNull(data.session.user));
        }
      }).catch(() => {});
    }

    if (supabase?.auth?.onAuthStateChange) {
      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        setCurrentUser(adminOrNull(session?.user));
      });
      return () => {
        authListener?.subscription?.unsubscribe();
      };
    }
  }, []);

  // webhook_configs is admin-only under RLS: an anonymous load returns no
  // rows, so re-read it whenever the admin session appears or goes away.
  useEffect(() => {
    if (!currentUser) {
      setWebhooks([]);
      return;
    }
    webhookConfigService.fetchWebhooks().then(setWebhooks).catch(() => {});
  }, [currentUser, webhookConfigService]);

  const handleSelectNav = (nav: NavState) => {
    if (nav.section === 'sync' || nav.section === 'settings') {
      const targetTab = nav.section === 'sync' ? 1 : 0;
      if (!currentUser) {
        setPendingAdminTab(targetTab);
        setShowAdminLogin(true);
        return;
      }
      setAdminTab(targetTab);
      setCurrentNav({ section: 'admin' });
      return;
    }
    if (nav.section === 'admin' && !currentUser) {
      setPendingAdminTab(0);
      setShowAdminLogin(true);
      return;
    }
    if (nav.section === 'admin') {
      setAdminTab(0);
    }
    setCurrentNav(nav);
  };

  const handleAdminLoginSuccess = (user?: any) => {
    setShowAdminLogin(false);
    if (user) {
      setCurrentUser(adminOrNull(user));
    } else if (supabase?.auth?.getSession) {
      supabase.auth.getSession().then(({ data }) => {
        if (data?.session?.user) {
          setCurrentUser(adminOrNull(data.session.user));
        }
      }).catch(() => {});
    }
    if (pendingAdminTab !== null) {
      setAdminTab(pendingAdminTab);
      setPendingAdminTab(null);
    }
    setCurrentNav({ section: 'admin' });
  };

  const handleSignOut = async () => {
    try {
      if (supabase?.auth?.signOut) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.error('Error signing out:', err);
    }
    setCurrentUser(null);
    setCurrentNav({ section: 'dashboard' });
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncMessage(null);

    try {
      const result = await syncService.syncVendors(undefined, { mode: 'auto' });
      if (result.success) {
        setSyncMessage('Ingestion complete! Fetched and updated feeds in Supabase.');
      } else {
        // BUG-003: surface the real failure reason when one is available,
        // instead of always hiding it behind the generic string. A persisted
        // log's error_message takes priority; when no row could be written
        // at all, fall back to the in-memory reason syncVendors() collected.
        const failedLog = result.newLogs.find((log) => log.status === 'FAILED');
        const reason = failedLog?.error_message || result.errors?.[0];
        setSyncMessage(
          reason
            ? `Sync failed: ${reason}`
            : 'Sync failed: one or more vendor feeds could not be ingested.'
        );
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
    }
  };

  const handleAddWebhook = async (hook: Omit<WebhookConfig, 'id' | 'created_at'>) => {
    const created = await webhookConfigService.createWebhook(hook);
    if (created) {
      setWebhooks((prev) => [created, ...prev]);
    } else {
      setSyncMessage('Failed to add webhook. Please try again.');
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    const previousWebhooks = webhooks;
    setWebhooks((prev) => prev.filter((h) => h.id !== id));
    try {
      const deleted = await webhookConfigService.deleteWebhook(id);
      if (!deleted) {
        setWebhooks(previousWebhooks);
        setSyncMessage('Failed to delete webhook. Please try again.');
      }
    } catch {
      setWebhooks(previousWebhooks);
      setSyncMessage('Failed to delete webhook. Please try again.');
    }
  };

  const handleTestWebhook = async (hook: WebhookConfig): Promise<boolean> => {
    return webhookConfigService.testWebhook(hook);
  };

  const handleSaveSchedule = async (
    vendorCode: string,
    schedule: { enabled: boolean; times: string[]; timezone: string }
  ): Promise<{ success: boolean; error?: string }> => {
    const result = await vendorService.updateSchedule(vendorCode, schedule);
    // Refresh in the background; a schedule save must not block on it.
    vendorService.fetchVendors().then(setVendors);
    return result;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Header
        onToggleSidebar={handleToggleSidebar}
        isSidebarCollapsed={isSidebarCollapsed}
      />

      <Box sx={{ display: 'flex', flexGrow: 1 }}>
        {/* Admin Console (backstage) has its own vendor-scoped panels; the public
            quick-nav vendor list would otherwise duplicate the vendor name already
            shown inside those panels (e.g. Sync Monitor's Feed Sources table). */}
        <Sidebar
          currentNav={currentNav}
          onSelectNav={handleSelectNav}
          taxonomy={currentNav.section === 'admin' ? [] : taxonomy}
          staticNavIds={['explorer', 'admin']}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
        />

        {/* minWidth: 0 lets this flex child shrink below its content width, so the
            Explorer tables scroll inside their own TableContainer instead of
            widening the document on narrow viewports. */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            minWidth: 0,
            p: { xs: 2, sm: 3.5 },
            overflowY: 'auto',
            bgcolor: 'background.default',
          }}
        >
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
            <PageState variant="loading" message="Connecting to live Supabase database..." />
          ) : (
            <>
              {loadError && (
                <PageState
                  variant="error"
                  message={loadError}
                  action={
                    <Button color="inherit" size="small" onClick={loadData}>
                      Retry
                    </Button>
                  }
                />
              )}

              {!loadError && cves.length === 0 && advisories.length === 0 && currentNav.section === 'dashboard' && (
                <PageState
                  variant="empty"
                  message="Connected to Supabase live project. Database is initialized. Sign in to the Admin Console to start the first multi-vendor security disclosure ingestion."
                  action={
                    <Button
                      color="inherit"
                      size="small"
                      startIcon={<RefreshCw size={14} />}
                      onClick={() => {
                        // R2: manual sync is only present and operable within the
                        // authenticated Admin Console; the Dashboard only navigates
                        // there (prompting login if needed) and never triggers a sync.
                        handleSelectNav({ section: 'admin' });
                      }}
                    >
                      Go to Admin Console
                    </Button>
                  }
                />
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
              {/* Suspense scoped to the lazy pages only, so a pending chunk never
                  unmounts the sidebar, header, or this <main> element. */}
              <Suspense fallback={<LazyFallback />}>
                {currentNav.section === 'explorer' && (
                  <ExplorerPage
                    cves={cves}
                    advisories={advisories}
                    onSelectCve={setSelectedCve}
                    onSelectAdvisory={setSelectedAdvisory}
                    onRefreshCves={loadData}
                    taxonomy={taxonomy}
                    isAuthenticated={!!currentUser}
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
                    isAuthenticated={!!currentUser}
                  />
                )}

                {currentNav.section === 'admin' && (
                  <AdminPage
                    userEmail={currentUser?.email}
                    webhooks={webhooks}
                    onAddWebhook={handleAddWebhook}
                    onDeleteWebhook={handleDeleteWebhook}
                    onTestWebhook={handleTestWebhook}
                    logs={syncLogs}
                    onRefreshLogs={handleRefreshLogs}
                    isRefreshingLogs={isRefreshingLogs}
                    onSignOut={handleSignOut}
                    vendors={vendors}
                    onManualSync={handleManualSync}
                    isSyncing={isSyncing}
                    onSaveSchedule={handleSaveSchedule}
                    activeTab={adminTab}
                    onTabChange={setAdminTab}
                  />
                )}
              </Suspense>

              {!['dashboard', 'explorer', 'vendor', 'admin'].includes(currentNav.section) && (
                <Box sx={{ p: 4, textAlign: 'center' }} data-testid="nav-fallback-container">
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    Page Not Found
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    The requested section is not recognized or has moved to the Admin Console.
                  </Typography>
                </Box>
              )}
            </>
          )}
        </Box>
      </Box>

      {hasOpenedCveDrawer && (
        <Suspense fallback={null}>
          <CveDetailDrawer
            open={Boolean(selectedCve)}
            item={selectedCve}
            onClose={() => setSelectedCve(null)}
          />
        </Suspense>
      )}

      {hasOpenedAdvisoryDrawer && (
        <Suspense fallback={null}>
          <AdvisoryDetailDrawer
            open={Boolean(selectedAdvisory)}
            item={selectedAdvisory}
            onClose={() => setSelectedAdvisory(null)}
          />
        </Suspense>
      )}

      <Suspense fallback={null}>
        {showAdminLogin && (
          <AdminLoginModal
            open={showAdminLogin}
            onClose={() => setShowAdminLogin(false)}
            onSuccess={handleAdminLoginSuccess}
          />
        )}
      </Suspense>
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
