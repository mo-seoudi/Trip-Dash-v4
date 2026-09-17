import { prismaControl } from "../lib/prismaControl.js";
import { resolveEffectiveAccessV2 } from "./effectiveAccessV2.js";
import { getOperationalPrismaForOrganization } from "./operationalPrismaFactory.js";

export class OperationalAuthorizationError extends Error {
  constructor(message, code = "OPERATIONAL_ACCESS_DENIED", status = 403) {
    super(message);
    this.name = "OperationalAuthorizationError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Resolve a user's canonical access to a school before any operational
 * datasource is selected. This is the mandatory boundary between the control
 * plane and school operational data.
 */
export async function getAuthorizedOperationalContext({ identity, schoolId, requiredPermission = null }) {
  if (!identity) {
    throw new OperationalAuthorizationError("Authentication is required", "AUTHENTICATION_REQUIRED", 401);
  }
  if (!schoolId) {
    throw new OperationalAuthorizationError("School workspace is required", "SCHOOL_REQUIRED", 400);
  }

  const access = await resolveEffectiveAccessV2(prismaControl, identity);
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

  // Infrastructure resolution happens only after the control plane has proved
  // that the user may enter this school workspace.
  const prisma = await getOperationalPrismaForOrganization(workspace.schoolId);

  return {
    user: access.user,
    tenantId: access.tenantId,
    workspace,
    prisma,
  };
}
