import express from "express";
import { authMiddleware, requirePermission } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/invoices", authMiddleware, requirePermission("VIEW_FINANCE"), async (req, res) => {
  // Load invoices for school or org
});

router.post("/invoices", authMiddleware, requirePermission("EDIT_FINANCE"), async (req, res) => {
  // Create new invoice
});

export default router;
