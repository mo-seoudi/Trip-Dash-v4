import { EXTERNAL_ACTIONS, consumeExternalWorkflowAction, resolveExternalWorkflowAction } from "./externalWorkflowActions.js";

export async function decideExternalQuotation({ prisma, token, decision, note = null }) {
  const requiredAction = decision === "approved"
    ? EXTERNAL_ACTIONS.APPROVE_QUOTATION
    : EXTERNAL_ACTIONS.DECLINE_QUOTATION;
  const action = await resolveExternalWorkflowAction({ prisma, token, requiredAction });
  if (!action) throw Object.assign(new Error("This action link is invalid, expired, revoked, or already used"), { status: 410 });

  return prisma.$transaction(async (tx) => {
    // Claim the bearer action first inside this transaction. If any subsequent
    // quotation/trip mutation fails, the transaction rolls the claim back too.
    await consumeExternalWorkflowAction({ prisma: tx, id: action.id });

    const approval = await tx.tripApprovalRequest.findFirst({
      where: { id: action.approvalRequestId, tripId: action.tripId, quotationId: action.quotationId, status: "pending" },
    });
    if (!approval) throw Object.assign(new Error("Approval request is no longer pending"), { status: 409 });

    const quotation = await tx.tripQuotation.findFirst({
      where: { id: action.quotationId, tripId: action.tripId, status: "submitted" },
    });
    if (!quotation) throw Object.assign(new Error("Quotation is no longer awaiting approval"), { status: 409 });

    const decisionNote = String(note || "").trim().slice(0, 1000) || null;
    const decided = await tx.tripApprovalRequest.update({
      where: { id: approval.id },
      data: { status: decision, decidedAt: new Date(), decidedByExternalEmail: action.recipientEmail, decisionNote },
    });

    if (decision === "approved") {
      await tx.tripQuotation.update({ where: { id: quotation.id }, data: { status: "approved" } });
      const changed = await tx.trip.updateMany({
        where: { id: action.tripId, status: "Quotation Submitted" },
        data: { status: "Approved" },
      });
      if (changed.count !== 1) throw Object.assign(new Error("Trip changed while quotation was being approved"), { status: 409 });
      await tx.tripApprovalRequest.updateMany({
        where: { quotationId: quotation.id, status: "pending", id: { not: approval.id } },
        data: { status: "superseded", decidedAt: new Date(), decisionNote: "Quotation approved through another approval request" },
      });
    } else {
      await tx.tripQuotation.update({ where: { id: quotation.id }, data: { status: "superseded", supersededAt: new Date() } });
      const changed = await tx.trip.updateMany({
        where: { id: action.tripId, status: "Quotation Submitted" },
        data: { status: "Accepted" },
      });
      if (changed.count !== 1) throw Object.assign(new Error("Trip changed while quotation was being declined"), { status: 409 });
      await tx.tripApprovalRequest.updateMany({
        where: { quotationId: quotation.id, status: "pending", id: { not: approval.id } },
        data: { status: "superseded", decidedAt: new Date(), decisionNote: "Quotation declined; a revised quotation is required" },
      });
    }

    await tx.externalWorkflowAction.updateMany({
      where: { quotationId: quotation.id, id: { not: action.id }, consumedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return {
      tripId: action.tripId,
      quotationId: action.quotationId,
      decision,
      approvalRequestId: decided.id,
      nextStatus: decision === "approved" ? "Approved" : "Accepted",
    };
  });
}
