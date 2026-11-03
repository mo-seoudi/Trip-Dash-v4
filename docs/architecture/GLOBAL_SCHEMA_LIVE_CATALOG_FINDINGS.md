# Live Supabase catalog audit — 2026-11-03

Source: user-provided read-only SQL export `Supabase Snippet Untitled query (6).csv` (78 rows). This is catalog metadata, not row-level equality or source-of-truth proof.

## Inventory
- `control`: 19 tables; `public`: 59 tables.
- 18 identically named tables occur in both schemas: `app_users`, `audit_events`, `auth_sessions`, `authentication_identities`, `data_source_credentials`, `operational_data_sources`, `organization_memberships`, `organization_relationships`, `organizations`, `permissions`, `provider_operating_countries`, `role_assignments`, `role_permissions`, `roles`, `secret_providers`, `tenant_account_members`, `tenant_organizations`, `tenants`.
- `control.user_permission_grants` exists, but no same-named table in `public`.
- `public.trip_registry` ALREADY EXISTS; do not create a new global-trip registry until mapped and migration decision reviewed.
- `public.trips` contains integer `id` and estimated 34 rows. Its operational organization/user ID columns are `text`; control IDs are UUIDs. Verify values before casting.
- `control.organizations` and `public.organizations` already have `country_code`, `region_code`, `created_source`, `claim_status`, `verification_status`, `operational_status`, `directory_visible`, `claimed_at`, `verified_at`. Current Prisma control schema omits these columns. Update model mapping after reviewing enum/type details; no new profile table.
- `public.trip_registry` columns: `id uuid`, `tenant_id uuid`, `trip_code text`, `school_org_id uuid`, `bus_company_org_id uuid`, `data_connection_id uuid`, `external_ref text`, `created_at timestamptz`, `updated_at timestamptz`. `data_connection_id` FK points to `public.data_connections_legacy_cutover(id)`. `tenant_id`, `school_org_id`, `bus_company_org_id` FKs point to public control-duplicate tables.
- The CSV uses `pg_class.reltuples` estimates: -1 means unknown/not analyzed, NOT zero rows. Actual row counts and PK overlap remain unverified.

## Critical migration consequences
1. Determine whether existing `trip_registry` is used, populated, and semantically equivalent to desired global trip identity; **reuse/move/extend**, not replace blindly.
2. Determine canonical control-vs-public identity rows with exact counts, PK set comparisons and FK usage before moving or dropping anything.
3. Map `data_connections_legacy_cutover` against `operational_data_sources` and credentials. Do not create a new data-source registry until equivalence is resolved.
4. Assess legacy `public.Trip` / `public.trips`, `BusBooking` / `bus_bookings` separately. Different casing does not mean independent concepts.
5. `control.provider_operating_countries` exists despite omission from inspected control Prisma model; preserve.
6. No DDL is authorized by this audit. Next step is read-only row-count/key-overlap and FK-dependency verification.
