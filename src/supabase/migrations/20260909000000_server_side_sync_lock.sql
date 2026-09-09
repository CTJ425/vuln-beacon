-- Migration: 20260909000000_server_side_sync_lock.sql
-- Description: Stored procedures for server-side manual threat feed sync concurrency control
-- Ref: docs/agent/specs/manual-sync-server-side.md (D3)

CREATE OR REPLACE FUNCTION public.try_acquire_sync_lock(lock_id BIGINT DEFAULT 7425001)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN pg_try_advisory_lock(lock_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_sync_lock(lock_id BIGINT DEFAULT 7425001)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN pg_advisory_unlock(lock_id);
END;
$$;

-- Revoke execution from anonymous/public users, grant to authenticated and service_role
REVOKE EXECUTE ON FUNCTION public.try_acquire_sync_lock(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.try_acquire_sync_lock(BIGINT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.release_sync_lock(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_sync_lock(BIGINT) TO authenticated, service_role;
