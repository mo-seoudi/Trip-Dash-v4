# Live trip preflight — 2026-11-16

Source: user-provided result of `server/prisma/migrations-review/007-live-trip-preflight-export.READ_ONLY.sql`, executed 2026-11-16T09:32:45.105995+00:00. This document records the reported output; it does not represent an independent database connection or migration execution.

## Summary

- Total operational trips: **58** across **4** school organization IDs.
- Trips with any issue: **0**; exceptions: **[]**; exception export truncated: **false**.
- Missing school, unknown school, non-school owner, invalid creator, requester, provider, active source count and tenant coverage: **all 0**.
- All four schools have exactly **one** tenant link and **one** active operational datasource.

| School organization ID | Trips | Tenant links | Active sources | Trips with issues |
|---|---:|---:|---:|---:|
| `ba6782ab-44e2-4284-a3de-4e334cf8f00f` | 54 | 1 | 1 | 0 |
| `81ac7032-1620-4c6a-86a0-671251e8fc99` | 2 | 1 | 1 | 0 |
| `173b7e23-938f-406e-bf2c-f9ef74397163` | 1 | 1 | 1 | 0 |
| `32674bef-2829-4b9e-8f40-78bf180a9890` | 1 | 1 | 1 | 0 |

## Live schema state

- `control.trip_registry`: absent.
- `public.trips.global_trip_id`: absent.
- Legacy `public.trip_registry`: present; preserve it.

## Gate and limitations

**Read-only identity/data-source preflight PASSED** for this snapshot. This does not authorize production migration, prove SQL DDL compatibility, validate physical multi-database routing, or establish rollback readiness. No database changes were performed by this preflight. The snapshot must be refreshed before any production deployment.

## Next gate

1. Verify a restorable, sanitized disposable PostgreSQL clone with both schemas and representative rows.
2. Check `001-control-trip-registry.sql` and `003-operational-trip-global-uuid.REVIEW_ONLY.sql` against the clone's actual constraints and column types.
3. Apply reviewed additive scripts **only to the clone**, reconcile all 58 trips, run `005-global-trip-postmigration-verification.TEST_ONLY.sql`, and check booking/recurring/auth flows.
4. Record results and obtain separate production approval before touching live Supabase.
