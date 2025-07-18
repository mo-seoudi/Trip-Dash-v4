import express from "express";
import { createTenant, listTenants, getTenantById, updateTenant } from "../services/tenantService.js";
const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const tenant = await createTenant(req.body);
    res.status(201).json(tenant);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const tenants = await listTenants();
    res.status(200).json(tenants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const tenant = await getTenantById(req.params.id);
    res.status(200).json(tenant);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const updated = await updateTenant(req.params.id, req.body);
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;