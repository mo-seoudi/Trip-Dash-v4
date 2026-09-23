import { Router } from "express";
import bcrypt from "bcryptjs";
import { prismaControl } from "../lib/prismaControl.js";
import { AUTH_COOKIE_NAME, authCookieOptions, signAuthToken } from "../lib/authTokens.js";
import { normalizeEmail, publicAppUser } from "../services/canonicalAuth.js";
import { seedControlPlaneReferenceData } from "../services/controlPlaneSeed.js";

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function existingPlatformAdmin() {
  return prismaControl.roleAssignment.findFirst({
    where: {
      isActive: true,
      scopeType: "PLATFORM",
      tenantId: null,
      organizationId: null,
      role: { key: "super_admin" },
    },
    select: { id: true },
  });
}

router.get("/status", async (_req, res, next) => {
  try {
    const configured = Boolean(String(process.env.PLATFORM_BOOTSTRAP_TOKEN || "").trim());
    const completed = Boolean(await existingPlatformAdmin());
    return res.json({ available: configured && !completed, configured, completed });
  } catch (error) {
    return next(error);
  }
});

router.post("/platform-admin", async (req, res, next) => {
  try {
    const configuredToken = String(process.env.PLATFORM_BOOTSTRAP_TOKEN || "").trim();
    if (!configuredToken) return res.status(503).json({ message: "Platform bootstrap is not configured" });
    if (await existingPlatformAdmin()) return res.status(409).json({ message: "Platform bootstrap has already been completed" });

    const suppliedToken = String(req.body?.setupKey || "").trim();
    if (!suppliedToken || suppliedToken !== configuredToken) return res.status(403).json({ message: "Invalid setup key" });

    const email = normalizeEmail(req.body?.email);
    const displayName = String(req.body?.name || "").trim();
    const password = String(req.body?.password || "");
    const allowedEmail = normalizeEmail(process.env.PLATFORM_BOOTSTRAP_EMAIL);

    if (!displayName || displayName.length > 120) return res.status(400).json({ message: "A valid name is required" });
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) return res.status(400).json({ message: "A valid email is required" });
    if (allowedEmail && email !== allowedEmail) return res.status(403).json({ message: "This email is not authorized for platform bootstrap" });
    if (password.length < 10 || password.length > 128) return res.status(400).json({ message: "Password must be between 10 and 128 characters" });

    // Bootstrap must be self-contained on a freshly cut-over control plane.
    // The seed is deterministic/idempotent and ensures the canonical role and
    // permission catalogue exists before the first administrator is created.
    await seedControlPlaneReferenceData(prismaControl);

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prismaControl.$transaction(async (tx) => {
      const alreadyBootstrapped = await tx.roleAssignment.findFirst({
        where: { isActive: true, scopeType: "PLATFORM", tenantId: null, organizationId: null, role: { key: "super_admin" } },
        select: { id: true },
      });
      if (alreadyBootstrapped) {
        const error = new Error("Platform bootstrap has already been completed");
        error.status = 409;
        throw error;
      }

      const existingUser = await tx.appUser.findUnique({ where: { email }, select: { id: true } });
      if (existingUser) {
        const error = new Error("Email already exists in the canonical user system");
        error.status = 409;
        throw error;
      }

      const role = await tx.role.findUnique({ where: { key: "super_admin" } });
      if (!role) {
        const error = new Error("Canonical super_admin role is unavailable after seeding");
        error.status = 500;
        throw error;
      }

      const created = await tx.appUser.create({
        data: {
          email,
          displayName,
          status: "active",
          identities: {
            create: {
              provider: "LOCAL",
              providerSubject: email,
              emailAtProvider: email,
              passwordHash,
            },
          },
        },
      });

      await tx.roleAssignment.create({
        data: {
          userId: created.id,
          roleId: role.id,
          scopeType: "PLATFORM",
          tenantId: null,
          organizationId: null,
          isActive: true,
        },
      });

      await tx.auditEvent.create({
        data: {
          actorUserId: created.id,
          action: "platform.bootstrap_completed",
          resourceType: "app_user",
          resourceId: created.id,
          metadata: { email },
        },
      });

      return created;
    });

    const publicUser = publicAppUser(user, "super_admin");
    const token = signAuthToken(publicUser);
    res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());
    return res.status(201).json({ ok: true, user: publicUser, token });
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ message: error.message });
    if (error?.code === "P2002") return res.status(409).json({ message: "Platform bootstrap could not be completed because the account already exists" });
    return next(error);
  }
});

export default router;
