// Canonical runtime access boundary.
//
// The control plane is the sole runtime authority for application access.
// Legacy Global DB and shadow/parity modes belonged to the migration period and
// must not remain as production authorization fallbacks.

import { prismaControl } from "../lib/prismaControl.js";
import { resolveEffectiveAccess } from "./effectiveAccess.js";

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
  controlPrisma = prismaControl,
  resolveCanonical = resolveEffectiveAccess,
  now = new Date(),
} = {}) {
  if (!user) throw new TypeError("user is required");
  if (!controlPrisma) {
    throw cutoverError("Canonical control plane is unavailable; authorization denied", "CANONICAL_ACCESS_UNAVAILABLE");
  }

  try {
    return await resolveCanonical(controlPrisma, identity(user), { now });
  } catch (error) {
    if (error?.code === "CANONICAL_ACCESS_UNAVAILABLE") throw error;
    throw cutoverError("Canonical access is unavailable; authorization denied", "CANONICAL_ACCESS_UNAVAILABLE");
  }
}
