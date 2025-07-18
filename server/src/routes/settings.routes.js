import express from "express";
import { getSettingsRepository } from "../services/repositoryResolver.js";
import { authMiddleware, requirePermission } from "../middlewares/authMiddleware.js";
import { getTenantConfig } from "../services/tenantService.js";

const router = express.Router();

router.get("/:orgId", authMiddleware, requirePermission("VIEW_SETTINGS"), async (req, res) => {
  try {
    const tenant = await getTenantConfig(req.user.tenantId);
    const settingsRepository = getSettingsRepository(tenant);

    const orgId = req.params.orgId;
    const settings = await settingsRepository.getSettingsByOrganization(orgId);
    res.json(settings);
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({ message: "Failed to fetch settings" });
  }
});

router.put("/:orgId", authMiddleware, requirePermission("EDIT_SETTINGS"), async (req, res) => {
  try {
    const tenant = await getTenantConfig(req.user.tenantId);
    const settingsRepository = getSettingsRepository(tenant);

    const orgId = req.params.orgId;
    const updated = await settingsRepository.updateSettings(orgId, req.body);
    res.json(updated);
  } catch (error) {
    console.error("Error updating settings:", error);
    res.status(500).json({ message: "Failed to update settings" });
  }
});

export default router;
