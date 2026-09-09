-- ============================================================================
-- VulnBeacon: Scheduled Sync Vault Secrets Configuration Script
-- ============================================================================
--
-- Why is this needed?
-- The background automated schedule uses pg_cron in PostgreSQL to trigger
-- public.tick_scheduled_syncs() every 5 minutes. That function issues an HTTP POST
-- to the 'scheduled-sync' Edge Function using secrets stored in Supabase Vault:
--   1. 'scheduled_sync_url': The full URL of the scheduled-sync Edge Function
--   2. 'scheduled_sync_key': The SUPABASE_SERVICE_ROLE_KEY
--
-- When these are not configured, pg_cron logs:
-- "Missing vault secrets: scheduled_sync_url or scheduled_sync_key not configured"
--
-- Choose Option A (Cloud) or Option B (Self-Hosted) below, replace the placeholders,
-- and execute in your Supabase SQL Editor.
-- ============================================================================

-- OPTION A: For Supabase Cloud (Hosted)
-- Replace <PROJECT_REF> with your Supabase project reference (e.g. egofadbvftmbwodjneoy)
-- Replace <SERVICE_ROLE_KEY> with your Project Settings -> API -> service_role key

-- Method 1 (Recommended): Single-line invocation using secure helper procedure:
-- SELECT public.set_scheduled_sync_vault_secrets(
--   'https://<PROJECT_REF>.supabase.co/functions/v1/scheduled-sync',
--   '<SERVICE_ROLE_KEY>'
-- );

-- Method 2: Direct Vault Operations:
-- 1. Remove old secrets if already present
DELETE FROM vault.secrets WHERE name IN ('scheduled_sync_url', 'scheduled_sync_key');

-- 2. Insert new encrypted secrets
SELECT vault.create_secret(
  'https://<PROJECT_REF>.supabase.co/functions/v1/scheduled-sync',
  'scheduled_sync_url'
);

SELECT vault.create_secret(
  '<SERVICE_ROLE_KEY>',
  'scheduled_sync_key'
);

-- ============================================================================
-- OPTION B: For Self-Hosted Supabase (Docker / Kong Internal Network)
-- In a self-hosted topology, the database communicates internally with Kong:
-- URL: http://kong:8000/functions/v1/scheduled-sync
-- Key: The JWT service_role key configured in your self-hosted .env
-- ============================================================================

-- DELETE FROM vault.secrets WHERE name IN ('scheduled_sync_url', 'scheduled_sync_key');
-- SELECT vault.create_secret('http://kong:8000/functions/v1/scheduled-sync', 'scheduled_sync_url');
-- SELECT vault.create_secret('<SELF_HOSTED_SERVICE_ROLE_KEY>', 'scheduled_sync_key');

-- ============================================================================
-- Verification: Check that secrets exist and are decrypted properly
-- ============================================================================
SELECT name, description, created_at, updated_at 
FROM vault.decrypted_secrets 
WHERE name IN ('scheduled_sync_url', 'scheduled_sync_key');
