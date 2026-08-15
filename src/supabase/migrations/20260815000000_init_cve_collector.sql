-- Migration: Initial schema for VulnBeacon (CVE Collector)
-- Description: Core tables, foreign keys, indexes, RLS policies, and initial vendor seed data

-- 1. Vendors Master Table
CREATE TABLE IF NOT EXISTS public.vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    icon_url TEXT,
    homepage TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Advisories Table
CREATE TABLE IF NOT EXISTS public.advisories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    advisory_id TEXT NOT NULL,
    title TEXT NOT NULL,
    severity TEXT CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN')),
    published_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    url TEXT,
    summary TEXT,
    raw_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_vendor_advisory UNIQUE (vendor_id, advisory_id)
);

-- 3. Standardized CVE Records Table
CREATE TABLE IF NOT EXISTS public.cves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cve_id TEXT UNIQUE NOT NULL,
    description TEXT,
    cvss_v3_score NUMERIC(3, 1),
    cvss_v3_vector TEXT,
    severity TEXT CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN')),
    is_known_exploited BOOLEAN DEFAULT false,
    published_date TIMESTAMPTZ,
    last_modified_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Advisory-to-CVE Many-to-Many Map Table
CREATE TABLE IF NOT EXISTS public.advisory_cve_map (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advisory_id UUID NOT NULL REFERENCES public.advisories(id) ON DELETE CASCADE,
    cve_id UUID NOT NULL REFERENCES public.cves(id) ON DELETE CASCADE,
    affected_products JSONB DEFAULT '[]'::jsonb,
    fixed_versions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_advisory_cve UNIQUE (advisory_id, cve_id)
);

-- 5. Security Triage Status Table
CREATE TABLE IF NOT EXISTS public.cve_triage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cve_id UUID NOT NULL REFERENCES public.cves(id) ON DELETE CASCADE UNIQUE,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'NOT_AFFECTED', 'PATCH_REQUIRED', 'PATCHED')),
    notes TEXT,
    assigned_to TEXT,
    updated_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Vendor Synchronization Execution Logs
CREATE TABLE IF NOT EXISTS public.vendor_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
    vendor_code TEXT,
    status TEXT NOT NULL CHECK (status IN ('RUNNING', 'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED')),
    items_fetched INTEGER DEFAULT 0,
    new_items_count INTEGER DEFAULT 0,
    error_message TEXT,
    duration_ms INTEGER,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

-- 7. Webhook Alert Configurations Table
CREATE TABLE IF NOT EXISTS public.webhook_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('discord', 'telegram', 'slack')),
    webhook_url TEXT NOT NULL,
    min_severity TEXT DEFAULT 'HIGH' CHECK (min_severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for high-frequency queries
CREATE INDEX IF NOT EXISTS idx_advisories_vendor_id ON public.advisories(vendor_id);
CREATE INDEX IF NOT EXISTS idx_advisories_published_at ON public.advisories(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_cves_severity ON public.cves(severity);
CREATE INDEX IF NOT EXISTS idx_cves_cvss_v3_score ON public.cves(cvss_v3_score DESC);
CREATE INDEX IF NOT EXISTS idx_cve_triage_status ON public.cve_triage(status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started_at ON public.vendor_sync_logs(started_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisory_cve_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cve_triage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;

-- Read & Write Policies
CREATE POLICY "Allow read access to vendors" ON public.vendors FOR SELECT USING (true);
CREATE POLICY "Allow write access to vendors" ON public.vendors FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow read access to advisories" ON public.advisories FOR SELECT USING (true);
CREATE POLICY "Allow write access to advisories" ON public.advisories FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow read access to cves" ON public.cves FOR SELECT USING (true);
CREATE POLICY "Allow write access to cves" ON public.cves FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow read access to advisory_cve_map" ON public.advisory_cve_map FOR SELECT USING (true);
CREATE POLICY "Allow write access to advisory_cve_map" ON public.advisory_cve_map FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow read access to cve_triage" ON public.cve_triage FOR SELECT USING (true);
CREATE POLICY "Allow write access to cve_triage" ON public.cve_triage FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow read access to vendor_sync_logs" ON public.vendor_sync_logs FOR SELECT USING (true);
CREATE POLICY "Allow write access to vendor_sync_logs" ON public.vendor_sync_logs FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow read access to webhook_configs" ON public.webhook_configs FOR SELECT USING (true);
CREATE POLICY "Allow write access to webhook_configs" ON public.webhook_configs FOR ALL USING (true) WITH CHECK (true);

-- Seed Target 8 Vendors
INSERT INTO public.vendors (code, name, icon_url, homepage, is_active)
VALUES
    ('redhat', 'Red Hat', 'https://access.redhat.com/favicon.ico', 'https://access.redhat.com/security/security-updates', true),
    ('vmware', 'VMware / Broadcom', 'https://www.broadcom.com/favicon.ico', 'https://support.broadcom.com/web/ecx/security-advisories', true),
    ('nutanix', 'Nutanix', 'https://www.nutanix.com/favicon.ico', 'https://portal.nutanix.com/page/documents/security-advisories', true),
    ('dell', 'Dell Technologies', 'https://www.dell.com/favicon.ico', 'https://www.dell.com/support/security/en-us', true),
    ('hpe', 'Hewlett Packard Enterprise', 'https://www.hpe.com/favicon.ico', 'https://support.hpe.com/hpesc/public/docDisplay?docId=emr_na-c05374460', true),
    ('netapp', 'NetApp', 'https://www.netapp.com/favicon.ico', 'https://security.netapp.com/advisory/', true),
    ('veeam', 'Veeam', 'https://www.veeam.com/favicon.ico', 'https://www.veeam.com/kb_security_advisories.html', true),
    ('cohesity', 'Cohesity / Veritas NetBackup', 'https://www.cohesity.com/favicon.ico', 'https://www.cohesity.com/support/security-advisories/', true)
ON CONFLICT (code) DO NOTHING;
