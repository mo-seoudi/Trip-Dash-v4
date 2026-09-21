# TripDash Architecture Baseline

This document describes the current architecture on `architecture-rebuild`. It is the baseline for continued development and cleanup. Historical implementation stages are not product versions and should not be named V2/V3/etc.

## Core architecture

TripDash has two deliberate PostgreSQL data planes:

1. **Control Plane** — `server/prisma/control.schema.prisma`, configured by `CONTROL_DATABASE_URL`.
2. **Operational Plane** — `server/prisma/operational.schema.prisma`, reached through the backend's operational data-source resolver and Prisma factory.

The browser does not connect directly to Supabase, Neon, AWS, or another database host. It talks to the TripDash backend API. PostgreSQL is the database contract; the hosting provider is an infrastructure choice.

There is no third default/global Prisma schema in the canonical runtime.

## Control Plane responsibilities

The Control Plane owns platform identity and authorization metadata:

- AppUser and authentication identities/sessions
- tenants and organizations
- organization memberships
- roles, permissions and scoped role assignments
- organization relationships
- operational data-source metadata
- credential/secret references
- audit/control metadata

Authorization is not a single `User.role` value. Effective access is derived from identity, active membership, scoped role assignments, permissions, organization relationships and resource participation.

Supported organization concepts include school groups, schools, bus operators and service partners. A school may book a provider directly, or an authorized service partner may manage a trip on the school's behalf.

## Operational Plane responsibilities

Operational databases own transport workflow data such as:

- trips
- trip series
- passengers and passenger payments
- bus assignments and passenger allocations
- bookings
- quotation/workflow state
- lifecycle/activity records
- operational commercial fields

Operational records store Control Plane identifiers as scalar IDs. Cross-database Prisma relations are intentionally avoided.

## Runtime routing

The live server mounts canonical workspace routes under `/api/workspaces/:schoolId` plus canonical access, datasource, session/authentication and integration routes.

The frontend trip service uses workspace-scoped trip, passenger, bus-assignment and workflow endpoints. CI contains a regression guard that fails if direct legacy `/trips` calls or SubTrip helpers return to the frontend.

## Authentication and authorization

Authentication resolves to canonical `AppUser` identities in the Control Plane. Protected requests reload current user state rather than trusting an old role claim as the security boundary.

Authorization is enforced server-side through the canonical access/workspace authorization layers. Frontend role/permission logic is an affordance layer only and must not be treated as the final security boundary.

## Operational database hosting

A workspace resolves to an `OperationalDataSource` in the Control Plane. The backend resolves its credential through the secret-provider abstraction and creates/reuses the corresponding operational Prisma client.

This allows different operational databases to be hosted by Supabase, Neon, AWS PostgreSQL/RDS/Aurora, or another PostgreSQL-compatible provider without exposing database credentials to the frontend.

The architecture also permits different customers to use different PostgreSQL hosts or accounts, provided the operational schema contract is satisfied.

## Migration and preservation

The repository still contains deliberate migration tooling for converting useful existing trip data into the canonical operational schema. That tooling is not part of the live request path, but it remains valuable until data migration/cutover is complete.

Historical role/audit documentation may also remain as migration evidence where it describes behavior that must be preserved. Historical documentation must not be mistaken for the current runtime architecture.

## Cleanup rules

During the remaining architecture cleanup:

- remove dead runtime compatibility layers and orphaned tests;
- remove stale references to retired Prisma clients/schemas and retired routes;
- keep migration/cutover tooling that still protects existing data;
- keep regression tests that prevent retired APIs or concepts from returning;
- do not introduce V2/V3 naming for normal design corrections;
- do not preserve duplicate architecture merely because it existed previously.

## CI contract

Architecture Validation must prove at minimum:

- deterministic dependency installation from lockfiles;
- Control Plane Prisma schema validation/generation;
- Operational Plane Prisma schema validation/generation;
- disposable PostgreSQL schema creation;
- access/operational contract tests;
- successful live server startup and `/health` response;
- successful React client build.

Operational PostgreSQL Verification separately applies the operational schema to clean PostgreSQL and runs database invariants.

## Next development direction

After the remaining structural cleanup is complete, development should move back to the product itself, including the professional Super Admin control center for organizations, permissions, roles, data-source connections and safe credential/vault administration.
