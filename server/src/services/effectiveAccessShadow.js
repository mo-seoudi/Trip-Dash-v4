// Read-only shadow resolver used before canonical access cutover.
// Legacy remains authoritative. Canonical access is calculated only for parity
// diagnostics and is never returned as the enforcement decision.

import { resolveEffectiveAccessWithPrisma } from "./effectiveAccess.js";
import { resolveEffectiveAccessV2 } from "./effectiveAccessV2.js";
import { compareEffectiveAccessParity } from "./accessParity.js";

function opaqueIdentity(user) {
  return { id: String(user?.id || ""), ...(user?.email ? { email: user.email } : {}) };
}

export async function resolveEffectiveAccessShadow({
  legacyPrisma,
  controlPrisma,
  legacyUser,
  now = new Date(),
  resolveLegacy = resolveEffectiveAccessWithPrisma,
  resolveCanonical = resolveEffectiveAccessV2,
}) {
  if (!legacyPrisma) throw new TypeError("legacy global Prisma client is required");
  if (!controlPrisma) throw new TypeError("canonical control-plane Prisma client is required");
  if (!legacyUser) throw new TypeError("legacy user is required");

  const legacyAccess = await resolveLegacy(legacyPrisma, legacyUser);
  const canonicalAccess = await resolveCanonical(controlPrisma, opaqueIdentity(legacyUser), { now });
  const parity = compareEffectiveAccessParity(legacyAccess, canonicalAccess);

  return {
    mode: "LEGACY_AUTHORITATIVE_CANONICAL_SHADOW",
    authoritativeSource: "legacy",
    access: legacyAccess,
    shadow: {
      source: "canonical-v2",
      safe: parity.safe,
      exact: parity.exact,
      counts: parity.counts,
      issues: parity.issues,
    },
  };
}
