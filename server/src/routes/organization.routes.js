import express from "express";
import organizationController from "../controllers/organization.controller.js";

const router = express.Router();
router.use("/", organizationController);
export default router;