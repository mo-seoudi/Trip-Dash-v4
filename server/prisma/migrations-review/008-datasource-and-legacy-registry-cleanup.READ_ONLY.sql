-- READ ONLY: datasource and legacy registry cleanup preflight.
-- Run in Supabase SQL Editor. Returns ONE JSON document, no credentials,
-- secret references, row-level IDs, connection strings, or user information.
-- No DDL, DML, temporary objects, functions, or security-setting changes.
WITH
source_modes AS (
  SELECT mode::text AS mode, is_active, count(*)::integer AS source_count,
         count(DISTINCT organization_id)::integer AS schools
  FROM control.operational_data_sources
  GROUP BY mode::text, is_active
),
source_summary AS (
  SELECT count(*)::integer AS total_sources,
         count(*) FILTER (WHERE is_active)::integer AS active_sources,
         count(DISTINCT organization_id) FILTER (WHERE is_active)::integer AS schools_with_active_sources,
         count(*) FILTER (WHERE mode::text <> 'HOSTED' AND is_active)::integer AS active_non_hosted_sources,
         count(*) FILTER (WHERE engine <> 'postgresql' AND is_active)::integer AS active_non_postgresql_sources
  FROM control.operational_data_sources
),
active_source_cardinality AS (
  SELECT count(*) FILTER (WHERE n > 1)::integer AS schools_with_multiple_active_sources
  FROM (SELECT organization_id,count(*) AS n FROM control.operational_data_sources WHERE is_active GROUP BY organization_id) s
),
credential_summary AS (
  SELECT count(*)::integer AS total_credentials,
         count(*) FILTER (WHERE c.is_active)::integer AS active_credentials,
         count(*) FILTER (WHERE c.is_active AND d.is_active)::integer AS credentials_on_active_sources,
         count(*) FILTER (WHERE c.is_active AND d.is_active AND d.mode::text <> 'HOSTED')::integer AS credentials_on_active_non_hosted_sources
  FROM control.data_source_credentials c
  LEFT JOIN control.operational_data_sources d ON d.id=c.data_source_id
),
provider_summary AS (
  SELECT count(*)::integer AS total_providers,
         count(*) FILTER (WHERE is_active)::integer AS active_providers
  FROM control.secret_providers
),
legacy_registry AS (
  SELECT count(*)::integer AS rows FROM public.trip_registry
),
legacy_fk AS (
  SELECT count(*)::integer AS foreign_key_count,
         coalesce(jsonb_agg(DISTINCT format('%I.%I', n.nspname, t.relname)),'[]'::jsonb) AS referencing_tables
  FROM pg_constraint c
  JOIN pg_class t ON t.oid=c.conrelid
  JOIN pg_namespace n ON n.oid=t.relnamespace
  WHERE c.contype='f' AND c.confrelid='public.trip_registry'::regclass
),
legacy_views AS (
  SELECT count(DISTINCT format('%I.%I',vn.nspname,v.relname))::integer AS dependent_view_count,
         coalesce(jsonb_agg(DISTINCT format('%I.%I',vn.nspname,v.relname)) FILTER (WHERE v.oid IS NOT NULL),'[]'::jsonb) AS dependent_views
  FROM pg_depend dep
  JOIN pg_rewrite rw ON rw.oid=dep.objid
  JOIN pg_class v ON v.oid=rw.ev_class AND v.relkind IN ('v','m')
  JOIN pg_namespace vn ON vn.oid=v.relnamespace
  WHERE dep.refobjid='public.trip_registry'::regclass
    AND v.oid<>'public.trip_registry'::regclass
),
legacy_triggers AS (
  SELECT count(*)::integer AS non_internal_triggers
  FROM pg_trigger WHERE tgrelid='public.trip_registry'::regclass AND NOT tgisinternal
),
legacy_policies AS (
  SELECT count(*)::integer AS policy_count
  FROM pg_policy WHERE polrelid='public.trip_registry'::regclass
),
legacy_rls AS (
  SELECT relrowsecurity AS rls_enabled,relforcerowsecurity AS rls_forced
  FROM pg_class WHERE oid='public.trip_registry'::regclass
)
SELECT jsonb_pretty(jsonb_build_object(
  'checked_at',now(),
  'sources',(SELECT to_jsonb(s) FROM source_summary s),
  'active_source_cardinality',(SELECT to_jsonb(a) FROM active_source_cardinality a),
  'source_modes',(SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY mode,is_active),'[]'::jsonb) FROM source_modes m),
  'credentials',(SELECT to_jsonb(c) FROM credential_summary c),
  'secret_providers',(SELECT to_jsonb(p) FROM provider_summary p),
  'legacy_registry',jsonb_build_object(
    'rows',(SELECT rows FROM legacy_registry),
    'foreign_keys',(SELECT to_jsonb(f) FROM legacy_fk f),
    'views',(SELECT to_jsonb(v) FROM legacy_views v),
    'triggers',(SELECT to_jsonb(t) FROM legacy_triggers t),
    'policies',(SELECT to_jsonb(p) FROM legacy_policies p),
    'rls',(SELECT to_jsonb(r) FROM legacy_rls r)
  ),
  'canonical_registry_exists',to_regclass('control.trip_registry') IS NOT NULL
)) AS cleanup_preflight;
