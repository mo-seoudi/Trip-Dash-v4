import express from "express";
import {
  createTrip,
  updateStatus,
  getTrips,
} from "../controllers/trip.controller.js";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validateMiddleware.js";
import { createTripSchema, updateStatusSchema } from "../validations/tripValidation.js";

const router = express.Router();

// 🟢 Create new trip
router.post(
  "/",
  authMiddleware,
  requireRole("school_staff", "admin"),
  validate(createTripSchema),
  createTrip
);

// 🟢 Update trip status
router.patch(
  "/:id/status",
  authMiddleware,
  requireRole("bus_company", "admin"),
  validate(updateStatusSchema),
  updateStatus
);

// 🟢 Get all trips (NEW)
router.get(
  "/",
  authMiddleware,
  requireRole("school_staff", "admin", "bus_company"), // adjust roles as needed
  getTrips
);

export default router;
