# Live Supabase cleanup preflight — 2026-11-16

Source: user-executed read-only SQL `008-datasource-and-legacy-registry-cleanup.READ_ONLY.sql`, checked at 2026-11-16T10:55:58.336949+00:00. No credentials or secret references exported.

## Observed counts

| Metric | Result |
|---|---:|
| Operational datasources total / active | 5 / 5 |
| Active hosted PostgreSQL sources | 5 |
| Active non-hosted sources | 0 |
| Schools with active sources | 5 |
| Schools with multiple active sources | 0 |
| Active non-PostgreSQL sources | 0 |
| Credential rows total / active | 1 / 1 |
| Credentials on active sources | 1 |
| Credentials on active non-hosted sources | 0 |
| Secret providers total / active | 1 / 1 |
| Legacy public.trip_registry rows | 0 |
| Legacy registry referencing foreign keys | 0 |
| Legacy registry dependent views | 0 |
| Legacy registry non-internal triggers | 0 |
| Legacy registry policies | 0 |
| Legacy registry RLS | enabled, not forced |
| Canonical control.trip_registry | absent |

## Code-verified implications

`operationalDataSourceResolver.js` resolves all `HOSTED` connections using `OPERATIONAL_DATABASE_URL`; it **does not use** the datasource credential for a hosted source. Therefore the single credential row is not required for current hosted connection resolution. However, it may still be referenced by administrative tooling, and must not be deleted without dependency checks.

`dataSourceAdminRoutes.js` still exposes `CUSTOMER_POSTGRES` management, so the unused external mode is a product/API capability, not just an orphaned database field. Removing it requires coordinated backend/UI/schema changes.

The empty `public.trip_registry` has no directly referencing foreign keys, dependent views or non-internal triggers in the reported preflight. This is **not** a complete code/function/RPC dependency audit, so dropping it remains deferred.

The five active sources are consistent with one active source per school. The previous trip-level preflight covered **four schools with 58 trips**, which does not contradict the fifth school having no trips.

## Decisions and gates

- **Retain** five datasource records and their school IDs while the canonical global registry is designed.
- **Retain** `OPERATIONAL_DATABASE_URL` and fail-closed datasource validation.
- **Candidate for retirement**: external customer database mode, secret-provider adapters, datasource credentials, redundant Prisma clients. Do not delete yet.
- **Candidate for retirement**: empty legacy `public.trip_registry`. Check runtime SQL, functions, triggers on *other* tables, and frontend/backend references first.
- **Do not add** `control.trip_registry` to production until disposable migration rehearsal and backfill verification.
- **Never run** mutating `prisma db push` verification scripts against production.

## Next step

Audit frontend/backend references to `CUSTOMER_POSTGRES`, `secretProvider`, `dataSourceCredential` and `public.trip_registry`; then implement an opt-in hosted-only runtime mode with tests before removing admin controls or schema objects.
