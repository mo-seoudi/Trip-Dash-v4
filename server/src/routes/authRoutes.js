// server/src/routes/authRoutes.js
import express from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { normalizeLegacyUser } from "../lib/legacyRoles.js";
import {
  AUTH_COOKIE_NAME,
  authCookieClearOptions,
  authCookieOptions,
  signAuthToken,
} from "../lib/authTokens.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function validateRegistration({ name, email, password }) {
  const normalizedName = String(name || "").trim();
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedName || !normalizedEmail || !password) {
    return { error: "name, email and password are required" };
  }
  if (normalizedName.length > 120) return { error: "name is too long" };
  if (normalizedEmail.length > 254 || !EMAIL_RE.test(normalizedEmail)) {
    return { error: "A valid email is required" };
  }
  if (typeof password !== "string" || password.length < 10 || password.length > 128) {
    return { error: "Password must be between 10 and 128 characters" };
  }

  return { normalizedName, normalizedEmail };
}

// Public registration can request access, but it cannot self-assign a privileged
// role. Admins will approve/assign the appropriate role during onboarding.
router.post("/register", async (req, res, next) => {
  try {
    const validation = validateRegistration(req.body || {});
    if (validation.error) return res.status(400).json({ message: validation.error });

    const { normalizedName, normalizedEmail } = validation;
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) return res.status(409).json({ message: "Email already registered" });

    const passwordHash = await bcrypt.hash(req.body.password, 12);
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: normalizedName,
        role: "school_staff",
        status: "pending",
        passwordHash,
      },
      select: { id: true, email: true, name: true, role: true, status: true },
    });

    return res.status(201).json({ user: normalizeLegacyUser(user) });
  } catch (err) {
    if (err?.code === "P2002") {
      return res.status(409).json({ message: "Email already registered" });
    }
    return next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || typeof password !== "string" || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }
    if (normalizedEmail.length > 254 || password.length > 128) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user?.passwordHash) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const isApproved = String(user.status || "").toLowerCase().trim() === "approved";
    if (!isApproved) {
      return res.status(403).json({ message: "Account pending approval", status: user.status });
    }

    const token = signAuthToken(user);
    res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());

    return res.json({
      ok: true,
      user: normalizeLegacyUser({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
      }),
      // Transitional compatibility for the existing frontend. The rebuilt
      // client should move to cookie-only auth, after which this can be removed.
      token,
    });
  } catch (err) {
    return next(err);
  }
});

// Session validation now uses exactly the same authentication path as protected
// API routes instead of maintaining a second JWT implementation.
router.get("/session", requireAuth, async (req, res) => {
  return res.json({ user: req.user });
});

router.post("/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, authCookieClearOptions());
  return res.json({ ok: true });
});

export default router;
