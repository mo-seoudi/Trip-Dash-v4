// Authorized workspace -> operational PostgreSQL context.
//
// The caller never selects a database directly. Authorization first resolves a
// school workspace. In legacy/shadow runtime modes, routing remains on the
// legacy DataConnection table. In canonical runtime mode, routing metadata is
// read from the dedicated Control Plane OperationalDataSource table.

import { prismaGlobal } from "../lib/prismaGlobal.js";
import { prismaControl } from "../lib/prismaControl.js";
import { accessRuntimeMode, resolveRuntimeAccess } from "./accessRuntime.js";
import { assertPostgresCompatibleDataSource, normalizeDataSourceProvider } from "./operationalDataSource.js";
import { prismaForOperationalDataSource } from "./operationalPrismaPool.js";

function httpError(status, message, code) {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
}

function canonicalMode(value) {
  const mode = String(value || "").trim().toUpperCase();
  if (mode === "BYODB" || mode === "CUSTOMER_POSTGRES") return "CUSTOMER_POSTGRES";
  return "HOSTED";
}

function providerFromConnection(connection) {
  const explicit = String(connection.provider || "").trim();
  if (explicit) return normalizeDataSourceProvider(explicit);
  const host = String(connection.dbHost || "").toLowerCase();
  if (host.includes("neon.tech")) return "neon";
  if (host.includes("supabase")) return "supabase";
  return "postgresql";
}

export function legacyConnectionAsDataSource(connection) {
  const secretRef = String(connection.vaultSecretId || "").trim();
  if (!secretRef) throw httpError(503, "This school's operational database credential is not configured", "DATA_SOURCE_SECRET_MISSING");
  return {
    id: `legacy:${connection.id}`, tenantId: connection.tenantId, organizationId: connection.orgId,
    mode: canonicalMode(connection.mode), provider: providerFromConnection(connection), region: null,
    secretRef, isActive: Boolean(connection.isActive), lastVerifiedAt: connection.lastVerifiedAt || null, updatedAt: connection.updatedAt,
  };
}

export function workspaceFromAccess(access, schoolId, requiredPermission = null) {
  const requestedSchoolId = String(schoolId || "").trim();
  if (!requestedSchoolId) throw httpError(400, "A school workspace is required", "SCHOOL_WORKSPACE_REQUIRED");
  const workspace = (access?.workspaces || []).find((item) => item.schoolId === requestedSchoolId);
  if (!workspace) throw httpError(403, "You do not have access to this school workspace", "SCHOOL_WORKSPACE_FORBIDDEN");
  if (requiredPermission && !(workspace.permissions || []).includes(requiredPermission)) {
    throw httpError(403, "You do not have permission for this action in this school workspace", "WORKSPACE_PERMISSION_FORBIDDEN");
  }
  if (!access?.tenantId) throw httpError(403, "This workspace is not attached to an authorized tenant", "WORKSPACE_TENANT_FORBIDDEN");
  return workspace;
}

export function activeWorkspaceConnectionWhere(access, workspace) {
  if (!access?.tenantId || !workspace?.schoolId) throw httpError(403, "Workspace routing context is incomplete", "WORKSPACE_ROUTING_FORBIDDEN");
  return { tenantId: access.tenantId, orgId: workspace.schoolId, isActive: true };
}

export function activeCanonicalDataSourceWhere(access, workspace) {
  if (!access?.tenantId || !workspace?.schoolId) throw httpError(403, "Workspace routing context is incomplete", "WORKSPACE_ROUTING_FORBIDDEN");
  return { tenantId: access.tenantId, organizationId: workspace.schoolId, isActive: true };
}

export function singleActiveWorkspaceConnection(connections = []) {
  if (!connections.length) throw httpError(503, "No active operational database is configured for this school", "DATA_SOURCE_NOT_CONFIGURED");
  if (connections.length > 1) throw httpError(503, "More than one active operational database is configured for this school", "DATA_SOURCE_AMBIGUOUS");
  return connections[0];
}

export async function authorizeSchoolWorkspace(user, schoolId, requiredPermission = null) {
  const access = await resolveRuntimeAccess({ user });
  const workspace = workspaceFromAccess(access, schoolId, requiredPermission);
  return { access, workspace };
}

export async function resolveWorkspaceDataSource(user, schoolId, requiredPermission = null, {
  runtimeMode = accessRuntimeMode(), legacyPrisma = prismaGlobal, controlPrisma = prismaControl,
} = {}) {
  const { access, workspace } = await authorizeSchoolWorkspace(user, schoolId, requiredPermission);

  if (runtimeMode === "canonical") {
    const rows = await controlPrisma.operationalDataSource.findMany({
      where: activeCanonicalDataSourceWhere(access, workspace), orderBy: { updatedAt: "desc" },
    });
    const dataSource = singleActiveWorkspaceConnection(rows);
    try {
      return { access, workspace, dataSource: assertPostgresCompatibleDataSource(dataSource) };
    } catch (error) {
      if (!error.code) error.code = "CANONICAL_DATA_SOURCE_INVALID";
      throw error;
    }
  }

  const connections = await legacyPrisma.dataConnection.findMany({
    where: activeWorkspaceConnectionWhere(access, workspace), orderBy: { updatedAt: "desc" },
  });
  return { access, workspace, dataSource: legacyConnectionAsDataSource(singleActiveWorkspaceConnection(connections)) };
}

export async function operationalPrismaForWorkspace(user, schoolId, requiredPermission = null) {
  const context = await resolveWorkspaceDataSource(user, schoolId, requiredPermission);
  const prisma = await prismaForOperationalDataSource(context.dataSource);
  return { ...context, prisma };
}
