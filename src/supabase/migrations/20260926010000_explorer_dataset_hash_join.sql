-- Migration: 20260926010000_explorer_dataset_hash_join.sql
-- Description: same output as 20260926000000 (md5-identical on production),
-- about 2.6x faster in the database. The first version resolved impact
-- indexes with a correlated subquery per mapping and per advisory, rescanning
-- the whole index set each time (about 1.7 s on production); this one builds
-- the index set once and hash-joins it (about 0.6 s).

CREATE OR REPLACE FUNCTION public.explorer_dataset()
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
    select e.map_id, jsonb_agg(x.idx order by e.ord) as i
    from elems e join impact_idx x on x.advisory_id = e.advisory_id and x.item = e.item
    group by e.map_id
  ), adv_impacts as (
    select advisory_id, jsonb_agg(item order by idx) as impacts from impact_idx group by advisory_id
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
      select jsonb_agg(jsonb_build_object('a', m.advisory_id, 'c', m.cve_id, 'f', m.fixed_versions, 'i', coalesce(mi.i, '[]'::jsonb)) order by m.id)
      from public.advisory_cve_map m left join map_idx mi on mi.map_id = m.id), '[]'::jsonb)
  )
$$;

REVOKE EXECUTE ON FUNCTION public.explorer_dataset() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.explorer_dataset() TO anon, authenticated;
