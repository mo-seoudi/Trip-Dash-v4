// Runtime access boundary during the legacy -> canonical control-plane migration.
//
// Modes:
// - legacy: legacy access is authoritative; canonical DB is not read.
// - shadow: legacy is authoritative; canonical is compared only.
// - canonical: canonical may become authoritative ONLY when parity with legacy is
//   exact. Any mismatch or canonical failure fails closed rather than falling
//   back to a broader/ambiguous decision.

import { prismaGlobal } from "../lib/prismaGlobal.js";
import { prismaControl } from "../lib/prismaControl.js";
import { resolveEffectiveAccessWithPrisma } from "./effectiveAccess.js";
import { resolveEffectiveAccessV2 } from "./effectiveAccessV2.js";
import { compareEffectiveAccessParity } from "./accessParity.js";

export function accessRuntimeMode(env = process.env) {
  const explicit = String(env?.ACCESS_RUNTIME_MODE || "").trim().toLowerCase();
  if (["legacy", "shadow", "canonical"].includes(explicit)) return explicit;
  // Backward-compatible bridge for the existing shadow flag.
  return String(env?.CANONICAL_ACCESS_SHADOW || "").trim().toLowerCase() === "true" ? "shadow" : "legacy";
}

export function canonicalShadowEnabled(env = process.env) {
  return accessRuntimeMode(env) === "shadow";
}

function identity(user) {
  return { id: String(user?.id || ""), ...(user?.email ? { email: user.email } : {}) };
}

function cutoverError(message, code, details = null) {
  const error = new Error(message);
  error.status = 503;
  error.code = code;
  if (details) error.details = details;
  return error;
}

export async function resolveRuntimeAccess({
  user,
  legacyPrisma = prismaGlobal,
  controlPrisma = prismaControl,
  mode = accessRuntimeMode(),
  // Kept for existing dependency-injected callers/tests while the old flag is retired.
  shadowEnabled,
  resolveLegacy = resolveEffectiveAccessWithPrisma,
  resolveCanonical = resolveEffectiveAccessV2,
  onShadowResult = null,
  onShadowError = null,
  now = new Date(),
} = {}) {
  if (!user) throw new TypeError("user is required");
  if (!legacyPrisma) throw new TypeError("legacy global Prisma client is required");

  const effectiveMode = shadowEnabled === true ? "shadow" : shadowEnabled === false && mode === "shadow" ? "legacy" : mode;
  const legacyAccess = await resolveLegacy(legacyPrisma, user);
  if (effectiveMode === "legacy") return legacyAccess;

  let canonicalAccess;
  let parity;
  try {
    if (!controlPrisma) throw new TypeError("canonical control-plane Prisma client is required");
    canonicalAccess = await resolveCanonical(controlPrisma, identity(user), { now });
    parity = compareEffectiveAccessParity(legacyAccess, canonicalAccess);
  } catch (error) {
    if (effectiveMode === "canonical") {
      throw cutoverError("Canonical access is unavailable; authorization denied", "CANONICAL_ACCESS_UNAVAILABLE");
    }
    if (typeof onShadowError === "function") {
      await onShadowError({ userId: String(user.id), code: error?.code || "CANONICAL_SHADOW_ERROR" });
    }
    return legacyAccess;
  }

  if (typeof onShadowResult === "function") {
    await onShadowResult({
      userId: String(user.id), safe: parity.safe, exact: parity.exact,
      counts: parity.counts, issueCodes: parity.issues.map((issue) => issue.code),
    });
  }

  if (effectiveMode === "shadow") return legacyAccess;
  if (effectiveMode !== "canonical") throw new TypeError(`Unsupported access runtime mode: ${effectiveMode}`);

  // Do not cut over on merely "safe" (narrower) access: exact parity is the
  // forcing function that proves the migration is complete for this identity.
  if (!parity.exact) {
    throw cutoverError("Canonical access has not reached exact legacy parity; authorization denied", "CANONICAL_ACCESS_PARITY_REQUIRED", {
      issueCodes: parity.issues.map((issue) => issue.code),
    });
  }
  return canonicalAccess;
}
