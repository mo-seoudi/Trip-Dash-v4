# Global trip identity — implementation checkpoint

Date: 2026-11-03. Branch: `feat/global-schema-audit`. **Not deployed.**

## Code changes
- `server/prisma/control.schema.prisma`: explicit `@db.Uuid` on 42 control-plane identity/foreign-key scalar fields. Existing PostgreSQL catalog confirms UUID for the audited control identities; the full set still requires validation against the live catalog and Prisma CLI.
- `server/prisma/operational.schema.prisma`: optional, unique `Trip.globalTripId` mapped to `public.trips.global_trip_id uuid`. Existing integer `Trip.id` and recurring series relations remain intact.
- Existing `GlobalTripRegistry` Prisma model corresponds to **proposed** `control.trip_registry`, not the empty legacy `public.trip_registry`.

## Strict release order
1. Run `npm run prisma:validate` in a controlled environment; reconcile any remaining native-type or constraint differences. **Do not use `prisma db push` against production**.
2. Validate SQL `001-control-trip-registry.sql` and `003-operational-trip-global-uuid.REVIEW_ONLY.sql` against a disposable database snapshot.
3. Deploy approved additive database changes **before** deploying the Prisma schema changes; otherwise Prisma may query a missing `global_trip_id` column.
4. Backfill existing operational UUIDs exactly once. Derive tenant and data-source ownership from verified school mappings. Never regenerate an existing UUID.
5. Add backend registration on single and recurring trip creation, plus retries/reconciliation for cross-database partial failures. Do not alter current authorization/workspace resolver.
6. Test null transport providers, multiple schools per tenant, separate customer-hosted databases, recurring occurrences, idempotent retries, and rollback.

## Known risks
- A successful V3 data integrity audit does not prove Prisma validates or that all 42 UUID annotations match the full live schema.
- Existing Prisma `ProviderOperatingCountry` composite PK is now verified by V3.
- No migrations have been run; **do not deploy this branch yet**.
