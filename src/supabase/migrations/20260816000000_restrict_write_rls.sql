-- Migration: Restrict public write access on sync-pipeline tables
-- Description: The browser client (anon/publishable key) no longer writes
-- directly to these tables — vendor sync persistence now goes through the
-- `sync-cve` Edge Function, which uses the service-role key and therefore
-- bypasses RLS entirely. Dropping the "allow all" write policies means only
-- service_role (and the Postgres owner) can write; anon/authenticated keep
-- read access via the existing SELECT policies, unchanged.
--
-- webhook_configs is intentionally NOT included here yet — its create/delete
-- flow still writes directly from the browser pending a follow-up
-- webhook-admin Edge Function (tracked separately).

DROP POLICY IF EXISTS "Allow write access to vendors" ON public.vendors;
DROP POLICY IF EXISTS "Allow write access to advisories" ON public.advisories;
DROP POLICY IF EXISTS "Allow write access to cves" ON public.cves;
DROP POLICY IF EXISTS "Allow write access to advisory_cve_map" ON public.advisory_cve_map;
DROP POLICY IF EXISTS "Allow write access to vendor_sync_logs" ON public.vendor_sync_logs;
DROP POLICY IF EXISTS "Allow write access to cve_triage" ON public.cve_triage;
