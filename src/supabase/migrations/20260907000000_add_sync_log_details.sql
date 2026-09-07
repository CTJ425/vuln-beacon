-- Migration: 20260907000000_add_sync_log_details.sql
-- Add structured observability details column to vendor_sync_logs for debugging and troubleshooting.

ALTER TABLE public.vendor_sync_logs
ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;

-- Add index for efficient filtering by status and vendor_code in admin log queries
CREATE INDEX IF NOT EXISTS idx_sync_logs_status_vendor ON public.vendor_sync_logs(status, vendor_code);
CREATE INDEX IF NOT EXISTS idx_sync_logs_details_gin ON public.vendor_sync_logs USING GIN (details);
