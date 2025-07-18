import express from "express";
import partnershipController from "../controllers/partnership.controller.js";

const router = express.Router();
router.use("/", partnershipController);
export default router;