-- Migration: 20260925020000_sync_lease_lock.sql
-- Description: replaces the session-level advisory lock with a table lease.
-- try_acquire_sync_lock()/release_sync_lock() took pg_try_advisory_lock over
-- PostgREST, whose pooled connections outlive the request: the lock stayed
-- held by whichever backend served the acquire, the release could run on a
-- different backend (and fail silently), and the leftover lock blocked or
-- re-admitted later syncs depending on which connection they landed on.
-- A lease row is visible to every connection, is released by its holder, and
-- expires on its own if an Edge Function is killed mid-run.

CREATE TABLE IF NOT EXISTS public.sync_leases (
  name TEXT PRIMARY KEY,
  holder TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

-- No policies: only service_role (which bypasses RLS) touches leases.
ALTER TABLE public.sync_leases ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.acquire_sync_lease(p_name TEXT, p_holder TEXT, p_ttl_seconds INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acquired BOOLEAN;
BEGIN
  INSERT INTO public.sync_leases AS l (name, holder, expires_at)
  VALUES (p_name, p_holder, now() + make_interval(secs => p_ttl_seconds))
  ON CONFLICT (name) DO UPDATE
    SET holder = EXCLUDED.holder, expires_at = EXCLUDED.expires_at
    WHERE l.expires_at < now()
  RETURNING true INTO acquired;
  RETURN coalesce(acquired, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_sync_lease(p_name TEXT, p_holder TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.sync_leases WHERE name = p_name AND holder = p_holder;
  RETURN FOUND;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.acquire_sync_lease(TEXT, TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_sync_lease(TEXT, TEXT, INT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.release_sync_lease(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_sync_lease(TEXT, TEXT) TO service_role;

-- Advisory locks the old functions left on pooled connections vanish when
-- those connections recycle; dropping the functions stops new ones.
DROP FUNCTION IF EXISTS public.try_acquire_sync_lock(BIGINT);
DROP FUNCTION IF EXISTS public.release_sync_lock(BIGINT);
