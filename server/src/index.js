// server/src/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

import { prisma } from "./lib/prisma.js";
import { prismaGlobal } from "./lib/prismaGlobal.js";
import { requireAuth } from "./middleware/auth.js";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import tripsRouter from "./routes/trips/index.js";
import globalRoutes from "./routes/globalRoutes.js";
import globalRolesRoutes from "./routes/globalRolesRoutes.js";
import bookingsRoutes from "./routes/bookingsRoutes.js";
import msRoutes from "./routes/ms.js";
import authMicrosoftRoutes from "./routes/authMicrosoft.js";
import accessRoutes from "./routes/accessRoutes.js";
import accessAdminRoutes from "./routes/accessAdminRoutes.js";

dotenv.config();

const app = express();
app.set("trust proxy", 1);

const DEV_DEFAULT = "http://localhost:5173";
const rawOrigins =
  (process.env.ALLOWED_ORIGINS && process.env.ALLOWED_ORIGINS.trim()) ||
  (process.env.NODE_ENV === "production" ? "" : DEV_DEFAULT);

const normalize = (s) => (s?.startsWith("http") ? s : s ? `https://${s}` : s);
const allowList = rawOrigins.split(",").map((s) => normalize(s.trim())).filter(Boolean);
const regexList = (process.env.ALLOWED_ORIGIN_REGEXES || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((pattern) => {
    try { return new RegExp(pattern); } catch { return null; }
  })
  .filter(Boolean);

const corsOptions = {
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    return cb(null, allowList.includes(origin) || regexList.some((re) => re.test(origin)));
  },
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

app.get("/", (_, res) => res.status(200).json({ ok: true }));
app.get("/health", (_, res) => res.status(200).json({ ok: true }));

// Legacy global-context endpoint retained during migration. New application UI
// should use /api/access/me instead.
app.get("/api/me", requireAuth, async (req, res, next) => {
  try {
    const appUser = req.user;
    const gUser =
      (await prismaGlobal.user.findFirst({
        where: { legacyUserId: Number(appUser.id) },
        select: { id: true },
      })) ||
      (await prismaGlobal.user.findFirst({
        where: { email: appUser.email },
        select: { id: true },
      }));

    const roles = gUser
      ? await prismaGlobal.userOrgMembership.findMany({
          where: { userId: gUser.id },
          include: { org: { select: { id: true, name: true, type: true } } },
          orderBy: { orgId: "asc" },
        })
      : [];

    return res.json({
      user: { id: appUser.id, email: appUser.email, name: appUser.name, role: appUser.role },
      orgs: roles.map((r) => ({
        org_id: r.orgId,
        name: r.org?.name || r.orgId,
        type: r.org?.type || null,
        role: r.role === "bus_company" ? "bus_operator" : r.role,
      })),
      active_org_id: req.cookies?.td_active_org || null,
    });
  } catch (e) {
    return next(e);
  }
});

app.post("/api/session/set-org", requireAuth, async (req, res, next) => {
  try {
    const { org_id } = req.body || {};
    if (!org_id || typeof org_id !== "string" || org_id.length > 100) {
      return res.status(400).json({ message: "valid org_id required" });
    }

    const gUser =
      (await prismaGlobal.user.findFirst({
        where: { legacyUserId: Number(req.user.id) },
        select: { id: true },
      })) ||
      (await prismaGlobal.user.findFirst({
        where: { email: req.user.email },
        select: { id: true },
      }));

    if (!gUser) return res.status(403).json({ message: "No global user" });

    const membership = await prismaGlobal.userOrgMembership.findFirst({
      where: { userId: gUser.id, orgId: org_id },
      select: { userId: true, orgId: true, status: true },
    });
    if (!membership || !["active", "approved"].includes(String(membership.status).toLowerCase())) {
      return res.status(403).json({ message: "No active membership in this organization" });
    }

    const isProd = process.env.NODE_ENV === "production";
    res.cookie("td_active_org", org_id, {
      httpOnly: true,
      sameSite: isProd ? "none" : "lax",
      secure: isProd,
      path: "/",
    });
    return res.sendStatus(204);
  } catch (e) {
    return next(e);
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/access", accessRoutes);
app.use("/api/access-admin", accessAdminRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/trips", tripsRouter);
app.use("/api/global", globalRoutes);
app.use("/api/global", globalRolesRoutes);
app.use("/api/bookings", bookingsRoutes);
app.use("/api/ms", msRoutes);
app.use("/api/auth", authMicrosoftRoutes);

app.use((req, res) => res.status(404).json({ message: "Route not found" }));

app.use((err, req, res, next) => {
  console.error(err);
  const status = Number.isInteger(err?.status) ? err.status : 500;
  return res.status(status).json({
    message: status >= 500 ? "Internal server error" : err.message || "Request failed",
  });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received; shutting down`);

  server.close(async () => {
    try {
      await prisma.$disconnect();
      await prismaGlobal.$disconnect();
      process.exit(0);
    } catch (error) {
      console.error("Shutdown failed:", error);
      process.exit(1);
    }
  });

  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));