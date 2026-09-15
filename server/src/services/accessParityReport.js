// Aggregate legacy <-> canonical-v2 parity results into a migration gate.
// This is deliberately pure: it can be used by tests, a dry-run backfill script,
// or an admin diagnostic without changing either database.

import { compareEffectiveAccessParity } from "./accessParity.js";

function reportIdentity(identity) {
  const result = { id: String(identity?.id || "") };
  // Email is useful for an interactive rehearsal when explicitly supplied, but
  // post-write verification deliberately passes opaque identities only.
  if (identity?.email) result.email = identity.email;
  return result;
}

export function buildAccessParityReport(rows = []) {
  const users = rows.map(({ identity, legacyAccess, canonicalAccess }) => {
    const parity = compareEffectiveAccessParity(legacyAccess, canonicalAccess);
    return {
      identity: reportIdentity(identity),
      safe: parity.safe,
      exact: parity.exact,
      counts: parity.counts,
      issues: parity.issues,
    };
  });

  const unsafeUsers = users.filter((row) => !row.safe);
  const nonExactUsers = users.filter((row) => !row.exact);
  const issueCounts = {};
  for (const user of users) {
    for (const issue of user.issues) {
      issueCounts[issue.code] = (issueCounts[issue.code] || 0) + 1;
    }
  }

  return {
    safe: unsafeUsers.length === 0,
    exact: nonExactUsers.length === 0,
    cutoverReady: users.length > 0 && nonExactUsers.length === 0,
    counts: {
      users: users.length,
      unsafeUsers: unsafeUsers.length,
      nonExactUsers: nonExactUsers.length,
    },
    issueCounts,
    users,
  };
}

export function assertAccessParityCutoverReady(rows = []) {
  const report = buildAccessParityReport(rows);
  if (!report.cutoverReady) {
    const error = new Error(
      report.safe
        ? "Canonical access is safe but does not exactly match legacy access"
        : "Canonical access expands beyond legacy access",
    );
    error.code = report.safe ? "ACCESS_PARITY_NOT_EXACT" : "ACCESS_PARITY_SECURITY_EXPANSION";
    error.report = report;
    throw error;
  }
  return report;
}
