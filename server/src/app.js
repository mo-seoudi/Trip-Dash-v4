import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import tripRoutes from "./routes/trip.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { authMiddleware } from "./middlewares/authMiddleware.js";

const app = express();

// 🌟 Middlewares
app.use(express.json());

// ⚙️ Configure CORS
app.use(cors({
  origin: ["https://your-frontend.com"], // ⬅️ Replace with your real frontend URL
  credentials: true,
}));

// ⚔️ Rate limiter
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                 // limit each IP to 100 requests per windowMs
}));

// 🛡️ Global authentication (optional, currently disabled)
// app.use(authMiddleware);

// 🚍 Routes
app.use("/api/trips", tripRoutes);
app.use("/api/settings", settingsRoutes);

// 💥 Error handler (must be last)
app.get("/api/hello", (req, res) => {
  res.json({ message: "✅ Server is working fine!" });
});

app.use(errorHandler);

export default app;
