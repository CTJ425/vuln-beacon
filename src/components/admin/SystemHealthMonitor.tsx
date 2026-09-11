import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  Button,
  Stack,
  LinearProgress,
  Divider,
} from '@mui/material';
import {
  Activity,
  Database,
  Lock,
  HardDrive,
  Cpu,
  Globe,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/utils/date';

interface ServiceCheck {
  id: string;
  name: string;
  category: 'supabase' | 'external';
  description: string;
  status: 'operational' | 'degraded' | 'outage' | 'checking';
  latencyMs?: number;
  message?: string;
  endpoint?: string;
}

export const SystemHealthMonitor: React.FC = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceCheck[]>([
    {
      id: 'db',
      name: 'Postgres Database',
      category: 'supabase',
      description: 'Supabase PostgreSQL 核心資料庫 (查詢 vendors 表)',
      status: 'checking',
    },
    {
      id: 'auth',
      name: 'Supabase Auth (GoTrue)',
      category: 'supabase',
      description: '身分驗證與管理員 Session 權限服務',
      status: 'checking',
    },
    {
      id: 'storage',
      name: 'Advisory Storage (S3)',
      category: 'supabase',
      description: 'advisory-documents 儲存貯體 (原始公告 JSON)',
      status: 'checking',
    },
    {
      id: 'edge',
      name: 'Edge Functions Runtime',
      category: 'supabase',
      description: 'Deno Edge Functions (sync-cve / scheduled-sync)',
      status: 'checking',
    },
    {
      id: 'redhat_csaf',
      name: 'Red Hat CSAF Feed',
      category: 'external',
      description: 'Red Hat CSAF v2 JSON 遠端公告來源',
      endpoint: 'https://access.redhat.com/security/data/csaf/v2/advisories/',
      status: 'checking',
    },
    {
      id: 'redhat_hydra',
      name: 'Red Hat Security Data API',
      category: 'external',
      description: 'Red Hat CVE Lookup API',
      endpoint: 'https://access.redhat.com/hydra/rest/securitydata/cve.json',
      status: 'checking',
    },
    {
      id: 'nutanix_advisories',
      name: 'Nutanix Security Advisories API',
      category: 'external',
      description: 'Nutanix Portal 官方資安公告來源',
      endpoint: 'https://portal.nutanix.com/api/v1/advisories',
      status: 'checking',
    },
    {
      id: 'ubuntu_notices',
      name: 'Ubuntu Security Notices API',
      category: 'external',
      description: 'Canonical 官方 Ubuntu 資安公告來源',
      endpoint: 'https://ubuntu.com/security/notices.json?limit=1',
      status: 'checking',
    },
    {
      id: 'debian_security',
      name: 'Debian Security Advisories (DSA)',
      category: 'external',
      description: 'Debian 官方資安公告追蹤來源',
      endpoint: 'https://salsa.debian.org/security-tracker-team/security-tracker/-/raw/master/data/DSA/list',
      status: 'checking',
    },
    {
      id: 'suse_csaf',
      name: 'SUSE CSAF Feed',
      category: 'external',
      description: 'SUSE 官方 CSAF 2.0 資安公告來源',
      endpoint: 'https://ftp.suse.com/pub/projects/security/csaf/changes.csv',
      status: 'checking',
    },
  ]);

  const runDiagnostics = useCallback(async () => {
    setIsChecking(true);

    const updatedServices: ServiceCheck[] = [];

    // 1. Check Database
    const dbStart = performance.now();
    try {
      const { error } = await supabase.from('vendors').select('id', { count: 'exact', head: true });
      const latency = Math.round(performance.now() - dbStart);
      if (error) {
        updatedServices.push({
          id: 'db',
          name: 'Postgres Database',
          category: 'supabase',
          description: 'Supabase PostgreSQL 核心資料庫 (查詢 vendors 表)',
          status: 'outage',
          latencyMs: latency,
          message: error.message || '資料庫連線逾時或拒絕存取',
        });
      } else {
        updatedServices.push({
          id: 'db',
          name: 'Postgres Database',
          category: 'supabase',
          description: 'Supabase PostgreSQL 核心資料庫 (查詢 vendors 表)',
          status: 'operational',
          latencyMs: latency,
          message: '連線正常，響應時間良好',
        });
      }
    } catch (err: any) {
      updatedServices.push({
        id: 'db',
        name: 'Postgres Database',
        category: 'supabase',
        description: 'Supabase PostgreSQL 核心資料庫 (查詢 vendors 表)',
        status: 'outage',
        latencyMs: Math.round(performance.now() - dbStart),
        message: err?.message || '連線錯誤',
      });
    }

    // 2. Check Auth
    const authStart = performance.now();
    try {
      const { error } = await supabase.auth.getSession();
      const latency = Math.round(performance.now() - authStart);
      if (error) {
        updatedServices.push({
          id: 'auth',
          name: 'Supabase Auth (GoTrue)',
          category: 'supabase',
          description: '身分驗證與管理員 Session 權限服務',
          status: 'degraded',
          latencyMs: latency,
          message: error.message,
        });
      } else {
        updatedServices.push({
          id: 'auth',
          name: 'Supabase Auth (GoTrue)',
          category: 'supabase',
          description: '身分驗證與管理員 Session 權限服務',
          status: 'operational',
          latencyMs: latency,
          message: '身分驗證服務運作正常',
        });
      }
    } catch (err: any) {
      updatedServices.push({
        id: 'auth',
        name: 'Supabase Auth (GoTrue)',
        category: 'supabase',
        description: '身分驗證與管理員 Session 權限服務',
        status: 'outage',
        latencyMs: Math.round(performance.now() - authStart),
        message: err?.message || 'Auth 服務連線失敗',
      });
    }

    // 3. Check Storage
    const storageStart = performance.now();
    try {
      const { error } = await supabase.storage.from('advisory-documents').list('', { limit: 1 });
      const latency = Math.round(performance.now() - storageStart);
      if (error) {
        updatedServices.push({
          id: 'storage',
          name: 'Advisory Storage (S3)',
          category: 'supabase',
          description: 'advisory-documents 儲存貯體 (原始公告 JSON)',
          status: 'degraded',
          latencyMs: latency,
          message: error.message,
        });
      } else {
        updatedServices.push({
          id: 'storage',
          name: 'Advisory Storage (S3)',
          category: 'supabase',
          description: 'advisory-documents 儲存貯體 (原始公告 JSON)',
          status: 'operational',
          latencyMs: latency,
          message: 'S3 貯體存取正常',
        });
      }
    } catch (err: any) {
      updatedServices.push({
        id: 'storage',
        name: 'Advisory Storage (S3)',
        category: 'supabase',
        description: 'advisory-documents 儲存貯體 (原始公告 JSON)',
        status: 'outage',
        latencyMs: Math.round(performance.now() - storageStart),
        message: err?.message || '儲存服務連線失敗',
      });
    }

    // 4. Check Edge Functions
    const edgeStart = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke('sync-cve', {
        body: { action: 'health_check' },
      });
      const latency = Math.round(performance.now() - edgeStart);
      if (error || (data && !data.success)) {
        updatedServices.push({
          id: 'edge',
          name: 'Edge Functions Runtime',
          category: 'supabase',
          description: 'Deno Edge Functions (sync-cve / scheduled-sync)',
          status: 'degraded',
          latencyMs: latency,
          message: error?.message || data?.error || 'Edge 服務響應異常',
        });
      } else {
        updatedServices.push({
          id: 'edge',
          name: 'Edge Functions Runtime',
          category: 'supabase',
          description: 'Deno Edge Functions (sync-cve / scheduled-sync)',
          status: 'operational',
          latencyMs: latency,
          message: 'Edge Function 執行緒響應正常',
        });
      }
    } catch (err: any) {
      updatedServices.push({
        id: 'edge',
        name: 'Edge Functions Runtime',
        category: 'supabase',
        description: 'Deno Edge Functions (sync-cve / scheduled-sync)',
        status: 'outage',
        latencyMs: Math.round(performance.now() - edgeStart),
        message: err?.message || 'Edge 服務連線失敗',
      });
    }

    // 5. External Feeds Check
    const externalFeeds = [
      {
        id: 'redhat_csaf',
        name: 'Red Hat CSAF Feed',
        description: 'Red Hat CSAF v2 JSON 遠端公告來源',
        endpoint: 'https://access.redhat.com/security/data/csaf/v2/advisories/',
      },
      {
        id: 'redhat_hydra',
        name: 'Red Hat Security Data API',
        description: 'Red Hat CVE Lookup API',
        endpoint: 'https://access.redhat.com/hydra/rest/securitydata/cve.json',
      },
      {
        id: 'nutanix_advisories',
        name: 'Nutanix Security Advisories API',
        description: 'Nutanix Portal 官方資安公告來源',
        endpoint: 'https://portal.nutanix.com/api/v1/advisories',
      },
      {
        id: 'ubuntu_notices',
        name: 'Ubuntu Security Notices API',
        description: 'Canonical 官方 Ubuntu 資安公告來源',
        endpoint: 'https://ubuntu.com/security/notices.json?limit=1',
      },
      {
        id: 'debian_security',
        name: 'Debian Security Advisories (DSA)',
        description: 'Debian 官方資安公告追蹤來源',
        endpoint: 'https://salsa.debian.org/security-tracker-team/security-tracker/-/raw/master/data/DSA/list',
      },
      {
        id: 'suse_csaf',
        name: 'SUSE CSAF Feed',
        description: 'SUSE 官方 CSAF 2.0 資安公告來源',
        endpoint: 'https://ftp.suse.com/pub/projects/security/csaf/changes.csv',
      },
    ];

    // 5. External Feeds Check (run concurrently via Promise.all for fast diagnostics)
    const externalResults = await Promise.all(
      externalFeeds.map(async (feed): Promise<ServiceCheck> => {
        const feedStart = performance.now();
        try {
          const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
          const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;
          const res = await fetch(feed.endpoint, {
            method: 'HEAD',
            mode: 'no-cors',
            signal: controller?.signal,
          });
          if (timeoutId) clearTimeout(timeoutId);
          const latency = Math.round(performance.now() - feedStart);
          return {
            id: feed.id,
            name: feed.name,
            category: 'external',
            description: feed.description,
            endpoint: feed.endpoint,
            status: 'operational',
            latencyMs: latency,
            message: res.status ? `HTTP ${res.status} OK` : '端點連線正常 (Active)',
          };
        } catch (err: any) {
          return {
            id: feed.id,
            name: feed.name,
            category: 'external',
            description: feed.description,
            endpoint: feed.endpoint,
            status: 'degraded',
            latencyMs: Math.round(performance.now() - feedStart),
            message: err?.name === 'AbortError' ? '連線逾時 (Timeout)' : err?.message || '連線逾時或被遠端拒絕',
          };
        }
      })
    );
    updatedServices.push(...externalResults);

    setServices(updatedServices);
    setLastCheckedAt(new Date().toISOString());
    setIsChecking(false);
  }, []);

  useEffect(() => {
    runDiagnostics();
  }, [runDiagnostics]);

  const hasOutage = services.some((s) => s.status === 'outage');
  const hasDegraded = services.some((s) => s.status === 'degraded');
  const overallStatus = hasOutage ? 'outage' : hasDegraded ? 'degraded' : 'operational';

  const getStatusIcon = (status: ServiceCheck['status']) => {
    switch (status) {
      case 'operational':
        return <CheckCircle2 size={18} color="#10b981" />;
      case 'degraded':
        return <AlertTriangle size={18} color="#f59e0b" />;
      case 'outage':
        return <XCircle size={18} color="#ef4444" />;
      default:
        return <Activity size={18} color="gray" className="animate-spin" />;
    }
  };

  const getStatusChip = (status: ServiceCheck['status']) => {
    switch (status) {
      case 'operational':
        return (
          <Chip
            size="small"
            label="運作正常 (Operational)"
            sx={{ bgcolor: 'rgba(16, 185, 129, 0.15)', color: '#059669', fontWeight: 700 }}
          />
        );
      case 'degraded':
        return (
          <Chip
            size="small"
            label="效能降低 (Degraded)"
            sx={{ bgcolor: 'rgba(245, 158, 11, 0.15)', color: '#d97706', fontWeight: 700 }}
          />
        );
      case 'outage':
        return (
          <Chip
            size="small"
            label="服務異常 (Outage)"
            sx={{ bgcolor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 700 }}
          />
        );
      default:
        return <Chip size="small" label="檢測中..." />;
    }
  };

  const getCategoryIcon = (id: string) => {
    switch (id) {
      case 'db':
        return <Database size={20} />;
      case 'auth':
        return <Lock size={20} />;
      case 'storage':
        return <HardDrive size={20} />;
      case 'edge':
        return <Cpu size={20} />;
      default:
        return <Globe size={20} />;
    }
  };

  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.01em' }}>
            API 與 Supabase 運作狀態監控
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            即時檢測後端資料庫、身分驗證、檔案儲存體、Edge Functions 與外部資安來源之連線健康度與延遲。
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<RefreshCw size={16} className={isChecking ? 'animate-spin' : ''} />}
          onClick={runDiagnostics}
          disabled={isChecking}
          sx={{ fontWeight: 700 }}
        >
          {isChecking ? '正在執行檢測...' : '重新檢測運作狀態'}
        </Button>
      </Box>

      {isChecking && <LinearProgress sx={{ borderRadius: 1 }} />}

      {/* Overall Health Status Banner */}
      <Paper
        sx={{
          p: 3,
          borderRadius: 3,
          bgcolor:
            overallStatus === 'operational'
              ? 'rgba(16, 185, 129, 0.08)'
              : overallStatus === 'degraded'
              ? 'rgba(245, 158, 11, 0.08)'
              : 'rgba(239, 68, 68, 0.08)',
          border: 1,
          borderColor:
            overallStatus === 'operational'
              ? 'rgba(16, 185, 129, 0.25)'
              : overallStatus === 'degraded'
              ? 'rgba(245, 158, 11, 0.25)'
              : 'rgba(239, 68, 68, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {getStatusIcon(overallStatus)}
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {overallStatus === 'operational'
                ? '全部系統運作正常 (All Systems Operational)'
                : overallStatus === 'degraded'
                ? '部分服務效能降低或延遲偏高 (Partial Degradation)'
                : '檢測到服務異常 (System Outage Detected)'}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
              {lastCheckedAt
                ? `上次檢測時間: ${formatDate(lastCheckedAt, 'yyyy-MM-dd HH:mm:ss')}`
                : '正在執行首次連線檢查...'}
            </Typography>
          </Box>
        </Box>
        {getStatusChip(overallStatus)}
      </Paper>

      {/* Supabase Core Infrastructure Section */}
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Database size={18} /> Supabase 核心基礎架構
        </Typography>
        <Grid container spacing={2}>
          {services
            .filter((s) => s.category === 'supabase')
            .map((service) => (
              <Grid item xs={12} sm={6} key={service.id}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2.5,
                    borderRadius: 2.5,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: 130,
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 2, color: 'primary.main' }}>
                        {getCategoryIcon(service.id)}
                      </Box>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          {service.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {service.description}
                        </Typography>
                      </Box>
                    </Box>
                    {getStatusChip(service.status)}
                  </Box>

                  <Divider sx={{ my: 1.5 }} />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {service.message || '檢查就緒'}
                    </Typography>
                    {service.latencyMs !== undefined && (
                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary' }}>
                        延遲: {service.latencyMs}ms
                      </Typography>
                    )}
                  </Box>
                </Paper>
              </Grid>
            ))}
        </Grid>
      </Box>

      {/* External Vendor Feeds Section */}
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Globe size={18} /> 外部資安廠商資料來源 (Vendor Feeds & APIs)
        </Typography>
        <Grid container spacing={2}>
          {services
            .filter((s) => s.category === 'external')
            .map((service) => (
              <Grid item xs={12} sm={6} key={service.id}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2.5,
                    borderRadius: 2.5,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: 130,
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 2, color: 'primary.main' }}>
                        <Globe size={20} />
                      </Box>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          {service.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {service.description}
                        </Typography>
                      </Box>
                    </Box>
                    {getStatusChip(service.status)}
                  </Box>

                  <Divider sx={{ my: 1.5 }} />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {service.endpoint || service.message}
                    </Typography>
                    {service.latencyMs !== undefined && (
                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary' }}>
                        延遲: {service.latencyMs}ms
                      </Typography>
                    )}
                  </Box>
                </Paper>
              </Grid>
            ))}
        </Grid>
      </Box>
    </Stack>
  );
};
