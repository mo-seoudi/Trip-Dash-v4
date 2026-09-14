// server/src/routes/authRoutes.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required but missing.");
}

const COOKIE_NAME = "token";
const isProd = process.env.NODE_ENV === "production";
const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
  path: "/",
  maxAge: 1000 * 60 * 60 * 24 * 7,
};

// Legacy registration is preserved during migration. New onboarding will later
// create AppUser, identity, membership, and scoped role records transactionally.
router.post("/register", async (req, res, next) => {
  try {
    const { email, password, name, role } = req.body || {};
    if (!email || !password || !name) {
      return res.status(400).json({ message: "name, email and password are required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) return res.status(409).json({ message: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: String(name).trim(),
        role: role || "school_staff",
        status: "pending",
        passwordHash,
      },
      select: { id: true, email: true, name: true, role: true, status: true },
    });

    return res.status(201).json({ user });
  } catch (err) {
    return next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user?.passwordHash) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const isApproved = String(user.status || "").toLowerCase().trim() === "approved";
    if (!isApproved) {
      return res.status(403).json({ message: "Account pending approval", status: user.status });
    }

    // Keep legacy token compatibility while authorization is migrated. Role is
    // deliberately not trusted from the token by requireAuth.
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    res.cookie(COOKIE_NAME, token, cookieOptions);

    return res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
      },
      token,
    });
  } catch (err) {
    return next(err);
  }
});

router.get("/session", async (req, res) => {
  const authHeader = req.get("authorization") || "";
  const bearerToken = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : null;
  const token = req.cookies?.[COOKIE_NAME] || bearerToken;

  if (!token) return res.status(401).json({ user: null });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id ?? decoded.uid;
    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: { id: true, email: true, name: true, role: true, status: true },
    });

    if (!user || String(user.status || "").toLowerCase().trim() !== "approved") {
      return res.status(401).json({ user: null });
    }
    return res.json({ user });
  } catch {
    return res.status(401).json({ user: null });
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, {
    path: "/",
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
  });
  return res.json({ ok: true });
});

export default router;
