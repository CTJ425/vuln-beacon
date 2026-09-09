-- Migration: 20260908000000_harden_vault_secrets_scheduler.sql
-- Description: Throttles duplicate 'Missing vault secrets' logs to prevent pg_cron log flooding
-- and provides helper procedure for setting vault secrets securely.

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

-- Revoke execute from public/anon/authenticated; only service_role (and pg_cron running as postgres) may execute
REVOKE EXECUTE ON FUNCTION public.tick_scheduled_syncs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tick_scheduled_syncs() TO service_role;

-- Helper function to configure vault secrets safely
CREATE OR REPLACE FUNCTION public.set_scheduled_sync_vault_secrets(
  p_sync_url TEXT,
  p_sync_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url_id UUID;
  v_key_id UUID;
BEGIN
  IF p_sync_url IS NULL OR length(trim(p_sync_url)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'p_sync_url must not be empty');
  END IF;
  IF p_sync_key IS NULL OR length(trim(p_sync_key)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'p_sync_key must not be empty');
  END IF;

  -- Delete existing secrets if present to avoid duplicate key conflicts
  DELETE FROM vault.secrets WHERE name IN ('scheduled_sync_url', 'scheduled_sync_key');

  -- Create new encrypted secrets in Supabase Vault
  SELECT vault.create_secret(p_sync_url, 'scheduled_sync_url') INTO v_url_id;
  SELECT vault.create_secret(p_sync_key, 'scheduled_sync_key') INTO v_key_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Vault secrets successfully configured',
    'url_secret_id', v_url_id,
    'key_secret_id', v_key_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_scheduled_sync_vault_secrets(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_scheduled_sync_vault_secrets(TEXT, TEXT) TO service_role;
