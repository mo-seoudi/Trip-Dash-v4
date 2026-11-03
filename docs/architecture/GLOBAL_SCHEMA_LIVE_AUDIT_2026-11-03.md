# Live Supabase compatibility audit — 2026-11-03

Source: user-run `000-global-compatibility-audit-v2.READ_ONLY.sql` output. Read-only; no migration executed.

## Observed counts and mappings
- 58 current `public.trips`; 0 `public.trip_registry` rows.
- Four schools have trips; **each has exactly one** `control.tenant_organizations` mapping and one active `control.operational_data_sources` record, all HOSTED PostgreSQL:
  - Test School: 54 trips, 53 without assigned transport provider.
  - Saida Secondary: 2 trips, 1 without assigned provider.
  - Repton Dubai: 1 trip, 1 without assigned provider.
  - RGS: 1 trip, 0 without assigned provider.
- Therefore 56 of 58 trips have null provider references; null provider must remain supported.
- `public.trips` organization and creator IDs are TEXT; `control.organizations.id` is UUID. Application must validate/cast at boundaries; never assume cross-database FKs.
- `control.organizations` has live fields not previously modeled: country_code, region_code, created_source, claim_status, verification_status, operational_status, directory_visible, claimed_at, verified_at.
- `control.provider_operating_countries` exists with organization_id UUID and country_code TEXT.
- No user-defined triggers were returned for the selected audited tables (not an audit of all DB triggers).
- All four sources have null schema_version; this does **not** prove customer-hosted compatibility.

## Implementation updates
- `control.schema.prisma` now includes observed organization profile fields and a ProviderOperatingCountry model, **pending verification of live primary/unique keys**.
- Canonical GlobalTripRegistry remains a proposed model and review-only SQL. No registry or operational UUID migration has run.

## Remaining safety gates
1. Inspect `control.provider_operating_countries` actual primary/unique constraint before deploying Prisma model (composite key currently an assumption).
2. Verify `control` table UUID types, Prisma model-to-DB alignment, and migrations without destructive drift.
3. Confirm tenant coverage for any future school not in the 58-trip sample.
4. Prepare an additive operational UUID column and backfill that maps each trip to its existing school, tenant and source; preserve existing integer IDs.
5. Implement idempotent cross-database registration, failure recovery and hosted/customer-hosted tests.
6. Do not execute `001-control-trip-registry.sql` or remove duplicate tables until reviewed.
