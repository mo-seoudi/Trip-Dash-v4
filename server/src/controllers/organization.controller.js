import express from "express";
import { createOrganization, listOrganizations } from "../services/organizationService.js";
const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const tenantConfig = req.tenantConfig;
    const org = await createOrganization(tenantConfig, req.body);
    res.status(201).json(org);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const tenantConfig = req.tenantConfig;
    const orgs = await listOrganizations(tenantConfig);
    res.status(200).json(orgs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;