# Trip Dash — dependency inventory and cleanup gates (Phase 1)

Branch: `feat/global-schema-audit`. Source: repository tree and current `server/src/index.js`, Prisma schemas, and inspected routing services. **Classification is provisional; no deletions authorized.**

## Target

One React/Vite frontend, one Express backend, one Supabase PostgreSQL deployment containing `control` (identity, tenants, organizations, authorization, routing, registry) and `public` (operational trips and bookings). Retain explicit authorization and workspace ownership. Physical datasource abstraction is retained until single-DB behavior and future requirements are confirmed.

## Schema inventory (all 38 Prisma models)

**Control — 20 models:** `Tenant`, `TenantAccountMember`, `TenantOrganization`, `AppUser`, `AuthenticationIdentity`, `AuthSession`, `Organization`, `OrganizationRelationship`, `OrganizationMembership`, `Role`, `Permission`, `RolePermission`, `RoleAssignment`, `UserPermissionGrant`, `SecretProvider`, `DataSourceCredential`, `OperationalDataSource`, `AuditEvent`, `GlobalTripRegistry`, `ProviderOperatingCountry`.

**Operational — 18 models:** `BusBooking`, `TripSeries`, `TripSeriesDateException`, `TripSeriesJourneyLeg`, `TripSeriesJourneyStop`, `TripSeriesQuotation`, `TripSeriesApprovalRequest`, `Trip`, `TripJourneyLeg`, `TripJourneyStop`, `TripBusAssignment`, `TripQuotation`, `TripQuotationLine`, `TripApprovalRequest`, `ExternalWorkflowAction`, `TripPassenger`, `TripBusPassengerAllocation`, `TripPassengerPayment`.

All models above are **retain pending dependency validation**. Model presence alone does not prove use. `GlobalTripRegistry` is planned but not present in live Supabase; `Trip.globalTripId` is planned but not present in live Supabase. Legacy `public.trip_registry` is not the canonical registry and must not be dropped without FK, query and historical-data review.

## Mounted backend route inventory

Directly mounted in `server/src/index.js`:

- Auth/session: `sessionRoutes`, `authRoutes`, `authMicrosoft`, `ms`.
- Access/admin: `accessRoutes`, `accessAdminRoutes`, `permissionGrantRoutes`, `platformBootstrapRoutes`, `platformControlRoutes`, `platformDirectoryRoutes`, `transportProviderDirectoryRoutes`, `platformOnboardingRoutes`, `delegatedAdminRoutes`, `dataSourceAdminRoutes`, `organizationAdminRoutes`, `relationshipDeleteRoutes`, `tenantOwnershipRoutes`.
- Operational: `workspaces/index.js`, `workspaceTripSeriesRoutes`, `externalWorkflowRoutes`.

**Keep all mounted routes for now.** A route is only removable after checking frontend API calls, nested imports, external links, permissions and deployed usage. Unmounted files `workspaceTripsRoutes.js`, `workspaceTripBusAssignmentsRoutes.js`, `workspaceTripPassengersRoutes.js` are **legacy candidates only**, not proven unused; check nested imports before removal.

## Backend consolidation candidates

1. `authorizedOperationalContext.js` and `workspaceOperationalContext.js`: overlapping workspace authorization. Establish one canonical runtime access/permission path and compare error semantics before refactoring.
2. `operationalPrismaForExternalWorkspace`: prechecks datasource existence then calls `getOperationalContextForOrganization`, which resolves datasource again. Remove duplicated query only with fail-closed cardinality behavior preserved.
3. `operationalDataSourceResolver.js`, `operationalPrismaFactory.js`, `secretProviderResolver.js`: review whether secret-provider abstraction is required for the chosen single Supabase database; do not remove until active credential configuration is inventoried.
4. `canonicalAuth.js`, `authTokens.js`, `authRoutes.js`, `authMicrosoft.js`, `ms/*`, `client/src/auth/msal.js`: map actual authentication mechanisms before considering Supabase Auth, MSAL or local-session removal. Do not assume Supabase Auth is currently authoritative.
5. `operationalMigrationWriter.js`, `operationalMigrationPlan.js`, `operationalMigrationVerification.js`: classify as operational provisioning tooling versus request-time dependencies; never delete solely because they are not mounted routes.

## Deployment and safety gates

- `server/package.json` `verify:control` and `verify:operational` include `prisma db push`; **these are mutating scripts**, not read-only verification. Do not run against production.
- Current live read-only preflight: 58 trips / 4 schools / zero identity or datasource issues; canonical registry and `global_trip_id` absent. See `GLOBAL_TRIP_LIVE_PREFLIGHT_2026-11-16.md`.
- CI schema validation and unit tests are not a substitute for database migration rehearsal.
- No production table drops, auth replacement, route deletions or registry migration until dependency graph, backups and tests are complete.

## Next implementation checkpoints

1. Generate **machine-checkable static imports and API call map** for backend/frontend; classify reachable vs unreferenced modules and external endpoint consumers.
2. Cross-check Prisma model use in controllers/services, live schema constraints, migrations, views, RLS, triggers and policies; produce a table-by-table retain/migrate/retire decision sheet.
3. Audit active Supabase credentials, Auth usage, storage and external secrets without exposing values.
4. Consolidate one backend service at a time with regression tests and CI; keep the live environment unchanged.
5. Only then prepare reversible removal migrations for explicitly approved obsolete objects.
