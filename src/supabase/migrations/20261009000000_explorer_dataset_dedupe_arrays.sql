-- Migration: 20261009000000_explorer_dataset_dedupe_arrays.sql
-- Description: BUG-036. On production the anon call to explorer_dataset(true)
-- took 3.2 s of database time (9,479 mappings) against the anon role's 3 s
-- statement_timeout, so the site often failed to load. Most mappings of one
-- advisory repeat the same affected_products array (BUG-006): 137,987 expanded
-- elements carried only 11,826 distinct impacts. This version groups mappings
-- by (advisory_id, affected_products), expands each distinct array once, and
-- joins the per-array index lists back to the mappings by the group's smallest
-- map id. Output is byte-identical to 20260926020000 (md5 equal for both
-- p_compact values; check: supabase/checks/explorer-dataset-equivalence.mjs).
-- The function-level statement_timeout gives headroom as data grows;
-- PostgREST applies function settings when it calls an RPC.

CREATE OR REPLACE FUNCTION public.explorer_dataset(p_compact boolean DEFAULT false)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
SET statement_timeout = '15s'
AS $$
  with grouped as (
    select m.id, m.advisory_id, m.affected_products,
           min(m.id::text) over (partition by m.advisory_id, m.affected_products) as arr_key
    from public.advisory_cve_map m
  ), arrays as (
    select distinct on (arr_key) arr_key, advisory_id, affected_products as arr
    from grouped order by arr_key
  ), elems as (
    select a.arr_key, a.advisory_id, e.item, e.ord
    from arrays a,
         jsonb_array_elements(case when jsonb_typeof(a.arr) = 'array' then a.arr else '[]'::jsonb end) with ordinality e(item, ord)
  ), impact_idx as (
    select advisory_id, item, (row_number() over (partition by advisory_id order by first_seen) - 1)::int as idx
    from (
      select advisory_id, item, min(arr_key || lpad(ord::text, 6, '0')) as first_seen
      from elems group by advisory_id, item
    ) s
  ), arr_idx as (
    select e.arr_key, jsonb_agg(x.idx order by e.ord) as i,
           bool_and(x.idx = e.ord - 1) as in_order, count(*) as n
    from elems e join impact_idx x on x.advisory_id = e.advisory_id and x.item = e.item
    group by e.arr_key
  ), adv_impacts as (
    select advisory_id, jsonb_agg(item order by idx) as impacts, count(*) as n from impact_idx group by advisory_id
  )
  select jsonb_build_object(
    'advisories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'advisory_id', a.advisory_id, 'title', a.title, 'severity', a.severity,
        'published_at', a.published_at, 'url', a.url, 'summary', a.summary,
        'vendor_code', v.code, 'vendor_name', v.name,
        'impacts', coalesce(ai.impacts, '[]'::jsonb)
      ) order by a.published_at desc nulls last, a.id)
      from public.advisories a
      left join public.vendors v on v.id = a.vendor_id
      left join adv_impacts ai on ai.advisory_id = a.id), '[]'::jsonb),
    'cves', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'cve_id', c.cve_id, 'description', c.description, 'cvss_v3_score', c.cvss_v3_score,
        'cvss_v3_vector', c.cvss_v3_vector, 'severity', c.severity, 'is_known_exploited', c.is_known_exploited,
        'published_date', c.published_date, 'last_modified_date', c.last_modified_date, 'created_at', c.created_at
      ) order by c.published_date desc nulls last, c.id)
      from public.cves c), '[]'::jsonb),
    'mappings', coalesce((
      select jsonb_agg(jsonb_build_object('a', g.advisory_id, 'c', m.cve_id, 'f', m.fixed_versions,
        'i', case when p_compact and mi.in_order and mi.n = ai.n then null else coalesce(mi.i, '[]'::jsonb) end) order by g.id)
      from grouped g
      join public.advisory_cve_map m on m.id = g.id
      left join arr_idx mi on mi.arr_key = g.arr_key
      left join adv_impacts ai on ai.advisory_id = g.advisory_id), '[]'::jsonb)
  )
$$;

REVOKE EXECUTE ON FUNCTION public.explorer_dataset(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.explorer_dataset(boolean) TO anon, authenticated;
