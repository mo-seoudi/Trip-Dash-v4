-- TEST DATABASE ONLY. Run AFTER reviewed migrations 001 and 003 and
-- a completed reconciliation sweep on a disposable clone, never production.
-- Read-only verification. All exception counts below must be zero.
-- The canonical control registry intentionally has no bus_company_org_id;
-- provider identity remains on operational trips.
SELECT
  (SELECT count(*) FROM public.trips) AS operational_trips,
  (SELECT count(*) FROM public.trips WHERE global_trip_id IS NULL) AS missing_global_uuids,
  (SELECT count(*) FROM control.trip_registry) AS registry_rows,
  (SELECT count(*) FROM control.trip_registry WHERE registration_status = 'active') AS active_registry_rows,
  (SELECT count(*) FROM public.trips t
   LEFT JOIN control.trip_registry r ON r.id = t.global_trip_id
   WHERE r.id IS NULL) AS trips_without_registry,
  (SELECT count(*) FROM public.trips t
   JOIN control.trip_registry r ON r.id = t.global_trip_id
   WHERE r.operational_trip_id IS DISTINCT FROM t.id
      OR r.school_org_id::text IS DISTINCT FROM t.owning_school_organization_id::text
      OR r.registration_status IS DISTINCT FROM 'active'
      OR NOT EXISTS (
        SELECT 1 FROM control.operational_data_sources ds
        WHERE ds.id = r.data_source_id
          AND ds.organization_id::text = t.owning_school_organization_id::text
      )
      OR NOT EXISTS (
        SELECT 1 FROM control.tenant_organizations membership
        WHERE membership.tenant_id = r.tenant_id
          AND membership.organization_id = r.school_org_id
      )
      OR (t.created_by_app_user_id IS NOT NULL
          AND r.created_by_user_id::text IS DISTINCT FROM t.created_by_app_user_id::text)
   ) AS mismatched_registry_rows,
  (SELECT count(*) FROM control.trip_registry r
   WHERE r.registration_status = 'active'
     AND NOT EXISTS (
       SELECT 1 FROM public.trips t
       WHERE t.global_trip_id = r.id AND t.id = r.operational_trip_id
     )) AS orphan_active_registry_rows;

-- Unmatched operational trips: expect no rows.
SELECT t.id, t.owning_school_organization_id, t.global_trip_id
FROM public.trips t
LEFT JOIN control.trip_registry r ON r.id = t.global_trip_id
WHERE r.id IS NULL
ORDER BY t.id
LIMIT 100;

-- Duplicate UUIDs, independently of the unique index: expect no rows.
SELECT global_trip_id, count(*) AS duplicate_count
FROM public.trips
WHERE global_trip_id IS NOT NULL
GROUP BY global_trip_id HAVING count(*) > 1;

-- Each school's registered count should match its operational trip count.
SELECT t.owning_school_organization_id AS school_id,
       count(*) AS trip_count,
       count(r.id) AS registered_count
FROM public.trips t
LEFT JOIN control.trip_registry r ON r.id = t.global_trip_id
GROUP BY t.owning_school_organization_id
ORDER BY trip_count DESC;
