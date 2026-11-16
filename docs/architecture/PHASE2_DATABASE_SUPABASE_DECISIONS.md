# Phase 2 — Database and Supabase dependency decisions (review only)

Date: 2026-11-16. Branch: `feat/global-schema-audit`. No database changes authorized.

## Agreed deployment target

One Supabase PostgreSQL database; `control` owns tenants, organizations, user access, workspace ownership and global trip registry; `public` owns operational trips and bookings. React/Vite frontend on Vercel; Express backend on Render. Do not remove security or operational records in the name of simplification.

## Verified repository dependencies

| Component | Current implementation | Decision | Prerequisite |
|---|---|---|---|
| `control.operational_data_sources` | `operationalDataSourceResolver.js` resolves one active source per school; `dataSourceAdminRoutes.js` manages it; registry uses source IDs | **RETAIN** as school-to-operational-context mapping for now | Preserve source IDs for global registry, workspace routing and existing trips |
| `control.secret_providers` / `control.data_source_credentials` | Used for `CUSTOMER_POSTGRES`; `secretProviderResolver.js` supports `HOST_ENVIRONMENT` and adapter registration | **SIMPLIFY CANDIDATE**, not delete yet | Confirm no active customer databases or admin workflows; design migration of credentials/relations |
| `HOSTED` operational mode | `operationalDataSourceResolver.js` uses `OPERATIONAL_DATABASE_URL` | **RETAIN** | Confirm environment configuration (never export secret values) |
| `CUSTOMER_POSTGRES` mode | Uses credential and secret-provider configuration | **DEFER/RETIRE CANDIDATE** for single-DB MVP | Confirm no live source uses mode; remove UI, routes, models and migrations coherently |
| `operationalPrismaFactory.js` client cache | Caches Prisma clients keyed by datasource ID; handles eviction and idle sweep | **SIMPLIFY CANDIDATE** | Prove all active school sources share one connection URL and test shutdown/eviction |
| `public.trip_registry` | Legacy table present in live database, distinct from proposed canonical registry | **PRESERVE UNTIL REFERENTIAL AUDIT** | Inspect live FKs, triggers, queries, views and row usage; no blind DROP |
| `control.trip_registry` | Planned canonical global registry; absent in live preflight | **ADD LATER AFTER REHEARSAL** | Review migration/backfill and validate global IDs, status and timestamps |
| `public.trips.global_trip_id` | Planned link to canonical registry; absent in live preflight | **ADD LATER AFTER REHEARSAL** | Validate uniqueness and full 58-trip reconciliation |
| `operationalMigrationPlan.js` | Pure read-only legacy v4 normalization planner | **ARCHIVE/TOOLING CANDIDATE** | Identify callers and historical migrations |
| `operationalMigrationWriter.js` | Guarded writer, production blocked; documented as not imported by runtime routes | **KEEP OUT OF RUNTIME** | Test-only migration rehearsal, never run on production |
| `operationalMigrationVerification.js` | Read-only plan-based verification | **KEEP IN MIGRATION TOOLING** | Reuse for test rehearsals if applicable |
| `dataSourceAdminRoutes.js` | Admin API supports source listing, updates, status changes and connection verification | **SIMPLIFY CANDIDATE** | Check UI callers and authorization, preserve source status/verification as needed |

## Concrete observations

1. `operationalDataSourceResolver.js` already fails closed for zero/multiple active sources and unsupported engines. It returns a connection URL, which is intentionally not exposed by `dataSourceAdminRoutes.js` view mapper.
2. `secretProviderResolver.js` has a built-in environment-variable adapter; an external vault requires a registered adapter. The existence of an extension point is **not evidence of active use**.
3. `operationalPrismaFactory.js` creates and caches a separate Prisma client for each datasource ID. In a single shared PostgreSQL database this may be unnecessarily expensive, but deduplication must not merge distinct credentials accidentally.
4. `dataSourceAdminRoutes.js` explicitly accepts `CUSTOMER_POSTGRES` and credential references, so dropping secret tables before changing routes would break the admin API.
5. Legacy operational migration writer is explicitly blocked in production; it is not a safe replacement for a planned canonical global-registry backfill.
6. Live preflight on 2026-11-16 reported 58 trips across four schools, one active source and tenant link per school, zero exceptions. This **does not establish** datasource mode, credential usage, legacy registry row counts or database constraints.

## Required next read-only Supabase inspection

Before removing any database objects, collect counts of active sources grouped by `mode`, referenced credential/provider rows, legacy registry rows, and dependencies on `public.trip_registry` (FKs, views, triggers). Record counts only; do not expose connection strings, secret references or credentials. Verify all existing organizations continue to map to a valid active source.

## Sequence

1. Build a **read-only SQL report** covering mode counts, credentials and legacy registry dependencies.
2. Map frontend calls to datasource admin API; determine if external-database UI is actually used.
3. Implement a single-database runtime mode with regression tests, retaining source IDs and fail-closed checks.
4. Retire unnecessary admin controls and secret-provider code only after successful tests and explicit database migration plan.
5. Run disposable PostgreSQL migration rehearsal and preserve rollback path before any production change.
