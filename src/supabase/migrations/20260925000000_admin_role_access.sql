-- Migration: 20260925000000_admin_role_access.sql
-- Description: Admin is now an explicit grant (auth.users.raw_app_meta_data
-- role = 'admin', settable only with the service-role key) instead of "any
-- authenticated user". webhook_configs holds webhook URLs and Telegram bot
-- tokens, which are credentials, so anonymous and non-admin reads are removed.
--
-- Grant admin once per project (then sign out and in to refresh the JWT):
--   update auth.users
--      set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'
--    where email = '<admin email>';

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

DROP POLICY IF EXISTS "Allow anon read webhook_configs" ON public.webhook_configs;
DROP POLICY IF EXISTS "Allow authenticated manage webhook_configs" ON public.webhook_configs;
DROP POLICY IF EXISTS "Allow admin manage webhook_configs" ON public.webhook_configs;

CREATE POLICY "Allow admin manage webhook_configs"
  ON public.webhook_configs FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
