# Workspace and Effective Access Model

## Purpose

TripDash uses a workspace experience without making a database provider or database-level policy engine the application authorization authority.

The backend owns identity, role/permission evaluation, organization relationships, workspace discovery and resource authorization. PostgreSQL stores the facts. The frontend receives an already-authorized workspace/access projection from the API.

## Workspace is a view, not a security boundary

A **workspace** is the user's operational context for one school. It is not a separate tenant/database and selecting it does not grant access.

The backend first calculates which schools the user may access. The frontend may then select one of those schools as the current workspace.

Two UI contexts are supported:

- **Portfolio** — aggregate view across all school workspaces the user is permitted to access.
- **School workspace** — one selected school, used for school-specific trip creation and operational actions.

A user may see a trip in Portfolio but be required to enter that trip's school workspace before performing school-context actions. The backend still re-checks authorization for every action; workspace selection alone never authorizes a request.

## Canonical organization types

- `SCHOOL_GROUP`
- `SCHOOL`
- `BUS_OPERATOR`
- `SERVICE_PARTNER`

Historical organization labels may be interpreted by migration tooling, but runtime authorization uses only canonical organization types.

## Canonical organization relationships

Relationships are directed facts between organizations. They are not user permissions by themselves.

- `BELONGS_TO_GROUP`: School -> School Group
- `TRANSPORT_PROVIDER`: School -> Bus Operator
- `TRIP_MANAGER`: School -> Service Partner
- `WORKS_WITH_TRANSPORT_PROVIDER`: Service Partner -> Bus Operator

Relationships can be active/inactive, primary/non-primary and date bounded. A primary relationship can be used to derive defaults (for example the default transport provider) but never bypass authorization.

## Identity, membership, role and permission are separate

A user can belong to more than one organization and can hold more than one role at different scopes.

Authorization is derived from:

`authenticated user + active membership + active scoped role assignment + role permissions + active organization relationships + resource context`

No single user-role field is the authorization model.

### Membership

Membership answers: **which organization is this person actually a member of?**

Examples:

- Sarah is a member of Repton Dubai.
- Mohammed is a member of Cognita Middle East.
- An STS dispatcher is a member of STS.
- A service-partner coordinator is a member of the service partner.

Membership does not itself grant every operational permission.

### Role assignment

Role assignment answers: **what may this user do, and at what scope?**

Scopes:

- `PLATFORM` — platform-wide; normally Super Admin only.
- `TENANT` — across the tenant/customer boundary.
- `ORGANIZATION` — anchored to one organization.

Canonical system roles initially are:

- `super_admin`
- `tenant_admin`
- `group_staff`
- `school_staff`
- `bus_operator`
- `service_partner`
- `finance`

Roles map to explicit permission keys. Routes/services authorize permissions, not UI labels.

## Effective school access

The access service calculates the schools available to a user. Direct access and relationship-derived access are distinguished so the UI and audit trail can explain why access exists.

### Direct school member

An active member with an appropriate organization-scoped role at School A can access School A.

### School-group/internal user

A user with a suitable role scoped to a School Group can access active schools belonging to that group. This supports internal users covering several schools without creating duplicate user accounts or pretending they belong to every school.

### Bus Operator user

A user with `bus_operator` role at Bus Operator X can access school workspaces where School -> Bus Operator X has an active `TRANSPORT_PROVIDER` relationship.

This relationship grants *scope*, not passenger privacy. The Bus Operator's role permissions still decide what data/actions are available. In particular, passenger/guardian details are not automatically exposed merely because the operator can access the school's trip workflow.

### Service Partner user

A user with `service_partner` role at Service Partner Y can access school workspaces where School -> Service Partner Y has an active `TRIP_MANAGER` relationship.

The partner may create/manage trips on the school's behalf according to its permissions. A `WORKS_WITH_TRANSPORT_PROVIDER` relationship can additionally identify the bus operators with which that service partner works; it does not automatically make every operator's unrelated schools accessible.

### Tenant/platform administrators

Platform and tenant administrator scopes are explicit role assignments. They are not inferred from organization names or email domains.

## Workspace API contract

The backend exposes authorization-derived access through its access API. The response contains only data needed by the client, conceptually:

```json
{
  "user": { "id": "...", "email": "...", "displayName": "..." },
  "roles": ["group_staff", "finance"],
  "permissions": ["trip.read", "finance.read"],
  "organizations": [
    {
      "id": "...",
      "type": "SCHOOL",
      "displayName": "Repton Dubai",
      "abbreviation": "RDXB",
      "access": {
        "direct": false,
        "viaOrganizationId": "...",
        "viaRelationship": "BELONGS_TO_GROUP"
      }
    }
  ],
  "workspaces": [
    {
      "schoolId": "...",
      "displayName": "Repton Dubai",
      "abbreviation": "RDXB",
      "permissions": ["trip.read", "trip.create", "passenger.read"]
    }
  ],
  "portfolio": { "enabled": true }
}
```

The client may remember the selected workspace ID for convenience, but the backend must reject any school/workspace ID outside the caller's current effective access.

## Trip resource context

Every canonical trip has explicit organizational ownership/context:

- `owningSchoolOrganizationId` — the school the trip belongs to.
- `requestingOrganizationId` — organization that requested/created the trip in the operational workflow; for a direct school request this is the owning school, while a service partner may request on the school's behalf.
- `transportProviderOrganizationId` — optional assigned Bus Operator.
- canonical creator identity/audit fields as defined by the operational schema.

This lets authorization answer questions from actual resource facts rather than creator-email conventions.

Examples:

- School staff create a trip: owning school = current school workspace; requesting organization = school.
- Service partner creates for School A: owning school = School A; requesting organization = service partner.
- Direct school/operator relationship: owning school = School A; requesting organization = School A; transport provider = related Bus Operator when assigned.

## Important security rules

1. The frontend never sends a trusted role, tenant, creator or permission.
2. Selecting a workspace never creates access.
3. Relationship-derived access is limited by the user's role permissions.
4. A Bus Operator's operational trip access does not imply passenger/guardian access.
5. Cross-tenant relationships are invalid unless explicitly supported by the control-plane relationship model and authorization rules.
6. Organization relationships must be active and within validity dates.
7. Resource writes must validate that referenced organizations are accessible and relationship-compatible.
8. Portfolio queries are server-filtered to the user's effective school set.
9. Every mutation is re-authorized server-side even if the UI hid or disabled the action.
10. PostgreSQL/RLS may be used as defense in depth, but backend authorization remains the application policy source of truth.

## Migration boundary

Historical user roles, organization labels and creator-based visibility rules are migration inputs only. Migration tooling may read them to preserve legitimate existing data and intent, but runtime authorization does not depend on those legacy structures.

Once migrated records have been verified against the canonical control-plane and operational schemas, the application continues using the canonical access model described above.
