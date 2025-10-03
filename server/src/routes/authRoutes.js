// server/src/routes/authRoutes.js
console.log("authRoutes loaded");

import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

/**
 * Cookie name MUST match what index.js -> getDecodedUser() expects (it checks req.cookies.token)
 */
const COOKIE_NAME = "token";

/**
 * Cookies: cross-site in prod (Vercel -> Render) and relaxed in dev (localhost)
 */
const isProd = process.env.NODE_ENV === "production";
const cookieOptions = {
  httpOnly: true,
  secure: isProd,                    // must be true over HTTPS
  sameSite: isProd ? "none" : "lax", // "none" required for cross-site cookies
  path: "/",
  maxAge: 1000 * 60 * 60 * 24 * 7,   // 7 days
};

/**
 * When true, /register will create users with status = 'approved'
 * Otherwise they are created as 'pending' and an admin must approve.
 */
const APPROVE_ON_REGISTER = String(process.env.APPROVE_ON_REGISTER || "").toLowerCase() === "true";

/* --------------------------- REGISTER --------------------------- */
router.post("/register", async (req, res, next) => {
  try {
    let { email, password, name, role } = req.body || {};
    if (!email || !password || !name) {
      return res.status(400).json({ message: "name, email and password are required" });
    }

    // Normalize email to lowercase to avoid duplicates by case
    email = String(email).trim().toLowerCase();

    // Check if user already exists (case-insensitive)
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        name: String(name).trim(),
        role: role || "school_staff",
        status: APPROVE_ON_REGISTER ? "approved" : "pending",
        passwordHash,
      },
      select: { id: true, email: true, name: true, role: true, status: true },
    });

    return res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
});

/* ----------------------------- LOGIN ---------------------------- */
/**
 * - Validates credentials
 * - Blocks if status is not 'approved'
 * - Signs JWT as { id, email }
 * - Sets cross-site cookie (name: "token")
 * - Also returns { token } so the client can use Authorization header
 */
router.post("/login", async (req, res, next) => {
  try {
    let { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    email = String(email).trim().toLowerCase();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const isApproved = (user.status ?? "").toLowerCase().trim() === "approved";
    if (!isApproved) {
      console.warn("LOGIN BLOCKED (status)", { email: user.email, status: user.status });
      return res.status(403).json({ message: "Account pending approval", status: user.status });
    }

    // ✅ Use { id, email } so index.js and other routes can read decoded.id
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

    // ✅ Set cookie for browser
    res.cookie(COOKIE_NAME, token, cookieOptions);

    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
    };

    // ✅ And also return token so the SPA can keep sending Authorization: Bearer <token>
    res.json({ ok: true, user: safeUser, token });
  } catch (err) {
    next(err);
  }
});

/* ---------------------------- SESSION --------------------------- */
/**
 * Reads the cookie and returns the current user.
 * Supports legacy tokens signed with { uid } as well, just in case.
 */
router.get("/session", async (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ user: null });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id ?? decoded.uid; // fallback if you ever had uid-signed tokens

    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: { id: true, email: true, name: true, role: true, status: true },
    });

    if (!user) return res.status(401).json({ user: null });
    res.json({ user });
  } catch {
    res.status(401).json({ user: null });
  }
});

/* ---------------------------- LOGOUT ---------------------------- */
/**
 * Clears the cookie. Flags must match creation flags.
 */
router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, {
    path: "/",
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
  });
  res.json({ ok: true });
});

export default router;
