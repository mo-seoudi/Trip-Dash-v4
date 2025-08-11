// server/src/routes/authRoutes.js
console.log("authRoutes loaded");

import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const COOKIE_NAME = "session";

// In production (Render/Vercel over HTTPS) cookies must be Secure + SameSite=None.
// In local dev (http://localhost) those flags break cookies, so we toggle by NODE_ENV.
const isProd = process.env.NODE_ENV === "production";
const cookieOptions = {
  httpOnly: true,
  secure: isProd,                     // true on Render (HTTPS)
  sameSite: isProd ? "none" : "lax",  // cross-site in prod; friendlier in dev
  path: "/",
  maxAge: 1000 * 60 * 60 * 24 * 7,    // 7 days
};

/** REGISTER */
router.post("/register", async (req, res, next) => {
  try {
    const { email, password, name, role } = req.body;
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
        status: "pending", // default pending — admin can approve later
        passwordHash,
      },
      select: { id: true, email: true, name: true, role: true, status: true },
    });

    return res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
});

/** LOGIN — blocks if not approved, sets cookie, returns user */
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    // Normalized approval check (replaces the old strict !== "approved")
    const isApproved = (user.status ?? "").toLowerCase().trim() === "approved";
    if (!isApproved) {
      console.warn("LOGIN BLOCKED (status)", { email: user.email, status: user.status });
      return res.status(403).json({ message: "Account pending approval", status: user.status });
    }

    const token = jwt.sign({ uid: user.id }, JWT_SECRET, { expiresIn: "7d" });

    // Cross-site cookie (Vercel -> Render)
    res.cookie(COOKIE_NAME, token, cookieOptions);

    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
    };
    res.json({ ok: true, user: safeUser });
  } catch (err) {
    next(err);
  }
});

/** SESSION — reads cookie and returns current user */
router.get("/session", async (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ user: null });

  try {
    const { uid } = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, email: true, name: true, role: true, status: true },
    });
    if (!user) return res.status(401).json({ user: null });
    res.json({ user });
  } catch {
    res.status(401).json({ user: null });
  }
});

/** LOGOUT — clear cookie (must match creation flags) */
router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, {
    path: "/",
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
  });
  res.json({ ok: true });
});

export default router;
