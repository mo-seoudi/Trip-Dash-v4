import express from "express";
import { createPartnership, assignBusOfficer, listPartnerships } from "../services/partnershipService.js";
const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const tenantConfig = req.tenantConfig;
    const partnership = await createPartnership(tenantConfig, req.body);
    res.status(201).json(partnership);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/assign-bus-officer", async (req, res) => {
  try {
    const { officerId, orgIds, companyName, notes } = req.body;
    const tenantConfig = req.tenantConfig;
    await assignBusOfficer(tenantConfig, officerId, orgIds, companyName, notes);
    res.status(200).json({ message: "Bus officer assigned successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const tenantConfig = req.tenantConfig;
    const partnerships = await listPartnerships(tenantConfig);
    res.status(200).json(partnerships);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;