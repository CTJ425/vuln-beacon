-- Migration: 20260926020000_explorer_dataset_compact.sql
-- Description: optional compact format. On production 4,956 of 5,022
-- mappings carry every impact of their advisory in order; with
-- p_compact = true such a mapping sends "i": null instead of the full index
-- list. The parameter defaults to false, so a client that calls the function
-- without arguments (the 1.4.0 frontend) keeps getting the full lists.

DROP FUNCTION IF EXISTS public.explorer_dataset();

CREATE OR REPLACE FUNCTION public.explorer_dataset(p_compact boolean DEFAULT false)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  with elems as (
    select m.id as map_id, m.advisory_id, e.item, e.ord
    from public.advisory_cve_map m,
         jsonb_array_elements(case when jsonb_typeof(m.affected_products) = 'array' then m.affected_products else '[]'::jsonb end) with ordinality e(item, ord)
  ), impact_idx as (
    select advisory_id, item, (row_number() over (partition by advisory_id order by first_seen) - 1)::int as idx
    from (
      select advisory_id, item, min(map_id::text || lpad(ord::text, 6, '0')) as first_seen
      from elems group by advisory_id, item
    ) s
  ), map_idx as (
    select e.map_id, jsonb_agg(x.idx order by e.ord) as i,
           bool_and(x.idx = e.ord - 1) as in_order, count(*) as n
    from elems e join impact_idx x on x.advisory_id = e.advisory_id and x.item = e.item
    group by e.map_id
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
      select jsonb_agg(jsonb_build_object('a', m.advisory_id, 'c', m.cve_id, 'f', m.fixed_versions,
        'i', case when p_compact and mi.in_order and mi.n = ai.n then null else coalesce(mi.i, '[]'::jsonb) end) order by m.id)
      from public.advisory_cve_map m
      left join map_idx mi on mi.map_id = m.id
      left join adv_impacts ai on ai.advisory_id = m.advisory_id), '[]'::jsonb)
  )
$$;

REVOKE EXECUTE ON FUNCTION public.explorer_dataset(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.explorer_dataset(boolean) TO anon, authenticated;
