# Global / Operational boundary consolidation — execution gates

Status: implementation preparation; NO destructive migration approved or applied.

## Canonical ownership
- PostgreSQL schema `control` is the present global authority; future physical rename to `global` is a separate, coordinated migration, not a Prisma filename rename.
- `control.tenants.id`, `control.organizations.id`, `control.app_users.id`, `control.operational_data_sources.id` are authoritative UUIDs.
- `control.trip_registry.id` is the permanent global trip UUID; `public.trips.global_trip_id` stores the same value; `public.trips.id` remains local integer PK.
- Operational role-specific IDs (owning_school_organization_id, requesting_organization_id, managing_organization_id, transport_provider_organization_id, payer_organization_id, created_by_app_user_id) reference global identities without copying the entities.
- Shared-DB foreign keys can reference `control`; independent school databases cannot use cross-database foreign keys. In both cases, validate authorization, identity existence, routing, and immutability in application service logic. Reconcile across stores.
- Prisma `control.schema.prisma` and `operational.schema.prisma` are source filenames, not evidence of the live PostgreSQL schema names. Keep database naming and generated client paths stable until planned cutover.

## Gate A — inventory and dependency evidence
Run `006-global-operational-boundary-audit.READ_ONLY.sql` in Supabase, one statement at a time if the editor times out. Capture same-name tables, column/type drift, all operational UUID reference types, FK dependencies, dependent views, and missing global identity references. Also audit triggers, functions, RLS policies, application SQL and legacy quoted tables before any drop.

## Gate B — application compatibility
Inventory every API/service/Prisma/raw-SQL reference to duplicated public administrative tables. Replace references with Global service calls. Keep operational databases independently deployable. Align PostgreSQL/Prisma types without unsafe casts or changing local trip IDs.

## Gate C — identity and trip reconciliation
For each existing trip, verify school, creator, requester, manager, provider and payer against global registry. Repair or map legacy IDs only with explicit audited mapping. Add `control.trip_registry` and `public.trips.global_trip_id` via separately reviewed migrations; backfill and verify one-to-one correspondence and idempotent retries.

## Gate D — controlled retirement
After backups and passing tests, stop writes to duplicate `public` administrative tables, verify no reads/constraints/policies depend on them, archive and drop via individually reviewed reversible migration. Do NOT use CASCADE to force deletion. Do not delete trip/booking/series/quotation/approval tables.

## Acceptance
- No operational API relies on local copies of tenants, organizations, users, roles or relationships.
- Trip creator and owning-school UUIDs resolve in Global, with permission checks; no unauthorized cross-school access.
- Each operational trip has exactly one matching Global UUID registry entry and correct source routing.
- Shared database and separate database modes both pass create/read/update/reconciliation tests.
- Backup and rollback plan demonstrated before destructive changes.
