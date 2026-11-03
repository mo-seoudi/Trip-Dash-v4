# V3 live compatibility gate — 2026-11-03

Source: user-run `002-global-constraints-integrity-audit.READ_ONLY.sql` output.

## Confirmed
- `public.trips`: 58 rows; missing school references 0; missing assigned provider references 0; ambiguous tenant coverage 0; ambiguous active operational source 0.
- `control.trip_registry`: absent.
- `public.trips.global_trip_id`: absent.
- `control.provider_operating_countries`: PRIMARY KEY (organization_id, country_code); FK to control.organizations(id) ON DELETE CASCADE. The previously provisional Prisma composite key is confirmed.
- `control.tenant_organizations`: PRIMARY KEY (tenant_id, organization_id), with FKs to control.tenants and control.organizations.
- `control.operational_data_sources`: PRIMARY KEY (id), FK organization_id to control.organizations.
- `public.trips`: integer PK, series occurrence unique constraint, FK trip_series_id to public.trip_series. Two FK constraints were reported on the same trip_series_id column; preserve until separately assessed.
- `public.trip_registry`: existing legacy table with FKs to public.tenants, public.organizations and public.data_connections_legacy_cutover; unique (tenant_id,trip_code). Earlier audit returned zero rows. This table is NOT the proposed global registry and must not be moved/reused without a dedicated migration review.

## Consequences
1. Global registry should be a NEW `control.trip_registry` table; preserve `public.trip_registry` untouched for now.
2. Add `public.trips.global_trip_id` in an additive, independently reviewed migration. Keep existing integer `id` and recurring series identifiers.
3. Existing records can be mapped to one tenant and one source per owning school; any future records require the same validation.
4. Operator ID must remain nullable; absence is normal for many trips.
5. Cross-database consistency requires idempotent backend registration and reconciliation. No native cross-database FK.
6. Before deploying, verify Prisma schema native UUID types against the live catalog, then validate generated clients and migrations in a non-production environment.

## Deployment status
NO schema migration executed by this audit. Files `001-control-trip-registry.sql` and `003-operational-trip-global-uuid.REVIEW_ONLY.sql` remain review-only.
