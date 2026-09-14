# TripDash v4 Architecture Rebuild

This branch rebuilds the v4 backend and data model around a multi-organization SaaS architecture with scoped role-based access and relationship-aware authorization over shared operational workflows.

## Design goals

1. Preserve the useful v4 trip experience and existing data while replacing the fragile access architecture underneath it.
2. Treat PostgreSQL as the application database contract. Supabase is a hosting option, not an application dependency.
3. Keep authentication, authorization, organization relationships, trip workflow rules, and data routing as explicit backend concerns.
4. Use one canonical user identity. Do not maintain a legacy user and a second global user that must be reconciled.
5. Model organizations and cross-organizational relationships directly so schools, groups, bus companies, and service partners can collaborate safely on the same operational records.
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
- sub-trips / bus allocations
- bus bookings
- trip activity / lifecycle events
- pricing / finance fields

These domains may initially live in the same PostgreSQL database. The logical boundary is deliberate so operational data can later move to a tenant-specific PostgreSQL database without redesigning identity or authorization.

## Organization model

Supported organization types initially:

- SCHOOL_GROUP
- SCHOOL
- BUS_COMPANY
- SERVICE_PARTNER

Examples:

- Cognita UAE -> SCHOOL_GROUP
- Repton Dubai -> SCHOOL
- STS -> BUS_COMPANY
- Enrich Me -> SERVICE_PARTNER

A SaaS tenant is the commercial/workspace account. A tenant has a root organization, but not every organization relationship is restricted to the same tenant. This is important because a bus company can serve schools belonging to other tenants.

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

A user may have multiple assignments. Examples:

- platform_super_admin @ PLATFORM
- group_admin @ Cognita UAE
- school_admin @ Repton Dubai
- school_staff @ Repton Dubai
- teacher @ Repton Dubai
- bus_operator_admin @ STS
- dispatcher @ STS
- service_partner_admin @ Enrich Me
- service_partner_staff @ Enrich Me
- finance @ an organization/group

Roles should map to permissions such as trip.read, trip.create, trip.edit_request, trip.accept, trip.assign_vehicle, trip.cancel, passenger.read_transport_fields, passenger.read_sensitive_fields, user.manage, organization.manage, relationship.manage, and audit.read.

## Authorization decision

Every protected backend operation should answer the same questions:

1. Is the caller authenticated and active?
2. What are the caller's direct memberships and role assignments?
3. What organization scope does the requested resource belong to?
4. Which organization relationships are relevant?
5. Is the caller's organization a participant in this resource?
6. Does the caller's role contain the requested permission?
7. Are there field-level restrictions for this role?

Example: an STS dispatcher may read a Repton Dubai trip only when STS is an active transport provider for that school and/or assigned to that trip. The dispatcher may assign a bus but may not edit school-only notes or manage school users.

## Trip ownership and participation

Trips must carry explicit organizational context. At minimum:

- owning school
- managing organization (optional)
- transport provider (optional)
- creating user
- tenant/workspace that owns the operational record

This allows the backend to distinguish ownership from participation. A school may own a trip while a service partner manages it and a bus company fulfils it.

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

Today, all operational data can resolve to the hosted TripDash PostgreSQL database (currently Supabase-hosted PostgreSQL).

Later, a tenant may resolve to another PostgreSQL deployment such as Azure Database for PostgreSQL or AWS RDS. The backend, not partner users, owns the database connection. Cross-organizational users never receive database credentials.

Potential future metadata:

- operational_data_source
- mode: HOSTED | CUSTOMER_POSTGRES
- provider
- region
- secret reference
- verification status

Do not store raw customer database passwords in normal application tables.

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
- add tenants, organizations, relationships, memberships, roles/permissions, and access grants to the main schema
- add globally unique public IDs while preserving legacy numeric IDs where necessary for migration
- seed system roles and permissions
- migrate useful data from the old global/control-plane tables

Phase 3 - authorization service
- central access-context resolver
- permission checks by action/resource
- relationship-aware school/provider access
- field-level response shaping where needed
- audit logging for privileged actions

Phase 4 - operational ownership
- add owning school, managing organization, and transport provider foreign keys to trips/bookings
- backfill old rows
- move trip CRUD to service/repository layers
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

Phase 7 - retire old global plane
- verify no frontend/API dependency remains
- remove PrismaGlobal and /api/global legacy routes
- archive old global schema after data migration

## Non-goals for the first rebuild pass

- dynamic multi-database routing at runtime
- customer BYO database onboarding UI
- subscriptions/billing
- white labelling
- advanced SSO provisioning

The schema and backend boundaries should permit those later without making them prerequisites for a secure working product.
