# Neon / Multi-PostgreSQL Readiness Gate

## Goal

Prove that TripDash business logic is PostgreSQL-portable and that one school can use a Neon PostgreSQL database while other schools continue using Supabase PostgreSQL, without changing the React application or duplicating business rules.

This is **not** a request to migrate production yet.

## Target architecture

The control plane remains authoritative for identity, tenants, organizations, memberships, role assignments, relationships, workspace access, audit metadata, and each organization's operational data-source registration.

Operational trip data may then be routed to the PostgreSQL data source registered for the owning school. `provider` is infrastructure metadata only; authorization and trip business logic must not contain `if Supabase` / `if Neon` branches.

A dedicated `prisma/operational.schema.prisma` now defines the portable operational database contract. It deliberately contains no foreign-key relationships to central users, tenants, organizations, roles, or memberships. Those references are stored as opaque IDs and validated/authorized by the backend control plane before an operational database is selected.

## Data-source contract

`OperationalDataSource` identifies tenant, optional organization, mode, provider, region, server-side `secretRef`, and active/verified state. The browser must never receive database credentials or `secretRef`.

A school-specific source overrides an explicitly configured tenant-level default. No source may be inferred from the provider name or frontend state.

## Readiness gates before first Neon organization

1. Canonical access tables are migrated and backfilled: AppUser, Organization, Membership, Role/Permission, RoleAssignment and OrganizationRelationship.
2. `BUS_OPERATOR` is canonical in the new schema. Legacy `bus_company` remains compatibility-only during data migration.
3. Backend effective-access resolution uses the canonical tables and rejects cross-tenant, inactive membership and expired/inactive relationship access.
4. Workspace-aware trip APIs authorize the requested school on the server before resolving a data source.
5. Operational data-source registry is available through an admin-only API/UI. Secrets are references, never browser-visible values.
6. A data-source resolver chooses the school-specific source, falling back only to an explicitly configured tenant default. It never guesses. **Code contract implemented; runtime validation pending.**
7. Prisma/schema migrations for the operational database are reproducible against a clean PostgreSQL database without Supabase-specific SQL requirements. **Portable schema split implemented; validation/migration pending.**
8. Existing Trip/Passenger/TripBusAssignment behavior and authorization tests pass against the normal test PostgreSQL database.
9. A provider-contract integration test can run the same operational test suite against two PostgreSQL connection strings.
10. Only after gates 1-9 do we create a disposable Neon project/database and register one test school against it.

## First Neon proof test

Suggested topology:

- Existing test School A -> Supabase PostgreSQL
- Existing test School B -> Supabase PostgreSQL
- `Neon Test School` -> Neon PostgreSQL

Use the same backend, frontend, operational Prisma schema and API routes for all three.

Acceptance criteria:

- A user with access to all three can switch workspaces without knowing which provider is behind each school.
- Portfolio reads return only authorized schools and can combine results without exposing credentials.
- Creating a trip in Neon Test School writes only to Neon.
- Creating a trip in a Supabase-backed school writes only to its configured source.
- Bus Operator / Service Partner relationship-derived access works identically across providers.
- Finance and passenger privacy rules are identical across providers.
- Disabling the Neon data source produces a controlled unavailable-data-source error, not a fallback into another school's database.
- No provider-specific business logic is added to React.

## Current status

Implemented on the architecture branch:

- additive central `OperationalDataSource` registry
- provider-neutral data-source validation/public-view contract
- separate provider-neutral operational Prisma schema
- generated-client build/validation scripts for central, legacy-global and operational schemas
- environment-backed secret-reference resolver (`env:NAME`)
- dynamic operational Prisma client pool
- school-specific data-source resolver with explicit tenant-default fallback
- graceful shutdown of dynamic clients

Still required before Neon execution:

- validate/generate all Prisma schemas in a real Node environment
- canonical access migration/backfill and `BUS_OPERATOR` cutover
- move effective-access resolution from the legacy global bridge to canonical access tables
- make trip/passenger/bus-assignment routes workspace-aware and route them through the operational resolver
- expose safe data-source administration in Access Control
- provider-contract tests against two PostgreSQL URLs

Therefore **we are closer, but not yet at the Neon execution gate**.
