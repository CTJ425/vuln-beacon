-- Security and Reliability Hardening Migration
-- 1. Restrict tick_scheduled_syncs from public/anon invocation
-- 2. Add advisory concurrency lock to tick_scheduled_syncs
-- 3. Log diagnostics when vault secrets are missing
-- 4. Tighten webhook_configs RLS to restrict anonymous direct mutations

-- Revoke execute from public/anon/authenticated; only service_role / cron can execute
REVOKE EXECUTE ON FUNCTION public.tick_scheduled_syncs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tick_scheduled_syncs() TO service_role;

-- Recreate tick_scheduled_syncs with concurrency guard and diagnostic logging
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
  -- Prevent concurrent overlapping tick executions using transaction-level advisory lock
  IF NOT pg_try_advisory_xact_lock(hashtext('tick_scheduled_syncs')) THEN
    RETURN;
  END IF;

  SELECT decrypted_secret INTO sync_url
    FROM vault.decrypted_secrets WHERE name = 'scheduled_sync_url';
  SELECT decrypted_secret INTO sync_key
    FROM vault.decrypted_secrets WHERE name = 'scheduled_sync_key';

  -- Surface missing vault secrets into vendor_sync_logs instead of silent exit
  IF sync_url IS NULL OR sync_key IS NULL THEN
    INSERT INTO public.vendor_sync_logs (
      vendor_id, vendor_code, status, error_message, duration_ms
    )
    SELECT id, code, 'FAILED', 'Missing vault secrets: scheduled_sync_url or scheduled_sync_key not configured', 0
    FROM public.vendors
    WHERE schedule_enabled = TRUE
    LIMIT 1;
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

-- Tighten webhook_configs RLS:
-- Public / anonymous may read active configurations for dashboard display,
-- but only authenticated users or service_role can insert, update, or delete.
DROP POLICY IF EXISTS "Allow write access to webhook_configs" ON public.webhook_configs;
DROP POLICY IF EXISTS "Allow read access to webhook_configs" ON public.webhook_configs;
DROP POLICY IF EXISTS "Allow public all access on webhook_configs" ON public.webhook_configs;
DROP POLICY IF EXISTS "Allow anon read webhook_configs" ON public.webhook_configs;
DROP POLICY IF EXISTS "Allow authenticated manage webhook_configs" ON public.webhook_configs;
DROP POLICY IF EXISTS "Allow service_role manage webhook_configs" ON public.webhook_configs;

CREATE POLICY "Allow anon read webhook_configs"
  ON public.webhook_configs FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow authenticated manage webhook_configs"
  ON public.webhook_configs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service_role manage webhook_configs"
  ON public.webhook_configs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
