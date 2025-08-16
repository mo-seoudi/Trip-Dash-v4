// server/src/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { PrismaClient } from "@prisma/client";

import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import tripsRouter from "./routes/trips/index.js";
import globalRoutes from "./routes/globalRoutes.js";


dotenv.config();

const app = express();
const prisma = new PrismaClient();

// Render is behind a proxy; needed for secure cookies
app.set("trust proxy", 1);

/* ---------------- CORS (simple + safe) ---------------- */
const fallbackProd = "https://trip-dash-v4.vercel.app";
const fallbackDev = "http://localhost:5173";

const base = process.env.NODE_ENV === "production" ? fallbackProd : fallbackDev;
const explicit = (process.env.ALLOWED_ORIGINS || base)
  .split(",")
  .map(s => s.trim())
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
    if (allowed.has(origin) || vercelPreviewPattern.test(origin)) return cb(null, true);
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

/* ---------------- Routes ---------------- */
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/trips", tripsRouter);
app.use("/api/global", globalRoutes);

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
  } finally {
    process.exit(0);
  }
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
