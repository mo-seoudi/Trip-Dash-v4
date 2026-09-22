import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { resolveRuntimeAccess } from "../services/accessRuntime.js";
import { PERMISSIONS } from "../services/accessCatalog.js";
import { operationalPrismaForWorkspace } from "../services/workspaceOperationalContext.js";
import { listInternalQuotationApprovers } from "../services/quotationApprovalAuthorization.js";

const router = Router();
router.use(requireAuth);

// GET /api/access/me
// Stable frontend bootstrap contract backed exclusively by the canonical
// control-plane effective-access resolver.
router.get("/me", async (req, res, next) => {
  try {
    const access = await resolveRuntimeAccess({ user: req.user });
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
