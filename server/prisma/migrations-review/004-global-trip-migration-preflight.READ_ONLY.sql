-- READ ONLY. Run in Supabase SQL editor before approving any migration.
-- Checks migration preconditions without creating or changing any object.
WITH source_counts AS (
 SELECT organization_id, count(*) AS active_sources
 FROM control.operational_data_sources WHERE is_active = true GROUP BY organization_id
), coverage AS (
 SELECT organization_id, count(*) AS tenants
 FROM control.tenant_organizations GROUP BY organization_id
), checks AS (
 SELECT
   count(*)::int AS total_trips,
   count(*) FILTER (WHERE t.owning_school_organization_id IS NULL)::int AS missing_school,
   count(*) FILTER (WHERE o.id IS NULL)::int AS unknown_school,
   count(*) FILTER (WHERE coalesce(sc.active_sources,0) <> 1)::int AS invalid_source_count,
   count(*) FILTER (WHERE coalesce(c.tenants,0) <> 1)::int AS invalid_tenant_count,
   count(*) FILTER (WHERE t.transport_provider_organization_id IS NOT NULL AND provider.id IS NULL)::int AS invalid_provider
 FROM public.trips t
 LEFT JOIN control.organizations o ON o.id::text = t.owning_school_organization_id
 LEFT JOIN control.organizations provider ON provider.id::text = t.transport_provider_organization_id
 LEFT JOIN source_counts sc ON sc.organization_id = o.id
 LEFT JOIN coverage c ON c.organization_id = o.id
)
SELECT * FROM checks;

-- The expected pre-migration state is: control.trip_registry and
-- public.trips.global_trip_id are absent. Stop and investigate if otherwise.
SELECT
 to_regclass('control.trip_registry') AS canonical_registry,
 EXISTS (
   SELECT 1 FROM information_schema.columns
   WHERE table_schema='public' AND table_name='trips' AND column_name='global_trip_id'
 ) AS operational_global_id_exists,
 to_regclass('public.trip_registry') AS legacy_public_registry;

-- Existing operational IDs remain the primary keys. This must be 0.
SELECT count(*)::int AS duplicate_local_ids
FROM (SELECT id FROM public.trips GROUP BY id HAVING count(*) > 1) x;

-- All schools and their active sources, for routing verification.
SELECT t.owning_school_organization_id AS school_id,
 count(*)::int AS trips,
 count(DISTINCT ods.id)::int AS active_source_count,
 string_agg(DISTINCT ods.mode::text, ',') AS source_modes
FROM public.trips t
LEFT JOIN control.operational_data_sources ods
 ON ods.organization_id::text=t.owning_school_organization_id AND ods.is_active=true
GROUP BY t.owning_school_organization_id
ORDER BY trips DESC, school_id;
