# Legacy v4 Role and Permission Audit

This document records what the existing v4 application actually allows before we migrate users into the new scoped access model. The goal is to preserve working behaviour first, then improve the internal model without changing the user experience accidentally.

## Legacy roles observed

Operational user roles currently in use or referenced by the application:

- `admin`
- `school_staff`
- `bus_company`
- `finance`
- `trip_manager`

The Admin Users page currently exposes only `admin`, `school_staff`, `finance`, and `bus_company` as selectable roles. `trip_manager` is still referenced by route/sidebar access but is not represented in the main trip action permission matrix.

## Important distinction

The old role system is not entirely broken. It contains useful operational behaviour, especially in the trip lifecycle UI. The migration should preserve these behaviours and translate them into explicit permissions attached to scoped role assignments.

The main weakness is that authorization is split between frontend role checks, backend ad-hoc checks, and an incompletely wired global organization layer.

## Route/page access observed

### admin
Frontend access:
- Dashboard
- All Trips
- Finance
- Extra Bookings
- Admin Roles
- Admin Users
- Admin Approvals
- Global Admin
- Settings

### school_staff
Frontend access:
- Dashboard
- All Trips
- Extra Bookings
- Settings

Operational behaviour:
- request a trip
- view trips in the main trip UI
- edit trips while Pending, Accepted, or Confirmed
- cancel immediately while Pending
- request cancellation after Accepted/Confirmed
- manage passengers when Accepted/Confirmed/Completed

### bus_company
Frontend access:
- Dashboard
- All Trips
- Settings

Operational behaviour:
- view trips
- accept/reject Pending trips
- assign bus after Accepted
- complete Confirmed trips
- approve/decline cancellation requests
- provider-side cancellation behaviour exists in the older action component
- no normal trip-form editing

### finance
Frontend access:
- Finance
- All Trips
- Settings

Operational trip matrix:
- view trips
- no accept/reject
- no bus assignment
- no completion
- no cancellation
- no normal trip edit

The older Admin Roles page also describes finance as being able to edit trips and mark paid, but that page persists its settings only to browser localStorage and is not authoritative backend permission data. Therefore the actual working application behaviour should take priority over those local settings during migration.

### trip_manager
Frontend access references:
- Dashboard
- All Trips
- Extra Bookings
- Settings

No explicit `trip_manager` entry exists in the main `tripPermissions` matrix, and no lifecycle actions are specifically granted to it. This role should therefore be treated as **incomplete/ambiguous legacy behaviour**, not blindly migrated to a powerful new role.

Before assigning new permissions to an existing user with this role, inspect whether any such users exist and what they were intended to do.

## Legacy trip lifecycle matrix

### Pending
- school_staff: View, Edit, Cancel
- bus_company: View, Accept, Reject
- admin: View, Edit, Accept, Reject, Cancel
- finance: View

### Accepted
- school_staff: View, Edit, Request Cancel, manage passengers
- bus_company: View, Assign Bus
- admin: View, Edit, Assign Bus, direct Cancel, passenger view
- finance: View

### Confirmed
- school_staff: View, Edit Request, Request Cancel, manage passengers
- bus_company: View, Complete
- admin: View, Edit, Complete, direct Cancel, passenger view
- finance: View

### Cancel Requested
- bus_company: View, Approve Cancel, Decline Request
- admin: View, Edit, Approve Cancel, Decline Request
- school_staff: View
- finance: View

### Rejected
- all normal viewing roles may view
- admin retains edit capability in the explicit permission matrix

### Completed
- school_staff: View, manage passengers
- admin: View, Edit, passenger read-only view
- bus_company: View
- finance: View

### Canceled
- admin: View, Edit, Delete/cleanup
- other viewing roles: View

## Passenger behaviour observed

Frontend intent:
- school_staff can manage passenger records
- admin can view passengers read-only
- bus_company passenger button is deliberately hidden

Backend implementation currently differs from that intent. Passenger API access is granted to admin or the trip creator, and does not yet model school/provider relationships. This mismatch must be corrected in the new authorization layer while preserving the intended school-side passenger management behaviour.

Proposed new permissions:
- `passenger.read_transport`
- `passenger.read_sensitive`
- `passenger.manage`

Do not grant all three automatically to transport providers.

## Trip visibility inconsistency

The frontend All Trips page treats `admin`, `school_staff`, `bus_company`, and `finance` as having global trip visibility, while the backend `/api/trips` route currently narrows `school_staff` to trips created by that user.

This means v4's observed behaviour is not a single coherent authorization system. During migration, visibility should be resolved from organization scope:

- school user -> trips belonging to permitted school(s)
- group user -> trips in permitted child schools
- bus company user -> trips where the company is a legitimate provider/participant
- service partner/trip manager -> trips managed for linked schools
- finance -> trips in its assigned organization scope
- platform admin -> according to platform/support policy

This is more faithful to the intended product than preserving the accidental `createdBy` filter as a permanent rule.

## User administration behaviour

Legacy `admin` can:
- list users
- approve pending users
- change a user's legacy role/status
- access the old global admin UI

The new architecture should split this into scoped permissions rather than making every admin platform-global.

Proposed distinctions:
- `platform_super_admin`
- `tenant_admin`
- `group_admin`
- `school_admin`
- `bus_operator_admin`
- `service_partner_admin`

## Proposed migration mapping

The mapping below preserves legacy intent while adding scope. It is a starting rule, not a blind one-to-one conversion.

### legacy `school_staff`
New role: `school_staff`
Scope: the school organization inferred from migrated membership/global data
Permissions initially:
- `trip.read`
- `trip.create`
- `trip.update`
- `trip.request_edit`
- `trip.cancel`
- `passenger.read_transport`
- `passenger.read_sensitive`
- `passenger.manage`
- `booking.read`
- `booking.create`
- `booking.update`
- `booking.cancel`

### legacy `bus_company`
New role: `dispatcher` by default, or `bus_operator_admin` where evidence shows user administration responsibility
Scope: bus-company organization
Permissions initially:
- `trip.read`
- `trip.accept`
- `trip.reject`
- `trip.assign_vehicle`
- `trip.complete`
- provider-side cancellation resolution
- `booking.read` / `booking.fulfil` where bookings are provider-facing

Access to school trips must additionally require an active organization relationship and/or explicit trip participation.

### legacy `finance`
New role: `finance`
Scope: inferred organization/group
Permissions initially:
- `trip.read`
- `trip.read_financials`
- finance workspace access

Any mutation such as `trip.update_financials` should be granted only if the existing finance workflow proves it was actually required.

### legacy `admin`
Do not automatically map every old admin to `platform_super_admin`.

Determine scope from the old global/control-plane records where possible:
- platform-wide legacy admin -> `platform_super_admin`
- customer/group admin -> `group_admin` or `tenant_admin`
- school-specific admin -> `school_admin`
- provider admin -> `bus_operator_admin`

Until the scope is known, migrated admin users should retain their legacy access through compatibility logic rather than receiving broader new privileges by assumption.

### legacy `trip_manager`
No automatic role mapping yet.

Likely future mapping depends on organization type:
- service partner user -> `service_partner_staff` / `service_partner_admin`
- school-side trip coordinator -> scoped school role

Inspect actual legacy users and global memberships before assigning permissions.

## Migration safety rules

1. Preserve legacy `User.id`, email, status, role, and password hash during the transition.
2. Create one `AppUser` per legacy user and record `legacyUserId`.
3. Never create duplicate identities for the same legacy user merely because the old global layer also contains a user row.
4. Use legacy/global membership and partnership data as migration evidence, not as unquestioned truth.
5. Backfill role assignments only where organization scope can be established safely.
6. Keep existing trip IDs and records unchanged.
7. Backfill new trip ownership/participation foreign keys alongside the legacy creator fields.
8. Validate migrated access against the legacy behaviour before retiring legacy authorization paths.
9. Do not grant `platform_super_admin` merely because `User.role = admin`.
10. Do not infer cross-organization access solely from tenant equality.

## Immediate backend implications

Before the new authorization service is activated:

- centralize Prisma client usage
- require a real JWT secret everywhere
- stop trusting a role carried only in the JWT
- load current user status/legacy role from the database for compatibility checks
- protect all operational mutation routes with authentication
- remove duplicate route mounting
- keep the existing frontend permission matrix as a behavioural reference, not as a security boundary

The frontend remains an affordance layer. Final authorization must be enforced by the backend.
