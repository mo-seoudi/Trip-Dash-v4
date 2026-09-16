import crypto from "node:crypto";

export const EXTERNAL_ACTIONS = Object.freeze({
  APPROVE_QUOTATION: "quotation.approve",
  DECLINE_QUOTATION: "quotation.decline",
  ACCEPT_TRIP: "trip.accept",
  REJECT_TRIP: "trip.reject",
  PREPARE_QUOTATION: "quotation.prepare",
  CONFIRM_TRIP: "trip.confirm",
});

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const hashToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");

export async function issueExternalWorkflowAction({ prisma, tripId, quotationId = null, approvalRequestId = null, recipientEmail, participantOrganizationId = null, allowedActions, channel = "email", ttlMinutes = 60 * 24 * 7 }) {
  const email = normalizeEmail(recipientEmail);
  if (!email || !email.includes("@")) throw Object.assign(new Error("A valid external recipient email is required"), { status: 400 });
  const actions = [...new Set((allowedActions || []).filter((a) => Object.values(EXTERNAL_ACTIONS).includes(a)))];
  if (!actions.length) throw Object.assign(new Error("At least one supported external action is required"), { status: 400 });
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + Math.max(5, Number(ttlMinutes) || 0) * 60_000);
  const record = await prisma.externalWorkflowAction.create({ data: { tokenHash: hashToken(token), tripId, quotationId, approvalRequestId, recipientEmail: email, participantOrganizationId, allowedActions: actions, channel, expiresAt } });
  return { token, action: record };
}

export async function resolveExternalWorkflowAction({ prisma, token, requiredAction }) {
  if (!token) return null;
  const record = await prisma.externalWorkflowAction.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.revokedAt || record.consumedAt || record.expiresAt <= new Date()) return null;
  if (requiredAction && !record.allowedActions.includes(requiredAction)) return null;
  return record;
}

export async function consumeExternalWorkflowAction({ prisma, id }) {
  return prisma.externalWorkflowAction.update({ where: { id }, data: { consumedAt: new Date() } });
}
