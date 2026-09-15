import { PrismaClient as PrismaControl } from "../prisma-control/index.js";

// Canonical control-plane database only.
// Never substitute DATABASE_URL here: the control plane has an explicit,
// dedicated connection contract through CONTROL_DATABASE_URL in its schema.
export const prismaControl =
  globalThis._tripDashPrismaControl || new PrismaControl();

if (process.env.NODE_ENV !== "production") {
  globalThis._tripDashPrismaControl = prismaControl;
}
