// server/src/routes/authRoutes.js
console.log("authRoutes loaded");

// ✅ load environment vars BEFORE constructing PrismaClient
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const COOKIE_NAME = "session";

/**
 * POST /api/auth/register
 * Creates a new user and returns basic user data.
 * - Adjust `role` / `status` fields to match your Prisma schema if needed.
 */
router.post("/register", async (req, res, next) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ message: "name, email and password are required" });
    }

    // Ensure unique email
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ message: "Email already registered" });

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user (tweak fields to your schema)
    const user = await prisma.user.create({
      data: {
        email,
        name,
        role: role || "school_staff", // if you use an enum, make sure the value exists
        // If your schema has a `status` column use this; otherwise remove the next line
        status: "pending",
        passwordHash,
      },
      select: { id: true, email: true, name: true, role: true, status: true },
    });

    return res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 * Verifies credentials and sets an httpOnly cookie (session).
 */
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ uid: user.id }, JWT_SECRET, { expiresIn: "7d" });

    // set httpOnly cookie
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: false,      // set true in production (https)
      sameSite: "lax",    // use "none" when calling from Vercel → Render (cross-site)
      path: "/",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/session
 * Returns the current user for a valid session cookie, else 401.
 */
router.get("/session", async (req, res) => {
  console.log("HIT /api/auth/session route");

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

/**
 * POST /api/auth/logout
 * Clears the session cookie.
 */
router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
});

export default router;
