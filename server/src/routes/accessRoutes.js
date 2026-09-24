import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { prismaControl } from "../lib/prismaControl.js";
import { resolveRuntimeAccess } from "../services/accessRuntime.js";
import { PERMISSIONS } from "../services/accessCatalog.js";
import { operationalPrismaForWorkspace } from "../services/workspaceOperationalContext.js";
import { listInternalQuotationApprovers } from "../services/quotationApprovalAuthorization.js";

const router = Router();
router.use(requireAuth);

function operationalReadiness(rows = []) {
  if (rows.length === 0) return { configured: false, state: "NOT_CONFIGURED", source: null };
  if (rows.length > 1) return { configured: false, state: "AMBIGUOUS", source: null };

  const source = rows[0];
  // Platform-hosted organizations use the server's shared OPERATIONAL_DATABASE_URL.
  // They deliberately have no per-organization DataSourceCredential record.
  if (source.mode === "HOSTED") return { configured: true, state: "READY", source };

  const credentialReady = Boolean(source.credential?.isActive && source.credential?.secretProvider?.isActive);
  return {
    configured: credentialReady,
    state: credentialReady ? "READY" : "CREDENTIAL_MISSING",
    source,
  };
}

// GET /api/access/me
// Stable frontend bootstrap contract backed exclusively by the canonical
// control-plane effective-access resolver. Operational readiness is metadata
// only: it never grants access and never exposes database credentials.
router.get("/me", async (req, res, next) => {
  try {
    const access = await resolveRuntimeAccess({ user: req.user });
    const workspaces = access?.workspaces || [];
    const schoolIds = [...new Set(workspaces.map((item) => item.schoolId).filter(Boolean))];
    const sources = schoolIds.length
      ? await prismaControl.operationalDataSource.findMany({
          where: { organizationId: { in: schoolIds }, isActive: true },
          select: {
            organizationId: true,
            id: true,
            name: true,
            mode: true,
            engine: true,
            providerLabel: true,
            lastVerifiedAt: true,
            credential: { select: { isActive: true, secretProvider: { select: { isActive: true } } } },
          },
        })
      : [];
    const bySchool = new Map();
    for (const source of sources) {
      const rows = bySchool.get(source.organizationId) || [];
      rows.push(source);
      bySchool.set(source.organizationId, rows);
    }
    access.workspaces = workspaces.map((workspace) => {
      const readiness = operationalReadiness(bySchool.get(workspace.schoolId) || []);
      const source = readiness.source;
      return {
        ...workspace,
        operational: {
          configured: readiness.configured,
          state: readiness.state,
          dataSourceId: source?.id || null,
          name: source?.name || null,
          mode: source?.mode || null,
          engine: source?.engine || null,
          providerLabel: source?.providerLabel || null,
          lastVerifiedAt: source?.lastVerifiedAt || null,
        },
      };
    });
    return res.json(access);
  } catch (error) { return next(error); }
});

// A scoped, authorization-filtered directory for the quotation workflow.
// It intentionally returns only users who can approve quotations in this exact
// school workspace; it is not a general user-directory endpoint.
router.get("/workspaces/:schoolId/quotation-approvers", async (req, res, next) => {
  try {
    await operationalPrismaForWorkspace(req.user, req.params.schoolId, PERMISSIONS.TRIP_REQUEST_QUOTE_APPROVAL);
    const approvers = await listInternalQuotationApprovers({ schoolId: req.params.schoolId });
    return res.json(approvers);
  } catch (error) { return next(error); }
});

export default router;
