# Global trip identity — controlled migration runbook (review only)

## Current gate
- GitHub CI validates Prisma and unit tests; it does not prove compatibility with live Supabase.
- The 58-trip inventory is from the prior read-only audit and must be rechecked immediately before migration.
- `public.trip_registry` is a separate legacy table; do not rename, delete or modify it.
- The new application Prisma model references `public.trips.global_trip_id`; **do not deploy the updated backend to any database without that column**.
- Vercel preview success is not evidence that the Render backend and database migrations are safe.

## Phase A — preflight (no writes)
1. Run `004-global-trip-migration-preflight.READ_ONLY.sql` in the target database.
2. Require 0 missing schools, 0 unknown schools, 0 invalid source counts, 0 invalid tenant counts, 0 invalid provider references and 0 duplicate local IDs.
3. Record exact trip count, school breakdown, source modes, existing column/table state.
4. Confirm control and operational Prisma native UUID types against actual PostgreSQL catalog; CI validation alone is insufficient.
5. Confirm backup/restore capability and perform a restore drill on a non-production copy.

## Phase B — isolated test database only
1. Create a sanitized clone with both `control` and `public` schemas, their constraints and representative trip data.
2. Review `001-control-trip-registry.sql` and `003-operational-trip-global-uuid.REVIEW_ONLY.sql`; check the DDL against the cloned catalog. Do not run `prisma db push`.
3. Apply the reviewed scripts in the clone only, in a documented order. Verify unique IDs and preserved integer primary keys.
4. Generate the Prisma clients and exercise individual and recurring creation, existing-trip reads, provider-null cases, multiple school workspaces and different operational sources.
5. Run `reconcile-global-trips.mjs` with its explicit environment gate against the clone. It scans each school separately. Rerun from cursor 0 to retry failures.
6. Assert for every operational trip exactly one canonical registry record matching UUID, tenant, school, source and integer local ID. Verify zero conflicts and zero missing rows.
7. Exercise retry and concurrent-worker cases. Add stronger database-side ownership guarantees if necessary.
8. Test deletion and provider reassignment behavior before enabling the booking hook.

## Phase C — production approval required
1. Freeze new trip writes for the short migration window or implement and verify an online migration strategy.
2. Take a verified backup; rerun preflight and compare inventory.
3. Apply the approved additive DDL to the correct physical databases, including each customer-managed source as applicable.
4. Deploy backend with `GLOBAL_TRIP_REGISTRATION_ENABLED=false`, verify reads and existing booking paths.
5. Run controlled reconciliation per school, collect results and compare against independent SQL checks.
6. Only after full consistency verification, enable `GLOBAL_TRIP_REGISTRATION_ENABLED=true` on the backend and monitor errors.
7. Keep a documented rollback path: disable the flag, revert application build if needed; do not drop UUIDs/registry as a reflexive rollback.

## Blockers before production
- No tested isolated migration or restore drill yet.
- Current hook logs failures but does not schedule persistent automatic retries; manual sweep exists.
- Registry upsert checks ownership but is not a cross-database atomic transaction.
- A per-school scan with a cursor is not a permanent queue; restart at 0 after any failures.
- Existing 58-trip snapshot may change before deployment.
- All target physical databases must be migrated before the updated operational Prisma client is deployed.
