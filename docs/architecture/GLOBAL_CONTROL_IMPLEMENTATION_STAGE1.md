# Global control plane implementation — stage 1

Branch: `feat/global-schema-audit`. Source: `v5-revamp`.

## Implemented in repository
- Added `GlobalTripRegistry` to `server/prisma/control.schema.prisma`, with relationships to canonical `Tenant`, `Organization`, and `OperationalDataSource`.
- Added **review-only** additive SQL in `server/prisma/migrations-review/001-control-trip-registry.sql`.
- No migration was executed; no live data was changed.

## Existing behavior that must remain
- Authentication and organization membership are resolved in the control plane.
- The selected school workspace resolves its own operational data source.
- School/provider trip visibility continues to use established relationship and authorization rules.
- Operational trip IDs remain integers; recurring series IDs are not individual trip IDs.

## Gates before migration or runtime wiring
1. Confirm exact live column types, constraints, and trigger behavior for `control` and `public` (including the additional organization profile fields absent from Prisma).
2. Confirm each school's tenant coverage and active `control.operational_data_sources` assignment; existing `public.trip_registry` is empty, but its old required `data_connection_id` points to legacy configuration and must not be blindly copied.
3. Add `global_trip_id uuid` to operational `trips` via separately reviewed, backward-compatible migration; backfill all current trips using the **actual resolved school data source and tenant**, without inventing values.
4. Update single-trip and recurring-occurrence creation to register the **same UUID** in the control registry with idempotent recovery for cross-database failures. Do not register a series UUID as a trip UUID.
5. Add read-only verification and tests for hosted and customer-hosted operational databases, provider visibility, and retries.
6. Only after validation, consider moving old registry and removing duplicate identity tables. No renaming, dropping, or live execution in this stage.

## Scope note
The SQL is a candidate for review, **not** an automatically deployable migration. It assumes existing canonical control tables have UUID IDs. It does not modify operational data or resolve historic tenant mappings.
