-- Migration: 20260925030000_surface_scheduled_sync_http_errors.sql
-- Description: pg_net posts to scheduled-sync asynchronously, so a rejected
-- call (e.g. 401 when the vault key no longer matches the runtime
-- service-role key) never reached vendor_sync_logs and the scheduler looked
-- healthy while doing nothing. Each tick now records its pg_net request id
-- and, on the next tick, logs a FAILED row if that request came back with an
-- HTTP error. A timed-out request is not an error: pg_net stops waiting after
-- 5 s while a long sync keeps running server-side.

CREATE TABLE IF NOT EXISTS public.scheduled_sync_ticks (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No policies: only the SECURITY DEFINER tick function uses this table.
ALTER TABLE public.scheduled_sync_ticks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.tick_scheduled_syncs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sync_url TEXT;
  sync_key TEXT;
  last_request_id BIGINT;
  last_status INT;
  v_request_id BIGINT;
BEGIN
  -- Prevent concurrent overlapping tick executions using transaction-level advisory lock
  IF NOT pg_try_advisory_xact_lock(hashtext('tick_scheduled_syncs')) THEN
    RETURN;
  END IF;

  SELECT t.request_id INTO last_request_id
    FROM public.scheduled_sync_ticks t ORDER BY t.id DESC LIMIT 1;
  IF last_request_id IS NOT NULL THEN
    SELECT r.status_code INTO last_status FROM net._http_response r WHERE r.id = last_request_id;
    IF last_status >= 400 THEN
      INSERT INTO public.vendor_sync_logs (vendor_id, vendor_code, status, error_message, duration_ms)
      SELECT id, code, 'FAILED', 'Scheduled sync request rejected: scheduled-sync returned HTTP ' || last_status, 0
      FROM public.vendors
      WHERE schedule_enabled = TRUE
        AND NOT EXISTS (
          SELECT 1 FROM public.vendor_sync_logs
          WHERE error_message LIKE 'Scheduled sync request rejected%'
            AND started_at > NOW() - INTERVAL '1 hour'
        )
      LIMIT 1;
    END IF;
  END IF;

  SELECT decrypted_secret INTO sync_url
    FROM vault.decrypted_secrets WHERE name = 'scheduled_sync_url';
  SELECT decrypted_secret INTO sync_key
    FROM vault.decrypted_secrets WHERE name = 'scheduled_sync_key';

  -- Surface missing vault secrets into vendor_sync_logs with 1-hour throttling
  -- to prevent pg_cron (5-minute tick) from flooding the log table when secrets are unconfigured.
  IF sync_url IS NULL OR sync_key IS NULL THEN
    INSERT INTO public.vendor_sync_logs (
      vendor_id, vendor_code, status, error_message, duration_ms
    )
    SELECT id, code, 'FAILED', 'Missing vault secrets: scheduled_sync_url or scheduled_sync_key not configured', 0
    FROM public.vendors
    WHERE schedule_enabled = TRUE
      AND NOT EXISTS (
        SELECT 1 FROM public.vendor_sync_logs
        WHERE error_message LIKE '%Missing vault secrets%'
          AND started_at > NOW() - INTERVAL '1 hour'
      )
    LIMIT 1;
    RETURN;
  END IF;

  SELECT net.http_post(
    url := sync_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || sync_key,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) INTO v_request_id;

  INSERT INTO public.scheduled_sync_ticks (request_id) VALUES (v_request_id);
  DELETE FROM public.scheduled_sync_ticks WHERE created_at < now() - INTERVAL '1 day';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tick_scheduled_syncs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tick_scheduled_syncs() TO service_role;
