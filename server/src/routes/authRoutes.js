import express from "express";
import bcrypt from "bcryptjs";
import { AUTH_COOKIE_NAME, authCookieClearOptions, authCookieOptions, signAuthToken } from "../lib/authTokens.js";
import { requireAuth } from "../middleware/auth.js";
import { isActiveAppUser, localIdentityForEmail, normalizeEmail, primaryCanonicalRole, publicAppUser } from "../services/canonicalAuth.js";

const router = express.Router();

// Canonical accounts are provisioned by administrators through the Control Center.
// The first Platform Super Admin is created only through the one-time /api/bootstrap flow.
router.post("/register", (_req, res) => res.status(403).json({ message: "Self-service registration is disabled. Contact your administrator for access." }));

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || typeof password !== "string" || !password) return res.status(400).json({ message: "email and password are required" });
    if (normalizedEmail.length > 254 || password.length > 128) return res.status(401).json({ message: "Invalid credentials" });

    const identity = await localIdentityForEmail(normalizedEmail);
    if (!identity?.passwordHash || !identity.user) return res.status(401).json({ message: "Invalid credentials" });
    if (!(await bcrypt.compare(password, identity.passwordHash))) return res.status(401).json({ message: "Invalid credentials" });
    if (!isActiveAppUser(identity.user)) return res.status(403).json({ message: "Account pending approval", status: identity.user.status });

    const role = await primaryCanonicalRole(identity.user.id);
    const user = publicAppUser(identity.user, role);
    const token = signAuthToken(user);
    res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());
    return res.json({ ok: true, user, token });
  } catch (error) { return next(error); }
});

router.get("/session", requireAuth, async (req, res) => res.json({ user: req.user }));
router.post("/logout", (_req, res) => { res.clearCookie(AUTH_COOKIE_NAME, authCookieClearOptions()); return res.json({ ok: true }); });

export default router;
