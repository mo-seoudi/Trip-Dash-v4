// server/src/routes/authRoutes.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

/* ---------------- Config ---------------- */
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

/** Must be "token" — index.js reads req.cookies.token */
const COOKIE_NAME = "token";

/** In prod, cookies must be Secure + SameSite=None (cross-site Vercel → Render) */
const isProd = process.env.NODE_ENV === "production";
const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
  path: "/",
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
};

/* ---------------- Helpers ---------------- */
const toSafeUser = (u) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  status: u.status,
});

/** normalize "approved" (handles Pending/pending/Approved etc.) */
const isApproved = (status) => String(status ?? "").trim().toLowerCase() === "approved";

/** create JWT with the shape other code expects */
const signUser = (u) =>
  jwt.sign({ id: u.id, email: u.email }, JWT_SECRET, { expiresIn: "7d" });

/** set the auth cookie */
const setAuthCookie = (res, token) => res.cookie(COOKIE_NAME, token, cookieOptions);

/** clear both current and legacy cookies */
const clearAuthCookies = (res) => {
  const base = { path: "/", secure: isProd, sameSite: isProd ? "none" : "lax" };
  res.clearCookie(COOKIE_NAME, base);
  res.clearCookie("session", base); // legacy, safe to clear
};

/* ---------------- Routes ---------------- */

/** POST /api/auth/register  (still requires admin approval later) */
router.post("/register", async (req, res, next) => {
  try {
    const { email, password, name, role } = req.body || {};
    if (!email || !password || !name) {
      return res.status(400).json({ message: "name, email and password are required" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ message: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        role: role || "school_staff",
        status: "pending",
        passwordHash,
      },
      select: { id: true, email: true, name: true, role: true, status: true },
    });

    return res.status(201).json({ user: toSafeUser(user) });
  } catch (err) {
    next(err);
  }
});

/** POST /api/auth/login  (blocks if not approved, sets cookie, returns {user, token}) */
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    if (!isApproved(user.status)) {
      return res
        .status(403)
        .json({ message: "Account pending approval", status: user.status });
    }

    const token = signUser(user);
    setAuthCookie(res, token);

    return res.json({ ok: true, user: toSafeUser(user), token });
  } catch (err) {
    next(err);
  }
});

/** GET /api/auth/session  (reads cookie; returns {user} or 401) */
router.get("/session", async (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ user: null });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id ?? decoded.uid; // support older tokens during transition

    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: { id: true, email: true, name: true, role: true, status: true },
    });

    if (!user) return res.status(401).json({ user: null });

    return res.json({ user: toSafeUser(user) });
  } catch {
    return res.status(401).json({ user: null });
  }
});

/** POST /api/auth/logout */
router.post("/logout", (req, res) => {
  clearAuthCookies(res);
  res.json({ ok: true });
});

export default router;
