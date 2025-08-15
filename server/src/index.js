// server/src/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { PrismaClient } from "@prisma/client";

// NEW: global control-plane Prisma client and helpers
// (generated from prisma/global.schema.prisma)
import { PrismaClient as PrismaGlobal } from "./prisma-global/index.js";

import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import tripRoutes from "./routes/tripRoutes.js";
import tripPassengersRoutes from "./routes/tripPassengersRoutes.js";

dotenv.config();

const app = express();

// Operational DB (your existing Prisma)
const prisma = new PrismaClient();

// Global control-plane DB (new Prisma pointing to Supabase)
const prismaGlobal = new PrismaGlobal();

// Render is behind a proxy; needed for secure cookies
app.set("trust proxy", 1);

/**
 * ---- CORS ----
 * If ALLOWED_ORIGINS (CSV) isn't set on Render, we fall back to your Vercel URL.
 */
const fallbackOrigin = "https://trip-dash-v4.vercel.app";

const envOrigins = (process.env.ALLOWED_ORIGINS || fallbackOrigin)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// In dev, also allow localhosts
if (process.env.NODE_ENV !== "production") {
  envOrigins.push("http://localhost:5173", "http://localhost:3000");
}

// Final allow list (unique)
const allowedOrigins = Array.from(new Set(envOrigins));

/**
 * Allow any Vercel *preview* URL for this project, e.g.:
 *   https://trip-dash-v4-<hash>.vercel.app
 * Keep production exact origin(s) in ALLOWED_ORIGINS.
 */
const VERCEL_PROJECT_SLUG = process.env.VERCEL_PROJECT_SLUG || "trip-dash-v4";
const vercelPreviewPattern = new RegExp(
  `^https:\\/\\/${VERCEL_PROJECT_SLUG}-[a-z0-9-]+\\.vercel\\.app$`
);

function isAllowedOrigin(origin) {
  if (allowedOrigins.includes(origin)) return true; // explicit allow-list
  if (vercelPreviewPattern.test(origin)) return true; // any preview for this project
  return false;
}

const corsOptions = {
  origin(origin, cb) {
    // allow server-to-server (curl/Postman) with no Origin header
    if (!origin) return cb(null, true);
    if (isAllowedOrigin(origin)) return cb(null, true);
    console.warn("Blocked by CORS:", origin);
    // respond as not allowed (no CORS headers)
    return cb(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // preflight

// Parsers
app.use(express.json());
app.use(cookieParser());

// ---------- Session scaffold (conservative) ----------
// This does NOT change your existing auth. It just exposes:
//   - req.activeOrgId from a cookie
//   - req.fetchUserOrgs() using the GLOBAL Prisma client
app.use(async (req, res, next) => {
  try {
    req.activeOrgId = req.cookies?.td_active_org || null;

    // helper to load org memberships for the logged-in user
    req.fetchUserOrgs = async () => {
      if (!req.user?.id) return [];
      return prismaGlobal.user_roles.findMany({
        where: { user_id: req.user.id },
        select: {
          org_id: true,
          role: true,
          organizations: { select: { id: true, name: true, type: true } },
        },
        orderBy: { org_id: "asc" },
      });
    };

    next();
  } catch (e) {
    console.error("session scaffold error:", e);
    next(); // don't block requests
  }
});

// Health checks
app.get("/", (_, res) => res.status(200).json({ ok: true }));
app.get("/health", (_, res) => res.status(200).json({ ok: true }));

// ---------- New minimal endpoints for org selection ----------

// Who am I? (for FE bootstrap)
// Returns user (from your existing auth), orgs, and active_org_id.
app.get("/api/me", async (req, res) => {
  try {
    if (!req.user) {
      return res.json({ user: null, orgs: [], active_org_id: null });
    }
    const roles = await req.fetchUserOrgs();
    return res.json({
      user: { id: req.user.id, email: req.user.email },
      orgs: roles.map((r) => ({
        org_id: r.org_id,
        name: r.organizations.name,
        type: r.organizations.type,
        role: r.role,
      })),
      active_org_id: req.activeOrgId,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "me error" });
  }
});

// Set active org (after user picks one in the UI)
app.post("/api/session/set-org", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not logged in" });
    const { org_id } = req.body || {};
    if (!org_id) return res.status(400).json({ message: "org_id required" });

    const memberships = await req.fetchUserOrgs();
    const member = memberships.find((m) => m.org_id === org_id);
    if (!member) return res.status(403).json({ message: "Not a member of this organization" });

    res.cookie("td_active_org", org_id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    res.sendStatus(204);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "set-org error" });
  }
});

// ---------- Your existing routes (unchanged) ----------
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/trips", tripPassengersRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res
    .status(err.status || 500)
    .json({ message: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 5000; // Render will set this (often 10000)
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

// Graceful shutdown for Prisma (both clients)
async function shutdown() {
  try {
    await prisma.$disconnect();
    await prismaGlobal.$disconnect();
  } finally {
    process.exit(0);
  }
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
