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
 * IMPORTANT:
 * index.js -> getDecodedUser() looks for req.cookies.token
 * so this MUST be "token" (not "session").
 */
const COOKIE_NAME = "token";

// In production (HTTPS) cookies must be Secure + SameSite=None.
// In local dev (http://localhost) those flags would block cookies,
// so we toggle by NODE_ENV.
const isProd = process.env.NODE_ENV === "production";
const cookieOptions = {
  httpOnly: true,
  secure: isProd,                 // true on Render/Vercel (HTTPS)
  sameSite: isProd ? "none" : "lax",
  path: "/",
  maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
};

/* =========================
   REGISTER (keeps approval)
   ========================= */
router.post("/register", async (req, res, next) => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) {
      return res
        .status(400)
        .json({ message: "name, email and password are required" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ message: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        role: role || "school_staff",
        status: "pending", // ✅ still requires admin approval later
        passwordHash
      },
      select: { id: true, email: true, name: true, role: true, status: true }
    });

    return res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
});

/* =========================================
   LOGIN (blocks unapproved, sets cookie+JWT)
   ========================================= */
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    // ✅ normalized approval check
    const isApproved = (user.status ?? "").toLowerCase().trim() === "approved";
    if (!isApproved) {
      console.warn("LOGIN BLOCKED (status)", { email: user.email, status: user.status });
      return res
        .status(403)
        .json({ message: "Account pending approval", status: user.status });
    }

    // ✅ sign the shape index.js expects
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // ✅ set cross-site cookie with the expected name
    res.cookie(COOKIE_NAME, token, cookieOptions);

    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status
    };

    // ✅ also return token so the client can set Authorization header
    res.json({ ok: true, user: safeUser, token });
  } catch (err) {
    next(err);
  }
});

/* ======================================
   SESSION (reads cookie, tolerates legacy)
   ====================================== */
router.get("/session", async (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ user: null });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // allow legacy { uid } tokens during transition
    const userId = decoded.id ?? decoded.uid;

    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: { id: true, email: true, name: true, role: true, status: true }
    });
    if (!user) return res.status(401).json({ user: null });

    res.json({ user });
  } catch {
    res.status(401).json({ user: null });
  }
});

/* =============================
   LOGOUT (clear matching cookie)
   ============================= */
router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, {
    path: "/",
    secure: isProd,
    sameSite: isProd ? "none" : "lax"
  });
  res.json({ ok: true });
});

export default router;
