# TripDash v4 Architecture Rebuild

This branch rebuilds the v4 backend and data model around a multi-organization SaaS architecture with scoped role-based access and relationship-aware authorization over shared operational workflows.

## Design goals

1. Preserve the useful v4 trip experience and existing data while replacing the fragile access architecture underneath it.
2. Treat PostgreSQL as the application database contract. Supabase is a hosting option, not an application dependency.
3. Keep authentication, authorization, organization relationships, trip workflow rules, and data routing as explicit backend concerns.
4. Use one canonical user identity. Do not maintain a legacy user and a second global user that must be reconciled.
5. Model organizations and cross-organizational relationships directly so schools, groups, bus operators, and service partners can collaborate safely on the same operational records.
6. Make role scope explicit. A user's permissions come from role + scope + organization relationships + resource participation, not from one global role string.
7. Keep physical database routing separate from authorization. Database location must never be the security model.
8. Design for hosted PostgreSQL first, while leaving a clean path to customer-controlled PostgreSQL later.

## Logical domains

### Platform / access domain

- users
- tenants
- organizations
- organization relationships
- organization memberships
- roles
- permissions
- access grants / role assignments
- authentication identities
- audit events
- operational data-source metadata

### Operational domain

- trips
- trip passengers
- bus assignments and passenger allocations
- bus bookings
- trip activity / lifecycle events
- pricing / finance fields

The canonical architecture separates the central control-plane PostgreSQL database from provider-neutral operational PostgreSQL databases. Operational records carry control-plane IDs as scalar identifiers rather than cross-database foreign keys.

## Organization model

Supported organization types initially:

- SCHOOL_GROUP
- SCHOOL
- BUS_OPERATOR
- SERVICE_PARTNER

Examples:

- Cognita UAE -> SCHOOL_GROUP
- Repton Dubai -> SCHOOL
- STS -> BUS_OPERATOR
- Enrich Me -> SERVICE_PARTNER

A SaaS tenant is the commercial/workspace account. A tenant has a root organization. Cross-tenant provider relationships require explicit authorization policy before they are enabled; database location itself never grants access.

## Organization relationships

Relationships are first-class records rather than hard-coded role exceptions.

Initial relationship types:

- BELONGS_TO_GROUP
- TRANSPORT_PROVIDER
- TRIP_MANAGER
- WORKS_WITH_TRANSPORT_PROVIDER

Example graph:

Cognita UAE <- BELONGS_TO_GROUP - Repton Dubai
Repton Dubai - TRANSPORT_PROVIDER -> STS
Repton Dubai - TRIP_MANAGER -> Enrich Me
Enrich Me - WORKS_WITH_TRANSPORT_PROVIDER -> STS

Relationships can be active/inactive and may later include validity dates and commercial metadata.

## Identity, membership, role and scope

Identity answers: who is the person?

Membership answers: which organization does the person belong to?

Role assignment answers: what may the person do, and at what scope?

A user may have multiple assignments. Canonical system roles currently include super_admin, tenant_admin, group_staff, school_staff, bus_operator, service_partner and finance; finer-grained roles can be added deliberately as the permission model matures.

## Authorization decision

Every protected backend operation should answer the same questions:

1. Is the caller authenticated and active?
2. What are the caller's direct memberships and role assignments?
3. What organization scope does the requested resource belong to?
4. Which organization relationships are relevant?
5. Is the caller's organization a participant in this resource?
6. Does the caller's role contain the requested permission?
7. Are there field-level restrictions for this role?

Example: an STS Bus Operator user may read a Repton Dubai trip only when STS is an authorized transport provider/participant for that school or trip. Bus Operator access does not automatically include passenger-sensitive data.

## Trip ownership and participation

Trips must carry explicit organizational context. At minimum:

- owning school
- managing organization (optional)
- transport provider (optional)
- creating user
- tenant/workspace that owns the operational record

This allows the backend to distinguish ownership from participation. A school may own a trip while a service partner manages it and a Bus Operator fulfils it.

## Authentication direction

Authentication and authorization are separate.

The backend should resolve any supported login method to one TripDash user identity. Local email/password may remain during the rebuild, while Microsoft Entra/OIDC can be added later without changing organization permissions.

Target session design:

- no hard-coded or fallback production secrets
- short-lived access token/session identity
- refresh/session revocation capability
- httpOnly secure refresh/session cookie where practical
- no authorization decisions based only on claims embedded in an old token
- account status revalidated server-side

## Database hosting and future routing

The backend resolves each school workspace to an operational PostgreSQL data source. PostgreSQL is the application contract; Supabase, Neon or another compatible provider may host a particular operational database. The backend, not partner users, owns the database connection. Cross-organizational users never receive database credentials.

Operational data-source metadata includes mode, provider, region, secret reference and verification status. Raw customer database passwords must not be stored in normal application tables.

## Migration strategy

The rebuild must be additive and reversible until cutover.

Phase 1 - audit and security baseline
- isolate work on this branch
- centralize Prisma clients
- require authentication on protected routes
- remove secret fallbacks
- remove duplicate route mounting
- document current endpoint dependencies

Phase 2 - new access model
- establish the dedicated control-plane schema for tenants, organizations, relationships, memberships, roles/permissions and assignments
- preserve compatible legacy identifiers for migration
- seed system roles and permissions
- plan/backfill useful legacy global/control-plane data into the dedicated control plane

Phase 3 - authorization service
- central access-context resolver
- permission checks by action/resource
- relationship-aware school/provider access
- field-level response shaping where needed
- audit logging for privileged actions

Phase 4 - operational ownership
- establish provider-neutral operational schema with scalar control-plane identifiers
- backfill old rows into canonical operational databases
- move trip CRUD to workspace-routed service/repository layers
- apply authorization before every operational query/mutation

Phase 5 - authentication rebuild
- replace ad-hoc auth/session code with one auth service
- session revocation/refresh
- invite/onboarding flow
- external identity provider support

Phase 6 - administration frontend
- platform super-admin workspace
- tenant/organization administration
- user memberships and role assignments
- organization relationship management
- audit and access review screens

Phase 7 - retire legacy paths and transitional schemas
- verify no frontend/API dependency remains on PrismaGlobal and `/api/global` legacy routes before retirement
- complete the dedicated Control Plane consolidation gate documented in `ACCESS_V2_MIGRATION_PLAN.md`
- retire legacy `/api/trips` only after the workspace route cutover gate below is satisfied
- archive legacy schemas/data only after migration, verification, observation period and explicit production approval

### Legacy `/api/trips` retirement gate

`/api/trips` is intentionally still live during migration and remains governed by creator/global-role rules in `legacyAuthorization.js`. The canonical path is `/api/workspaces/:schoolId/trips` plus its workspace-scoped passenger and bus-assignment endpoints. Keeping both forever would create two answers to the same authorization question, so the legacy path has an explicit removal gate.

The legacy path may be removed only when **all** of the following are true:

1. The browser frontend no longer calls `/api/trips` for trip CRUD, requests, passengers or historical SubTrip reads.
2. Every required behavior has a workspace-scoped equivalent with canonical permission checks and field-level privacy rules.
3. The frontend always has/resolves the active school workspace ID needed to construct workspace endpoints.
4. A test/audit pass confirms normal browser workflows produce no requests to legacy `/api/trips` endpoints.
5. Authorization parity has been reviewed for each migrated action. Canonical access may be narrower while discrepancies are fixed, but it must never broaden access merely to imitate legacy behavior.
6. Historical SubTrip reads are either no longer needed by the frontend or are exposed only through a migration-safe/read-only compatibility path; SubTrip creation must not return.
7. Legacy route removal and its `legacyAuthorization.js` dependencies pass the full server contract suite and operational PostgreSQL tests.

Current frontend dependency audit (`client/src/services/tripService.js`):

- `getAllTrips` -> `GET /trips`
- `getTripsByUser` -> `GET /trips?createdBy=...`
- `createTrip` -> `POST /trips`
- `updateTrip` / `assignBusesToTrip` -> `PATCH /trips/:id`
- `deleteTrip` -> `DELETE /trips/:id`
- `createSubTrips` -> `POST /trips/:id/subtrips` (**obsolete and server-retired; frontend helper must be removed, not migrated**)
- `getSubTripsByParent` -> `GET /trips/:id/subtrips` (historical compatibility only)
- passenger roster/create/update/payment helpers -> `/trips/:id/passengers...`
- cancel/edit request and provider/admin response helpers -> `/trips/:id/...`

These call sites are the concrete frontend cutover checklist. Do not delete the legacy route merely because workspace routes exist; first migrate the frontend behavior and prove the browser no longer reaches it.

## Non-goals for the first rebuild pass

- subscriptions/billing
- white labelling
- advanced SSO provisioning

Provider-neutral multi-database routing is now part of the rebuild architecture, but customer BYO database onboarding UI and production provider migrations remain later controlled work.

The schema and backend boundaries should permit those later without making them prerequisites for a secure working product.
