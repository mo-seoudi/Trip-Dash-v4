-- READ ONLY. Run once in Supabase SQL Editor and export the single JSON result.
-- Does not create, update, delete, migrate, or lock application rows.
-- Intended for the current shared-database control/public deployment.
WITH source_counts AS (
  SELECT organization_id, count(*) AS active_sources
  FROM control.operational_data_sources
  WHERE is_active = true
  GROUP BY organization_id
), tenant_counts AS (
  SELECT organization_id, count(*) AS tenant_links
  FROM control.tenant_organizations
  GROUP BY organization_id
), inspected AS (
  SELECT t.id, t.owning_school_organization_id AS school_id,
    t.created_by_app_user_id AS creator_id,
    t.requesting_organization_id AS requester_id,
    t.transport_provider_organization_id AS provider_id,
    o.id IS NOT NULL AS school_exists,
    (o.id IS NOT NULL AND o.type::text = 'SCHOOL') AS school_is_school,
    (t.created_by_app_user_id IS NULL OR creator.id IS NOT NULL) AS creator_valid,
    (t.requesting_organization_id IS NULL OR requester.id IS NOT NULL) AS requester_valid,
    (t.transport_provider_organization_id IS NULL OR provider.id IS NOT NULL) AS provider_valid,
    coalesce(sc.active_sources,0) AS active_sources,
    coalesce(tc.tenant_links,0) AS tenant_links
  FROM public.trips t
  LEFT JOIN control.organizations o ON o.id::text=t.owning_school_organization_id::text
  LEFT JOIN control.app_users creator ON creator.id::text=t.created_by_app_user_id::text
  LEFT JOIN control.organizations requester ON requester.id::text=t.requesting_organization_id::text
  LEFT JOIN control.organizations provider ON provider.id::text=t.transport_provider_organization_id::text
  LEFT JOIN source_counts sc ON sc.organization_id=o.id
  LEFT JOIN tenant_counts tc ON tc.organization_id=o.id
), flags AS (
  SELECT *, (school_id IS NULL OR NOT school_exists OR NOT school_is_school
    OR NOT creator_valid OR NOT requester_valid OR NOT provider_valid
    OR active_sources<>1 OR tenant_links<>1) AS has_issue
  FROM inspected
)
SELECT jsonb_pretty(jsonb_build_object(
  'checked_at',now(),
  'schema_state',jsonb_build_object(
    'control_trip_registry',to_regclass('control.trip_registry')::text,
    'legacy_public_trip_registry',to_regclass('public.trip_registry')::text,
    'public_trips_global_trip_id_exists',EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='trips' AND column_name='global_trip_id'
    )
  ),
  'counts',(SELECT jsonb_build_object(
    'total_trips',count(*),
    'missing_school',count(*) FILTER (WHERE school_id IS NULL),
    'unknown_school',count(*) FILTER (WHERE NOT school_exists),
    'non_school_owner',count(*) FILTER (WHERE school_exists AND NOT school_is_school),
    'invalid_creator',count(*) FILTER (WHERE NOT creator_valid),
    'invalid_requester',count(*) FILTER (WHERE NOT requester_valid),
    'invalid_provider',count(*) FILTER (WHERE NOT provider_valid),
    'invalid_active_source',count(*) FILTER (WHERE active_sources<>1),
    'invalid_tenant_coverage',count(*) FILTER (WHERE tenant_links<>1),
    'trips_with_any_issue',count(*) FILTER (WHERE has_issue)
  ) FROM flags),
  'schools',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.trips DESC,s.school_id),'[]'::jsonb)
    FROM (SELECT school_id,count(*) AS trips,
      max(active_sources) AS active_sources,max(tenant_links) AS tenant_links,
      count(*) FILTER (WHERE has_issue) AS trips_with_issues
      FROM flags GROUP BY school_id) s),
  'exceptions',(SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.id),'[]'::jsonb)
    FROM (SELECT id,school_id,creator_id,requester_id,provider_id,
      school_exists,school_is_school,creator_valid,requester_valid,provider_valid,
      active_sources,tenant_links
      FROM flags WHERE has_issue ORDER BY id LIMIT 100) e),
  'exception_export_truncated',(SELECT count(*)>100 FROM flags WHERE has_issue)
)) AS live_trip_preflight;
