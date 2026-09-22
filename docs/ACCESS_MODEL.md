# TripDash Access Model

## Core rule

Authorization is not represented by one `User.role` value..

An access decision is derived from:

`authenticated identity + active membership + active scoped role assignment + role permissions + active organization relationships + resource context`

The control plane is the authority for these access facts. Routes and services authorize explicit permissions; the frontend does not supply trusted roles or permissions.

## Scope hierarchy

### PLATFORM

Used for TripDash platform administration.

Canonical system role:
- `super_admin`

A platform role can administer platform/control-plane configuration without requiring membership in every customer organization.

### TENANT

Used for customer-wide administration.

Canonical system role:
- `tenant_admin`

A tenant-scoped role can operate across organizations covered by that tenant, subject to the permissions attached to the role.

### ORGANIZATION

Used for school-group, school, bus-operator and service-partner access.

Canonical system roles initially are:
- `group_staff`
- `school_staff`
- `bus_operator`
- `service_partner`
- `finance`

The role/permission model can grow without introducing ad-hoc authorization branches in routes.

## Permission catalogue

Permissions are explicit capability keys attached to roles. The current catalogue includes control-plane and operational capabilities such as:

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

Permission keys, rather than role display names, are what runtime authorization should check.

## Canonical organization relationships

- `BELONGS_TO_GROUP`: School -> School Group
- `TRANSPORT_PROVIDER`: School -> Bus Operator
- `TRIP_MANAGER`: School -> Service Partner
- `WORKS_WITH_TRANSPORT_PROVIDER`: Service Partner -> Bus Operator

Relationships establish operational scope and defaults. They do not by themselves grant every permission or every field of a resource.

## Relationship-aware examples

### School directly books its bus operator

- Repton Dubai owns the trip.
- Repton Dubai has an active `TRANSPORT_PROVIDER` relationship to STS.
- The trip's `requestingOrganizationId` is Repton Dubai.
- STS may be assigned as `transportProviderOrganizationId`.
- Authorized Repton Dubai staff can create/read the trip.
- Authorized STS users can participate in the provider-side workflow according to their permissions and the active relationship/resource context.

### Service partner books for a school

- Repton Dubai remains the owning school.
- The service partner has an active `TRIP_MANAGER` relationship with Repton Dubai.
- The trip's `requestingOrganizationId` is the service partner.
- A Bus Operator may separately be assigned as `transportProviderOrganizationId`.

The service partner does not become the owner of the school's operational data merely because it requested the trip on the school's behalf.

### One Bus Operator serves several organizations

A Bus Operator may have active `TRANSPORT_PROVIDER` relationships with schools covered by different tenants. Its users receive access through explicit membership/role/permission and relationship/resource evaluation, not because they share a tenant with every school.

This is why authorization cannot rely solely on `tenantId` equality.

## Field-level restrictions

Resource access and field access are separate decisions.

For example, a transport provider may legitimately need:
- passenger name where operationally required
- pickup/drop-off information
- transport notes
- trip timings

but not automatically:
- unrelated school internal notes
- customer administration data
- sensitive passenger/guardian information beyond its permission
- fields restricted to finance

API response shaping should follow the caller's permissions rather than assuming that `trip.read` means permission to read every attached field.

## Implementation rule

Routes must not contain authorization logic such as:

```js
if (user.role === "school_staff") {
  // allow
}
```

They should use the centralized access layer, conceptually:

```js
const access = await resolveEffectiveAccess(req.user.id);
authorizePermission(access, "trip.read", resourceContext);
```

Operational database queries are then constrained to the school/resource scope that the backend has authorized.

## Frontend boundary

The React application may use the access projection returned by the backend to show or hide controls, but this is only a user-experience layer.

The frontend must not:
- determine authoritative roles or permissions itself;
- receive database credentials or secret references;
- choose an operational database directly;
- treat a selected workspace as proof of access.

Every protected request is authorized again by the backend.

## Migration boundary

Historical role labels and creator-based visibility rules may still be read by deliberate migration/cutover tooling. They are migration inputs only and are not runtime authorization sources.

The canonical runtime model is `AppUser` + memberships + scoped role assignments + permissions + organization relationships + resource context.
