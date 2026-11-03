# Global trip registration wiring — 2026-11-03

## Implemented on feat/global-schema-audit
- `server/src/services/globalTripRegistryService.js`: idempotent UUID assignment and control registry reconciliation.
- `server/src/services/globalTripRegistrationHook.js`: default-off post-creation hook with per-trip error reporting.
- `server/src/domain/trips/tripController.js`: invokes hook after individual trip creation.
- `server/src/routes/workspaceTripSeriesRoutes.js`: collects IDs of created recurring occurrences and invokes hook **after** the operational transaction commits; response shape remains unchanged.
- `GLOBAL_TRIP_REGISTRATION_ENABLED=true` is **not** authorized for production until migrations, Prisma validation, and recovery worker are complete.

## Known remaining blockers
1. Run Prisma validation and unit tests. The GitHub edits have not been executed in a running backend.
2. Run reviewed migrations on a test database before deploying the updated Prisma clients.
3. Add durable retry/reconciliation (current hook logs failures but has no persistent queue). Do not activate while this is missing.
4. Improve concurrency safety for multiple registry workers and enforce ownership at the DB transaction boundary.
5. Backfill the 58 existing trips, including unassigned providers; verify totals and integrity.
6. Confirm deletion, provider changes and customer-hosted data-source behavior; test recurring booking generation with many occurrences.
7. Preserve authorization, legacy public.trip_registry and integer operational trip IDs.

## Safety
No database changes and no deployment performed. Flag defaults off. The presence of new Prisma field `global_trip_id` still requires the operational migration **before deploying this branch**, even with the flag disabled.
