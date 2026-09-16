import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { decideExternalQuotation } from "../src/services/externalQuotationDecision.js";
import { EXTERNAL_ACTIONS } from "../src/services/externalWorkflowActions.js";

const digest = (token) => crypto.createHash("sha256").update(token).digest("hex");
function fixture({ tripStatus = "Quotation Submitted" } = {}) {
  const token = "external-test-token";
  const state = {
    trip: { id: 9, status: tripStatus }, quotation: { id: "q1", tripId: 9, status: "submitted" },
    approvals: [{ id: "a1", tripId: 9, quotationId: "q1", status: "pending" }],
    action: { id: "x1", tokenHash: digest(token), tripId: 9, quotationId: "q1", approvalRequestId: "a1", recipientEmail: "approver@school.ae", allowedActions: [EXTERNAL_ACTIONS.APPROVE_QUOTATION, EXTERNAL_ACTIONS.DECLINE_QUOTATION], expiresAt: new Date(Date.now() + 60000), consumedAt: null, revokedAt: null },
  };
  const db = {
    externalWorkflowAction: { async findUnique({ where }) { return state.action.tokenHash === where.tokenHash ? state.action : null; }, async updateMany({ where, data }) { if (where.id && state.action.id !== where.id) return { count: 0 }; if (where.id && (state.action.consumedAt || state.action.revokedAt || state.action.expiresAt <= where.expiresAt.gt)) return { count: 0 }; Object.assign(state.action, data); return { count: 1 }; } },
    tripApprovalRequest: { async findFirst({ where }) { return state.approvals.find((a) => a.id === where.id && a.status === where.status) || null; }, async update({ where, data }) { const a = state.approvals.find((x) => x.id === where.id); Object.assign(a, data); return a; }, async updateMany({ where, data }) { for (const a of state.approvals) if (a.quotationId === where.quotationId && a.status === where.status && a.id !== where.id?.not) Object.assign(a, data); return { count: 1 }; } },
    tripQuotation: { async findFirst({ where }) { return state.quotation.id === where.id && state.quotation.status === where.status ? state.quotation : null; }, async update({ data }) { Object.assign(state.quotation, data); return state.quotation; } },
    trip: { async updateMany({ where, data }) { if (state.trip.id !== where.id || state.trip.status !== where.status) return { count: 0 }; Object.assign(state.trip, data); return { count: 1 }; } },
  };
  const prisma = { ...db, async $transaction(fn) { const snapshot = structuredClone(state); try { return await fn(db); } catch (error) { state.trip = snapshot.trip; state.quotation = snapshot.quotation; state.approvals = snapshot.approvals; state.action = snapshot.action; throw error; } } };
  return { prisma, state, token };
}

test("external approval consumes token and approves the exact submitted quotation", async () => { const { prisma, state, token } = fixture(); const result = await decideExternalQuotation({ prisma, token, decision: "approved" }); assert.equal(result.nextStatus, "Approved"); assert.equal(state.trip.status, "Approved"); assert.equal(state.quotation.status, "approved"); assert.equal(state.approvals[0].status, "approved"); assert.ok(state.action.consumedAt); });
test("external change request consumes token, supersedes quotation, and reopens trip", async () => { const { prisma, state, token } = fixture(); const result = await decideExternalQuotation({ prisma, token, decision: "declined", note: "Please revise rate" }); assert.equal(result.nextStatus, "Accepted"); assert.equal(state.trip.status, "Accepted"); assert.equal(state.quotation.status, "superseded"); assert.equal(state.approvals[0].decisionNote, "Please revise rate"); assert.ok(state.action.consumedAt); });
test("failed status transition rolls token consumption back with the business transaction", async () => { const { prisma, state, token } = fixture({ tripStatus: "Accepted" }); await assert.rejects(() => decideExternalQuotation({ prisma, token, decision: "approved" }), (e) => e?.status === 409); assert.equal(state.action.consumedAt, null); assert.equal(state.quotation.status, "submitted"); assert.equal(state.approvals[0].status, "pending"); });
