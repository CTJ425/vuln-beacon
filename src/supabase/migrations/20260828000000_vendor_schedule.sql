-- Migration: vendor sync schedule columns + pg_cron tick
-- Description: adds per-vendor schedule configuration and registers a
-- pg_cron job that posts to the `scheduled-sync` Edge Function every five
-- minutes. The Edge Function (not this migration) decides which vendors are
-- due, via the pure src/services/scheduleWindow.ts logic (TASK-13 D2/D4).
--
-- `vendors` already has a public SELECT policy; writes to the new columns go
-- through `sync-cve`'s `update_vendor_schedule` action using the
-- service-role key, so no browser write policy is added here — migration
-- 20260816000000_restrict_write_rls.sql deliberately dropped that access.

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS schedule_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS schedule_times TEXT[] NOT NULL DEFAULT ARRAY['08:00','12:30','18:30'],
  ADD COLUMN IF NOT EXISTS schedule_timezone TEXT NOT NULL DEFAULT 'Asia/Taipei',
  ADD COLUMN IF NOT EXISTS last_scheduled_run_at TIMESTAMPTZ;

ALTER TABLE public.vendors
  DROP CONSTRAINT IF EXISTS vendors_schedule_times_format;

ALTER TABLE public.vendors
  ADD CONSTRAINT vendors_schedule_times_format
  CHECK (
    NOT EXISTS (
      SELECT 1 FROM unnest(schedule_times) AS t
      WHERE t !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    )
  );

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Carries no scheduling decision itself — it just wakes the Edge Function,
-- which reads vendors.schedule_* and decides who is due (TASK-13 D2).
CREATE OR REPLACE FUNCTION public.tick_scheduled_syncs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sync_url TEXT;
  sync_key TEXT;
BEGIN
  SELECT decrypted_secret INTO sync_url
    FROM vault.decrypted_secrets WHERE name = 'scheduled_sync_url';
  SELECT decrypted_secret INTO sync_key
    FROM vault.decrypted_secrets WHERE name = 'scheduled_sync_key';

  IF sync_url IS NULL OR sync_key IS NULL THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := sync_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || sync_key,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- Re-running this migration must not register a duplicate cron job.
SELECT cron.unschedule('vuln-beacon-scheduled-sync')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'vuln-beacon-scheduled-sync');

SELECT cron.schedule('vuln-beacon-scheduled-sync', '*/5 * * * *',
  $$ SELECT public.tick_scheduled_syncs() $$);

-- One-time manual step (run once per project, never checked in with real
-- values):
--
-- select vault.create_secret('https://<ref>.supabase.co/functions/v1/scheduled-sync', 'scheduled_sync_url');
-- select vault.create_secret('<service-role-key>', 'scheduled_sync_key');
