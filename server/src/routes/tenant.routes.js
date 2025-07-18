import express from "express";
import tenantController from "../controllers/tenant.controller.js";

const router = express.Router();
router.use("/", tenantController);
export default router;