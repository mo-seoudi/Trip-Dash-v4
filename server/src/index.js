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

// MS365 routes
import msRoutes from "./routes/ms.js";
import authMicrosoftRoutes from "./routes/authMicrosoft.js";

// Passengers subrouter (mounted under /api/trips)
import tripsPassengersRouter from "./routes/trips/trips.passengers.js";

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const prismaGlobal = new PrismaGlobal();

// Render/other hosts are behind proxies; needed for secure cookies
app.set("trust proxy", 1);

/* ---------------- CORS (hosting-agnostic) ----------------
   Configure via env:
     ALLOWED_ORIGINS="https://your-app.com, http://localhost:5173"
     PREVIEW_ORIGIN_REGEX="^https:\\/\\/.*\\.vercel\\.app$"   (optional)
---------------------------------------------------------------- */
const DEV_DEFAULT = "http://localhost:5173";
const PROD_DEFAULT = ""; // no default in prod; rely on env when possible

const rawOrigins =
  (process.env.ALLOWED_ORIGINS && process.env.ALLOWED_ORIGINS.trim()) ||
  (process.env.NODE_ENV === "production" ? PROD_DEFAULT : DEV_DEFAULT);

const normalize = (s) => (s?.startsWith("http") ? s : s ? `https://${s}` : s);
const allowList = rawOrigins
  .split(",")
  .map((s) => normalize(s.trim()))
  .filter(Boolean);

let previewRe = null;
if (process.env.PREVIEW_ORIGIN_REGEX) {
  try {
    previewRe = new RegExp(process.env.PREVIEW_ORIGIN_REGEX);
  } catch {
    // ignore bad regex
  }
}

const corsOptions = {
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  origin(origin, cb) {
    // allow server-to-server (no Origin) like health checks, SSR, curl
    if (!origin) return cb(null, true);
    const ok =
      allowList.includes(origin) || (previewRe ? previewRe.test(origin) : false);
    return cb(null, ok);
  },
};

// set credential header early (for some proxies)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Credentials", "true");
  next();
});
app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // preflight

/* ---------------- Parsers ---------------- */
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
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
app.get("/api/me", async (req, res) => {
  try {
    const decoded = getDecodedUser(req); // expects JWT to contain { id, email, ... }
    let appUser = null;

    if (decoded?.id) {
      appUser = await prisma.user.findUnique({
        where: { id: Number(decoded.id) },
        select: { id: true, email: true, name: true },
      });
    }

    // Find corresponding global user (by legacy_user_id, fallback by email)
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
          include: { organizations: { select: { id: true, name: true, type: true } } },
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
 * Cross-site cookie => SameSite=None; Secure
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
      return res.status(403).json({ message: "Not a member of this organization" });

    // Cross-site cookie for different frontend domain
    res.cookie("td_active_org", org_id, {
      httpOnly: true,
      sameSite: "none",
      secure: true, // required with SameSite=None
      path: "/",
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

// Trips + passengers
app.use("/api/trips", tripsRouter);
app.use("/api/trips", tripsPassengersRouter);

// Global
app.use("/api/global", globalRoutes);
app.use("/api/global", globalRolesRoutes);

// Bookings
app.use("/api/bookings", bookingsRoutes);

// Microsoft 365 integration
app.use("/api/ms", msRoutes);
app.use("/api/auth", authMicrosoftRoutes);

/* ---------------- Error handler ---------------- */
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || "Internal server error" });
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
