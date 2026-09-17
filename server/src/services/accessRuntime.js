// Runtime access boundary during the legacy -> canonical control-plane migration.
//
// Modes:
// - legacy: emergency rollback path; legacy access is authoritative.
// - shadow: migration/diagnostic path; legacy is authoritative and canonical is compared.
// - canonical: normal path; canonical control-plane access is authoritative and the
//   legacy database is not read. This is important because operational authorization
//   must no longer depend on legacy tenant-era state after verified cutover.

import { prismaGlobal } from "../lib/prismaGlobal.js";
import { prismaControl } from "../lib/prismaControl.js";
import { resolveEffectiveAccessWithPrisma } from "./effectiveAccess.js";
import { resolveEffectiveAccessV2 } from "./effectiveAccessV2.js";
import { compareEffectiveAccessParity } from "./accessParity.js";

export function accessRuntimeMode(env = process.env) {
  const explicit = String(env?.ACCESS_RUNTIME_MODE || "").trim().toLowerCase();
  if (["legacy", "shadow", "canonical"].includes(explicit)) return explicit;
  // Safe deployment default while environments are explicitly migrated. Once an
  // environment is verified, set ACCESS_RUNTIME_MODE=canonical.
  return String(env?.CANONICAL_ACCESS_SHADOW || "").trim().toLowerCase() === "true" ? "shadow" : "legacy";
}

export function canonicalShadowEnabled(env = process.env) {
  return accessRuntimeMode(env) === "shadow";
}

function identity(user) {
  return { id: String(user?.id || ""), ...(user?.email ? { email: user.email } : {}) };
}

function cutoverError(message, code) {
  const error = new Error(message);
  error.status = 503;
  error.code = code;
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

  const effectiveMode = shadowEnabled === true ? "shadow" : shadowEnabled === false && mode === "shadow" ? "legacy" : mode;

  // Canonical is a true cutover, not a permanent dual-read. The migration/parity
  // suite is the gate before enabling this mode; runtime authorization then has one
  // source of truth and can survive removal of the legacy global database.
  if (effectiveMode === "canonical") {
    if (!controlPrisma) throw cutoverError("Canonical control plane is unavailable; authorization denied", "CANONICAL_ACCESS_UNAVAILABLE");
    try {
      return await resolveCanonical(controlPrisma, identity(user), { now });
    } catch (error) {
      if (error?.code === "CANONICAL_ACCESS_UNAVAILABLE") throw error;
      throw cutoverError("Canonical access is unavailable; authorization denied", "CANONICAL_ACCESS_UNAVAILABLE");
    }
  }

  if (!legacyPrisma) throw new TypeError("legacy global Prisma client is required");
  const legacyAccess = await resolveLegacy(legacyPrisma, user);
  if (effectiveMode === "legacy") return legacyAccess;
  if (effectiveMode !== "shadow") throw new TypeError(`Unsupported access runtime mode: ${effectiveMode}`);

  try {
    if (!controlPrisma) throw new TypeError("canonical control-plane Prisma client is required");
    const canonicalAccess = await resolveCanonical(controlPrisma, identity(user), { now });
    const parity = compareEffectiveAccessParity(legacyAccess, canonicalAccess);
    if (typeof onShadowResult === "function") {
      await onShadowResult({
        userId: String(user.id), safe: parity.safe, exact: parity.exact,
        counts: parity.counts, issueCodes: parity.issues.map((issue) => issue.code),
      });
    }
  } catch (error) {
    if (typeof onShadowError === "function") {
      await onShadowError({ userId: String(user.id), code: error?.code || "CANONICAL_SHADOW_ERROR" });
    }
  }

  return legacyAccess;
}
