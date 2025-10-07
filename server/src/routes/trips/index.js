// server/src/routes/trips/index.js

import express from "express";
import {
  requestCancelTrip,
  requestEditTrip,
  respondCancelTrip,
  applyEditTrip,
} from "./trips.core.js";

const router = express.Router();

// 🧩 New routes (non-breaking; keep your existing ones)
router.post("/:id/request-cancel", requestCancelTrip);
router.post("/:id/request-edit", requestEditTrip);
router.patch("/:id/respond-cancel", respondCancelTrip); // approve/decline cancel request
router.patch("/:id/apply-edit", applyEditTrip);         // apply requested changes

export default router;
