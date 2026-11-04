-- Trip Dash Global/Operational boundary audit. READ ONLY.
-- Run in Supabase SQL Editor; no DDL or data changes.
-- 1. Same-named tables across control and public (candidates for retirement, NOT a drop list).
SELECT c.table_name,
       (SELECT count(*) FROM information_schema.columns x WHERE x.table_schema='control' AND x.table_name=c.table_name) AS control_columns,
       (SELECT count(*) FROM information_schema.columns x WHERE x.table_schema='public' AND x.table_name=c.table_name) AS public_columns
FROM information_schema.tables c
JOIN information_schema.tables p ON p.table_name=c.table_name AND p.table_schema='public' AND p.table_type='BASE TABLE'
WHERE c.table_schema='control' AND c.table_type='BASE TABLE'
ORDER BY c.table_name;

-- 2. Naming/type drift for all columns in overlapping tables.
WITH cols AS (
 SELECT table_schema,table_name,column_name,data_type,udt_name,is_nullable
 FROM information_schema.columns
 WHERE table_schema IN ('control','public')
), pairs AS (
 SELECT COALESCE(c.table_name,p.table_name) AS table_name,
        COALESCE(c.column_name,p.column_name) AS column_name,
        c.data_type AS control_type,p.data_type AS public_type,
        c.udt_name AS control_udt,p.udt_name AS public_udt,
        c.is_nullable AS control_nullable,p.is_nullable AS public_nullable
 FROM (SELECT * FROM cols WHERE table_schema='control') c
 FULL JOIN (SELECT * FROM cols WHERE table_schema='public') p
 ON c.table_name=p.table_name AND c.column_name=p.column_name
 WHERE COALESCE(c.table_name,p.table_name) IN (
  SELECT table_name FROM information_schema.tables WHERE table_schema='control'
  INTERSECT
  SELECT table_name FROM information_schema.tables WHERE table_schema='public'
 )
)
SELECT * FROM pairs
WHERE control_type IS DISTINCT FROM public_type
   OR control_udt IS DISTINCT FROM public_udt
   OR control_nullable IS DISTINCT FROM public_nullable
ORDER BY table_name,column_name;

-- 3. Actual operational identity-reference columns and types (do not assume UUID).
SELECT table_name,column_name,data_type,udt_name,is_nullable
FROM information_schema.columns
WHERE table_schema='public'
  AND (column_name LIKE '%organization_id'
       OR column_name LIKE '%user_id'
       OR column_name IN ('global_trip_id','tenant_id','data_source_id'))
ORDER BY table_name,column_name;

-- 4. All declared foreign keys involving public or control; locate blockers.
SELECT con.conname AS constraint_name,
       con.conrelid::regclass::text AS referencing_table,
       con.confrelid::regclass::text AS referenced_table,
       pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
WHERE con.contype='f'
  AND (con.connamespace IN ('public'::regnamespace,'control'::regnamespace)
       OR con.confrelid IN (
         SELECT oid FROM pg_class WHERE relnamespace IN ('public'::regnamespace,'control'::regnamespace)
       ))
ORDER BY referencing_table,constraint_name;

-- 5. Database views that depend on public copies of control table names.
SELECT DISTINCT view_ns.nspname AS view_schema, view_class.relname AS view_name,
       source_ns.nspname AS source_schema, source_class.relname AS source_table
FROM pg_depend dep
JOIN pg_rewrite rw ON rw.oid=dep.objid
JOIN pg_class view_class ON view_class.oid=rw.ev_class
JOIN pg_namespace view_ns ON view_ns.oid=view_class.relnamespace
JOIN pg_class source_class ON source_class.oid=dep.refobjid
JOIN pg_namespace source_ns ON source_ns.oid=source_class.relnamespace
WHERE source_ns.nspname='public'
  AND source_class.relname IN (SELECT table_name FROM information_schema.tables WHERE table_schema='control')
  AND view_class.relkind IN ('v','m')
ORDER BY view_schema,view_name,source_table;

-- 6. Verify trip-to-global user/org references by text comparison; counts only.
SELECT count(*) AS total_trips,
       count(*) FILTER (WHERE o.id IS NULL) AS missing_global_school,
       count(*) FILTER (WHERE t.created_by_app_user_id IS NOT NULL AND u.id IS NULL) AS missing_global_creator,
       count(*) FILTER (WHERE t.requesting_organization_id IS NOT NULL AND r.id IS NULL) AS missing_global_requester,
       count(*) FILTER (WHERE t.transport_provider_organization_id IS NOT NULL AND b.id IS NULL) AS missing_global_provider
FROM public.trips t
LEFT JOIN control.organizations o ON o.id::text=t.owning_school_organization_id::text
LEFT JOIN control.app_users u ON u.id::text=t.created_by_app_user_id::text
LEFT JOIN control.organizations r ON r.id::text=t.requesting_organization_id::text
LEFT JOIN control.organizations b ON b.id::text=t.transport_provider_organization_id::text;
