// server/src/app.js
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import tripRoutes from "./routes/trip.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import authRoutes from "./routes/auth.js";
import tenantRoutes from "./routes/tenant.routes.js";
import organizationRoutes from "./routes/organization.routes.js";
import partnershipRoutes from "./routes/partnership.routes.js";
import userRoutes from "./routes/user.routes.js";

import { errorHandler } from "./middlewares/errorHandler.js";
import { requestLogger } from "./middlewares/requestLogger.js";
import { requestIdMiddleware } from "./middlewares/requestIdMiddleware.js";

// import { authMiddleware } from "./middlewares/authMiddleware.js";

const app = express();

// 🔧 Core middleware
app.use(express.json());
app.use(requestIdMiddleware);
app.use(requestLogger);

// 🌍 CORS from env (no hardcoded URLs)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map(o => o.trim());

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

// 🛡 Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
}));

// app.use(authMiddleware); // Optional global protection

// 🚍 Routes
app.use("/api/trips", tripRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/tenants", tenantRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/partnerships", partnershipRoutes);
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);

// ✅ Health check
app.get("/api/hello", (req, res) => {
  res.json({ message: "✅ Server is working fine!" });
});

// 💥 Central error handler
app.use(errorHandler);

export default app;
