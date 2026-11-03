-- READ ONLY: verify keys, UUID identity types and trip data integrity.
-- Execute in Supabase SQL Editor; export the single JSON result.
WITH selected AS (
 SELECT n.nspname AS schema_name, c.relname AS table_name, con.conname AS constraint_name,
        con.contype AS constraint_type, pg_get_constraintdef(con.oid) AS definition
 FROM pg_constraint con
 JOIN pg_class c ON c.oid=con.conrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE (n.nspname='control' AND c.relname IN ('provider_operating_countries','tenants','organizations','operational_data_sources','tenant_organizations','trip_registry'))
    OR (n.nspname='public' AND c.relname IN ('trips','trip_registry'))
),
checks AS (
 SELECT t.id, t.owning_school_organization_id AS school_id,
        t.transport_provider_organization_id AS operator_id,
        o.id AS resolved_school_id,
        b.id AS resolved_operator_id,
        (SELECT count(*) FROM control.tenant_organizations z WHERE z.organization_id::text=t.owning_school_organization_id) AS tenant_matches,
        (SELECT count(*) FROM control.operational_data_sources ds WHERE ds.organization_id::text=t.owning_school_organization_id AND ds.is_active) AS active_sources
 FROM public.trips t
 LEFT JOIN control.organizations o ON o.id::text=t.owning_school_organization_id
 LEFT JOIN control.organizations b ON b.id::text=t.transport_provider_organization_id
)
SELECT jsonb_pretty(jsonb_build_object(
 'constraints', (SELECT coalesce(jsonb_agg(to_jsonb(selected) ORDER BY schema_name,table_name,constraint_name),'[]'::jsonb) FROM selected),
 'trip_integrity', (SELECT jsonb_build_object(
    'total',count(*),
    'missing_school',count(*) FILTER (WHERE resolved_school_id IS NULL),
    'missing_provider_when_specified',count(*) FILTER (WHERE operator_id IS NOT NULL AND resolved_operator_id IS NULL),
    'non_unique_tenant_coverage',count(*) FILTER (WHERE tenant_matches<>1),
    'non_unique_active_source',count(*) FILTER (WHERE active_sources<>1)
  ) FROM checks),
 'existing_global_registry',to_regclass('control.trip_registry')::text,
 'existing_operational_global_id_column',(SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='trips' AND column_name='global_trip_id')
)) AS compatibility_gate_v3;
