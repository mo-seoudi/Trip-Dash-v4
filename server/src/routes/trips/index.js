// server/src/routes/trips/index.js

import { Router } from "express";
import core from "./trips.core.js";
import subtrips from "./trips.subtrips.js";
import passengers from "./trips.passengers.js";

const router = Router();
router.use("/", core);          // /api/trips, /api/trips/:id
router.use("/", subtrips);      // /api/trips/:id/subtrips
router.use("/", passengers);    // /api/trips/:id/passengers
export default router;
