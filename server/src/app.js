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

// import { authMiddleware } from "./middlewares/authMiddleware.js"; // Uncomment if needed

const app = express();

// 🌟 Middlewares
app.use(express.json());
app.use(requestIdMiddleware);
app.use(requestLogger);

app.use(
  cors({
    origin: [
      "http://localhost:5000", // local dev
      "https://your-frontend.com", // production domain
    ],
    credentials: true,
  })
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
  })
);

// 🛡️ Global authentication (optional)
// app.use(authMiddleware); // Uncomment to protect everything globally

// 🚍 Routes
app.use("/api/trips", tripRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/tenants", tenantRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/partnerships", partnershipRoutes);
app.use("/api/users", userRoutes);
app.use("/api", authRoutes);

// ✅ Simple health check
app.get("/api/hello", (req, res) => {
  res.json({ message: "✅ Server is working fine!" });
});

// 💥 Error handler
app.use(errorHandler);

export default app;
