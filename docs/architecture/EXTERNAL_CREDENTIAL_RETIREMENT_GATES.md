# External database credential retirement — execution gates

Branch: `feat/global-schema-audit`. This document is an implementation checklist, not authorization to delete live objects.

## Evidence established

- Live Supabase read-only report (2026-11-16): 5 active sources, all `HOSTED`, 0 active external sources, 1 active credential row and 1 active secret provider row.
- `operationalDataSourceResolver.js`: hosted connections use `OPERATIONAL_DATABASE_URL`; external connections call `resolveSecret`.
- `dataSourceAdminRoutes.js`: external mode still creates/updates credential records and reads `secretProvider` when hosted-only mode is disabled.
- `control.schema.prisma`: `OperationalDataSource.credential`, `DataSourceCredential`, `SecretProvider` and the `DataSourceMode` enum are connected. Removing one model in isolation would invalidate the schema.
- The hosted-only flag is currently opt-in and off by default. Therefore removing the legacy code now would change default runtime behavior and is premature.

## Safe retirement order

1. **Confirm CI** actually runs hosted-only and authorization tests; perform a disposable Postgres integration rehearsal for both active source resolution and school assignment.
2. **Verify deployment configuration** for the intended hosted-only setting without exposing environment variable values. Do not flip production settings before rehearsal.
3. **Inventory all imports and references** to `secretProviderResolver`, `resolveSecret`, `registerSecretProviderAdapter`, `dataSourceCredential`, `secretProvider`, `CUSTOMER_POSTGRES`, and `secret_reference` across server, client, scripts, migrations and tests. Distinguish historical migrations from runtime code.
4. **Make hosted-only the canonical runtime** only after confirming no externally hosted customers; remove external provisioning from API and update tests together.
5. **Remove unused runtime adapter** and credential model relations in a single reviewed change; keep migration history intact. Validate Prisma generation and frontend build.
6. **Create an explicit reversible SQL migration** for database object retirement. The live credential and provider records must be backed up and dependency-checked, not silently dropped.
7. **Only after successful database rehearsal and approval**, apply the migration to production, verify all five source mappings and the 58 trips, then remove the feature flag and compatibility code.

## Additional safety finding

The `verify:control` and `verify:operational` package scripts currently include `prisma db push`, so they **modify schemas**. They must not be run against the live Supabase database. Replace them with explicit read-only verification and separately named, environment-guarded migration commands before any live rollout.

## No deletion authorization

Do not drop `control.data_source_credentials`, `control.secret_providers`, or `public.trip_registry` based on row counts alone. The legacy registry is empty but application SQL/functions may still reference it.
