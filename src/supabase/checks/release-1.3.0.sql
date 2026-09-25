-- Release 1.3.0 database behaviour check. Run in the SQL editor of a
-- NON-production project (vuln-beacon-dev) after the 20260925* migrations.
-- Everything runs in one block that ends with RAISE EXCEPTION 'ALL_OK', so
-- every write rolls back. Any other error message names the failed assertion.

DO $$
DECLARE
  r RECORD;
  n INT;
BEGIN
  -- upsert_cves: a later vendor without data must not erase an earlier one
  PERFORM public.upsert_cves('[{"cve_id":"CVE-0000-99991","description":"RH desc","cvss_v3_score":7.5,"cvss_v3_vector":"V1","severity":"HIGH","published_date":"2026-02-01T00:00:00Z"}]');
  PERFORM public.upsert_cves('[{"cve_id":"CVE-0000-99991","description":null,"description_fallback":"DSA title","cvss_v3_score":null,"severity":"LOW","published_date":"2026-01-01T00:00:00Z"}]');
  SELECT * INTO r FROM public.cves WHERE cve_id = 'CVE-0000-99991';
  ASSERT r.cvss_v3_score = 7.5, 'score erased: ' || coalesce(r.cvss_v3_score::text, 'null');
  ASSERT r.cvss_v3_vector = 'V1', 'vector erased';
  ASSERT r.description = 'RH desc', 'description replaced: ' || coalesce(r.description, 'null');
  ASSERT r.severity = 'HIGH', 'severity downgraded: ' || r.severity;
  ASSERT r.published_date = '2026-01-01T00:00:00Z', 'published not earliest';

  SELECT count(*) INTO n FROM public.upsert_cves('[{"cve_id":"CVE-0000-99991","description":"newer","cvss_v3_score":9.8,"cvss_v3_vector":"V2","severity":"CRITICAL"},{"cve_id":"CVE-0000-99992","description_fallback":"Only a title","severity":"MEDIUM"}]');
  ASSERT n = 2, 'expected 2 returned ids, got ' || n;
  SELECT * INTO r FROM public.cves WHERE cve_id = 'CVE-0000-99991';
  ASSERT r.cvss_v3_score = 9.8 AND r.cvss_v3_vector = 'V2' AND r.severity = 'CRITICAL' AND r.description = 'newer', 'higher values not taken';
  SELECT * INTO r FROM public.cves WHERE cve_id = 'CVE-0000-99992';
  ASSERT r.description = 'Only a title', 'fallback not used for new row';

  -- sync lease
  ASSERT public.acquire_sync_lease('t-lease', 'a', 900), 'first acquire failed';
  ASSERT NOT public.acquire_sync_lease('t-lease', 'b', 900), 'second holder acquired a live lease';
  ASSERT NOT public.release_sync_lease('t-lease', 'b'), 'non-holder released';
  ASSERT public.release_sync_lease('t-lease', 'a'), 'holder could not release';
  ASSERT public.acquire_sync_lease('t-lease', 'b', 900), 'acquire after release failed';
  UPDATE public.sync_leases SET expires_at = now() - interval '1 minute' WHERE name = 't-lease';
  ASSERT public.acquire_sync_lease('t-lease', 'c', 900), 'expired lease not taken over';

  -- webhook_configs RLS
  INSERT INTO public.webhook_configs (name, platform, webhook_url) VALUES ('rls-probe', 'discord', 'https://discord.com/api/webhooks/x/y');
  SET LOCAL ROLE anon;
  SELECT count(*) INTO n FROM public.webhook_configs WHERE name = 'rls-probe';
  ASSERT n = 0, 'anon can read webhook_configs';
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000001","app_metadata":{}}', true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.webhook_configs WHERE name = 'rls-probe';
  ASSERT n = 0, 'non-admin can read webhook_configs';
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000001","app_metadata":{"role":"admin"}}', true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.webhook_configs WHERE name = 'rls-probe';
  ASSERT n = 1, 'admin cannot read webhook_configs';
  RESET ROLE;

  -- tick surfaces an HTTP error returned to the previous request
  UPDATE public.vendors SET schedule_enabled = true WHERE code = 'redhat';
  DELETE FROM public.vendor_sync_logs WHERE error_message LIKE 'Scheduled sync request rejected%';
  INSERT INTO net._http_response (id, status_code, created) VALUES (-424242, 401, now());
  INSERT INTO public.scheduled_sync_ticks (request_id) VALUES (-424242);
  PERFORM public.tick_scheduled_syncs();
  SELECT count(*) INTO n FROM public.vendor_sync_logs WHERE error_message = 'Scheduled sync request rejected: scheduled-sync returned HTTP 401';
  ASSERT n = 1, 'tick did not log the 401, rows=' || n;

  RAISE EXCEPTION 'ALL_OK';
END;
$$;
