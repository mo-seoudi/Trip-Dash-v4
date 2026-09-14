// server/src/lib/prismaGlobal.js
// Shared Prisma client for the legacy global/control-plane database.
// This module is transitional and should disappear when the old global schema
// has been migrated into the canonical access model.

import { PrismaClient as PrismaGlobal } from "../prisma-global/index.js";

export const prismaGlobal =
  globalThis._tripDashPrismaGlobal || new PrismaGlobal();

if (process.env.NODE_ENV !== "production") {
  globalThis._tripDashPrismaGlobal = prismaGlobal;
}
