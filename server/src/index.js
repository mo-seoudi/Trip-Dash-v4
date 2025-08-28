// server/src/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

// Global/control-plane Prisma client (generated from prisma/global.schema.prisma)
import { PrismaClient as PrismaGlobal } from "./prisma-global/index.js";

import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import tripsRouter from "./routes/trips/index.js";
import globalRoutes from "./routes/globalRoutes.js";
import globalRolesRoutes from "./routes/globalRolesRoutes.js";
import bookingsRoutes from "./routes/bookingsRoutes.js";

// ✅ NEW: MS365 routes (CommonJS export is fine to import as default in ESM)
import msRoutes from "./routes/ms.js";
import authMicrosoftRoutes from "./routes/authMicrosoft.js";


dotenv.config();

const app = express();
const prisma = new PrismaClient();
const prismaGlobal = new PrismaGlobal();

// Render is behind a proxy; needed for secure cookies
app.set("trust proxy", 1);

/* ---------------- CORS (simple + safe) ---------------- */
const fallbackProd = "https://trip-dash-v4.vercel.app";
const fallbackDev = "http://localhost:5173";

const base = process.env.NODE_ENV === "production" ? fallbackProd : fallbackDev;
const explicit = (process.env.ALLOWED_ORIGINS || base)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowed = new Set(explicit);

// Allow any Vercel preview for this project (optional but handy)
const VERCEL_PROJECT_SLUG = process.env.VERCEL_PROJECT_SLUG || "trip-dash-v4";
const vercelPreviewPattern = new RegExp(
  `^https:\\/\\/${VERCEL_PROJECT_SLUG}-[a-z0-9-]+\\.vercel\\.app$`
);

const corsOptions = {
  origin(origin, cb) {
    // allow server-to-server (no Origin)
    if (!origin) return cb(null, true);
    if (allowed.has(origin) || vercelPreviewPattern.test(origin))
      return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

/* ---------------- Parsers ---------------- */
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

/* ---------------- Health ---------------- */
app.get("/", (_, res) => res.status(200).json({ ok: true }));
app.get("/health", (_, res) => res.status(200).json({ ok: true }));

/* ---------------- Helpers ---------------- */
function getDecodedUser(req) {
  try {
    const bearer = req.headers.authorization || "";
    const token = bearer.startsWith("Bearer ")
      ? bearer.slice(7)
      : req.cookies?.token;
    if (!token) return null;
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

/* ---------------- Session / Me endpoints ---------------- */
/**
 * Returns the app user + the organizations they belong to in the global control plane,
 * plus the currently active organization (from cookie).
 */
app.get("/api/me", async (req, res) => {
  try {
    const decoded = getDecodedUser(req); // expects your JWT to contain { id, email, ... }
    let appUser = null;

    if (decoded?.id) {
      appUser = await prisma.user.findUnique({
        where: { id: Number(decoded.id) },
        select: { id: true, email: true, name: true },
      });
    }

    // Try to find the corresponding global user (by legacy_user_id, fallback by email)
    let gUser = null;
    if (appUser) {
      gUser =
        (await prismaGlobal.users.findFirst({
          where: { legacy_user_id: Number(appUser.id) },
          select: { id: true },
        })) ||
        (await prismaGlobal.users.findFirst({
          where: { email: appUser.email },
          select: { id: true },
        }));
    }

    const roles = gUser
      ? await prismaGlobal.userRoles.findMany({
          where: { user_id: gUser.id },
          include: {
            organizations: {
              select: { id: true, name: true, type: true },
            },
          },
          orderBy: { org_id: "asc" },
        })
      : [];

    res.json({
      user: appUser,
      orgs: roles.map((r) => ({
        org_id: r.org_id,
        name: r.organizations?.name || r.org_id,
        type: r.organizations?.type || null,
        role: r.role,
      })),
      active_org_id: req.cookies?.td_active_org || null,
    });
  } catch (e) {
    console.error("/api/me error:", e);
    res.status(500).json({ message: "me error" });
  }
});

/**
 * Sets active organization cookie after verifying the user is a member of that org.
 */
app.post("/api/session/set-org", async (req, res) => {
  try {
    const decoded = getDecodedUser(req);
    if (!decoded?.id) return res.status(401).json({ message: "Not logged in" });

    const { org_id } = req.body || {};
    if (!org_id) return res.status(400).json({ message: "org_id required" });

    // Resolve global user
    const appUser = await prisma.user.findUnique({
      where: { id: Number(decoded.id) },
      select: { id: true, email: true },
    });

    const gUser =
      (await prismaGlobal.users.findFirst({
        where: { legacy_user_id: Number(appUser?.id) },
        select: { id: true },
      })) ||
      (await prismaGlobal.users.findFirst({
        where: { email: appUser?.email || "" },
        select: { id: true },
      }));

    if (!gUser) return res.status(403).json({ message: "No global user" });

    // Ensure membership
    const membership = await prismaGlobal.userRoles.findFirst({
      where: { user_id: gUser.id, org_id },
      select: { user_id: true, org_id: true },
    });
    if (!membership)
      return res
        .status(403)
        .json({ message: "Not a member of this organization" });

    // Set cookie for the browser session
    res.cookie("td_active_org", org_id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      // you can add `domain` if you need cross-subdomain sharing
    });
    res.sendStatus(204);
  } catch (e) {
    console.error("set-org error:", e);
    res.status(500).json({ message: "set-org error" });
  }
});

/* ---------------- Feature routes ---------------- */
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/trips", tripsRouter);
app.use("/api/global", globalRoutes);
app.use("/api/global", globalRolesRoutes);
app.use("/api/bookings", bookingsRoutes);

// ✅ NEW: Microsoft 365 integration routes
app.use("/api/ms", msRoutes);
app.use("/api/auth", authMicrosoftRoutes);

/* ---------------- Error handler ---------------- */
app.use((err, req, res, next) => {
  console.error(err);
  res
    .status(err.status || 500)
    .json({ message: err.message || "Internal server error" });
});

/* ---------------- Boot ---------------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

/* ---------------- Graceful shutdown ---------------- */
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
