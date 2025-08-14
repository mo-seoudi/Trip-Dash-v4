import { PrismaClient as PrismaGlobal } from "../prisma-global/index.js";

export const prismaGlobal = new PrismaGlobal();

// helper: list orgs/roles for a user (by UUID in public.users)
export async function getUserOrgs(userId) {
  return prismaGlobal.user_roles.findMany({
    where: { user_id: userId },
    select: {
      org_id: true,
      role: true,
      organizations: { select: { id: true, name: true, type: true } }
    },
    orderBy: { org_id: "asc" }
  });
}

// optional: find or create public.users by email (to bridge legacy users)
export async function ensureProfileByEmail(email, defaults = {}) {
  const existing = await prismaGlobal.users.findUnique({ where: { email } });
  if (existing) return existing;
  return prismaGlobal.users.create({
    data: { email, ...defaults }
  });
}
