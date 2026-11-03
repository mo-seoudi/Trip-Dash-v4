# Global / Operational Schema Transformation — Target and Gap Register

Status: architecture review; **not** a migration approval. Existing development data may be test data, but preserve it during transformation.

## Boundary
- Existing PostgreSQL `control` schema is the **Global** authority: tenants, users/authentication, organizations and their relationships, roles/permissions, operational data-source routing, and canonical trip identities.
- Existing PostgreSQL `public` schema is the **Operational** authority: bookings, recurring series and occurrences, journey legs/stops, quotations, approvals, passengers, assignments, payments, and operational lifecycle.
- Do not rename schemas. Do not duplicate operational detail in Global. Cross-database references are logical UUID identities, not PostgreSQL foreign keys.

## Reviewed current Prisma inventory
Global: Tenant, TenantAccountMember, TenantOrganization, AppUser, AuthenticationIdentity, AuthSession, Organization, OrganizationRelationship, OrganizationMembership, Role, Permission, RolePermission, RoleAssignment, UserPermissionGrant, SecretProvider, DataSourceCredential, OperationalDataSource, AuditEvent, GlobalTripRegistry, ProviderOperatingCountry.
Operational: BusBooking, TripSeries and its date exceptions/journey legs/stops/quotations/approval requests, Trip, TripJourneyLeg, TripJourneyStop, TripBusAssignment, TripQuotation, TripQuotationLine, TripApprovalRequest, ExternalWorkflowAction, TripPassenger, TripBusPassengerAllocation, TripPassengerPayment.

## Gaps and decisions to resolve before write migrations
1. **Canonical trip identity**: `control.GlobalTripRegistry` exists in Prisma only, not live DB; operational `Trip.globalTripId` likewise. Ensure uniqueness and safe reconciliation. Existing integer local IDs remain internal identifiers.
2. **Global vs local booking identity**: `public.BusBooking` has a separate integer ID and no Global UUID. Establish whether it is a draft/intake request, a separate commercial booking, or a trip container before deciding whether it requires Global registration. Do not blindly register both.
3. **Recurring series identity**: `TripSeries.id` is a local UUID and occurrences reference it; decide whether series need canonical Global IDs for cross-database reporting and linking, separate from occurrence-level Global Trip IDs.
4. **Operational org references**: trip and series school/requester/manager/provider/payer IDs are TEXT, while Global org IDs are UUID. Audit actual values and all usages before type changes. Operational DBs cannot FK to a remote Global schema.
5. **Source routing**: `OperationalDataSource` currently belongs to one organization, with no DB-enforced guarantee of one active source per school. Define routing rules for multiple schools sharing one source, source replacement, and migration history.
6. **Registry lifecycle**: `registrationStatus` is a free-form string; define states, transitions, timestamps, provider changes, cancellation/deletion behavior, and retry semantics. Keep trip workflow status in Operational.
7. **Registry cross-field consistency**: enforce or validate that registry tenant/school/source match the operational trip and the organization's grants. A FK on each field alone does not enforce that relationship.
8. **Identity/authorization**: verify existing Global user membership, role assignments and relationship scopes cover service partners, multi-school users and provider access without duplicating user profiles in Operational.
9. **Operational status history**: review whether current Trip/TripSeries status and ExternalWorkflowAction represent full auditable transitions or need a dedicated lifecycle event record. Do not move operational history into Global.
10. **Schema parity**: compare BOTH Prisma files with actual PostgreSQL catalogs (columns, types, FKs, unique constraints, triggers, policies, indexes, enums) before generating migrations. Prisma files are not proof of live DB state.

## Implementation sequence
A. Inventory + responsibility matrix for every existing table and identify missing tables/fields.
B. Agree on booking vs trip vs recurring-series identity and registry lifecycle.
C. Produce additive Global and Operational DDL with backfills, idempotency and validation; no drops/renames until references are audited.
D. Apply in controlled stages to the existing development DB after a recoverable backup and explicit approval.
E. Reconcile test trips, run post-migration verification, then update service routing and feature flags.

## Verified live preflight (2026-11-03)
58 trips across four schools; one active HOSTED source per school; all missing/invalid ownership, tenant, provider, and duplicate-ID checks returned zero. Live `control.trip_registry` and `public.trips.global_trip_id` were absent; legacy `public.trip_registry` was present. These checks are necessary but do not constitute a full catalog audit.
