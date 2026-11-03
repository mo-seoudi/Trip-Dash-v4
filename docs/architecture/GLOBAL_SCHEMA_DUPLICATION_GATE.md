# Global schema transformation — identity and duplication gate (draft)

Source: `v5-revamp`, `server/prisma/control.schema.prisma` and `server/prisma/operational.schema.prisma`. This is a repository-model inventory, **not** verification of deployed Supabase catalog contents.

## Non-negotiable rules
1. Preserve existing `Organization.id`, `AppUser.id`, `Tenant.id` and relationships; never create parallel identity tables or remap UUIDs without a reviewed migration.
2. Before creating any table or column, inspect **both deployed schemas** for semantically equivalent objects, including aliases, views, constraints, indexes and migration history.
3. Reuse or migrate equivalent records. Never seed duplicate organizations, users, subscriptions, data sources or roles.
4. Never run destructive migrations or production schema renames without a data backup, dry run, rollback plan and explicit approval.
5. Preserve local operational `Trip.id` (integer) for existing FKs. A future global trip UUID must not overwrite it.
6. The global registry must contain only routing/ownership/identity metadata, never itinerary, passengers, pricing or other sensitive trip data.
7. Database provider and secret references stay in the global plane; credentials remain in a server-side vault/environment, never a browser response.

## Known equivalences (Prisma fields => PostgreSQL mapped columns)
| Canonical concept | Existing control | Existing operational | Rule |
|---|---|---|---|
| Organization | `Organization.id` / `organizations.id` | `Trip.owningSchoolOrganizationId` / `owning_school_organization_id`; `requestingOrganizationId`; `managingOrganizationId`; `transportProviderOrganizationId`; `payerOrganizationId` | These are references to the **same global Organization ID**, not separate org entities. Distinct roles must remain distinct. |
| User | `AppUser.id` / `app_users.id` | `Trip.createdByAppUserId` / `created_by_app_user_id`; similar quotation/approval fields | Reuse global user identity; no duplicate user table. |
| SaaS tenant | `Tenant.id` / `tenants.id` | No tenant model in inspected operational Prisma schema | Tenant != organization; preserve separation. |
| Organization membership | `OrganizationMembership` | No equivalent model in inspected operational Prisma schema | Keep global. |
| Organization relationships | `OrganizationRelationship` | No equivalent model in inspected operational Prisma schema | Keep global. |
| Database routing | `OperationalDataSource`, `DataSourceCredential`, `SecretProvider` | No equivalent model in inspected operational Prisma schema | Evolve in place, check live DB before splitting connection/assignment. |
| Trip | No `GlobalTrip` model in inspected control Prisma | `Trip.id` integer; `TripSeries.id` UUID; `BusBooking.id` integer | Search live catalog for equivalent global UUID/registry before proposing new fields/tables. |

## Repository-only findings requiring live catalog verification
- `RoleAssignment` has nullable `tenantId` and `organizationId` in a composite unique constraint. Verify actual constraints and duplicate rows; design scope-specific uniqueness only after inspection.
- `OperationalDataSource` currently belongs to one organization. Confirm whether another existing global/public table already models shared physical connections or assignments.
- `Tenant` already stores `subscriptionMode`, `planKey`, billing references and subscription dates. Do not create duplicate subscription fields or tables without first mapping their distinct lifecycle purpose.
- No dedicated `GlobalTrip` Prisma model appears in the inspected control schema. Verify physical catalog, views, migrations and code for equivalent functionality.
- Both Prisma schemas use different datasource environment variables; inspect actual PostgreSQL namespace/search_path before renaming `control` and `public`.
- `TripSeries` is recurring-trip identity, not interchangeable with a global ID for each occurrence.
- Existing `BusBooking` may be a legacy booking representation; map it against `Trip` and workflows before any new registry or migration.

## Required live database read-only inspection
1. Inventory `information_schema.tables` for all non-system schemas and `information_schema.columns` (including types and defaults).
2. Inventory `pg_constraint`, `pg_indexes`, foreign keys, sequences, views, triggers and RLS policies.
3. Compare table names and field semantics across `control`, `public` and any other application schemas, not only spelling.
4. Inspect Prisma migration history and database migrations; identify source of truth for each duplicated table.
5. Count rows and inspect representative non-sensitive keys for candidate duplicates; map legacy integer IDs to canonical UUIDs only where needed.
6. Produce a table-by-table disposition: KEEP / REUSE / MOVE / MERGE / DEPRECATE / NEW (only if proven absent).
7. No migrations until this gate is reviewed.

## Implementation gates
A. Complete live catalog inventory and duplicate matrix.
B. Approve canonical entity mapping and trip identity strategy.
C. Write reversible additive migration and backend compatibility plan.
D. Test on a disposable Supabase clone with realistic data.
E. Approve production rollout separately.
