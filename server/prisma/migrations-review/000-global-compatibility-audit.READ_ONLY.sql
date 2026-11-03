-- TripDash GLOBAL/OPERATIONAL COMPATIBILITY AUDIT
-- READ ONLY. Run in Supabase SQL Editor, export the single result.
-- Uses existing control and public schema names; no modifications.
WITH school_trip_counts AS (
  SELECT owning_school_organization_id AS school_id,
         count(*)::int AS trip_count,
         count(*) FILTER (WHERE transport_provider_organization_id IS NULL)::int AS unassigned_provider_trips
  FROM public.trips GROUP BY owning_school_organization_id
),
school_mappings AS (
  SELECT t.school_id, t.trip_count, t.unassigned_provider_trips,
         o.display_name AS school_name, o.type::text AS organization_type,
         (SELECT count(*) FROM control.tenant_organizations z WHERE z.organization_id=t.school_id) AS tenant_coverage_count,
         (SELECT jsonb_agg(jsonb_build_object('tenant_id',z.tenant_id)) FROM control.tenant_organizations z WHERE z.organization_id=t.school_id) AS tenant_coverage,
         (SELECT count(*) FROM control.operational_data_sources ds WHERE ds.organization_id=t.school_id AND ds.is_active) AS active_source_count,
         (SELECT jsonb_agg(jsonb_build_object('id',ds.id,'mode',ds.mode,'engine',ds.engine,'schema_version',ds.schema_version,'is_active',ds.is_active))
          FROM control.operational_data_sources ds WHERE ds.organization_id=t.school_id) AS configured_sources
  FROM school_trip_counts t LEFT JOIN control.organizations o ON o.id=t.school_id
),
trigger_info AS (
  SELECT n.nspname AS schema_name,c.relname AS table_name,tr.tgname AS trigger_name,pg_get_triggerdef(tr.oid) AS definition
  FROM pg_trigger tr JOIN pg_class c ON c.oid=tr.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE NOT tr.tgisinternal AND n.nspname IN ('control','public')
    AND c.relname IN ('trips','trip_registry','trip_series','bus_bookings','organizations','operational_data_sources')
),
schema_details AS (
  SELECT table_schema,table_name,column_name,data_type,is_nullable,column_default
  FROM information_schema.columns
  WHERE (table_schema='control' AND table_name IN ('organizations','provider_operating_countries','operational_data_sources','tenant_organizations'))
     OR (table_schema='public' AND table_name IN ('trips','trip_registry'))
)
SELECT jsonb_pretty(jsonb_build_object(
  'trip_count', (SELECT count(*) FROM public.trips),
  'registry_count', (SELECT count(*) FROM public.trip_registry),
  'school_mappings', (SELECT coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) FROM school_mappings s),
  'triggers', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM trigger_info t),
  'columns', (SELECT coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) FROM schema_details c)
)) AS compatibility_audit;
