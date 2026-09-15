// End-to-end, read-only access migration rehearsal.
//
// This deliberately accepts every data source/resolver as a dependency. It does
// not know DATABASE_URL, does not create Prisma clients, and performs no writes.
// A future CLI/admin diagnostic can wire legacy/control clients explicitly.

import { buildAccessV2BackfillPlan } from "./accessV2BackfillPlan.js";
import { buildAccessParityReport } from "./accessParityReport.js";

function safeIdentity(user) {
  return {
    id: String(user?.id || ""),
    email: user?.email || null,
  };
}

export async function rehearseAccessMigration({
  legacySnapshot,
  legacyUsers = [],
  resolveLegacyAccess,
  resolveCanonicalAccessFromPlan,
}) {
  if (!legacySnapshot || typeof legacySnapshot !== "object") {
    throw new TypeError("legacySnapshot is required");
  }
  if (!Array.isArray(legacyUsers)) {
    throw new TypeError("legacyUsers must be an array");
  }
  if (typeof resolveLegacyAccess !== "function") {
    throw new TypeError("resolveLegacyAccess is required");
  }
  if (typeof resolveCanonicalAccessFromPlan !== "function") {
    throw new TypeError("resolveCanonicalAccessFromPlan is required");
  }

  const plan = buildAccessV2BackfillPlan(legacySnapshot);
  const rows = [];

  // Resolve sequentially on purpose. A rehearsal may target a live legacy DB in
  // read-only mode; bounded behavior is preferable to an unbounded query burst.
  for (const legacyUser of legacyUsers) {
    const legacyAccess = await resolveLegacyAccess(legacyUser);
    const canonicalAccess = await resolveCanonicalAccessFromPlan({
      plan,
      identity: safeIdentity(legacyUser),
      legacyUser,
    });
    rows.push({
      identity: safeIdentity(legacyUser),
      legacyAccess,
      canonicalAccess,
    });
  }

  const parity = buildAccessParityReport(rows);
  return {
    mode: "READ_ONLY_REHEARSAL",
    writesPerformed: false,
    plan: {
      counts: {
        tenants: plan.tenants?.length || 0,
        organizations: plan.organizations?.length || 0,
        appUsers: plan.appUsers?.length || 0,
        memberships: plan.memberships?.length || 0,
        roleAssignments: plan.roleAssignments?.length || 0,
        relationships: plan.relationships?.length || 0,
      },
      validation: plan.validation,
    },
    parity,
  };
}
