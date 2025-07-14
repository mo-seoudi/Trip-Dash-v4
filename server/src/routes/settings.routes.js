import express from "express";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware.js";
import * as settingsRepo from "../repositories/settingsRepository.js";

const router = express.Router();

// Get current settings
router.get("/", authMiddleware, requireRole("admin"), async (req, res, next) => {
  try {
    const settings = await settingsRepo.getSettingsByOrganization(req.user.organizationId);
    res.status(200).json(settings);
  } catch (err) {
    next(err);
  }
});

// Update settings
router.put("/", authMiddleware, requireRole("admin"), async (req, res, next) => {
  try {
    const updated = await settingsRepo.updateSettings(req.user.organizationId, req.body);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
