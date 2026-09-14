# Canonical Access v2 Migration / Backfill Plan

Status: planning and validation only. **Do not run against production yet.**

The goal is to move identity, organizations, memberships, roles, relationships and operational data-source metadata from the transitional global/control-plane structures into the canonical v2 control plane, without changing live v4 behavior during the migration.

## Settled database boundary

Canonical access v2 lives in a **dedicated central control-plane PostgreSQL database**, represented by `server/prisma/control.schema.prisma` and configured through `CONTROL_DATABASE_URL`.

This is an architectural boundary, not a provider commitment. The control plane may itself be hosted on any suitable PostgreSQL provider. It is separate from each school's operational PostgreSQL database and separate from the live v4 operational schema during the rebuild.

The control plane owns:
- AppUser and authentication identities/sessions
- Tenant and Organization
- memberships, roles, permissions and role assignments
- organization relationships
- operational data-source metadata and secret references
- audit events

School operational databases own trip, passenger, bus-assignment and booking data. They do not become the source of truth for identity or authorization.

The older canonical-v2 models that were added to `server/prisma/schema.prisma` are now transitional duplicates. They must not be treated as the production destination for the access-v2 backfill. They can be removed from the primary schema only after route/model dependencies are disentangled and the dedicated control-plane client is in use.

## Safety principles

1. Preserve existing identifiers where compatible. Legacy global Tenant, Organization and User UUIDs become canonical Tenant, Organization and AppUser IDs. `legacyUserId` continues linking AppUser to the existing integer v4 User.
2. Backfill is additive. Legacy tables remain authoritative until validation and a controlled cutover are complete.
3. Never broaden access during conversion. Explicit legacy school scopes become explicit school-level canonical role assignments.
4. Inactive, blocked, revoked or unresolved access never becomes ACTIVE by default.
5. Canonical application vocabulary is used in v2 (`BUS_OPERATOR`, `bus_operator`). `bus_company` remains legacy-storage compatibility only.
6. Database credentials are not copied into migration reports. Data sources move by secret reference only.
7. Production backfill must be rerunnable/idempotent and execute in transactions by phase.
8. A migration runner must name its source and destination clients explicitly: legacy global control plane -> canonical control plane. It must never infer the destination from `DATABASE_URL`.

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

Before role assignments are inserted, seed the canonical Role, Permission and RolePermission tables from `server/src/services/accessCatalog.js`. `server/src/services/controlPlaneSeed.js` is the deterministic seed contract. Keys must match the code catalog exactly. The seed uses upserts and replaces system-role permission joins so reruns cannot accumulate obsolete permissions.

## Proposed execution phases

### Phase 0 - preflight only

Read legacy/global data, build a migration plan with `accessV2BackfillPlan.js`, and stop if validation reports dangling tenant/user/organization references. Produce counts only; never output secret values.

### Phase 1 - canonical reference data

Upsert Tenant, AppUser, Organization, Role, Permission and RolePermission into the dedicated canonical control-plane database. Preserve compatible UUIDs. Do not switch reads.

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

## Required gates before production execution

- all server contract tests green
- canonical control-plane Prisma schema validated/generated
- migration/backfill planner tests green
- role/permission seed tested
- dry-run report on a non-production snapshot
- canonical effective-access resolver implemented
- legacy vs canonical parity test implemented
- explicit backup/restore point documented
- explicit approval before production database migration/backfill

## Current implementation state

`server/src/services/accessV2BackfillPlan.js` is intentionally pure and write-free. It establishes deterministic mapping and validation rules. `server/src/services/controlPlaneSeed.js` establishes the canonical role/permission seed. Neither is a production migration runner.
