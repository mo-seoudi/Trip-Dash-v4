// Runtime access boundary during the legacy -> canonical control-plane migration.
// Legacy is always authoritative. Canonical access may be evaluated in shadow
// mode only when explicitly enabled; a shadow failure must never change the
// user's legacy authorization decision.

import { prismaGlobal } from "../lib/prismaGlobal.js";
import { prismaControl } from "../lib/prismaControl.js";
import { resolveEffectiveAccessWithPrisma } from "./effectiveAccess.js";
import { resolveEffectiveAccessV2 } from "./effectiveAccessV2.js";
import { compareEffectiveAccessParity } from "./accessParity.js";

export function canonicalShadowEnabled(env = process.env) {
  return String(env?.CANONICAL_ACCESS_SHADOW || "").trim().toLowerCase() === "true";
}

function identity(user) {
  return { id: String(user?.id || ""), ...(user?.email ? { email: user.email } : {}) };
}

export async function resolveRuntimeAccess({
  user,
  legacyPrisma = prismaGlobal,
  controlPrisma = prismaControl,
  shadowEnabled = canonicalShadowEnabled(),
  resolveLegacy = resolveEffectiveAccessWithPrisma,
  resolveCanonical = resolveEffectiveAccessV2,
  onShadowResult = null,
  onShadowError = null,
  now = new Date(),
} = {}) {
  if (!user) throw new TypeError("user is required");
  if (!legacyPrisma) throw new TypeError("legacy global Prisma client is required");

  const legacyAccess = await resolveLegacy(legacyPrisma, user);
  if (!shadowEnabled) return legacyAccess;

  try {
    if (!controlPrisma) throw new TypeError("canonical control-plane Prisma client is required");
    const canonicalAccess = await resolveCanonical(controlPrisma, identity(user), { now });
    const parity = compareEffectiveAccessParity(legacyAccess, canonicalAccess);
    if (typeof onShadowResult === "function") {
      await onShadowResult({
        userId: String(user.id),
        safe: parity.safe,
        exact: parity.exact,
        counts: parity.counts,
        issueCodes: parity.issues.map((issue) => issue.code),
      });
    }
  } catch (error) {
    if (typeof onShadowError === "function") {
      await onShadowError({ userId: String(user.id), code: error?.code || "CANONICAL_SHADOW_ERROR" });
    }
  }

  return legacyAccess;
}
