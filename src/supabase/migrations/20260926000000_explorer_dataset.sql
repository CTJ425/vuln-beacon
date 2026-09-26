-- Migration: 20260926000000_explorer_dataset.sql
-- Description: one read for the Explorer, Dashboard and Vendor pages.
-- The browser used to page through advisories and cves separately, each with
-- every advisory_cve_map row and its full product-impact list embedded: on
-- production (238 advisories, 3368 CVEs, 5022 mappings, 2026-09-26) that was
-- 37 MB of JSON per page load, 13 MB of it the same impacts repeated per CVE.
-- explorer_dataset() returns each distinct impact once per advisory and gives
-- every mapping the indexes of the impacts it carries, so the client can
-- rebuild exactly the rows it had before (Red Hat impacts do differ per CVE)
-- from about 4 MB.
--
-- SECURITY INVOKER: it reads through the caller's RLS, which already allows
-- public reads of these tables.

CREATE OR REPLACE FUNCTION public.explorer_dataset()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  with adv_imp as (
    select m.advisory_id, e.item, min(m.id::text || lpad(e.ord::text, 6, '0')) first_seen
    from public.advisory_cve_map m,
         jsonb_array_elements(case when jsonb_typeof(m.affected_products) = 'array' then m.affected_products else '[]'::jsonb end) with ordinality e(item, ord)
    group by m.advisory_id, e.item
  ), adv_imp_idx as (
    select advisory_id, item, (row_number() over (partition by advisory_id order by first_seen) - 1)::int idx from adv_imp
  )
  select jsonb_build_object(
    'advisories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'advisory_id', a.advisory_id, 'title', a.title, 'severity', a.severity,
        'published_at', a.published_at, 'url', a.url, 'summary', a.summary,
        'vendor_code', v.code, 'vendor_name', v.name,
        'impacts', coalesce((select jsonb_agg(i.item order by i.idx) from adv_imp_idx i where i.advisory_id = a.id), '[]'::jsonb)
      ) order by a.published_at desc nulls last, a.id)
      from public.advisories a left join public.vendors v on v.id = a.vendor_id), '[]'::jsonb),
    'cves', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'cve_id', c.cve_id, 'description', c.description, 'cvss_v3_score', c.cvss_v3_score,
        'cvss_v3_vector', c.cvss_v3_vector, 'severity', c.severity, 'is_known_exploited', c.is_known_exploited,
        'published_date', c.published_date, 'last_modified_date', c.last_modified_date, 'created_at', c.created_at
      ) order by c.published_date desc nulls last, c.id)
      from public.cves c), '[]'::jsonb),
    'mappings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'a', m.advisory_id, 'c', m.cve_id, 'f', m.fixed_versions,
        'i', coalesce((
          select jsonb_agg(x.idx order by e.ord)
          from jsonb_array_elements(case when jsonb_typeof(m.affected_products) = 'array' then m.affected_products else '[]'::jsonb end) with ordinality e(item, ord)
          join adv_imp_idx x on x.advisory_id = m.advisory_id and x.item = e.item), '[]'::jsonb)
      ) order by m.id)
      from public.advisory_cve_map m), '[]'::jsonb)
  )
$$;

REVOKE EXECUTE ON FUNCTION public.explorer_dataset() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.explorer_dataset() TO anon, authenticated;
