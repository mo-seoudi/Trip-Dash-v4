-- TEST DATABASE ONLY. Run AFTER reviewed migrations 001 and 003 on a
-- disposable clone, never on production. Read-only verification.
-- Compare output against the pre-migration snapshot.
SELECT
  (SELECT count(*) FROM public.trips) AS operational_trips,
  (SELECT count(*) FROM public.trips WHERE global_trip_id IS NULL) AS missing_global_uuids,
  (SELECT count(*) FROM control.trip_registry) AS registry_rows,
  (SELECT count(*) FROM control.trip_registry WHERE registration_status = 'active') AS active_registry_rows,
  (SELECT count(*) FROM public.trips t
   JOIN control.trip_registry r ON r.id = t.global_trip_id
   WHERE r.operational_trip_id <> t.id
      OR r.school_org_id::text <> t.owning_school_organization_id
      OR r.bus_company_org_id::text IS DISTINCT FROM t.transport_provider_organization_id
  ) AS mismatched_registry_rows;

-- Should be zero after running reconciliation for all schools.
SELECT t.id, t.owning_school_organization_id, t.global_trip_id
FROM public.trips t
LEFT JOIN control.trip_registry r ON r.id = t.global_trip_id
WHERE r.id IS NULL
ORDER BY t.id
LIMIT 100;

-- Check duplicate UUIDs independently of the unique index.
SELECT global_trip_id, count(*) AS duplicate_count
FROM public.trips
WHERE global_trip_id IS NOT NULL
GROUP BY global_trip_id HAVING count(*) > 1;

-- Per-school comparison; each school's registry count should match trip count
-- only AFTER all its trips have been reconciled.
SELECT t.owning_school_organization_id AS school_id,
       count(*) AS trip_count,
       count(r.id) AS registered_count
FROM public.trips t
LEFT JOIN control.trip_registry r ON r.id = t.global_trip_id
GROUP BY t.owning_school_organization_id
ORDER BY trip_count DESC;
