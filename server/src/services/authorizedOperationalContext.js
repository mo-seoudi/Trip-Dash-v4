import { prismaControl } from "../lib/prismaControl.js";
import { resolveEffectiveAccessV2 } from "./effectiveAccessV2.js";
import { getOperationalContextForOrganization } from "./operationalPrismaFactory.js";

export class OperationalAuthorizationError extends Error {
  constructor(message, code = "OPERATIONAL_ACCESS_DENIED", status = 403) { super(message); this.name = "OperationalAuthorizationError"; this.code = code; this.status = status; }
}

export async function getAuthorizedOperationalContext({ identity, schoolId, requiredPermission = null }) {
  if (!identity) throw new OperationalAuthorizationError("Authentication is required", "AUTHENTICATION_REQUIRED", 401);
  if (!schoolId) throw new OperationalAuthorizationError("School workspace is required", "SCHOOL_REQUIRED", 400);

  const access = await resolveEffectiveAccessV2(prismaControl, identity);
  const workspace = access.workspaces.find((item) => item.schoolId === schoolId);
  if (!workspace) throw new OperationalAuthorizationError("School workspace is not available to this user");
  if (requiredPermission && !workspace.permissions.includes(requiredPermission)) {
    throw new OperationalAuthorizationError(
      "Required permission is not available in this school workspace",
      "OPERATIONAL_PERMISSION_DENIED"
    );
  }

  // Authorization selects the school. The control-plane datasource mapping then
  // selects both the physical PostgreSQL database and its tenant partition.
  // Tenant scope is infrastructure metadata, not a user-access mechanism.
  const { prisma, dataSource } = await getOperationalContextForOrganization(workspace.schoolId);
  if (!dataSource?.tenantId) {
    throw new OperationalAuthorizationError(
      "Operational datasource has no tenant partition",
      "OPERATIONAL_TENANT_NOT_CONFIGURED",
      500
    );
  }

  return {
    user: access.user,
    workspace,
    prisma,
    tenantId: dataSource.tenantId,
    dataSource: {
      id: dataSource.id,
      organizationId: dataSource.organizationId,
      providerLabel: dataSource.providerLabel,
      schemaVersion: dataSource.schemaVersion,
    },
  };
}
