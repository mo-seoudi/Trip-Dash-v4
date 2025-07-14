import express from "express";
import { createTrip, updateStatus } from "../controllers/trip.controller.js";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validateMiddleware.js";
import { createTripSchema, updateStatusSchema } from "../validations/tripValidation.js";

const router = express.Router();

router.post(
  "/",
  authMiddleware,
  requireRole("school_staff", "admin"),
  validate(createTripSchema),
  createTrip
);

router.patch(
  "/:id/status",
  authMiddleware,
  requireRole("bus_company", "admin"),
  validate(updateStatusSchema),
  updateStatus
);

export default router;
