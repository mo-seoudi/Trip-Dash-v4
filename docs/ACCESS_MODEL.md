# TripDash Access Model

## Core rule

Authorization is not represented by one `User.role` value.

An access decision is derived from:

`user identity + active membership + scoped role + permission + organization relationship + resource participation`

## Scope hierarchy

### PLATFORM
Used only for TripDash platform administration.

Example role:
- `platform_super_admin`

This role may administer tenants and platform configuration. It does not need to be a member of every customer organization.

### TENANT
Used for customer/workspace-wide administration.

Examples:
- `tenant_admin`
- `tenant_finance`
- `tenant_auditor`

A tenant-scoped role can operate across organizations belonging to that tenant, subject to the permissions attached to the role.

### ORGANIZATION
Used for group, school, bus-company, and service-partner access.

Examples:
- `group_admin`
- `school_admin`
- `school_staff`
- `teacher`
- `bus_operator_admin`
- `dispatcher`
- `driver_coordinator`
- `service_partner_admin`
- `service_partner_staff`
- `finance`
- `viewer`

## Initial permission catalogue

### Platform and organization
- `tenant.read`
- `tenant.manage`
- `organization.read`
- `organization.manage`
- `relationship.read`
- `relationship.manage`
- `user.read`
- `user.manage`
- `role.assign`
- `audit.read`

### Trips
- `trip.read`
- `trip.create`
- `trip.update`
- `trip.request_edit`
- `trip.cancel`
- `trip.accept`
- `trip.reject`
- `trip.assign_vehicle`
- `trip.complete`
- `trip.read_financials`
- `trip.update_financials`

### Passengers
- `passenger.read_transport`
- `passenger.read_sensitive`
- `passenger.manage`

### Bookings
- `booking.read`
- `booking.create`
- `booking.update`
- `booking.cancel`
- `booking.fulfil`

## Suggested system role mappings

These are starting defaults, not hard-coded authorization logic.

### platform_super_admin
Platform-wide administrative permissions.

### tenant_admin
Tenant-wide organization/user/relationship administration plus operational visibility.

### group_admin
Organization management for the school group and child schools, user access administration, relationship management, and trip visibility across the group.

### school_admin
User/access management for the school plus full school trip workflow permissions.

### school_staff
Create/read school trips and perform school-side workflow actions. No user administration.

### teacher
Create/read trips within the permitted school. Sensitive passenger access should be limited to what is necessary.

### bus_operator_admin
Manage users belonging to the bus company and view/operate trips in which that company participates.

### dispatcher
Read participating trips, accept/reject requests, assign operational resources, and complete provider-side workflow actions.

### service_partner_admin
Manage the service partner's users and operate trips for schools with an active `TRIP_MANAGER` relationship.

### service_partner_staff
Operate permitted school trips through the service partner relationship, without organization administration.

### finance
Read permitted trips and financial fields. Financial mutation permissions can be assigned separately.

## Relationship-aware examples

### School directly books its bus company

- Repton Dubai owns the trip.
- Repton Dubai has an active `TRANSPORT_PROVIDER` relationship to STS.
- STS is assigned as the trip's transport provider.
- Repton Dubai school staff can create/read the trip.
- STS dispatchers can read and fulfil the trip because their organization participates as transport provider.

### Service partner books for a school

- Repton Dubai owns the trip.
- Enrich Me has an active `TRIP_MANAGER` relationship with Repton Dubai.
- Enrich Me creates/manages the trip on Repton Dubai's behalf.
- STS is the transport provider.
- The trip records all three roles explicitly: owning school, managing organization, transport provider.

The service partner does not become the owner of the school's data merely because it created the request.

### One bus company serves several unrelated customers

STS may have active `TRANSPORT_PROVIDER` relationships with schools belonging to different tenants. An STS dispatcher can see participating trips from those schools through the authorization service without receiving access to either customer's unrelated data.

This is why relationship authorization cannot rely solely on `tenant_id` equality.

## Field-level restrictions

Resource access and field access are separate decisions.

For example, a provider may legitimately need:
- student/passenger name
- pickup/dropoff information
- transport notes
- trip timings

but not:
- unrelated school internal notes
- customer administration data
- fields belonging only to finance

The API should eventually shape responses based on the caller's permissions rather than assuming that permission to read a trip means permission to read every attached field.

## Implementation rule

Routes should not contain ad-hoc checks such as:

`if (user.role === "school_staff") ...`

Instead they should call a centralized authorization layer, conceptually:

```js
const access = await resolveAccessContext(req.user.id);
await authorize(access, "trip.read", trip);
```

Operational database queries should then be constrained to the resource scope that the authorization layer has resolved.
