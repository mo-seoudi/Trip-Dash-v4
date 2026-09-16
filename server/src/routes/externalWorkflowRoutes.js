import { Router } from "express";
import { operationalPrismaForExternalWorkspace } from "../services/workspaceOperationalContext.js";
import { EXTERNAL_ACTIONS, resolveExternalWorkflowAction } from "../services/externalWorkflowActions.js";
import { decideExternalQuotation } from "../services/externalQuotationDecision.js";

const router = Router({ mergeParams: true });
const cleanToken = (req) => String(req.body?.token || req.query?.token || "").trim();
const money = (value) => value == null ? null : String(value);

router.get("/quotation", async (req, res, next) => {
  try {
    const token = cleanToken(req);
    if (!token) return res.status(400).json({ message: "Action token is required" });
    const routed = await operationalPrismaForExternalWorkspace(req.params.schoolId);
    const action = await resolveExternalWorkflowAction({ prisma: routed.prisma, token });
    if (!action || !action.allowedActions.some((a) => [EXTERNAL_ACTIONS.APPROVE_QUOTATION, EXTERNAL_ACTIONS.DECLINE_QUOTATION].includes(a))) {
      return res.status(410).json({ message: "This action link is invalid, expired, revoked, or already used" });
    }
    const approval = await routed.prisma.tripApprovalRequest.findFirst({ where: { id: action.approvalRequestId, tripId: action.tripId, quotationId: action.quotationId, status: "pending" } });
    const quotation = await routed.prisma.tripQuotation.findFirst({
      where: { id: action.quotationId, tripId: action.tripId, status: "submitted" },
      include: { lines: { orderBy: { sequence: "asc" } }, trip: { select: { destination: true, date: true, departureTime: true, returnTime: true, tripType: true } } },
    });
    if (!approval || !quotation) return res.status(410).json({ message: "This quotation is no longer awaiting your response" });
    return res.json({
      quotation: {
        version: quotation.version,
        status: quotation.status,
        submittedAt: quotation.submittedAt,
        trip: quotation.trip,
        lines: quotation.lines.map((line) => ({ sequence: line.sequence, busType: line.busType, seatCapacity: line.seatCapacity, price: money(line.price), currency: line.currency, rateDescription: line.rateDescription || null })),
      },
      expiresAt: action.expiresAt,
      actions: { approve: action.allowedActions.includes(EXTERNAL_ACTIONS.APPROVE_QUOTATION), decline: action.allowedActions.includes(EXTERNAL_ACTIONS.DECLINE_QUOTATION) },
    });
  } catch (error) { next(error); }
});

async function decide(req, res, next, decision) {
  try {
    const token = cleanToken(req);
    if (!token) return res.status(400).json({ message: "Action token is required" });
    const routed = await operationalPrismaForExternalWorkspace(req.params.schoolId);
    const result = await decideExternalQuotation({ prisma: routed.prisma, token, decision, note: req.body?.note });
    return res.json(result);
  } catch (error) { next(error); }
}

router.post("/quotation/approve", (req, res, next) => decide(req, res, next, "approved"));
router.post("/quotation/decline", (req, res, next) => decide(req, res, next, "declined"));
export default router;
