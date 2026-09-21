import { prismaControl } from "../lib/prismaControl.js";

export const ACTIVE_USER_STATUS = "active";
export const PENDING_USER_STATUS = "pending";

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function publicAppUser(user, role = null) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.displayName,
    displayName: user.displayName,
    status: user.status,
    ...(role ? { role } : {}),
  };
}

export function isActiveAppUser(user) {
  return String(user?.status || "").trim().toLowerCase() === ACTIVE_USER_STATUS;
}

export async function findCanonicalUserById(id, prisma = prismaControl) {
  const value = String(id || "").trim();
  if (!value) return null;
  return prisma.appUser.findUnique({ where: { id: value } });
}

export async function findCanonicalUserByEmail(email, prisma = prismaControl) {
  const value = normalizeEmail(email);
  if (!value) return null;
  return prisma.appUser.findUnique({ where: { email: value } });
}

export async function primaryCanonicalRole(userId, prisma = prismaControl) {
  const assignment = await prisma.roleAssignment.findFirst({
    where: { userId, isActive: true },
    include: { role: true },
    orderBy: [{ scopeType: "asc" }, { createdAt: "asc" }],
  });
  return assignment?.role?.key || null;
}

export async function localIdentityForEmail(email, prisma = prismaControl) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  return prisma.authenticationIdentity.findFirst({
    where: { provider: "LOCAL", user: { email: normalized } },
    include: { user: true },
  });
}

export async function registerLocalUser({ email, displayName, passwordHash }, prisma = prismaControl) {
  const normalized = normalizeEmail(email);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.appUser.findUnique({ where: { email: normalized }, select: { id: true } });
    if (existing) {
      const error = new Error("Email already registered");
      error.status = 409;
      error.code = "EMAIL_REGISTERED";
      throw error;
    }
    return tx.appUser.create({
      data: {
        email: normalized,
        displayName,
        status: PENDING_USER_STATUS,
        identities: {
          create: {
            provider: "LOCAL",
            providerSubject: normalized,
            emailAtProvider: normalized,
            passwordHash,
          },
        },
      },
    });
  });
}

export async function findMicrosoftUser({ subject, email }, prisma = prismaControl) {
  const providerSubject = String(subject || "").trim();
  if (providerSubject) {
    const identity = await prisma.authenticationIdentity.findUnique({
      where: { provider_providerSubject: { provider: "MICROSOFT_ENTRA", providerSubject } },
      include: { user: true },
    });
    if (identity?.user) return identity.user;
  }
  return findCanonicalUserByEmail(email, prisma);
}

export async function ensureMicrosoftIdentity({ userId, subject, email }, prisma = prismaControl) {
  const providerSubject = String(subject || "").trim();
  if (!providerSubject) return null;
  return prisma.authenticationIdentity.upsert({
    where: { provider_providerSubject: { provider: "MICROSOFT_ENTRA", providerSubject } },
    create: { userId, provider: "MICROSOFT_ENTRA", providerSubject, emailAtProvider: normalizeEmail(email) || null },
    update: { userId, emailAtProvider: normalizeEmail(email) || null },
  });
}

export async function provisionMicrosoftUser({ subject, email, displayName }, prisma = prismaControl) {
  const normalized = normalizeEmail(email);
  return prisma.$transaction(async (tx) => {
    const user = await tx.appUser.create({ data: { email: normalized, displayName, status: PENDING_USER_STATUS } });
    await tx.authenticationIdentity.create({
      data: { userId: user.id, provider: "MICROSOFT_ENTRA", providerSubject: String(subject || normalized), emailAtProvider: normalized },
    });
    return user;
  });
}
