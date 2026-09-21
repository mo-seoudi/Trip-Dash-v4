import express from "express";
import bcrypt from "bcryptjs";
import { AUTH_COOKIE_NAME, authCookieClearOptions, authCookieOptions, signAuthToken } from "../lib/authTokens.js";
import { requireAuth } from "../middleware/auth.js";
import { isActiveAppUser, localIdentityForEmail, normalizeEmail, primaryCanonicalRole, publicAppUser, registerLocalUser } from "../services/canonicalAuth.js";

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRegistration({ name, email, password }) {
  const normalizedName = String(name || "").trim();
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedName || !normalizedEmail || !password) return { error: "name, email and password are required" };
  if (normalizedName.length > 120) return { error: "name is too long" };
  if (normalizedEmail.length > 254 || !EMAIL_RE.test(normalizedEmail)) return { error: "A valid email is required" };
  if (typeof password !== "string" || password.length < 10 || password.length > 128) return { error: "Password must be between 10 and 128 characters" };
  return { normalizedName, normalizedEmail };
}

router.post("/register", async (req, res, next) => {
  try {
    const validation = validateRegistration(req.body || {});
    if (validation.error) return res.status(400).json({ message: validation.error });
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    const user = await registerLocalUser({ email: validation.normalizedEmail, displayName: validation.normalizedName, passwordHash });
    return res.status(201).json({ user: publicAppUser(user) });
  } catch (error) {
    if (error?.code === "EMAIL_REGISTERED" || error?.code === "P2002") return res.status(409).json({ message: "Email already registered" });
    return next(error);
  }
});

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
