// server/src/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { PrismaClient } from "@prisma/client";

import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import tripRoutes from "./routes/tripRoutes.js";

dotenv.config();

const app = express();
const prisma = new PrismaClient();

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
  if (allowedOrigins.includes(origin)) return true;          // explicit allow-list
  if (vercelPreviewPattern.test(origin)) return true;        // any preview for this project
  return false;
}

const corsOptions = {
  origin(origin, cb) {
    // allow server-to-server (curl/Postman) with no Origin header
    if (!origin) return cb(null, true);
    if (isAllowedOrigin(origin)) return cb(null, true);
    console.warn("Blocked by CORS:", origin);
    // respond as not allowed (no CORS headers). Returning false tells cors to reject.
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

// Health checks
app.get("/", (_, res) => res.status(200).json({ ok: true }));
app.get("/health", (_, res) => res.status(200).json({ ok: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/trips", tripRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 5000; // Render will set this (often 10000)
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

// Graceful shutdown for Prisma
async function shutdown() {
  try {
    await prisma.$disconnect();
  } finally {
    process.exit(0);
  }
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
