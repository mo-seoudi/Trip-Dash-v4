# Multi-PostgreSQL Readiness Gate

## Goal

Prove that TripDash business logic is PostgreSQL-portable and that different schools can use different PostgreSQL hosts (for example Supabase, Neon, AWS-hosted PostgreSQL, or another compatible service) without changing the React application or duplicating business rules.

This is an architecture/readiness gate, not a production migration instruction.

## Target architecture

The control plane is authoritative for identity, tenants, organizations, memberships, role assignments, relationships, workspace access, audit metadata, and operational data-source registration.

Operational trip data is routed by the backend to the PostgreSQL data source registered for the owning school. Provider is infrastructure metadata only; authorization and trip business logic must not branch on provider names.

`server/prisma/operational.schema.prisma` defines the provider-neutral operational database contract. It contains no foreign-key relationships to control-plane users, tenants, organizations, roles, or memberships. Control-plane references are stored as opaque IDs in operational records and are authorized by the backend before a data source is selected.

The React frontend talks to the backend API only. It does not receive PostgreSQL connection strings, database credentials, secret references, or provider-specific database SDK access.

## Data-source contract

`OperationalDataSource` identifies the tenant, optional organization, mode, provider, region, server-side credential relationship, and active/verified state.

Credentials are represented through the control-plane credential/secret-provider model and are resolved only on the server. Browser-safe API responses must never expose credential material or secret references.

A school-specific source overrides an explicitly configured tenant-level default. No source may be inferred from a provider name or frontend state.

## Current canonical baseline

Implemented on `architecture-rebuild`:

1. Canonical control-plane Prisma schema and generated client.
2. Canonical provider-neutral operational Prisma schema and generated client.
3. Canonical `AppUser` authentication identities and scoped access model.
4. Backend effective-access resolution through the control plane.
5. Workspace-aware operational APIs that authorize organization access before resolving operational data.
6. Canonical `OperationalDataSource` administration backed by control-plane records.
7. Server-side secret-provider resolution and operational Prisma client creation.
8. CI validation/generation of both canonical Prisma schemas.
9. Clean-PostgreSQL operational schema application and invariant smoke testing.
10. Live-server startup smoke testing so broken runtime imports cannot pass architecture validation unnoticed.
11. Deterministic dependency installation from reconciled lockfiles.

## Remaining readiness gates for a second PostgreSQL host

Before registering the first organization against a second real PostgreSQL provider:

1. Confirm the target provider accepts the canonical operational Prisma schema without provider-specific changes.
2. Configure a server-side secret provider/credential reference for the target database; never place the connection string in frontend configuration.
3. Register a dedicated `OperationalDataSource` for a disposable test organization/school.
4. Verify the source through the canonical datasource-admin API.
5. Run the same operational contract/invariant suite against both the existing PostgreSQL host and the second host.
6. Exercise workspace switching and operational reads/writes through the normal backend API, confirming each school's records remain in its configured database.
7. Verify relationship-derived access (school, bus operator, service partner and finance scopes) behaves identically regardless of database host.
8. Verify disabling or misconfiguring a school-specific source returns a controlled data-source error and never falls through to another organization's database.
9. Verify no provider-specific branching or credentials have been introduced into React.

## First multi-host proof test

Suggested topology:

- Test School A -> existing Supabase PostgreSQL operational database
- Test School B -> existing Supabase PostgreSQL operational database
- Multi-host Test School -> second PostgreSQL provider (for example Neon or AWS-hosted PostgreSQL)

All schools use the same backend, frontend, operational Prisma schema, authorization model and workspace APIs.

Acceptance criteria:

- An authorized user can switch between all test schools without needing to know which provider hosts each database.
- Portfolio reads return only authorized schools and can combine results without exposing credentials.
- Creating a trip writes only to the operational database configured for the owning school.
- Bus Operator and Service Partner relationship-derived access works identically across providers.
- Finance and passenger privacy rules are identical across providers.
- Disabling the second-provider data source produces a controlled unavailable-data-source error, not fallback into another school's database.
- No provider-specific business logic is added to React.

## Status

The architecture is now at the point where introducing a second PostgreSQL host is primarily an integration/proof exercise rather than another architectural redesign.

The next meaningful proof is to connect a disposable second-provider PostgreSQL database through the existing control-plane datasource and credential model and run the canonical operational tests against it.
