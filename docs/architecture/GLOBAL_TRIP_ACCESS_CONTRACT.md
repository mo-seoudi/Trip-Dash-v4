# Global schema: trip identity, discovery and access contract (draft)

Scope: backend/data-model transformation only; no Control Center expansion. Source: live Supabase catalog export (2026-11-03) plus `v5-revamp` Prisma models. **Design only; no DDL applied.**

## Existing objects: reuse, do not duplicate
- `control.tenants`, `control.organizations`, `control.app_users`, `control.organization_memberships`, `control.organization_relationships`, `control.tenant_organizations`, `control.roles`, `control.permissions`, `control.role_assignments`, `control.role_permissions`, `control.user_permission_grants`, `control.operational_data_sources`, `control.data_source_credentials`, `control.secret_providers`, `control.audit_events`.
- `public.trip_registry` already exists. Its `id` is UUID; `tenant_id`, `school_org_id`, `bus_company_org_id`, `data_connection_id`, `trip_code`, `external_ref`, `created_at`, `updated_at` already exist. Reuse/move this table after data/FK reconciliation; **do not create a second trip registry**.
- Existing `public.trip_registry` FKs point to `public.tenants`, `public.organizations`, and `public.data_connections_legacy_cutover`. Before relocating registry to `global`, reconcile duplicate identity tables and legacy datasource IDs, and repoint FKs to canonical global objects. Do not drop or overwrite populated rows.
- `public.trips.id` is an integer local ID; keep it and existing FKs. `public.trip_series.id` is UUID but identifies a series, not each occurrence.

## Minimum global registry contract (map to existing fields first)
| Canonical meaning | Existing candidate | Needed only if no equivalent exists |
|---|---|---|
| Global trip UUID | `trip_registry.id` | Nothing |
| SaaS tenant | `trip_registry.tenant_id` | Nothing |
| Owning school | `trip_registry.school_org_id` | Nothing |
| Transport operator | `trip_registry.bus_company_org_id` | Nothing; make assignment lifecycle-aware |
| Operational routing | `trip_registry.data_connection_id` | Repoint to canonical datasource after verifying legacy mapping |
| Local trip locator | `trip_registry.external_ref` | Define stable mapping to operational local ID; separate field only if incompatible |
| Trip code | `trip_registry.trip_code` | Nothing |
| Creator | `public.trips.created_by_app_user_id` | Registry creator field if not already stored elsewhere |
| Requester | `public.trips.requesting_organization_id` | Registry requester field only if global discovery needs it |
| Manager | `public.trips.managing_organization_id` | Registry manager field only if global discovery needs it |
| Creation time | `trip_registry.created_at` | Distinguish registration timestamp from original trip creation if needed |
| Lifecycle | Operational status is not global access state | Minimal registration/visibility state only if proven necessary |

No itinerary, student names, passenger counts, costs, quotations, route details or operational workflow in global registry.

## Authorization contract
1. Authenticate `AppUser` using existing identities/sessions.
2. Resolve active tenant memberships, organization memberships, scoped role assignments and grants; reject suspended/revoked memberships.
3. Resolve current active organization relationships (direction, type, valid_from/valid_until, status) and tenant coverage.
4. For each trip, use its **specific participant organization IDs** (school, requester, manager, assigned operator), not a blanket rule that any operator linked to a school can see every trip.
5. User may discover a trip only if (a) they have a valid scope and relevant permission, (b) their organization participates in that trip in a permitted role, and (c) tenant/relationship validity and trip access state permit it. Platform super-admin access remains explicitly permission-gated and audited.
6. Organization relationships provide eligibility; **trip-specific participation grants actual trip visibility**. Reassignment must revoke former provider access immediately in the global layer.
7. Backend verifies authorization again when reading, changing, or issuing external action tokens. No direct customer database credentials or client-side-only authorization.
8. Do not expose trip existence across tenants through predictable IDs or error differences.

## Lifecycle consistency
- Generate/reuse one UUID as the global trip ID, preserve existing operational integer IDs.
- Idempotent registration keyed by global UUID; record local locator and datasource; handle operational-write/global-write failures with durable retry/reconciliation. Do not assume cross-database ACID transactions.
- Backfill existing trips by canonical school, user and local ID mapping; do not guess ownership for unresolved rows.
- Recurring series may need a separate **series registry decision**, but do not create it before auditing existing series IDs and actual access requirements.
- Use indexes on tenant, school, provider and relevant manager/requester columns for discovery, after verifying existing indexes.
- Enforce trip-specific access in backend queries and tests: school, service partner, provider, unrelated organization, revoked relationship, reassignment, multi-school user, suspended tenant, hosted DB, external DB.

## Gate before migration
Read-only inspect row counts, PK overlaps, `trip_registry` links to `trips`, legacy connection mappings, actual auth access-runtime behavior and existing trip registry consumers. Then produce an additive migration with explicit SQL, Prisma updates, tests and rollback. No production changes before review.

## Existing working behavior is authoritative — compatibility correction (2026-11-03)
The application **already** resolves a school staff user's school workspace and a bus operator's available school workspaces at sign-in. A trip created by school staff already appears to the appropriate bus operator inside that school's workspace. This existing behavior MUST be preserved, not redesigned.

The authorization contract above describes desired global data ownership, **not a mandate to introduce a new trip-specific access-grant mechanism**. Before adding any trip-participant access columns, access tables or authorization checks, trace the current sign-in, access runtime, workspace selection, trip creation, trip listing and bus operator visibility code. Map each current SQL query and model to its future `global` or `operational` equivalent. Reuse existing relationship/permission logic and only add fields where a proven gap exists.

The migration is primarily structural: existing `control` -> canonical `global`; existing `public` -> canonical `operational`, after reconciling overlaps, legacy tables and the already-existing `public.trip_registry`. Neither current schema should be blindly renamed. Preserve all existing IDs, workflow states, existing records, API behavior and workspace results.

**Regression gate:** same school user, same bus operator, same available schools, same visible trips, same create-to-operator propagation, before and after migration. No backend behavior changes until these tests are specified and a reversible compatibility plan is reviewed.
