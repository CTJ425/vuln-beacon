-- Migration: 20260925010000_merge_cve_upsert.sql
-- Description: cves is shared by every vendor, but each sync used to upsert
-- its own full row, so a vendor without a score (Debian, most VMware CVEs)
-- overwrote another vendor's score with NULL and an advisory title replaced a
-- real description. upsert_cves() merges instead:
--   description        incoming real description, else keep, else the
--                      caller's fallback (advisory title) for a new row
--   cvss score/vector  the higher score wins, kept together as a pair
--   severity           the highest severity any vendor reported
--   is_known_exploited true once any vendor says so
--   published_date     the earliest date seen
-- Every rule except description is order-independent, so the stored row no
-- longer depends on which vendor happened to sync last.

CREATE OR REPLACE FUNCTION public.severity_rank(p_severity TEXT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_severity
    WHEN 'CRITICAL' THEN 4
    WHEN 'HIGH' THEN 3
    WHEN 'MEDIUM' THEN 2
    WHEN 'LOW' THEN 1
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_cves(p_rows JSONB)
RETURNS TABLE (id UUID, cve_id TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  DROP TABLE IF EXISTS _incoming_cves;
  CREATE TEMP TABLE _incoming_cves ON COMMIT DROP AS
  SELECT DISTINCT ON (r.cve_id) r.*
  FROM jsonb_to_recordset(p_rows) AS r(
    cve_id TEXT,
    description TEXT,
    description_fallback TEXT,
    cvss_v3_score NUMERIC,
    cvss_v3_vector TEXT,
    severity TEXT,
    is_known_exploited BOOLEAN,
    published_date TIMESTAMPTZ
  )
  WHERE r.cve_id IS NOT NULL
  ORDER BY r.cve_id;

  UPDATE public.cves c SET
    description = COALESCE(i.description, c.description, i.description_fallback),
    cvss_v3_vector = CASE
      WHEN i.cvss_v3_score IS NOT NULL AND (c.cvss_v3_score IS NULL OR i.cvss_v3_score > c.cvss_v3_score)
        THEN i.cvss_v3_vector ELSE c.cvss_v3_vector END,
    cvss_v3_score = GREATEST(c.cvss_v3_score, i.cvss_v3_score),
    severity = CASE
      WHEN public.severity_rank(i.severity) > public.severity_rank(c.severity) THEN i.severity
      ELSE COALESCE(c.severity, i.severity) END,
    is_known_exploited = COALESCE(c.is_known_exploited, false) OR COALESCE(i.is_known_exploited, false),
    published_date = LEAST(c.published_date, i.published_date)
  FROM _incoming_cves i
  WHERE c.cve_id = i.cve_id;

  INSERT INTO public.cves (cve_id, description, cvss_v3_score, cvss_v3_vector, severity, is_known_exploited, published_date)
  SELECT i.cve_id, COALESCE(i.description, i.description_fallback), i.cvss_v3_score, i.cvss_v3_vector,
         i.severity, COALESCE(i.is_known_exploited, false), i.published_date
  FROM _incoming_cves i
  ON CONFLICT (cve_id) DO NOTHING;

  RETURN QUERY
  SELECT c.id, c.cve_id FROM public.cves c JOIN _incoming_cves i ON i.cve_id = c.cve_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_cves(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_cves(JSONB) TO service_role;
