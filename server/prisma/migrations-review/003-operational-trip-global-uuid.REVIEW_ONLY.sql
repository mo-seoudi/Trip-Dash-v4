-- REVIEW ONLY. NOT APPROVED FOR EXECUTION.
-- Add global identity to operational trip occurrences without replacing integer id.
-- Depends on successful V3 compatibility audit and reviewed control registry schema.
-- The application must populate/synchronize control.trip_registry separately.
BEGIN;
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS global_trip_id uuid;
-- UUIDs must be unique within each operational database.
CREATE UNIQUE INDEX IF NOT EXISTS trips_global_trip_id_unique
  ON public.trips (global_trip_id);
-- Backfill existing trips with stable UUIDs. This must run only once after preflight.
UPDATE public.trips SET global_trip_id=gen_random_uuid()
 WHERE global_trip_id IS NULL;
-- Do not add NOT NULL yet: first deploy compatible write paths and verify.
COMMIT;
