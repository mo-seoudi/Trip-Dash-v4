// Post-write verification for a disposable/non-production canonical control plane.
// This service never mutates either source. It resolves both sides and requires
// exact parity before a future cutover may be considered.

import { buildAccessParityReport } from "./accessParityReport.js";

function opaqueIdentity(user) {
  return { id: String(user?.id || "") };
}

export async function verifyControlPlaneBackfill({
  legacyUsers,
  resolveLegacyAccess,
  resolveCanonicalAccess,
}) {
  if (!Array.isArray(legacyUsers) || legacyUsers.length === 0) {
    const error = new Error("At least one legacy user is required for post-write verification");
    error.code = "CONTROL_VERIFY_EMPTY_USER_SET";
    throw error;
  }
  if (typeof resolveLegacyAccess !== "function") throw new TypeError("resolveLegacyAccess is required");
  if (typeof resolveCanonicalAccess !== "function") throw new TypeError("resolveCanonicalAccess is required");

  const rows = [];
  for (const legacyUser of legacyUsers) {
    const legacyAccess = await resolveLegacyAccess(legacyUser);
    const canonicalAccess = await resolveCanonicalAccess(opaqueIdentity(legacyUser), legacyUser);
    rows.push({
      identity: opaqueIdentity(legacyUser),
      legacyAccess,
      canonicalAccess,
    });
  }

  const report = buildAccessParityReport(rows);
  return {
    mode: "POST_WRITE_READ_ONLY_VERIFICATION",
    writesPerformed: false,
    cutoverReady: report.cutoverReady,
    report,
  };
}

export async function assertControlPlaneBackfillVerified(options) {
  const result = await verifyControlPlaneBackfill(options);
  if (!result.report.safe) {
    const error = new Error("Canonical control-plane backfill expands access beyond legacy");
    error.code = "CONTROL_VERIFY_SECURITY_EXPANSION";
    error.report = result.report;
    throw error;
  }
  if (!result.report.exact || !result.report.cutoverReady) {
    const error = new Error("Canonical control-plane backfill does not exactly match legacy access");
    error.code = "CONTROL_VERIFY_NOT_EXACT";
    error.report = result.report;
    throw error;
  }
  return result;
}
