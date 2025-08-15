//server/src/lib/prisma.js

import { PrismaClient } from "@prisma/client";
export const prisma =
  globalThis._prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis._prisma = prisma;
