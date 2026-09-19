import { prismaControl } from "../lib/prismaControl.js";
import { resolveEffectiveAccess } from "./effectiveAccess.js";
import { getOperationalContextForOrganization } from "./operationalPrismaFactory.js";

export class OperationalAuthorizationError extends Error {
  constructor(message, code = "OPERATIONAL_ACCESS_DENIED", status = 403) {
    super(message);
    this.name = "OperationalAuthorizationError";
    this.code = code;
    this.status = status;
  }
}

export async function getAuthorizedOperationalContext({ identity, schoolId, requiredPermission = null }) {
  if (!identity) {
    throw new OperationalAuthorizationError("Authentication is required", "AUTHENTICATION_REQUIRED", 401);
  }
  if (!schoolId) {
    throw new OperationalAuthorizationError("School workspace is required", "SCHOOL_REQUIRED", 400);
  }

  const access = await resolveEffectiveAccess(prismaControl, identity);
  const workspace = access.workspaces.find((item) => item.schoolId === schoolId);
  if (!workspace) {
    throw new OperationalAuthorizationError("School workspace is not available to this user");
  }
  if (requiredPermission && !workspace.permissions.includes(requiredPermission)) {
    throw new OperationalAuthorizationError(
      "Required permission is not available in this school workspace",
      "OPERATIONAL_PERMISSION_DENIED"
    );
  }

  // Authorization selects the school. The control plane then selects the
  // physical PostgreSQL datasource assigned to that organization. Platform
  // tenancy is deliberately not part of operational data routing.
  const { prisma, dataSource } = await getOperationalContextForOrganization(workspace.schoolId);

  return {
    user: access.user,
    workspace,
    prisma,
    dataSource: {
      id: dataSource.id,
      organizationId: dataSource.organizationId,
      providerLabel: dataSource.providerLabel,
      schemaVersion: dataSource.schemaVersion,
    },
  };
}
