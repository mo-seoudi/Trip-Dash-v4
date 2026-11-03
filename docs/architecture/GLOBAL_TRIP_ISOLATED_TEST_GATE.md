# Isolated Global Trip Migration — Test Gate

## Confirmed preflight (user-run read-only SQL, 2026-11-03)
- 58 trips across 4 schools (54, 2, 1, 1).
- Exactly one active HOSTED source per school.
- Missing/unknown schools, invalid sources, invalid tenant coverage, invalid providers: all 0.
- No duplicate local IDs.
- control.trip_registry absent; public.trips.global_trip_id absent; legacy public.trip_registry exists.

## Test environment required
Use a **separate, disposable** Supabase project or PostgreSQL database with an isolated connection string. Do not use the live TripDash project's SQL Editor for write tests. Do not paste database passwords into chat or commit them to GitHub.

### Preparation
1. Confirm the isolated project has `control` and `public` schemas and representative schema constraints, enums, foreign keys, and data.
2. Copy only sanitized sample records; do not expose personal or student data.
3. Confirm `control.tenants`, `control.organizations`, `control.tenant_organizations`, `control.operational_data_sources` and `public.trips` exist with correct types and constraints.
4. Run `004-global-trip-migration-preflight.READ_ONLY.sql` against the clone, recording results. Do not expect the same 58 count if using a representative subset.

### Controlled test execution (not yet authorized)
1. Review `001-control-trip-registry.sql` and `003-operational-trip-global-uuid.REVIEW_ONLY.sql` against the clone's live catalog.
2. Apply both scripts **only to the clone** after review.
3. Generate clients and run reconciliation per school against clone-specific environment variables.
4. Run `005-global-trip-postmigration-verification.TEST_ONLY.sql`; verify missing UUIDs, unmatched registry rows, duplicates and ownership mismatches are all 0.
5. Re-run reconciliation from cursor 0; confirm no UUID changes and no new registry rows.
6. Exercise single and recurring trip creation with the feature flag disabled, then enabled in the clone, plus retry/failure cases.
7. Preserve integer local IDs and the legacy registry throughout.

## Production gate
No production migrations, deploys or feature-flag activation until test results, backup/restore, authorization and rollback plan are reviewed. CI passing is not sufficient evidence of live DB compatibility.
