# Canonical Access v2 Migration / Backfill Plan

Status: planning and validation only. **Do not run against production yet.**

The goal is to move identity, organizations, memberships, roles, relationships and operational data-source metadata from the transitional global/control-plane structures into the canonical v2 tables already defined in `server/prisma/schema.prisma`, without changing live v4 behavior during the migration.

## Safety principles

1. Preserve existing identifiers where compatible. Legacy global Tenant, Organization and User UUIDs become canonical Tenant, Organization and AppUser IDs. `legacyUserId` continues linking AppUser to the existing integer v4 User.
2. Backfill is additive. Legacy tables remain authoritative until validation and a controlled cutover are complete.
3. Never broaden access during conversion. Explicit legacy school scopes become explicit school-level canonical role assignments.
4. Inactive, blocked, revoked or unresolved access never becomes ACTIVE by default.
5. Canonical application vocabulary is used in v2 (`BUS_OPERATOR`, `bus_operator`). `bus_company` remains legacy-storage compatibility only.
6. Database credentials are not copied into migration reports. Data sources move by secret reference only.
7. Production backfill must be rerunnable/idempotent and execute in transactions by phase.

## Legacy -> canonical mapping

| Legacy control-plane data | Canonical v2 target | Rule |
| --- | --- | --- |
| Tenant | Tenant | Preserve UUID, name, slug, status/timezone |
| Organization | Organization | Preserve UUID/tenant; `name` -> displayName/fullName; `code` -> abbreviation; canonicalize type; parent -> parentId |
| User | AppUser | Preserve global UUID; keep `legacyUserId`; fullName -> displayName |
| UserOrgMembership | OrganizationMembership | Collapse multiple role rows for the same user/org into one membership |
| UserOrgMembership.role | RoleAssignment | Canonical role key, organization scoped |
| UserOrgScope | RoleAssignment | Explicit school-level organization assignment; replaces broader assignment for that membership+role |
| Organization.parentOrgId | OrganizationRelationship | Also create School -> School Group `BELONGS_TO_GROUP` |
| Partnership | OrganizationRelationship | School -> Bus Operator `TRANSPORT_PROVIDER` |
| DataConnection | OperationalDataSource | Preserve tenant/org/mode/active/verified metadata and vault secret reference; no raw credential |

## Membership status conversion

- `active`, `approved` -> `ACTIVE`
- `pending` -> `PENDING`
- `blocked`, `suspended` -> `SUSPENDED`
- `revoked` -> `REVOKED`
- unknown -> `PENDING` (fail safe)

When legacy rows contain multiple roles for one user/organization, canonical OrganizationMembership is one row and the roles become separate RoleAssignments.

## Role and permission seed

Before role assignments are inserted, seed the canonical Role, Permission and RolePermission tables from `server/src/services/accessCatalog.js`. Keys must match the code catalog exactly. The seed is an upsert and must not create duplicate semantic roles.

## Proposed execution phases

### Phase 0 - preflight only

Read legacy/global data, build a migration plan with `accessV2BackfillPlan.js`, and stop if validation reports dangling tenant/user/organization references. Produce counts only; never output secret values.

### Phase 1 - canonical reference data

Upsert Tenant, AppUser, Organization, Role, Permission and RolePermission. Preserve compatible UUIDs. Do not switch reads.

### Phase 2 - access graph

Upsert OrganizationMembership, RoleAssignment and OrganizationRelationship. Explicit school scopes must restrict rather than widen inherited organization access.

### Phase 3 - operational data-source metadata

Upsert OperationalDataSource from legacy DataConnection. Copy `vaultSecretId` only as canonical `secretRef`; never resolve or log the credential during backfill.

### Phase 4 - parity validation

For every active user, compare legacy `resolveEffectiveAccess` output with a canonical-v2 resolver:

- tenant
- accessible school workspace IDs
- canonical roles per workspace
- permissions per workspace
- bus operator relationships
- inactive/blocked access denial

Any canonical result that grants a school or permission absent from legacy is a hard failure.

### Phase 5 - shadow reads

Keep legacy effective access authoritative, calculate canonical access in parallel, log only non-sensitive parity differences, and fix all mismatches before cutover.

### Phase 6 - controlled cutover

Switch effective access and Access Admin to canonical tables behind a configuration flag. Keep legacy tables read-only for rollback during an agreed observation period. No production legacy table deletion in this phase.

## Data-source routing caveat

The current canonical models live in the primary Prisma schema while the transitional access/control data is represented by `global.schema.prisma`. Before production execution we must confirm whether canonical control-plane tables are being created in the same PostgreSQL database that currently holds the v4 `User`/Trip data or in the dedicated control-plane database. The migration runner must use the database that actually contains the canonical tables; it must not silently read one database and write another based on similarly named environment variables.

## Required gates before production execution

- all server contract tests green
- Prisma canonical schema validated/generated
- migration/backfill planner tests green
- role/permission seed tested
- dry-run report on a non-production snapshot
- canonical effective-access resolver implemented
- legacy vs canonical parity test implemented
- explicit backup/restore point documented
- explicit approval before production database migration/backfill

## Current implementation state

`server/src/services/accessV2BackfillPlan.js` is intentionally pure and write-free. It establishes deterministic mapping and validation rules. It is safe to run in tests but is **not** a production migration runner.
