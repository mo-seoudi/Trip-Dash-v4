-- REVIEW ONLY. Do not execute before verifying existing control schema and tenant coverage.
-- Additive canonical registry; deliberately does NOT move/drop public.trip_registry.
-- Run only after confirming control table names, UUID types, and ownership mappings.
BEGIN;
CREATE TABLE IF NOT EXISTS control.trip_registry (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES control.tenants(id) ON DELETE RESTRICT,
  school_org_id uuid NOT NULL REFERENCES control.organizations(id) ON DELETE RESTRICT,
  data_source_id uuid NOT NULL REFERENCES control.operational_data_sources(id) ON DELETE RESTRICT,
  created_by_user_id uuid REFERENCES control.app_users(id) ON DELETE RESTRICT,
  operational_trip_id integer,
  registration_status text NOT NULL DEFAULT 'pending'
    CHECK (registration_status IN ('pending','active','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trip_registry_data_source_local_id_unique UNIQUE (data_source_id, operational_trip_id),
  CONSTRAINT trip_registry_active_requires_local_id
    CHECK (registration_status <> 'active' OR operational_trip_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS trip_registry_school_created_idx ON control.trip_registry(school_org_id, created_at);
CREATE INDEX IF NOT EXISTS trip_registry_creator_idx ON control.trip_registry(created_by_user_id);
CREATE INDEX IF NOT EXISTS trip_registry_tenant_created_idx ON control.trip_registry(tenant_id, created_at);
COMMIT;
